import { Injectable } from '@nestjs/common';
import { ReservationInThePastError } from '../errors/reservation.errors';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * One minute of tolerance for clock skew.
 *
 * Without it, a client whose clock is a few seconds ahead gets its own
 * "now" rejected as the past -- a failure the user can neither understand
 * nor act on.
 */
const CLOCK_SKEW_MS = 60_000;

@Injectable()
export class NotInThePastRule implements ReservationRule {
  readonly name = 'NOT_IN_THE_PAST';

  check(context: ReservationContext): Promise<void> {
    // context.now comes from ClockService, never Date.now(), which is what
    // makes this rule testable without freezing global time.
    if (context.period.isBefore(new Date(context.now.getTime() - CLOCK_SKEW_MS))) {
      throw new ReservationInThePastError();
    }
    return Promise.resolve();
  }
}
