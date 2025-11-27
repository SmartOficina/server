import express from "express";
import cors from "cors";
import clientsRoutes from "./modules/clients/routes";
import vehiclesRoutes from "./modules/vehicles/routes";
import serviceOrdersRoutes from "./modules/service-orders/routes";
import garageRoutes from "./modules/garage/routes";
import plansRoutes from "./modules/plans/routes";
import paymentRoutes from "./modules/payment/routes";
import scheduleRoutes from "./modules/schedule/routes";
import authRoutes from "./modules/auth/routes";
import logger from "./logger";
import requestLogger from "./core/middleware/services/request-logger";
import heartbeatRoutes from "./modules/heartbeat/routes";
import { activityTrackingMiddleware } from "./core/middleware/activity-tracking-middleware";
import webhookRoutes from "./modules/webhook/routes";
import cardRoutes from "./modules/credit-card/routes";
import settingsRoutes from "./modules/settings/routes";
import partsRoutes from "./modules/inventory/parts/routes";
import suppliersRoutes from "./modules/inventory/suppliers/routes";
import inventoryEntriesRoutes from "./modules/inventory/entries/routes";
import servicesRoutes from "./modules/services/routes";
import couponRoutes from "./modules/coupon/routes";
import statisticsRoutes from "./modules/statistics/routes";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(requestLogger);

app.use(
  cors({
    origin: ["http://localhost:4200", "http://localhost:4300", "https://www.smartoficina.com.br", "http://127.0.0.1:4200"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "asaas-webhook-token"],
  })
);

app.use("/api/webhook", webhookRoutes);

app.use("/api/auth", authRoutes);
app.use(activityTrackingMiddleware);
app.use("/api/clients", clientsRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/service-orders", serviceOrdersRoutes);
app.use("/api/garage", garageRoutes);
app.use("/api/plans", plansRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/heartbeat", heartbeatRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/inventory-entries", inventoryEntriesRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/statistics", statisticsRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ error: err.message }, `Erro na rota ${req.originalUrl}`);
  res.status(500).send("Algo deu errado!");
});

export default app;
