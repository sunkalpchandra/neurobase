import type { z } from "zod";
import { getEnv } from "@/lib/env";

/**
 * HTTP client for public APIs: per-host rate limiting, timeouts, bounded retries and
 * schema validation of every response body. NeuroBase never scrapes HTML, so this is
 * the only way records enter the pipeline.
 */

export interface RateLimiterOptions {
  /** Sustained request rate. */
  requestsPerSecond: number;
  /** Burst allowance; defaults to one second's worth of requests. */
  burst?: number;
}

export interface TokenBucket {
  /** Resolves when a request may proceed. */
  take(now?: number): Promise<void>;
}

/**
 * Token bucket. `sleep` is injectable so tests can drive it without real timers.
 */
export function createTokenBucket(
  options: RateLimiterOptions,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  clock: () => number = () => Date.now(),
): TokenBucket {
  const capacity = Math.max(1, options.burst ?? Math.ceil(options.requestsPerSecond));
  const refillPerMs = options.requestsPerSecond / 1000;
  let tokens = capacity;
  let lastRefill = clock();
  // Serialises waiters so concurrent callers cannot all claim the same token.
  let queue: Promise<void> = Promise.resolve();

  async function acquire(): Promise<void> {
    for (;;) {
      const now = clock();
      tokens = Math.min(capacity, tokens + (now - lastRefill) * refillPerMs);
      lastRefill = now;
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await sleep(Math.ceil((1 - tokens) / refillPerMs));
    }
  }

  return {
    take() {
      const next = queue.then(acquire);
      // Keep the chain alive even if a waiter rejects.
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}

export interface HttpClientOptions {
  requestsPerSecond: number;
  burst?: number;
  timeoutMs?: number;
  maxRetries?: number;
  /** First backoff step; doubles per retry when the server gives no Retry-After. */
  baseBackoffMs?: number;
  /**
   * Longest wait to honour before abandoning the request. A Retry-After beyond this is
   * a sustained block, not a moment's congestion: waiting it out would stall a batch
   * run for minutes, and the next scheduled refresh will pick the records up instead.
   */
  maxWaitMs?: number;
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    /** Seconds the server asked us to wait, when it said. */
    readonly retryAfterSeconds: number | null = null,
    message?: string,
  ) {
    super(message ?? `Request to ${url} failed with status ${status}`);
    this.name = "HttpError";
  }
}

/** Retry-After is either a delay in seconds or an HTTP date. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 120);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, Math.round((date - now) / 1000)), 120);
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Contact details go in the User-Agent so public APIs can identify the caller. */
export function userAgent(): string {
  const contact = getEnv().INGEST_CONTACT_EMAIL;
  return contact
    ? `NeuroBase/0.1 (+${contact})`
    : "NeuroBase/0.1 (+https://sample.neurobase.invalid)";
}

export interface HttpClient {
  /** GETs a URL and validates the JSON body. Throws after the retry budget is spent. */
  getJson<T>(
    url: string,
    schema: z.ZodType<T>,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<T>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    timeoutMs = 15_000,
    maxRetries = 3,
    baseBackoffMs = 250,
    maxWaitMs = 30_000,
    fetchImpl = fetch,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;
  const bucket = createTokenBucket(
    { requestsPerSecond: options.requestsPerSecond, burst: options.burst },
    sleep,
  );

  async function attempt(
    url: string,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<unknown> {
    await bucket.take();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    init?.signal?.addEventListener("abort", onAbort);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": userAgent(),
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new HttpError(
          response.status,
          url,
          parseRetryAfter(response.headers.get("retry-after")),
        );
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
      init?.signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    async getJson<T>(
      url: string,
      schema: z.ZodType<T>,
      init?: { signal?: AbortSignal; headers?: Record<string, string> },
    ): Promise<T> {
      let lastError: unknown;
      for (let retry = 0; retry <= maxRetries; retry += 1) {
        try {
          const body = await attempt(url, init);
          const parsed = schema.safeParse(body);
          if (!parsed.success) {
            // A shape change upstream is not retryable: fail loudly instead of looping.
            throw new Error(`Unexpected response shape from ${url}: ${parsed.error.message}`);
          }
          return parsed.data;
        } catch (error: unknown) {
          lastError = error;
          const retryable =
            (error instanceof HttpError && RETRYABLE_STATUSES.has(error.status)) ||
            (error instanceof Error && (error.name === "AbortError" || error.name === "TypeError"));
          if (!retryable || retry === maxRetries || init?.signal?.aborted) break;
          // A server that says how long to wait knows better than our backoff curve.
          const askedFor = error instanceof HttpError ? error.retryAfterSeconds : null;
          const wait = askedFor !== null ? askedFor * 1000 : 2 ** retry * baseBackoffMs;
          if (wait > maxWaitMs) break;
          await sleep(wait);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
  };
}

/** Builds a query string, dropping empty values. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}
