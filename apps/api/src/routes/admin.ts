import { Router } from "express";
import { requireAdmin, type AdminProfile } from "../middleware/admin-auth.js";
import { adminCategoriesRouter } from "./admin-categories.js";
import { adminCouponsRouter } from "./admin-coupons.js";
import { adminCustomRequestsRouter } from "./admin-custom-requests.js";
import { adminOrdersRouter } from "./admin-orders.js";
import { adminPriceRouter } from "./admin-price.js";
import { adminProductsRouter } from "./admin-products.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/me", (_req, res) => {
  const profile = res.locals.adminProfile as AdminProfile;

  res.json({
    profile
  });
});

adminRouter.use("/categories", adminCategoriesRouter);
adminRouter.use("/coupons", adminCouponsRouter);
adminRouter.use("/custom-requests", adminCustomRequestsRouter);
adminRouter.use("/orders", adminOrdersRouter);
adminRouter.use("/price", adminPriceRouter);
adminRouter.use("/products", adminProductsRouter);
