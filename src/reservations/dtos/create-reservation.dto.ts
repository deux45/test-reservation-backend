import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateReservationDto {
  /** The resource to book. */
  @IsUUID()
  resourceId: string;

  /** Title shown in the schedule. */
  @IsString()
  @MaxLength(160)
  title: string;

  /**
   * Start in UTC, ISO 8601. **Inclusive.**
   *
   * Must fall on a multiple of 15 minutes.
   */
  @ApiProperty({ example: '2026-09-15T10:00:00Z' })
  @IsISO8601()
  startAt: string;

  /**
   * End in UTC, ISO 8601. **Exclusive.**
   *
   * A reservation ending at 11:00 does not collide with one starting at
   * 11:00: intervals are half-open `[start, end)`.
   */
  @ApiProperty({ example: '2026-09-15T11:00:00Z' })
  @IsISO8601()
  endAt: string;

  /** Expected attendees. Checked against the resource's capacity. */
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
