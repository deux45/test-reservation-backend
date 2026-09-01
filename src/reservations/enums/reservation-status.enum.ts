/**
 * Three states, no approval flow.
 *
 * Only CONFIRMED participates in the database's exclusion constraint, which
 * is what makes cancellation work: a CANCELLED row leaves the partial index
 * and its slot is free again immediately, with no cleanup job.
 */
export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  /** Assigned once the period has passed. Separates history from the agenda. */
  COMPLETED = 'COMPLETED',
}
