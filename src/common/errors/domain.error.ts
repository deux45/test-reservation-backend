/**
 * Domain errors know nothing about HTTP.
 *
 * Services throw these; ProblemDetailsFilter is the single place that turns
 * them into status codes and RFC 7807 bodies. That keeps the domain free of
 * @nestjs/common imports and keeps the wire format in one file.
 */
export abstract class DomainError extends Error {
  /** Stable machine-readable code. Clients branch on this, never on the message. */
  abstract readonly code: string;

  /** HTTP status the filter maps this to. */
  abstract readonly status: number;

  /** Extra fields merged into the problem+json body. */
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 409 — the request is well formed but conflicts with current state. */
export abstract class ConflictError extends DomainError {
  readonly status = 409;
}

/** 422 — the request is syntactically valid but semantically impossible. */
export abstract class UnprocessableError extends DomainError {
  readonly status = 422;
}

/** 404 */
export abstract class NotFoundError extends DomainError {
  readonly status = 404;
}

/**
 * 403 — the caller is known and simply may not do this.
 *
 * Distinct from 401: telling an authenticated user to sign in again leads
 * nowhere. Also distinct from ConflictError, which the type system enforced
 * -- a forbidden action is not a conflict with current state.
 */
export abstract class ForbiddenError extends DomainError {
  readonly status = 403;
}
