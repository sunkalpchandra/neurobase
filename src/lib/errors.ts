/** Thrown by repositories when a requested record does not exist. */
export class NotFoundError extends Error {
  readonly code = "not_found" as const;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown at request boundaries when input fails validation. */
export class ValidationError extends Error {
  readonly code = "bad_request" as const;
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends Error {
  readonly code = "rate_limited" as const;
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}
