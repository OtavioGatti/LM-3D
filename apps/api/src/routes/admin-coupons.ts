import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const couponPayloadSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().int().min(1),
  min_order_cents: z.coerce.number().int().min(0).default(0),
  max_redemptions: z.coerce.number().int().min(1).optional().nullable(),
  is_active: z.boolean().default(true),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable()
});

const couponUpdateSchema = couponPayloadSchema.partial();

export const adminCouponsRouter = Router();

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

adminCouponsRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("discount_coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ coupons: data });
  } catch (error) {
    next(error);
  }
});

adminCouponsRouter.post("/", async (req, res, next) => {
  try {
    const payload = couponPayloadSchema.parse(req.body);
    const { data, error } = await getSupabaseAdminClient()
      .from("discount_coupons")
      .insert({
        ...payload,
        code: normalizeCode(payload.code)
      })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ coupon: data });
  } catch (error) {
    next(error);
  }
});

adminCouponsRouter.patch("/:id", async (req, res, next) => {
  try {
    const payload = couponUpdateSchema.parse(req.body);
    const { data, error } = await getSupabaseAdminClient()
      .from("discount_coupons")
      .update({
        ...payload,
        ...(payload.code ? { code: normalizeCode(payload.code) } : {})
      })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ coupon: data });
  } catch (error) {
    next(error);
  }
});
