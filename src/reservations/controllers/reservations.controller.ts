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
    summary: 'Create a reservation',
    description:
      'Applies every business rule and guarantees there is no overlap. ' +
      'Intervals are half-open `[start, end)`: a reservation ending at 11:00 ' +
      'does not clash with one starting at 11:00.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Repeating the request with the same key returns the reservation already ' +
      'created instead of creating a second one.',
  })
  @ApiCreatedResponse({ type: ReservationDto })
  @ApiConflictResponse({
    description:
      'The slot is already taken (`OVERLAPPING_RESERVATION`, carrying the ' +
      'conflicting range), or a rule forbids it: outside operating hours, ' +
      'resource blocked, or the active reservation limit reached.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid range, a range in the past, or attendees above capacity.',
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
    summary: 'List reservations with filters and pagination',
    description:
      'Without the admin role only your own are returned, and the userId ' +
      'parameter is ignored. The range returns reservations that **overlap** it.',
  })
  @ApiPaginatedResponse(ReservationDto)
  findAll(
    @Query() filters: FilterReservationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<ReservationDto>> {
    return this.service.findAllPaginated(filters, toCaller(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one reservation' })
  @ApiOkResponse({ type: ReservationDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationDto> {
    return this.service.findById(id, toCaller(user));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reschedule a reservation',
    description:
      'Re-runs every rule while excluding this reservation, so that it does ' +
      'not collide with the slot it currently occupies.',
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
    summary: 'Cancel a reservation',
    description:
      'Idempotent: cancelling an already cancelled reservation returns 200. ' +
      'The slot is freed immediately, because the constraint only indexes ' +
      'CONFIRMED rows.',
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
