import { Router } from "express";
import { z } from "zod";
import type { AdminProfile } from "../middleware/admin-auth.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const presetSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    filament_kg_cost_cents: z.coerce.number().int().min(0),
    kwh_cost_cents: z.coerce.number().int().min(0),
    printer_power_watts: z.coerce.number().int().min(0),
    marketplace_fee_percent: z.coerce.number().min(0).max(99),
    desired_margin_percent: z.coerce.number().min(0).max(99),
    packaging_cost_cents: z.coerce.number().int().min(0),
    labor_cost_cents: z.coerce.number().int().min(0),
    is_default: z.boolean().default(false)
  })
  .refine((payload) => payload.marketplace_fee_percent + payload.desired_margin_percent < 100, {
    message: "A soma da taxa de pagamento e da margem precisa ser menor que 100%.",
    path: ["desired_margin_percent"]
  });

const calculationSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  input: z.record(z.unknown()),
  filament_cost_cents: z.coerce.number().int().min(0),
  energy_cost_cents: z.coerce.number().int().min(0),
  operational_cost_cents: z.coerce.number().int().min(0),
  suggested_price_cents: z.coerce.number().int().min(1),
  minimum_price_cents: z.coerce.number().int().min(0),
  estimated_profit_cents: z.coerce.number().int()
});

export const adminPriceRouter = Router();

adminPriceRouter.get("/presets", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("price_calculation_presets")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ presets: data });
  } catch (error) {
    next(error);
  }
});

adminPriceRouter.post("/presets", async (req, res, next) => {
  try {
    const payload = presetSchema.parse(req.body);
    const profile = res.locals.adminProfile as AdminProfile;
    const supabase = getSupabaseAdminClient();

    if (payload.is_default) {
      await supabase
        .from("price_calculation_presets")
        .update({ is_default: false })
        .eq("owner_id", profile.id);
    }

    const { data, error } = await supabase
      .from("price_calculation_presets")
      .insert({ ...payload, owner_id: profile.id })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ preset: data });
  } catch (error) {
    next(error);
  }
});

adminPriceRouter.get("/calculations", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("price_calculations")
      .select("*, product:products (id, name)")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;
    res.json({ calculations: data });
  } catch (error) {
    next(error);
  }
});

adminPriceRouter.post("/calculations", async (req, res, next) => {
  try {
    const payload = calculationSchema.parse(req.body);
    const profile = res.locals.adminProfile as AdminProfile;
    const { data, error } = await getSupabaseAdminClient()
      .from("price_calculations")
      .insert({ ...payload, created_by: profile.id })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ calculation: data });
  } catch (error) {
    next(error);
  }
});
