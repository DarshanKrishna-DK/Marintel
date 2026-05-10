import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler";
import type { RedisClient } from "../redis";
import { getMonitorSnapshot } from "../services/healthMonitor";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function createHealthRouter(deps: { redis: RedisClient | null }) {
  const router = Router();

  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      const startedAt = Date.now();

      if (!deps.redis) {
        return res.json({
          status: "ok",
          time: new Date().toISOString(),
          redis: { configured: false },
          monitor: getMonitorSnapshot(),
          latencyMs: Date.now() - startedAt
        });
      }

      try {
        const pong = await withTimeout(deps.redis.ping(), 1500);
        return res.json({
          status: "ok",
          time: new Date().toISOString(),
          redis: { configured: true, ping: pong },
          monitor: getMonitorSnapshot(),
          latencyMs: Date.now() - startedAt
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        return res.json({
          status: "ok",
          time: new Date().toISOString(),
          redis: { configured: true, error: message },
          monitor: getMonitorSnapshot(),
          latencyMs: Date.now() - startedAt
        });
      }
    })
  );

  return router;
}

