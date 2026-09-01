import { ConflictError, NotFoundError, UnprocessableError } from '../../common/errors/domain.error';

export class ResourceNotFoundError extends NotFoundError {
  readonly code = 'RESOURCE_NOT_FOUND';

  constructor(id: string) {
    super(`No existe el recurso ${id}`, { resourceId: id });
  }
}

export class ResourceTypeNotFoundError extends NotFoundError {
  readonly code = 'RESOURCE_TYPE_NOT_FOUND';

  constructor(id: string) {
    super(`No existe el tipo de recurso ${id}`, { resourceTypeId: id });
  }
}

export class DuplicateCodeError extends ConflictError {
  readonly code = 'DUPLICATE_CODE';

  constructor(entity: string, duplicated: string) {
    super(`Ya existe un ${entity} con el código "${duplicated}"`, { code: duplicated });
  }
}

/**
 * Deactivating a resource that still has future confirmed reservations.
 *
 * Refused by default rather than silently cancelling other people's bookings.
 * The caller can pass ?force=true to cancel them deliberately.
 */
export class ResourceHasFutureReservationsError extends ConflictError {
  readonly code = 'RESOURCE_HAS_FUTURE_RESERVATIONS';

  constructor(id: string, count: number) {
    super(
      `El recurso tiene ${count} reserva(s) futura(s) confirmada(s). ` +
        'Usa ?force=true para cancelarlas y darlo de baja.',
      { resourceId: id, futureReservations: count },
    );
  }
}

export class InvalidTimeZoneError extends UnprocessableError {
  readonly code = 'INVALID_TIME_ZONE';

  constructor(timeZone: string) {
    super(`"${timeZone}" no es una zona horaria IANA válida`, { timeZone });
  }
}
