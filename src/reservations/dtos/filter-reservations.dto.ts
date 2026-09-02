import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';
import { ReservationStatus } from '../enums/reservation-status.enum';

export class FilterReservationsDto extends PaginationQueryDto {
  /** Filter by resource. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  /** Filter by user. Ignored without the admin role: you only see your own. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  /** Every reservation for one family of resources. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceTypeId?: string;

  /** Repeatable: `?status=CONFIRMED&status=CANCELLED`. */
  @ApiPropertyOptional({ enum: ReservationStatus, isArray: true })
  @IsOptional()
  // A single occurrence arrives as a string, several as an array. Normalising
  // here keeps the repository from having to care which the client sent.
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value === undefined ? undefined : [value],
  )
  @IsArray()
  @IsEnum(ReservationStatus, { each: true })
  status?: ReservationStatus[];

  /**
   * Returns the reservations that **overlap** the range, not those contained
   * within it: asking "what is booked this week" must include the meeting
   * that started on Friday and ends on Monday.
   */
  @ApiPropertyOptional({ example: '2026-09-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
