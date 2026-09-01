import { Module, type Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesModule } from '../resources/resources.module';
import { AvailabilityController } from './controllers/availability.controller';
import { ReservationsController } from './controllers/reservations.controller';
import { ResourceAvailability } from '../resources/entities/resource-availability.entity';
import { ResourceBlock } from '../resources/entities/resource-block.entity';
import { Reservation } from './entities/reservation.entity';
import { ReservationRepository } from './repositories/reservation.repository';
import { ActiveReservationLimitRule } from './rules/active-reservation-limit.rule';
import { NoOverlapRule } from './rules/no-overlap.rule';
import { NoResourceBlockRule } from './rules/no-resource-block.rule';
import { NotInThePastRule } from './rules/not-in-the-past.rule';
import { RESERVATION_RULES, type ReservationRule } from './rules/reservation-rule.interface';
import { ResourceIsActiveRule } from './rules/resource-is-active.rule';
import { SufficientCapacityRule } from './rules/sufficient-capacity.rule';
import { WithinOperatingHoursRule } from './rules/within-operating-hours.rule';
import { ClockService } from './services/clock.service';
import { ReservationLockService } from './services/reservation-lock.service';
import { AvailabilityService } from './services/availability.service';
import { ReservationService } from './services/reservation.service';

/**
 * The rules, in execution order.
 *
 * Ordered cheapest first: the in-memory checks run before anything touches
 * the database, so a booking that fails on capacity never costs a query.
 *
 * Adding a rule is adding a class and one line here. ReservationService is
 * not touched -- that is the open/closed principle as something you can
 * point at rather than assert.
 *
 * Note what is NOT in this list: duration, granularity and start-before-end.
 * Those live in Period, because a rule can be skipped by a caller that
 * forgets to run the engine, whereas an invalid Period cannot be constructed
 * at all.
 */
const RULES = [
  ResourceIsActiveRule,
  NotInThePastRule,
  SufficientCapacityRule,
  WithinOperatingHoursRule,
  NoResourceBlockRule,
  NoOverlapRule,
  ActiveReservationLimitRule,
];

/**
 * Collects the rule instances into the array the service iterates.
 *
 * NOT `multi: true`. That is Angular's mechanism; NestJS has no multi-provider
 * support and silently keeps a single value, so the service ends up injecting
 * one rule instead of a list and fails at runtime with "this.rules is not
 * iterable" -- on the first booking, not at boot.
 *
 * A factory with `inject` is the Nest idiom: each class is resolved normally
 * and the factory receives them in the order declared, which is the order they
 * run in.
 */
const rulesProvider: Provider = {
  provide: RESERVATION_RULES,
  useFactory: (...rules: ReservationRule[]) => rules,
  inject: RULES,
};

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, ResourceAvailability, ResourceBlock]),
    ResourcesModule,
  ],
  controllers: [ReservationsController, AvailabilityController],
  providers: [
    ReservationService,
    AvailabilityService,
    ReservationLockService,
    ReservationRepository,
    ClockService,
    ...RULES,
    rulesProvider,
  ],
  exports: [ReservationRepository],
})
export class ReservationsModule {}
