import type { RedisClient } from "../redis";

export async function cacheGetJson<T>(redis: RedisClient, key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return value as T;
}

export async function cacheSetJson(redis: RedisClient, key: string, ttlSeconds: number, value: unknown) {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

