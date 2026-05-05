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
  production_time_days_min: z.coerce.number().int().min(0).default(1),
  production_time_days_max: z.coerce.number().int().min(0).default(3),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  accepts_customization: z.boolean().default(false),
  customization_prompt: z.string().trim().optional().nullable(),
  color_options: z.array(z.string().trim().min(1)).default([]),
  category_ids: z.array(z.string().uuid()).default([]),
  image_urls: z.array(z.string().trim().min(1)).default([])
});

const productUpdateSchema = productPayloadSchema.partial();

export const adminProductsRouter = Router();

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

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        ...productPayload,
        slug: toSlug(payload.slug ?? payload.name)
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

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
          alt_text: product.name,
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
    const supabase = getSupabaseAdminClient();
    const { category_ids: categoryIds, image_urls: imageUrls, ...productPayload } = payload;
    const updatePayload = {
      ...productPayload,
      ...(payload.slug ? { slug: toSlug(payload.slug) } : {})
    };

    const { data: product, error } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

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

    if (imageUrls) {
      await supabase.from("product_images").delete().eq("product_id", req.params.id);

      if (imageUrls.length > 0) {
        const { error: imageError } = await supabase.from("product_images").insert(
          imageUrls.map((url, index) => ({
            product_id: req.params.id,
            public_url: url,
            alt_text: product.name,
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
