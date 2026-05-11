import { Router } from "express";
import { adminRouter } from "./admin.js";
import { customRequestsRouter } from "./custom-requests.js";
import { healthRouter } from "./health.js";
import { mercadoPagoWebhooksRouter } from "./mercado-pago-webhooks.js";
import { ordersRouter } from "./orders.js";
import { systemRouter } from "./system.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/system", systemRouter);
apiRouter.use("/custom-requests", customRequestsRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/webhooks", mercadoPagoWebhooksRouter);
apiRouter.use("/admin", adminRouter);
