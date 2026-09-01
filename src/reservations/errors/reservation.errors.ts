import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../../common/errors/domain.error';
import { type Period } from '../period.vo';

/** 422 — the requested range is not a valid booking period at all. */
export class InvalidPeriodError extends UnprocessableError {
  readonly code = 'INVALID_PERIOD';
}

/**
 * 409 — the central rule of the system.
 *
 * Carries the conflicting reservation's range so the client can say
 * "ocupado de 10:00 a 11:00" and offer nearby slots, rather than just
 * refusing. That payload is why the application-level check exists at all:
 * the database constraint alone would guarantee correctness but could only
 * report an opaque failure.
 */
export class OverlappingReservationError extends ConflictError {
  readonly code = 'OVERLAPPING_RESERVATION';

  constructor(
    resourceId: string,
    period: Period,
    conflict?: { id: string; startAt: Date; endAt: Date },
  ) {
    super('El recurso ya está reservado en ese horario', {
      resourceId,
      requested: period.toRange(),
      conflict: conflict && {
        reservationId: conflict.id,
        startAt: conflict.startAt.toISOString(),
        endAt: conflict.endAt.toISOString(),
      },
    });
  }
}

export class ReservationNotFoundError extends NotFoundError {
  readonly code = 'RESERVATION_NOT_FOUND';

  constructor(id: string) {
    super(`No existe la reserva ${id}`, { reservationId: id });
  }
}

export class ReservationInThePastError extends UnprocessableError {
  readonly code = 'RESERVATION_IN_PAST';

  constructor() {
    super('No se puede reservar en el pasado');
  }
}

export class ResourceUnavailableError extends ConflictError {
  readonly code = 'RESOURCE_UNAVAILABLE';

  constructor(resourceId: string) {
    super('El recurso no está disponible para reservas', { resourceId });
  }
}

export class OutsideOperatingHoursError extends ConflictError {
  readonly code = 'OUTSIDE_OPERATING_HOURS';

  constructor(resourceId: string, timeZone: string) {
    super('El recurso no está disponible a esa hora', { resourceId, timeZone });
  }
}

export class ResourceBlockedError extends ConflictError {
  readonly code = 'RESOURCE_BLOCKED';

  constructor(resourceId: string, reason: string) {
    super(`El recurso está bloqueado en ese periodo: ${reason}`, { resourceId, reason });
  }
}

export class CapacityExceededError extends UnprocessableError {
  readonly code = 'CAPACITY_EXCEEDED';

  constructor(requested: number, capacity: number) {
    super(`El recurso admite ${capacity} personas y se han indicado ${requested}`, {
      requested,
      capacity,
    });
  }
}

export class ReservationLimitReachedError extends ConflictError {
  readonly code = 'RESERVATION_LIMIT_REACHED';

  constructor(limit: number) {
    super(`Has alcanzado tu límite de ${limit} reservas activas`, { limit });
  }
}

/** A retry of a request that already succeeded. Not an error condition. */
export class DuplicateReservationError extends ConflictError {
  readonly code = 'DUPLICATE_RESERVATION';

  constructor(idempotencyKey: string) {
    super('Ya existe una reserva creada con esa clave de idempotencia', { idempotencyKey });
  }
}

export class ReservationAlreadyEndedError extends ConflictError {
  readonly code = 'RESERVATION_ALREADY_ENDED';

  constructor(id: string) {
    super('No se puede modificar una reserva que ya terminó', { reservationId: id });
  }
}

export class ReservationForbiddenError extends ForbiddenError {
  readonly code = 'RESERVATION_FORBIDDEN';

  constructor() {
    super('Solo puedes gestionar tus propias reservas');
  }
}
