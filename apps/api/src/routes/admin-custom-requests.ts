import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const CUSTOM_REQUEST_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "converted",
  "closed",
  "canceled"
] as const;

const customRequestUpdateSchema = z.object({
  status: z.enum(CUSTOM_REQUEST_STATUSES).optional(),
  estimated_price_cents: z.coerce.number().int().min(0).optional().nullable(),
  quote_message: z.string().trim().max(1200).optional().nullable(),
  quoted_deadline: z.string().trim().max(160).optional().nullable(),
  quoted_weight_grams: z.coerce.number().int().positive().optional().nullable(),
  quoted_package_width_cm: z.coerce.number().positive().optional().nullable(),
  quoted_package_height_cm: z.coerce.number().positive().optional().nullable(),
  quoted_package_length_cm: z.coerce.number().positive().optional().nullable(),
  admin_notes: z.string().trim().optional().nullable()
});

export const adminCustomRequestsRouter = Router();

adminCustomRequestsRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("custom_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ requests: data });
  } catch (error) {
    next(error);
  }
});

adminCustomRequestsRouter.patch("/:id", async (req, res, next) => {
  try {
    const payload = customRequestUpdateSchema.parse(req.body);

    const { data, error } = await getSupabaseAdminClient()
      .from("custom_requests")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    res.json({ request: data });
  } catch (error) {
    next(error);
  }
});
