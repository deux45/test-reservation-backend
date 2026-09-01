import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateResourceDto {
  /** Tipo al que pertenece. Determina qué atributos son válidos. */
  @IsUUID()
  resourceTypeId: string;

  /** Código único y estable. Minúsculas, números y guiones. */
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code solo admite minúsculas, números y guiones',
  })
  code: string;

  /** Nombre visible. */
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /** Aforo máximo. Se contrasta con los asistentes de cada reserva. */
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
   * Zona IANA, por ejemplo Europe/Madrid.
   *
   * El horario operativo se interpreta en esta zona; los instantes se guardan
   * siempre en UTC.
   */
  @ApiPropertyOptional({ example: 'Europe/Madrid', default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  /** Atributos propios del tipo. Se validan contra su JSON Schema. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
