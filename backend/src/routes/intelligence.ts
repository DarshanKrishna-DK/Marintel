import { Router } from "express";
import { z } from "zod";

import type { Env } from "../env";
import { cacheGetJson, cacheSetJson } from "../lib/cacheJson";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/httpErrors";
import type { RedisClient } from "../redis";
import { recordCacheHit, recordCacheMiss } from "../services/healthMonitor";
import { runIntelligencePipeline } from "../services/pipeline";

const SymbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z0-9._-]+$/.test(s), { message: "Invalid symbol format" });

const IntelligenceRequestSchema = z.object({
  symbol: SymbolSchema,
  type: z.enum(["equity"]).default("equity")
});

const CACHE_TTL_SECONDS = 30 * 60;

export function createIntelligenceRouter(deps: { env: Env; redis: RedisClient | null }) {
  const router = Router();

  router.post(
    "/intelligence",
    asyncHandler(async (req, res) => {
      const { symbol, type } = IntelligenceRequestSchema.parse(req.body ?? {});
      const cacheKey = `marintel:intelligence:${type}:${symbol}`;

      if (deps.redis) {
        const cached = await cacheGetJson<unknown>(deps.redis, cacheKey);
        if (cached) {
          recordCacheHit();
          res.setHeader("x-marintel-cache", "hit");
          return res.json(cached);
        }
      }

      recordCacheMiss();
      res.setHeader("x-marintel-cache", "miss");

      if (!deps.env.ANAKIN_API_KEY) {
        throw new AppError({
          statusCode: 503,
          code: "ANAKIN_NOT_CONFIGURED",
          message: "ANAKIN_API_KEY is not configured on the server."
        });
      }

      if (!deps.env.GROQ_API_KEY) {
        throw new AppError({
          statusCode: 503,
          code: "GROQ_NOT_CONFIGURED",
          message: "GROQ_API_KEY is not configured on the server."
        });
      }

      const result = await runIntelligencePipeline(deps.env, { symbol });

      if (deps.redis) {
        await cacheSetJson(deps.redis, cacheKey, CACHE_TTL_SECONDS, result);
      }

      return res.json(result);
    })
  );

  return router;
}

