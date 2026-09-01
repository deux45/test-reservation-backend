import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateResourceTypeDto {
  /** Código único y estable. Minúsculas, números y guiones. */
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code solo admite minúsculas, números y guiones',
  })
  code: string;

  /** Nombre visible del tipo. */
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * JSON Schema que deben cumplir los atributos de cada recurso de este tipo.
   *
   * Es lo que hace genérico el modelo sin una tabla por tipo: dar de alta
   * "vehículo" es insertar una fila, no desplegar código. Se valida como
   * esquema al guardarlo, no la primera vez que alguien crea un recurso.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'object',
      required: ['floor'],
      properties: {
        floor: { type: 'integer', minimum: 0 },
        hasProjector: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  })
  @IsOptional()
  @IsObject()
  attributesSchema?: Record<string, unknown>;
}
