import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateReservationDto {
  /** Recurso a reservar. */
  @IsUUID()
  resourceId: string;

  /** Título visible en la agenda. */
  @IsString()
  @MaxLength(160)
  title: string;

  /**
   * Inicio en UTC, ISO 8601. **Inclusivo.**
   *
   * Debe caer en un múltiplo de 15 minutos.
   */
  @ApiProperty({ example: '2026-09-15T10:00:00Z' })
  @IsISO8601()
  startAt: string;

  /**
   * Fin en UTC, ISO 8601. **Exclusivo.**
   *
   * Una reserva que termina a las 11:00 no colisiona con otra que empieza a
   * las 11:00: los intervalos son semiabiertos `[inicio, fin)`.
   */
  @ApiProperty({ example: '2026-09-15T11:00:00Z' })
  @IsISO8601()
  endAt: string;

  /** Asistentes previstos. Se contrasta con el aforo del recurso. */
  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attendees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
