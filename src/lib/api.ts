import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiError } from "@/domain/types";
import { NotFoundError, RateLimitError, ValidationError } from "./errors";
import { getRateLimiter, type RateLimiterOptions } from "./rate-limit";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(
  code: ApiError["error"]["code"],
  message: string,
  status: number,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse<ApiError> {
  const body: ApiError = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { status, headers });
}

/** Best-effort client key for rate limiting behind a proxy. */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "local";
}

export interface RouteOptions {
  rateLimit?: { name: string } & RateLimiterOptions;
}

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
type Handler = (request: Request, context: RouteContext) => Promise<Response>;

/**
 * Wraps a route handler with input-error mapping, optional rate limiting and a
 * consistent error envelope. Unexpected errors are logged and returned as 500 without
 * leaking internals.
 */
export function apiRoute(handler: Handler, options: RouteOptions = {}): Handler {
  return async (request, context) => {
    try {
      if (options.rateLimit) {
        const { name, ...limiterOptions } = options.rateLimit;
        const decision = getRateLimiter(name, limiterOptions).check(getClientKey(request));
        if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
      }
      return await handler(request, context);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return jsonError("bad_request", "Invalid request", 400, error.issues);
      }
      if (error instanceof ValidationError) {
        return jsonError("bad_request", error.message, 400, error.details);
      }
      if (error instanceof NotFoundError) {
        return jsonError("not_found", error.message, 404);
      }
      if (error instanceof RateLimitError) {
        return jsonError("rate_limited", error.message, 429, undefined, {
          "Retry-After": String(error.retryAfterSeconds),
        });
      }
      console.error(error);
      return jsonError("internal", "Something went wrong", 500);
    }
  };
}
