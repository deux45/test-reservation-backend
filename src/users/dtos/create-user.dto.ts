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
  /** Correo, único en el sistema. */
  @IsEmail()
  email: string;

  /** Mínimo 10 caracteres, igual que en el registro público. */
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  password: string;

  @IsString()
  @MaxLength(120)
  name: string;

  /** Por defecto `user`. */
  @ApiPropertyOptional({ enum: ROLES, default: 'user' })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;
}

export class BanUserDto {
  /** Motivo del bloqueo. Queda registrado. */
  @ApiPropertyOptional({ example: 'Uso indebido de las salas' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  /**
   * Duración en días. Sin valor, el bloqueo es indefinido.
   *
   * Better Auth levanta el bloqueo por sí solo al vencer, así que no hace
   * falta ningún proceso programado que lo revise.
   */
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
}
