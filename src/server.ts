import app from "./app";
import connectDB from "./config/database";
import { initOnlineStatusCron } from "./job/online-status";
import { initSubscriptionCron } from "./job/subscription";
import logger from "./logger";
import fs from "fs";
import path from "path";
const PORT = 3000;

try {
  const logsDir = path.resolve("./logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  logger.info("🔧 Inicializando servidor...");

  connectDB()
    .then(() => {
      initSubscriptionCron();
      initOnlineStatusCron();
      app.listen(PORT, "0.0.0.0", () => {
        try {
          logger.info(`🚀 Servidor rodando na porta ${PORT} em todas as interfaces de rede`);
        } catch (error: any) {}
      });
    })
    .catch((error) => {});
} catch (error) {}
