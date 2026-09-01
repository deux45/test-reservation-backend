import { Injectable } from '@nestjs/common';
import { CapacityExceededError } from '../errors/reservation.errors';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * Attendees must fit in the resource.
 *
 * Skipped when either side is unknown: a resource with no declared capacity
 * imposes no limit, and a booking that does not state its attendee count is
 * not claiming to exceed one. Inventing a default in either direction would
 * reject valid bookings on made-up grounds.
 */
@Injectable()
export class SufficientCapacityRule implements ReservationRule {
  readonly name = 'SUFFICIENT_CAPACITY';

  check(context: ReservationContext): Promise<void> {
    const { capacity } = context.resource;
    const { attendees } = context;

    if (capacity != null && attendees != null && attendees > capacity) {
      throw new CapacityExceededError(attendees, capacity);
    }
    return Promise.resolve();
  }
}
