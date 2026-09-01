import { InvalidPeriodError } from './errors/reservation.errors';

/** Booking granularity. A 07-minute slot helps nobody read an agenda. */
export const SLOT_MINUTES = 15;
export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 8 * 60;

const MS_PER_MINUTE = 60_000;

/**
 * A half-open instant range: `[start, end)`.
 *
 * Start is inclusive, end is exclusive. That single decision is why
 * 10:00–11:00 and 11:00–12:00 are adjacent rather than conflicting, and it is
 * the difference between a booking system people can use and one that rejects
 * back-to-back meetings.
 *
 * Immutable and impossible to construct in an invalid state: there is no way
 * to hold a Period whose end is not after its start. Every rule downstream can
 * therefore assume it, and none of them has to re-check it.
 *
 * Deliberately the only piece of the reservations module that is a value
 * object rather than a plain service. It earns it: forty lines, no I/O, and
 * the single place the boundary bug can live.
 */
export class Period {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {
    Object.freeze(this);
  }

  static create(start: Date | string, end: Date | string): Period {
    const from = toDate(start, 'startAt');
    const to = toDate(end, 'endAt');

    // end === start would be a zero-length range: `[)` makes it empty, so it
    // would overlap nothing and could be booked infinitely often.
    if (to.getTime() <= from.getTime()) {
      throw new InvalidPeriodError('endAt debe ser posterior a startAt', {
        startAt: from.toISOString(),
        endAt: to.toISOString(),
      });
    }

    const minutes = (to.getTime() - from.getTime()) / MS_PER_MINUTE;

    if (minutes < MIN_DURATION_MINUTES) {
      throw new InvalidPeriodError(
        `La reserva debe durar al menos ${MIN_DURATION_MINUTES} minutos`,
      );
    }

    if (minutes > MAX_DURATION_MINUTES) {
      throw new InvalidPeriodError(
        `La reserva no puede durar más de ${MAX_DURATION_MINUTES / 60} horas`,
      );
    }

    if (from.getTime() % (SLOT_MINUTES * MS_PER_MINUTE) !== 0) {
      throw new InvalidPeriodError(`El inicio debe caer en múltiplos de ${SLOT_MINUTES} minutos`);
    }

    if (minutes % SLOT_MINUTES !== 0) {
      throw new InvalidPeriodError(`La duración debe ser múltiplo de ${SLOT_MINUTES} minutos`);
    }

    return new Period(from, to);
  }

  /** Bypasses the business rules. For ranges that come from the database. */
  static fromStored(start: Date, end: Date): Period {
    return new Period(new Date(start), new Date(end));
  }

  get durationMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / MS_PER_MINUTE;
  }

  /**
   * True when the two ranges share at least one instant.
   *
   * Same semantics as PostgreSQL's `&&` on a tstzrange built with '[)', which
   * is not a coincidence: the check here and the guarantee in the database
   * must agree, and the cheapest way to ensure that is to define them the
   * same way.
   */
  overlaps(other: Period): boolean {
    return this.start.getTime() < other.end.getTime() && this.end.getTime() > other.start.getTime();
  }

  /** True when this range lies entirely within the other. */
  isWithin(other: Period): boolean {
    return (
      this.start.getTime() >= other.start.getTime() && this.end.getTime() <= other.end.getTime()
    );
  }

  isBefore(instant: Date): boolean {
    return this.start.getTime() < instant.getTime();
  }

  /** The parameters the repository binds into a tstzrange literal. */
  toRange(): { startAt: string; endAt: string } {
    return { startAt: this.start.toISOString(), endAt: this.end.toISOString() };
  }

  toString(): string {
    return `[${this.start.toISOString()}, ${this.end.toISOString()})`;
  }
}

function toDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidPeriodError(`${field} no es una fecha válida`, { [field]: String(value) });
  }
  return date;
}
