import { Router } from "express";
import { env } from "../config/env.js";
import { hasSupabaseAdminConfig } from "../lib/supabase.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "lm-3d-api",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    dependencies: {
      supabase: hasSupabaseAdminConfig() ? "configured" : "missing",
      mercadoPago: env.MERCADO_PAGO_ACCESS_TOKEN ? "configured" : "pending"
    }
  });
});
