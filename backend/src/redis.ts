import { Redis } from "@upstash/redis";

import type { Env } from "./env";

export type RedisClient = Redis;

export function createRedisClient(env: Env): RedisClient | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;

  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  });
}

