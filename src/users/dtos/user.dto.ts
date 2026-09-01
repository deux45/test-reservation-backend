import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';
import { type UserAccount } from '../entities/user.entity';

/** The roles this system recognises. */
export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ROLES }) role: Role;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty() banned: boolean;

  /** Future confirmed reservations. Shown so an admin sees the impact of a ban. */
  @ApiProperty({ example: 3 }) activeReservations: number;

  @ApiProperty() createdAt: Date;

  static from(entity: UserAccount, activeReservations: number): UserDto {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      // Better Auth leaves role null until the admin plugin sets one.
      role: entity.role === 'admin' ? 'admin' : 'user',
      emailVerified: entity.emailVerified,
      banned: entity.banned ?? false,
      activeReservations,
      createdAt: entity.createdAt,
    };
  }
}

export class UpdateRoleDto {
  /** Nuevo rol. Solo `admin` o `user`. */
  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role: Role;
}

export class FilterUsersDto extends PaginationQueryDto {
  /** Busca en nombre y correo. */
  @ApiPropertyOptional({ example: 'ana' })
  // Without these the field has no validator, and forbidNonWhitelisted
  // rejects the whole request with "property q should not exist" -- the pipe
  // doing its job, since an undecorated field is not part of the contract.
  @IsOptional()
  @IsString()
  q?: string;
}
