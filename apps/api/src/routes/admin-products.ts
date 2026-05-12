import { PRODUCT_STATUSES } from "@lm-3d/shared";
import { Router } from "express";
import { z } from "zod";
import { toSlug } from "../lib/slug.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const productPayloadSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  short_description: z.string().trim().min(2),
  description: z.string().trim().min(2),
  price_cents: z.coerce.number().int().min(0),
  status: z.enum(PRODUCT_STATUSES).default("draft"),
  material: z.string().trim().optional().default("PLA"),
  weight_grams: z.coerce.number().int().min(0).optional().nullable(),
  dimensions: z.string().trim().optional().nullable(),
  package_width_cm: z.coerce.number().positive().optional().nullable(),
  package_height_cm: z.coerce.number().positive().optional().nullable(),
  package_length_cm: z.coerce.number().positive().optional().nullable(),
  production_time_days_min: z.coerce.number().int().min(0).default(1),
  production_time_days_max: z.coerce.number().int().min(0).default(3),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  accepts_customization: z.boolean().default(false),
  customization_prompt: z.string().trim().optional().nullable(),
  metadata: z
    .object({
      color_options: z.array(z.string().trim().min(1)).default([])
    })
    .default({ color_options: [] }),
  category_ids: z.array(z.string().uuid()).default([]),
  image_urls: z.array(z.string().trim().min(1)).default([])
});

const productUpdateSchema = productPayloadSchema.partial();

export const adminProductsRouter = Router();

function isMissingPackageColumn(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  return /package_(width|height|length)_cm/.test(String(error.message));
}

function stripPackageColumns<T extends Record<string, unknown>>(payload: T) {
  const stripped = { ...payload };

  delete stripped.package_width_cm;
  delete stripped.package_height_cm;
  delete stripped.package_length_cm;

  return stripped;
}

async function insertProduct(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").insert(payload).select("*").single();

  if (!error) {
    return data;
  }

  if (!isMissingPackageColumn(error)) {
    throw error;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("products")
    .insert(stripPackageColumns(payload))
    .select("*")
    .single();

  if (fallbackError) {
    throw fallbackError;
  }

  return fallbackData;
}

async function updateProduct(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (!error) {
    return data;
  }

  if (!isMissingPackageColumn(error)) {
    throw error;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("products")
    .update(stripPackageColumns(payload))
    .eq("id", id)
    .select("*")
    .single();

  if (fallbackError) {
    throw fallbackError;
  }

  return fallbackData;
}

adminProductsRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("products")
      .select(
        `
        *,
        product_images (*),
        product_categories (
          category:categories (*)
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ products: data });
  } catch (error) {
    next(error);
  }
});

adminProductsRouter.post("/", async (req, res, next) => {
  try {
    const payload = productPayloadSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();
    const { category_ids: categoryIds, image_urls: imageUrls, ...productPayload } = payload;

    const product = await insertProduct({
      ...productPayload,
      slug: toSlug(payload.slug ?? payload.name)
    });

    if (categoryIds.length > 0) {
      const { error: categoryError } = await supabase.from("product_categories").insert(
        categoryIds.map((categoryId) => ({
          product_id: product.id,
          category_id: categoryId
        }))
      );

      if (categoryError) {
        throw categoryError;
      }
    }

    if (imageUrls.length > 0) {
      const { error: imageError } = await supabase.from("product_images").insert(
        imageUrls.map((url, index) => ({
          product_id: product.id,
          public_url: url,
          alt: product.name,
          sort_order: index + 1
        }))
      );

      if (imageError) {
        throw imageError;
      }
    }

    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
});

adminProductsRouter.patch("/:id", async (req, res, next) => {
  try {
    const payload = productUpdateSchema.parse(req.body);
    const shouldSyncImages = Object.prototype.hasOwnProperty.call(req.body, "image_urls");
    const supabase = getSupabaseAdminClient();
    const { category_ids: categoryIds, image_urls: imageUrls, ...productPayload } = payload;
    const updatePayload = {
      ...productPayload,
      ...(payload.slug ? { slug: toSlug(payload.slug) } : {})
    };

    const product = await updateProduct(req.params.id, updatePayload);

    if (categoryIds) {
      await supabase.from("product_categories").delete().eq("product_id", req.params.id);

      if (categoryIds.length > 0) {
        const { error: categoryError } = await supabase.from("product_categories").insert(
          categoryIds.map((categoryId) => ({
            product_id: req.params.id,
            category_id: categoryId
          }))
        );

        if (categoryError) {
          throw categoryError;
        }
      }
    }

    if (shouldSyncImages && imageUrls) {
      await supabase.from("product_images").delete().eq("product_id", req.params.id);

      if (imageUrls.length > 0) {
        const { error: imageError } = await supabase.from("product_images").insert(
          imageUrls.map((url, index) => ({
            product_id: req.params.id,
            public_url: url,
            alt: product.name,
            sort_order: index + 1
          }))
        );

        if (imageError) {
          throw imageError;
        }
      }
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
});

adminProductsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("products")
      .update({ status: "archived" })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    res.json({ product: data });
  } catch (error) {
    next(error);
  }
});
