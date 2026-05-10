import { z } from "zod";

const truthy = new Set(["1", "true", "yes", "y", "on"]);
const falsy = new Set(["0", "false", "no", "n", "off"]);

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function parseBoolean(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (truthy.has(normalized)) return true;
  if (falsy.has(normalized)) return false;
  return value;
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(8787)),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  ENABLE_DEBUG_ENDPOINTS: z.preprocess(parseBoolean, z.boolean().optional()),
  DEBUG_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  UPSTASH_REDIS_REST_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  ANAKIN_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ANAKIN_API_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  GROQ_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional())
});

const base = EnvSchema.parse(process.env);

const allowedOrigins = base.ALLOWED_ORIGINS
  ? base.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

export const env = {
  NODE_ENV: base.NODE_ENV,
  PORT: base.PORT,
  LOG_LEVEL: base.LOG_LEVEL,
  ENABLE_DEBUG_ENDPOINTS: base.ENABLE_DEBUG_ENDPOINTS ?? base.NODE_ENV !== "production",
  DEBUG_TOKEN: base.DEBUG_TOKEN,
  UPSTASH_REDIS_REST_URL: base.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: base.UPSTASH_REDIS_REST_TOKEN,
  ANAKIN_API_KEY: base.ANAKIN_API_KEY,
  ANAKIN_API_BASE_URL: base.ANAKIN_API_BASE_URL ?? "https://api.anakin.io/v1",
  GROQ_API_KEY: base.GROQ_API_KEY,
  allowedOrigins
} as const;

export type Env = typeof env;

