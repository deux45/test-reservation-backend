import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateResourceDto {
  /** The type it belongs to. */
  @IsUUID()
  resourceTypeId: string;

  /** Unique, stable code. Lowercase letters, digits and hyphens. */
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code solo admite minúsculas, números y guiones',
  })
  code: string;

  /** Display name. */
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /** Maximum capacity. Checked against each reservation's attendees. */
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Planta 2' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  /**
   * IANA zone, for example Europe/Madrid.
   *
   * Operating hours are interpreted in this zone; instants are always stored
   * in UTC.
   */
  @ApiPropertyOptional({ example: 'Europe/Madrid', default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}
