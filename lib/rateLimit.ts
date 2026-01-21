type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  source: 'upstash' | 'memory';
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSec: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryStore: Map<string, MemoryEntry> = (() => {
  const globalAny = globalThis as typeof globalThis & { __rateLimitStore?: Map<string, MemoryEntry> };
  if (!globalAny.__rateLimitStore) {
    globalAny.__rateLimitStore = new Map();
  }
  return globalAny.__rateLimitStore;
})();

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashIncrement(key: string, windowSec: number): Promise<number> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('UPSTASH_MISSING');
  }

  const headers = { Authorization: `Bearer ${UPSTASH_TOKEN}` };
  const encodedKey = encodeURIComponent(key);

  const incrRes = await fetch(`${UPSTASH_URL}/incr/${encodedKey}`, {
    method: 'POST',
    headers,
  });

  if (!incrRes.ok) {
    throw new Error(`UPSTASH_INCR_FAILED:${incrRes.status}`);
  }

  const incrJson = (await incrRes.json()) as { result?: number };
  const count = typeof incrJson.result === 'number' ? incrJson.result : 0;

  if (count === 1) {
    await fetch(`${UPSTASH_URL}/expire/${encodedKey}/${windowSec}`, {
      method: 'POST',
      headers,
    });
  }

  return count;
}

function memoryIncrement(key: string, windowSec: number): MemoryEntry {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowSec * 1000 };
    memoryStore.set(key, entry);
    return entry;
  }

  existing.count += 1;
  return existing;
}

export async function checkRateLimit({
  key,
  limit,
  windowSec,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const count = await upstashIncrement(key, windowSec);
      const remaining = Math.max(0, limit - count);
      return {
        allowed: count <= limit,
        remaining,
        resetAt: now + windowSec * 1000,
        limit,
        source: 'upstash',
      };
    } catch {
      // fallback to in-memory
    }
  }

  const entry = memoryIncrement(key, windowSec);
  const remaining = Math.max(0, limit - entry.count);
  return {
    allowed: entry.count <= limit,
    remaining,
    resetAt: entry.resetAt,
    limit,
    source: 'memory',
  };
}
