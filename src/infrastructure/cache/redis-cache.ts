import { createClient, type RedisClientType } from "redis";
import { config } from "../config/env.js";

let client: RedisClientType | undefined;

async function redis(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: config.REDIS_URL, socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) } });
    client.on("error", (error) => console.error("Redis cache error", error));
    await client.connect();
  }
  return client;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const value = await (await redis()).get(key);
    return value ? JSON.parse(value) as T : null;
  } catch (error) {
    console.warn("Cache read bypassed", { key, error });
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds = config.CACHE_DEFAULT_TTL_SECONDS): Promise<void> {
  try { await (await redis()).set(key, JSON.stringify(value), { EX: ttlSeconds }); }
  catch (error) { console.warn("Cache write bypassed", { key, error }); }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  try { if (keys.length) await (await redis()).del(keys); }
  catch (error) { console.warn("Cache invalidation bypassed", { keys, error }); }
}

export async function closeCache(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = undefined;
}

const tokenBucketLua = `
local key, capacity, refill, now = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local stored = redis.call('HMGET', key, 'tokens', 'updated_at')
local tokens = tonumber(stored[1]) or capacity
local updated = tonumber(stored[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated) * refill)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call('HSET', key, 'tokens', tokens, 'updated_at', now)
redis.call('EXPIRE', key, math.ceil((capacity / refill) * 2))
return {allowed, tokens}
`;

export async function consumeTokenBucket(key: string, capacity: number, refillPerSecond: number): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const result = await (await redis()).eval(tokenBucketLua, { keys: [key], arguments: [String(capacity), String(refillPerSecond), String(Date.now() / 1000)] }) as [number, number];
    return { allowed: Number(result[0]) === 1, remaining: Math.floor(Number(result[1])) };
  } catch (error) {
    console.warn("Rate limit store unavailable; allowing request", { key, error });
    return { allowed: true, remaining: capacity };
  }
}
