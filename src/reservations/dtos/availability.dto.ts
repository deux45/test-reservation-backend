import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { type Interval } from '../utils/intervals.util';

export class AvailabilityQueryDto {
  /** Start of the range to query, UTC ISO 8601. */
  @ApiProperty({ example: '2026-12-15T00:00:00Z' })
  @IsISO8601()
  from: string;

  /** End of the range. At most 60 days from `from`. */
  @ApiProperty({ example: '2026-12-16T00:00:00Z' })
  @IsISO8601()
  to: string;

  /**
   * Discards slots shorter than this.
   *
   * Offering a 15-minute slot to someone who needs an hour only produces a
   * failed attempt.
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
  /** Start of the slot, UTC. Inclusive. */
  @ApiProperty() startAt: Date;

  /** End of the slot, UTC. **Exclusive.** */
  @ApiProperty() endAt: Date;

  @ApiProperty({ example: 60 }) durationMinutes: number;

  /**
   * The zone the client should render the slot in.
   *
   * Carried on every slot so the client does not have to cross-reference the
   * resource in a second request just to know how to display it.
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
