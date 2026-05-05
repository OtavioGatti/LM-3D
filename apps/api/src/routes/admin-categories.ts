import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { toSlug } from "../lib/slug.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const categoryPayloadSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().default(""),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true)
});

const categoryUpdateSchema = categoryPayloadSchema.partial();

export const adminCategoriesRouter = Router();

adminCategoriesRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ categories: data });
  } catch (error) {
    next(error);
  }
});

adminCategoriesRouter.post("/", async (req, res, next) => {
  try {
    const payload = categoryPayloadSchema.parse(req.body);
    const slug = toSlug(payload.slug ?? payload.name);

    const { data, error } = await getSupabaseAdminClient()
      .from("categories")
      .insert({
        ...payload,
        slug
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ category: data });
  } catch (error) {
    next(error);
  }
});

adminCategoriesRouter.patch("/:id", async (req, res, next) => {
  try {
    const payload = categoryUpdateSchema.parse(req.body);
    const nextPayload = {
      ...payload,
      ...(payload.slug ? { slug: toSlug(payload.slug) } : {})
    };

    const { data, error } = await getSupabaseAdminClient()
      .from("categories")
      .update(nextPayload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    res.json({ category: data });
  } catch (error) {
    next(error);
  }
});

adminCategoriesRouter.delete("/:id", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdminClient();
    const { count, error: countError } = await supabase
      .from("product_categories")
      .select("product_id", { count: "exact", head: true })
      .eq("category_id", req.params.id);

    if (countError) {
      throw countError;
    }

    if (count && count > 0) {
      throw new HttpError(
        409,
        "CATEGORY_IN_USE",
        "Categoria vinculada a produtos. Desative ou remova os vinculos antes de apagar."
      );
    }

    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
