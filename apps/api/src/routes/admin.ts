import { Router } from "express";
import { requireAdmin, type AdminProfile } from "../middleware/admin-auth.js";
import { adminCategoriesRouter } from "./admin-categories.js";
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
adminRouter.use("/products", adminProductsRouter);
