import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateResourceTypeDto {
  /** Unique, stable code. Lowercase letters, digits and hyphens. */
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code solo admite minúsculas, números y guiones',
  })
  code: string;

  /** Display name of the type. */
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
