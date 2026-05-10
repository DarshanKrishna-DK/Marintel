import { Router, type RequestHandler } from "express";
import { z } from "zod";

import type { Env } from "../env";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/httpErrors";
import type { RedisClient } from "../redis";

const DebugCacheRequestSchema = z.object({
  key: z.string().trim().min(1).max(200),
  value: z.unknown(),
  ttlSeconds: z.coerce.number().int().positive().max(86_400).default(1800)
});

function parsePossiblyJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function requireDebugAuth(env: Env): RequestHandler {
  return (req, res, next) => {
    if (!env.DEBUG_TOKEN) return next();
    const token = req.header("x-debug-token");
    if (token && token === env.DEBUG_TOKEN) return next();
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid debug token" } });
  };
}

export function createDebugRouter(deps: { env: Env; redis: RedisClient | null }) {
  const router = Router();

  router.use(requireDebugAuth(deps.env));

  router.get(
    "/debug/redis",
    asyncHandler(async (_req, res) => {
      if (!deps.redis) {
        throw new AppError({
          statusCode: 503,
          code: "REDIS_NOT_CONFIGURED",
          message: "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
        });
      }

      const pong = await deps.redis.ping();
      res.json({ redis: { ping: pong } });
    })
  );

  router.post(
    "/debug/cache",
    asyncHandler(async (req, res) => {
      if (!deps.redis) {
        throw new AppError({
          statusCode: 503,
          code: "REDIS_NOT_CONFIGURED",
          message: "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
        });
      }

      const { key, value, ttlSeconds } = DebugCacheRequestSchema.parse(req.body ?? {});
      await deps.redis.setex(key, ttlSeconds, JSON.stringify(value));
      const stored = await deps.redis.get(key);

      res.json({
        key,
        ttlSeconds,
        stored: parsePossiblyJson(stored)
      });
    })
  );

  return router;
}

