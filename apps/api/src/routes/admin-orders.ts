import { ORDER_STATUSES, PAYMENT_STATUSES } from "@lm-3d/shared";
import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const orderUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  payment_status: z.enum(PAYMENT_STATUSES).optional(),
  admin_notes: z.string().trim().optional().nullable(),
  tracking_code: z.string().trim().optional().nullable(),
  delivery_method: z.string().trim().optional().nullable()
});

export const adminOrdersRouter = Router();

adminOrdersRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("orders")
      .select(
        `
        *,
        order_items (*),
        payments (*),
        discount_coupon_redemptions (
          *,
          discount_coupons (
            code,
            name
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ orders: data });
  } catch (error) {
    next(error);
  }
});

adminOrdersRouter.patch("/:id", async (req, res, next) => {
  try {
    const payload = orderUpdateSchema.parse(req.body);

    const { data, error } = await getSupabaseAdminClient()
      .from("orders")
      .update(payload)
      .eq("id", req.params.id)
      .select(
        `
        *,
        order_items (*),
        payments (*),
        discount_coupon_redemptions (
          *,
          discount_coupons (
            code,
            name
          )
        )
      `
      )
      .single();

    if (error) {
      throw error;
    }

    res.json({ order: data });
  } catch (error) {
    next(error);
  }
});
