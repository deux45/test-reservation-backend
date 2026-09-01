import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { ResourceRepository } from '../../resources/repositories/resource.repository';
import { type CreateReservationDto } from '../dtos/create-reservation.dto';
import { type FilterReservationsDto } from '../dtos/filter-reservations.dto';
import { ReservationDto } from '../dtos/reservation.dto';
import { type Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';
import {
  ReservationAlreadyEndedError,
  ReservationForbiddenError,
  ReservationNotFoundError,
  ResourceUnavailableError,
} from '../errors/reservation.errors';
import { Period } from '../period.vo';
import { ReservationRepository } from '../repositories/reservation.repository';
import {
  RESERVATION_RULES,
  type ReservationContext,
  type ReservationRule,
} from '../rules/reservation-rule.interface';
import { ClockService } from './clock.service';
import { ReservationLockService } from './reservation-lock.service';

export interface Caller {
  userId: string;
  isAdmin: boolean;
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly reservations: ReservationRepository,
    private readonly resources: ResourceRepository,
    private readonly lock: ReservationLockService,
    private readonly clock: ClockService,
    @Inject(RESERVATION_RULES) private readonly rules: ReservationRule[],
  ) {}

  /**
   * Creates a reservation. The three defences meet here.
   *
   * 1. Period.create validates shape before a transaction is even opened.
   * 2. The advisory lock plus the rules produce a useful 409 for the 99% case.
   * 3. The EXCLUDE constraint in the repository is the guarantee.
   */
  async create(
    dto: CreateReservationDto,
    userId: string,
    idempotencyKey?: string,
  ): Promise<ReservationDto> {
    // Layer 1. Outside the transaction on purpose: a malformed range should
    // not cost a connection from the pool.
    const period = Period.create(dto.startAt, dto.endAt);

    const reservation = await this.dataSource.transaction(async (manager) => {
      // A retry of a request that already succeeded returns the original
      // instead of a 409. Checked inside the transaction so it cannot race
      // with the insert below.
      if (idempotencyKey) {
        const existing = await this.reservations.findByIdempotencyKey(
          userId,
          idempotencyKey,
          manager,
        );
        if (existing) return existing;
      }

      // Layer 2. Everything after this point is serialised per resource, so
      // the gap between checking and inserting cannot be exploited.
      await this.lock.acquire(dto.resourceId, manager);

      const resource = await this.resources.findById(dto.resourceId, manager);
      if (!resource) throw new ResourceUnavailableError(dto.resourceId);

      const context: ReservationContext = {
        resource,
        period,
        userId,
        attendees: dto.attendees,
        now: this.clock.now(),
      };

      await this.applyRules(context, manager);

      // Layer 3 lives inside create(): a 23P01 from the constraint becomes
      // the same OverlappingReservationError the rule would have thrown.
      return this.reservations.create(
        {
          resourceId: resource.id,
          userId,
          title: dto.title,
          period,
          attendees: dto.attendees,
          notes: dto.notes,
          idempotencyKey,
        },
        manager,
      );
    });

    return ReservationDto.from(reservation);
  }

  /**
   * Reschedules an existing reservation.
   *
   * Re-runs every rule with excludedReservationId set, so the reservation does
   * not conflict with its own current slot. Skipping the rules on update --
   * a common shortcut -- is how a booking ends up in a slot it could never
   * have been created in.
   */
  async reschedule(id: string, dto: CreateReservationDto, caller: Caller): Promise<ReservationDto> {
    const period = Period.create(dto.startAt, dto.endAt);

    const updated = await this.dataSource.transaction(async (manager) => {
      const existing = await this.getOwned(id, caller, manager);

      if (existing.endAt.getTime() <= this.clock.now().getTime()) {
        throw new ReservationAlreadyEndedError(id);
      }

      await this.lock.acquire(existing.resourceId, manager);

      const resource = await this.resources.findById(existing.resourceId, manager);
      if (!resource) throw new ResourceUnavailableError(existing.resourceId);

      await this.applyRules(
        {
          resource,
          period,
          userId: existing.userId,
          attendees: dto.attendees,
          now: this.clock.now(),
          excludedReservationId: id,
        },
        manager,
      );

      await this.reservations.update(
        id,
        {
          title: dto.title,
          startAt: period.start,
          endAt: period.end,
          attendees: dto.attendees ?? null,
          notes: dto.notes ?? null,
        },
        manager,
      );

      return this.reservations.findById(id, manager);
    });

    return ReservationDto.from(updated!);
  }

  /**
   * Cancels a reservation.
   *
   * Idempotent: cancelling an already cancelled reservation returns it rather
   * than failing. The caller's intent is already satisfied, and a retry after
   * a dropped connection should not look like an error.
   *
   * No lock and no rules: moving out of CONFIRMED only ever frees capacity.
   */
  async cancel(id: string, caller: Caller, reason?: string): Promise<ReservationDto> {
    const cancelled = await this.dataSource.transaction(async (manager) => {
      const existing = await this.getOwned(id, caller, manager);

      if (existing.status === ReservationStatus.CANCELLED) return existing;

      if (existing.endAt.getTime() <= this.clock.now().getTime()) {
        throw new ReservationAlreadyEndedError(id);
      }

      await this.reservations.update(
        id,
        {
          status: ReservationStatus.CANCELLED,
          cancelledAt: this.clock.now(),
          cancelledBy: caller.userId,
          cancellationReason: reason ?? null,
        },
        manager,
      );

      return this.reservations.findById(id, manager);
    });

    this.logger.log({ reservationId: id, by: caller.userId }, 'Reservation cancelled');
    return ReservationDto.from(cancelled!);
  }

  async findAllPaginated(
    filters: FilterReservationsDto,
    caller: Caller,
  ): Promise<PaginatedResult<ReservationDto>> {
    // Enforced here, not trusted from the query string: without a role, the
    // listing is restricted to the caller's own reservations whatever the
    // userId parameter says.
    const restrictTo = caller.isAdmin ? undefined : caller.userId;

    const result = await this.reservations.findAllPaginated(filters, restrictTo);
    return { ...result, data: result.data.map((r) => ReservationDto.from(r)) };
  }

  async findById(id: string, caller: Caller): Promise<ReservationDto> {
    const reservation = await this.reservations.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);

    if (!caller.isAdmin && reservation.userId !== caller.userId) {
      throw new ReservationForbiddenError();
    }
    return ReservationDto.from(reservation);
  }

  /** Runs every registered rule in order. The first failure wins. */
  private async applyRules(context: ReservationContext, manager: EntityManager): Promise<void> {
    for (const rule of this.rules) {
      await rule.check(context, manager);
    }
  }

  private async getOwned(id: string, caller: Caller, manager: EntityManager): Promise<Reservation> {
    const reservation = await this.reservations.findById(id, manager);
    if (!reservation) throw new ReservationNotFoundError(id);

    if (!caller.isAdmin && reservation.userId !== caller.userId) {
      throw new ReservationForbiddenError();
    }
    return reservation;
  }
}
