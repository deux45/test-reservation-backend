import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { ReservationLimitReachedError } from '../errors/reservation.errors';
import { ReservationRepository } from '../repositories/reservation.repository';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * Caps how many future confirmed reservations one user may hold.
 *
 * Counts only future ones. A limit that also counted history would tighten by
 * itself over time until an active user could never book again -- a quota
 * that silently becomes a ban.
 *
 * This rule exists mostly to demonstrate the open/closed shape: it was added
 * without touching ReservationService, exactly as any later rule would be.
 */
@Injectable()
export class ActiveReservationLimitRule implements ReservationRule {
  readonly name = 'ACTIVE_RESERVATION_LIMIT';

  constructor(private readonly reservations: ReservationRepository) {}

  async check(context: ReservationContext, manager: EntityManager): Promise<void> {
    const limit = await this.reservations.findUserLimit(context.userId, manager);

    const active = await this.reservations.countFutureConfirmed(
      context.userId,
      context.now,
      context.excludedReservationId,
      manager,
    );

    if (active >= limit) {
      throw new ReservationLimitReachedError(limit);
    }
  }
}
