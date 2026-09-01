import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { type Interval } from '../utils/intervals.util';

export class AvailabilityQueryDto {
  /** Inicio del rango a consultar, UTC ISO 8601. */
  @ApiProperty({ example: '2026-12-15T00:00:00Z' })
  @IsISO8601()
  from: string;

  /** Fin del rango. Máximo 60 días desde `from`. */
  @ApiProperty({ example: '2026-12-16T00:00:00Z' })
  @IsISO8601()
  to: string;

  /**
   * Descarta los huecos más cortos que esto.
   *
   * Ofrecer un hueco de 15 minutos a quien necesita una hora solo produce un
   * intento fallido.
   */
  @ApiPropertyOptional({ minimum: 15, maximum: 480, default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(480)
  minDurationMinutes?: number;
}

export class AvailabilitySlotDto {
  /** Inicio del hueco, UTC. Inclusivo. */
  @ApiProperty() startAt: Date;

  /** Fin del hueco, UTC. **Exclusivo.** */
  @ApiProperty() endAt: Date;

  @ApiProperty({ example: 60 }) durationMinutes: number;

  /**
   * Zona en la que el cliente debe pintar el hueco.
   *
   * Va en cada slot para que el cliente no tenga que cruzarlo con el recurso
   * en una segunda petición solo para saber cómo mostrarlo.
   */
  @ApiProperty({ example: 'Europe/Madrid' }) timeZone: string;

  static from(interval: Interval, timeZone: string): AvailabilitySlotDto {
    return {
      startAt: interval.start,
      endAt: interval.end,
      durationMinutes: (interval.end.getTime() - interval.start.getTime()) / 60_000,
      timeZone,
    };
  }
}
