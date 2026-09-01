import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import { type AuthenticatedUser } from '../../auth/ports/auth-provider.port';
import { ApiPaginatedResponse } from '../../common/dtos/paginated-response.dto';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { CreateReservationDto } from '../dtos/create-reservation.dto';
import { FilterReservationsDto } from '../dtos/filter-reservations.dto';
import { CancelReservationDto, ReservationDto } from '../dtos/reservation.dto';
import { type Caller, ReservationService } from '../services/reservation.service';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly service: ReservationService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea una reserva',
    description:
      'Aplica todas las reglas de negocio y garantiza que no haya solapes. ' +
      'Los intervalos son semiabiertos `[inicio, fin)`: una reserva que ' +
      'termina a las 11:00 no choca con otra que empieza a las 11:00.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Si se repite la petición con la misma clave se devuelve la reserva ya ' +
      'creada en lugar de crear una segunda.',
  })
  @ApiCreatedResponse({ type: ReservationDto })
  @ApiConflictResponse({
    description:
      'El horario ya está ocupado (`OVERLAPPING_RESERVATION`, con el rango en ' +
      'conflicto), o alguna regla lo impide: fuera de horario, recurso ' +
      'bloqueado o límite de reservas alcanzado.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Rango inválido, en el pasado, o asistentes por encima del aforo.',
  })
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ReservationDto> {
    return this.service.create(dto, user.id, idempotencyKey);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista reservas con filtros y paginación',
    description:
      'Sin rol admin solo se devuelven las propias, ignorando el parámetro ' +
      'userId. El rango devuelve las reservas que **se solapan** con él.',
  })
  @ApiPaginatedResponse(ReservationDto)
  findAll(
    @Query() filters: FilterReservationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<ReservationDto>> {
    return this.service.findAllPaginated(filters, toCaller(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una reserva' })
  @ApiOkResponse({ type: ReservationDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationDto> {
    return this.service.findById(id, toCaller(user));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reprograma una reserva',
    description:
      'Reejecuta todas las reglas excluyéndose a sí misma, para que no ' +
      'colisione con su propio hueco actual.',
  })
  @ApiOkResponse({ type: ReservationDto })
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationDto> {
    return this.service.reschedule(id, dto, toCaller(user));
  }

  /**
   * Cancellation as a resource, not a DELETE.
   *
   * Cancelling does not remove anything: it records who, when and why. A POST
   * that creates a cancellation fact says that in the URL and can carry a body.
   */
  @Post(':id/cancellation')
  @ApiOperation({
    summary: 'Cancela una reserva',
    description:
      'Idempotente: cancelar una reserva ya cancelada devuelve 200. El hueco ' +
      'queda libre de inmediato, porque la constraint solo indexa CONFIRMED.',
  })
  @ApiOkResponse({ type: ReservationDto })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationDto> {
    return this.service.cancel(id, toCaller(user), dto.reason);
  }
}

const toCaller = (user: AuthenticatedUser): Caller => ({
  userId: user.id,
  isAdmin: user.roles.includes('admin'),
});
