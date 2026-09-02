import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query parameters shared by every paginated listing. */
export class PaginationQueryDto {
  /** Page number, starting at 1. */
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Results per page. */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // Capped so a client cannot ask for the whole table in one request.
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  /**
   * Sort field. Each controller restricts the allowed values, because
   * interpolating a client-supplied column name into ORDER BY is an injection
   * vector that no parameter binding protects against.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;
}
