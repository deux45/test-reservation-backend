import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { paginate } from '../../common/utils/paginate.util';
import { isPgError, PG_ERROR } from '../../common/utils/pg-error.util';
import { type FilterReservationsDto } from '../dtos/filter-reservations.dto';
import { Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';
import {
  DuplicateReservationError,
  OverlappingReservationError,
} from '../errors/reservation.errors';
import { DEFAULT_ACTIVE_RESERVATION_LIMIT } from '../reservations.constants';
import { type Period } from '../period.vo';

const SORTABLE = new Set(['startAt', 'createdAt']);

export type ReservationUpdate = {
  title?: string;
  startAt?: Date;
  endAt?: Date;
  attendees?: number | null;
  notes?: string | null;
  status?: ReservationStatus;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
};

export interface NewReservation {
  resourceId: string;
  userId: string;
  title: string;
  period: Period;
  attendees?: number;
  notes?: string;
  idempotencyKey?: string;
}

@Injectable()
export class ReservationRepository {
  constructor(
    @InjectRepository(Reservation)
    private readonly repository: Repository<Reservation>,
  ) {}

  private scope(manager?: EntityManager): Repository<Reservation> {
    return manager ? manager.getRepository(Reservation) : this.repository;
  }

  /**
   * Layer 3: the last word.
   *
   * If a conflicting row reaches this insert -- from a second API instance, a
   * script, a psql session, or simply a race the advisory lock did not cover
   * -- PostgreSQL refuses it. Catching 23P01 here turns that guarantee into
   * the same 409 the application-level check produces, so a client cannot
   * tell which layer stopped it and does not need to.
   */
  async create(data: NewReservation, manager: EntityManager): Promise<Reservation> {
    const scope = this.scope(manager);

    try {
      return await scope.save(
        scope.create({
          resourceId: data.resourceId,
          userId: data.userId,
          title: data.title,
          startAt: data.period.start,
          endAt: data.period.end,
          attendees: data.attendees ?? null,
          notes: data.notes ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          status: ReservationStatus.CONFIRMED,
        }),
      );
    } catch (error) {
      // Matched on the constraint name too, not just the SQLSTATE: two
      // different indexes on this table raise codes that would otherwise be
      // indistinguishable, and they mean different things to the caller.
      if (isPgError(error, PG_ERROR.EXCLUSION_VIOLATION, 'reservation_no_overlap')) {
        throw new OverlappingReservationError(data.resourceId, data.period);
      }

      if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION, 'reservation_idempotency_uq')) {
        throw new DuplicateReservationError(data.idempotencyKey ?? '');
      }

      throw error;
    }
  }

  /**
   * The conflicting reservation, if any.
   *
   * The overlap test is `&&` against the generated tstzrange -- the same
   * operator and the same '[)' bound the EXCLUDE constraint uses. Writing
   * `start < :end AND end > :start` by hand would give the same answer today
   * and drift from the constraint the first time someone edits one of them.
   *
   * Served by reservation_resource_period_idx, the partial GiST index.
   */
  findOverlapping(
    resourceId: string,
    period: Period,
    excludeId: string | undefined,
    manager: EntityManager,
  ): Promise<Reservation | null> {
    const query = this.scope(manager)
      .createQueryBuilder('r')
      .where('r.resource_id = :resourceId', { resourceId })
      .andWhere('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere("r.period && tstzrange(:startAt, :endAt, '[)')", period.toRange());

    // andWhere, never where(): in TypeORM, .where() discards every condition
    // added before it.
    if (excludeId) query.andWhere('r.id != :excludeId', { excludeId });

    return query.getOne();
  }

  /** Confirmed reservations for a resource that intersect a range. */
  findConfirmedInRange(
    resourceId: string,
    from: Date,
    to: Date,
    manager?: EntityManager,
  ): Promise<Reservation[]> {
    return this.scope(manager)
      .createQueryBuilder('r')
      .where('r.resource_id = :resourceId', { resourceId })
      .andWhere('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere("r.period && tstzrange(:from, :to, '[)')", {
        from: from.toISOString(),
        to: to.toISOString(),
      })
      .orderBy('r.start_at', 'ASC')
      .getMany();
  }

  findById(id: string, manager?: EntityManager): Promise<Reservation | null> {
    return this.scope(manager).findOne({
      where: { id },
      relations: { resource: true },
    });
  }

  findByIdempotencyKey(
    userId: string,
    key: string,
    manager: EntityManager,
  ): Promise<Reservation | null> {
    return this.scope(manager).findOne({ where: { userId, idempotencyKey: key } });
  }

  async update(id: string, data: ReservationUpdate, manager?: EntityManager): Promise<void> {
    await this.scope(manager).update(id, data);
  }

  countFutureConfirmed(
    userId: string,
    now: Date,
    excludeId: string | undefined,
    manager: EntityManager,
  ): Promise<number> {
    const query = this.scope(manager)
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere('r.end_at > :now', { now });

    if (excludeId) query.andWhere('r.id != :excludeId', { excludeId });

    return query.getCount();
  }

  /** The user's own limit, or the default when they have no profile row. */
  async findUserLimit(userId: string, manager: EntityManager): Promise<number> {
    const rows = await manager.query<{ active_reservation_limit: number }[]>(
      'SELECT active_reservation_limit FROM user_profile WHERE user_id = $1',
      [userId],
    );
    return rows[0]?.active_reservation_limit ?? DEFAULT_ACTIVE_RESERVATION_LIMIT;
  }

  async findAllPaginated(
    filters: FilterReservationsDto,
    restrictToUserId?: string,
  ): Promise<PaginatedResult<Reservation>> {
    const query = this.scope().createQueryBuilder('r').leftJoinAndSelect('r.resource', 'resource');

    // Applied by the service, not requested by the client: a non-admin sees
    // only their own reservations whatever they put in the query string.
    if (restrictToUserId) {
      query.andWhere('r.user_id = :restrictToUserId', { restrictToUserId });
    } else if (filters.userId) {
      query.andWhere('r.user_id = :userId', { userId: filters.userId });
    }

    if (filters.resourceId) {
      query.andWhere('r.resource_id = :resourceId', { resourceId: filters.resourceId });
    }

    if (filters.resourceTypeId) {
      query.andWhere('resource.resource_type_id = :typeId', { typeId: filters.resourceTypeId });
    }

    if (filters.status?.length) {
      query.andWhere('r.status IN (:...statuses)', { statuses: filters.status });
    }

    // Reservations that INTERSECT the window, not ones contained in it.
    // Asking "what is booked this week" must return the meeting that started
    // last Friday and runs into Monday.
    if (filters.from && filters.to) {
      query.andWhere("r.period && tstzrange(:from, :to, '[)')", {
        from: filters.from,
        to: filters.to,
      });
    } else if (filters.from) {
      query.andWhere('r.end_at > :from', { from: filters.from });
    } else if (filters.to) {
      query.andWhere('r.start_at < :to', { to: filters.to });
    }

    const sortBy = SORTABLE.has(filters.sortBy ?? '') ? filters.sortBy! : 'startAt';
    query.orderBy(`r.${sortBy}`, filters.sortOrder);

    return paginate(query, filters.page, filters.limit);
  }
}
