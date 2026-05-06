import { Router } from "express";
import { adminRouter } from "./admin.js";
import { healthRouter } from "./health.js";
import { ordersRouter } from "./orders.js";
import { systemRouter } from "./system.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/system", systemRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/admin", adminRouter);
