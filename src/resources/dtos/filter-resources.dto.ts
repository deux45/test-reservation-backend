import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export class FilterResourcesDto extends PaginationQueryDto {
  /** Solo recursos de este tipo. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  typeId?: string;

  /** Busca en nombre y código. */
  @ApiPropertyOptional({ example: 'aurora' })
  @IsOptional()
  @IsString()
  q?: string;

  /** Aforo mínimo. */
  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @ApiPropertyOptional({ example: 'Planta 2' })
  @IsOptional()
  @IsString()
  location?: string;

  /** Por defecto muestra activos e inactivos. */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  // A query string carries "true", not true. Without this the value arrives
  // as a non-empty string, which is truthy, and ?isActive=false would filter
  // for active resources.
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  isActive?: boolean;
}
