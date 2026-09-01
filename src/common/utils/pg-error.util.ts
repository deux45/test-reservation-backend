/** PostgreSQL SQLSTATE codes this application reacts to by name. */
export const PG_ERROR = {
  /** unique_violation */
  UNIQUE_VIOLATION: '23505',
  /** exclusion_violation -- what reservation_no_overlap raises. */
  EXCLUSION_VIOLATION: '23P01',
  /** foreign_key_violation */
  FOREIGN_KEY_VIOLATION: '23503',
  /** check_violation */
  CHECK_VIOLATION: '23514',
} as const;

interface PostgresError {
  code: string;
  constraint?: string;
  detail?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  // `'code' in error` already narrows the type, so no assertion is needed.
  return (
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
  );
}

/**
 * Narrows a thrown value to a specific PostgreSQL error, optionally on a
 * specific constraint.
 *
 * Matching the constraint name matters: two different unique indexes on the
 * same table both raise 23505, and they mean different things to the caller.
 */
export function isPgError(
  error: unknown,
  code: (typeof PG_ERROR)[keyof typeof PG_ERROR],
  constraint?: string,
): error is PostgresError {
  if (!isPostgresError(error)) return false;
  if (error.code !== code) return false;
  return constraint === undefined || error.constraint === constraint;
}
