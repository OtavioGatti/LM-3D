import { Router } from "express";
import { ORDER_STATUSES, PRODUCT_STATUSES } from "@lm-3d/shared";

export const systemRouter = Router();

systemRouter.get("/", (_req, res) => {
  res.json({
    name: "LM-3D API",
    phase: "base-structure",
    publicRoutes: ["/api/health", "/api/system"],
    futureAdminRoutes: ["/api/admin/products", "/api/admin/categories", "/api/admin/orders"],
    productStatuses: PRODUCT_STATUSES,
    orderStatuses: ORDER_STATUSES
  });
});
