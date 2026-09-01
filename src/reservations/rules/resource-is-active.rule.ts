import { Injectable } from '@nestjs/common';
import { ResourceUnavailableError } from '../errors/reservation.errors';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * A deactivated resource takes no new bookings.
 *
 * Its existing reservations stay valid and readable -- deactivation is a
 * catalogue decision, not a reason to cancel other people's meetings.
 */
@Injectable()
export class ResourceIsActiveRule implements ReservationRule {
  readonly name = 'RESOURCE_IS_ACTIVE';

  check(context: ReservationContext): Promise<void> {
    if (!context.resource.isActive) {
      throw new ResourceUnavailableError(context.resource.id);
    }
    return Promise.resolve();
  }
}
