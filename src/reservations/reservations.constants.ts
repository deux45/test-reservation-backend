/**
 * Constants shared between a rule and the repository it uses.
 *
 * They live here rather than in either file because ActiveReservationLimitRule
 * depends on ReservationRepository, so the repository importing a value back
 * from the rule closes a cycle. TypeScript compiles it happily; at runtime the
 * class is still undefined when the decorator reads its constructor types, and
 * Nest fails with "can't resolve dependencies ... argument at index [0]".
 *
 * A module with no imports of its own cannot participate in a cycle.
 */

/** Future confirmed reservations one user may hold with no profile of their own. */
export const DEFAULT_ACTIVE_RESERVATION_LIMIT = 10;
