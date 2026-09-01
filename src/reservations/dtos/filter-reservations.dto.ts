import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';
import { ReservationStatus } from '../enums/reservation-status.enum';

export class FilterReservationsDto extends PaginationQueryDto {
  /** Filtra por recurso. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  /** Filtra por usuario. Sin rol admin se ignora: solo verás las tuyas. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  /** Todas las reservas de una familia de recursos. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceTypeId?: string;

  /** Repetible: `?status=CONFIRMED&status=CANCELLED`. */
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
   * Devuelve las reservas que **se solapan** con el rango, no las contenidas
   * en él: preguntar "qué hay reservado esta semana" debe incluir la reunión
   * que empezó el viernes y termina el lunes.
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
