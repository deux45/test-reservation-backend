import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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
}
