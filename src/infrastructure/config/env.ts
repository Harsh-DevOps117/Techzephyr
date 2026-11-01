import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  ALLOWED_ORIGIN: z.string().default("http://localhost:3001"),
  DATA_ROOT: z.string().default("./data"),
  VALIDATOR_PATH: z.string().default("./validator.py"),
  PYTHON_BIN: z.string().default("python3"),
  GROQ_API_KEY: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(60),
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().max(60).default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().max(30).default(7),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  TEAM_NAME: z.string().min(1).max(80).default("TechZephyr"),
  TWILIO_ACCOUNT_SID: z.string().optional().transform((value) => value?.trim() || undefined),
  TWILIO_AUTH_TOKEN: z.string().optional().transform((value) => value?.trim() || undefined),
  TWILIO_FROM_NUMBER: z.string().optional().transform((value) => value?.trim() || undefined),
  ALLOW_HEADER_AUTH: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const parsed = configSchema.parse(process.env);
if (parsed.NODE_ENV === "production" && parsed.JWT_SECRET.includes("replace-this-development-secret")) {
  throw new Error("Set a unique JWT_SECRET before running in production");
}

export const config = {
  ...parsed,
  ALLOW_HEADER_AUTH: parsed.ALLOW_HEADER_AUTH || parsed.NODE_ENV !== "production",
};
