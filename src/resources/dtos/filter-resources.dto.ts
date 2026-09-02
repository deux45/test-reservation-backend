import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export class FilterResourcesDto extends PaginationQueryDto {
  /** Only resources of this type. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  typeId?: string;

  /** Searches name and code. */
  @ApiPropertyOptional({ example: 'aurora' })
  @IsOptional()
  @IsString()
  q?: string;

  /** Minimum capacity. */
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

  /** By default both active and inactive are shown. */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  // A query string carries "true", not true. Without this the value arrives
  // as a non-empty string, which is truthy, and ?isActive=false would filter
  // for active resources.
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  isActive?: boolean;
}
