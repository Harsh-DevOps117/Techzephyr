import winston from "winston";
import { config } from "../config/env.js";

const json = config.NODE_ENV === "production";

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: json
    ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
    : winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.simple()),
  transports: [new winston.transports.Console()],
});
