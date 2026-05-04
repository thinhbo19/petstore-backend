const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60);
const REDIS_URL = process.env.REDIS_URL || "";

const memoryCache = new Map();
let redisClientPromise = null;

const toSeconds = (ttlSeconds) => {
  const parsed = Number(ttlSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_SECONDS;
  return Math.floor(parsed);
};

const buildCacheKey = (namespace, rawKey) => `cache:${namespace}:${rawKey}`;

const getRedisClient = async () => {
  if (!REDIS_URL) return null;
  if (redisClientPromise) return redisClientPromise;

  redisClientPromise = (async () => {
    try {
      // Optional dependency: app still works if redis package is not installed.
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      const { createClient } = require("redis");
      const client = createClient({ url: REDIS_URL });
      client.on("error", (error) => {
        console.error("Redis error:", error?.message || error);
      });
      await client.connect();
      return client;
    } catch (error) {
      console.warn("Redis unavailable. Falling back to in-memory cache.");
      return null;
    }
  })();

  return redisClientPromise;
};

const getCache = async (cacheKey) => {
  const redisClient = await getRedisClient();
  if (redisClient) {
    const raw = await redisClient.get(cacheKey);
    return raw ? JSON.parse(raw) : null;
  }

  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() > cached.expireAt) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return cached.value;
};

const setCache = async (cacheKey, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const ttl = toSeconds(ttlSeconds);
  const redisClient = await getRedisClient();
  if (redisClient) {
    await redisClient.set(cacheKey, JSON.stringify(value), { EX: ttl });
    return;
  }

  memoryCache.set(cacheKey, {
    value,
    expireAt: Date.now() + ttl * 1000,
  });
};

const invalidateNamespace = async (namespace) => {
  const prefix = `cache:${namespace}:`;
  const redisClient = await getRedisClient();

  if (redisClient) {
    const keysToDelete = [];
    for await (const key of redisClient.scanIterator({ MATCH: `${prefix}*` })) {
      keysToDelete.push(key);
    }
    if (keysToDelete.length) {
      await redisClient.del(keysToDelete);
    }
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
};

module.exports = {
  buildCacheKey,
  getCache,
  setCache,
  invalidateNamespace,
};
