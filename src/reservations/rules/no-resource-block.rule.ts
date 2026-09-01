import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { ResourceBlock } from '../../resources/entities/resource-block.entity';
import { ResourceBlockedError } from '../errors/reservation.errors';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * The booking must not collide with maintenance, a holiday or a breakdown.
 *
 * The overlap test is delegated to PostgreSQL's `&&` on the block's generated
 * tstzrange, exactly as the reservation check is. Two different definitions
 * of "overlaps" in one system is how they drift apart.
 */
@Injectable()
export class NoResourceBlockRule implements ReservationRule {
  readonly name = 'NO_RESOURCE_BLOCK';

  async check(context: ReservationContext, manager: EntityManager): Promise<void> {
    const block = await manager
      .createQueryBuilder(ResourceBlock, 'block')
      .where('block.resource_id = :resourceId', { resourceId: context.resource.id })
      .andWhere("block.period && tstzrange(:startAt, :endAt, '[)')", context.period.toRange())
      .getOne();

    if (block) {
      throw new ResourceBlockedError(context.resource.id, block.reason);
    }
  }
}
