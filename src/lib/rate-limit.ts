/**
 * Process-local sliding-window rate limiter for public endpoints (search, suggest,
 * feed). It protects a single instance from bursts; a multi-instance deployment should
 * replace it with a shared store (Redis or similar) behind the same interface.
 */
export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitDecision;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Upper bound on tracked keys; the oldest are evicted first. */
  maxKeys?: number;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max, maxKeys = 10_000 } = options;
  const hits = new Map<string, number[]>();

  function prune(timestamps: number[], now: number): number[] {
    const cutoff = now - windowMs;
    let start = 0;
    while (start < timestamps.length && (timestamps[start] ?? 0) <= cutoff) start += 1;
    return start === 0 ? timestamps : timestamps.slice(start);
  }

  return {
    check(key, now = Date.now()) {
      const recent = prune(hits.get(key) ?? [], now);
      if (recent.length >= max) {
        const oldest = recent[0] ?? now;
        hits.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
        };
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldestKey = hits.keys().next().value;
        if (oldestKey !== undefined) hits.delete(oldestKey);
      }
      return { allowed: true, remaining: max - recent.length, retryAfterSeconds: 0 };
    },
  };
}

type Holder = { limiters?: Map<string, RateLimiter> };
const holder = globalThis as unknown as { __neurobaseRateLimit?: Holder };

/** Shared limiter per endpoint name, surviving hot reloads in development. */
export function getRateLimiter(name: string, options: RateLimiterOptions): RateLimiter {
  if (!holder.__neurobaseRateLimit) holder.__neurobaseRateLimit = {};
  if (!holder.__neurobaseRateLimit.limiters) holder.__neurobaseRateLimit.limiters = new Map();
  const limiters = holder.__neurobaseRateLimit.limiters;
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = createRateLimiter(options);
    limiters.set(name, limiter);
  }
  return limiter;
}
