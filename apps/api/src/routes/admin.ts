import { Router } from "express";
import { requireAdmin, type AdminProfile } from "../middleware/admin-auth.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/me", (_req, res) => {
  const profile = res.locals.adminProfile as AdminProfile;

  res.json({
    profile
  });
});
