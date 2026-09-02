import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ROLES, type Role } from './user.dto';

export class CreateUserDto {
  /** Email, unique across the system. */
  @IsEmail()
  email: string;

  /** At least 10 characters, the same as public sign-up. */
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  password: string;

  @IsString()
  @MaxLength(120)
  name: string;

  /** Defaults to `user`. */
  @ApiPropertyOptional({ enum: ROLES, default: 'user' })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;
}

export class UpdateUserDto {
  /** Display name. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /**
   * Email. It must remain unique.
   *
   * Changing it changes the credential this person signs in with, which is
   * why the interface warns before saving.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class BanUserDto {
  /** Reason for the ban. It is recorded. */
  @ApiPropertyOptional({ example: 'Misuse of the meeting rooms' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  /**
   * Duration in days. With no value the ban is indefinite.
   *
   * Better Auth lifts the ban itself once it expires, so no scheduled job is
   * needed to check for it.
   */
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
}
