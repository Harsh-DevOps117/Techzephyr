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
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(60),
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

export const config = configSchema.parse(process.env);
