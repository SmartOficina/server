import pino from "pino";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const ensureLogDirectory = () => {
  const logsDir = path.resolve("./logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
};

const cleanOldLogs = () => {
  try {
    const logsDir = ensureLogDirectory();

    const logFiles = fs.readdirSync(logsDir).filter((file) => file.startsWith("logs-garage-") && file.endsWith(".log"));

    if (logFiles.length > 30) {
      logFiles.sort();

      for (let i = 0; i < logFiles.length - 30; i++) {
        fs.unlinkSync(path.join(logsDir, logFiles[i]));
      }
    }
  } catch (error) {
  }
};

ensureLogDirectory();
cleanOldLogs();

const today = new Date().toISOString().split("T")[0];
const logFilePath = path.join(ensureLogDirectory(), `logs-garage-${today}.log`);

const options = {
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  msgPrefix: `[${process.env.VERSION}] `,
  sync: true,
};

const createLogger = () => {
  const fileStream = pino.destination({
    dest: logFilePath,
    sync: true,
  });

  const fileLogger = pino(options, fileStream);

  const consoleLogger = pino({
    ...options,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:dd/mm/yyyy HH:MM:ss",
      },
    },
  });

  return {
    trace: function (msg: any, ...args: any[]): void {
      fileLogger.trace(msg, ...args);
      consoleLogger.trace(msg, ...args);
    },
    debug: function (msg: any, ...args: any[]): void {
      fileLogger.debug(msg, ...args);
      consoleLogger.debug(msg, ...args);
    },
    info: function (msg: any, ...args: any[]): void {
      fileLogger.info(msg, ...args);
      consoleLogger.info(msg, ...args);
    },
    warn: function (msg: any, ...args: any[]): void {
      fileLogger.warn(msg, ...args);
      consoleLogger.warn(msg, ...args);
    },
    error: function (msg: any, ...args: any[]): void {
      fileLogger.error(msg, ...args);
      consoleLogger.error(msg, ...args);
    },
    fatal: function (msg: any, ...args: any[]): void {
      fileLogger.fatal(msg, ...args);
      consoleLogger.fatal(msg, ...args);
    },
  };
};

let logger: ReturnType<typeof createLogger>;

try {
  logger = createLogger();
} catch (error) {
  logger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
  };
}

export default logger;
