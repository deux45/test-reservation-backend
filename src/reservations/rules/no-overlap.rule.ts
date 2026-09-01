import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { OverlappingReservationError } from '../errors/reservation.errors';
import { ReservationRepository } from '../repositories/reservation.repository';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * The rule the whole brief is about.
 *
 * Layer 2 of three. It does NOT provide the guarantee -- the EXCLUDE
 * constraint in migration 1756700000004 does, and would still refuse a
 * conflicting insert if this class were deleted. What this provides is a
 * useful answer: it finds the reservation that clashes and puts its range in
 * the 409, so the client can say "ocupado de 10:00 a 11:00" and offer nearby
 * slots instead of just refusing.
 *
 * It runs inside the transaction that already holds the advisory lock for
 * this resource, so between this query and the insert no competing request
 * can slip in.
 */
@Injectable()
export class NoOverlapRule implements ReservationRule {
  readonly name = 'NO_OVERLAP';

  constructor(private readonly reservations: ReservationRepository) {}

  async check(context: ReservationContext, manager: EntityManager): Promise<void> {
    const conflict = await this.reservations.findOverlapping(
      context.resource.id,
      context.period,
      context.excludedReservationId,
      manager,
    );

    if (conflict) {
      throw new OverlappingReservationError(context.resource.id, context.period, {
        id: conflict.id,
        startAt: conflict.startAt,
        endAt: conflict.endAt,
      });
    }
  }
}
