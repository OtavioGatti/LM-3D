import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "lm-3d-api",
    timestamp: new Date().toISOString()
  });
});
