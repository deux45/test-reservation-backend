import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { AUTH_PROVIDER, type AuthProvider } from '../../auth/ports/auth-provider.port';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { type BanUserDto, type CreateUserDto, type UpdateUserDto } from '../dtos/create-user.dto';
import { type FilterUsersDto, type Role, UserDto } from '../dtos/user.dto';
import { UserRepository } from '../repositories/user.repository';

class UserNotFoundError extends NotFoundError {
  readonly code = 'USER_NOT_FOUND';

  constructor(id: string) {
    super(`No existe el usuario ${id}`, { userId: id });
  }
}

class CannotActOnSelfError extends ConflictError {
  readonly code = 'CANNOT_ACT_ON_SELF';

  constructor(action: string) {
    super(`No puedes ${action} tu propia cuenta`);
  }
}

class EmailAlreadyUsedError extends ConflictError {
  readonly code = 'EMAIL_ALREADY_USED';

  constructor(email: string) {
    super(`Ya existe una cuenta con el correo ${email}`, { email });
  }
}

const MS_PER_DAY = 86_400_000;

@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
  ) {}

  async findAllPaginated(filters: FilterUsersDto): Promise<PaginatedResult<UserDto>> {
    const page = await this.users.findAllPaginated(filters);

    // One extra query for the whole page, not one per row.
    const counts = await this.users.countActiveReservationsFor(page.data.map((user) => user.id));

    return {
      ...page,
      data: page.data.map((user) => UserDto.from(user, counts.get(user.id) ?? 0)),
    };
  }

  /**
   * Creates an account on someone's behalf.
   *
   * Delegated to the identity provider rather than inserting rows: it owns
   * password hashing, and a "user" row without a matching "account" row could
   * never sign in.
   *
   * A provider that cannot provision accounts -- one backed by corporate SSO,
   * say -- leaves createAccount undefined, and this answers 501 rather than
   * pretending the attempt failed.
   */
  async create(dto: CreateUserDto): Promise<UserDto> {
    if (!this.authProvider.createAccount) {
      throw new NotImplementedException(
        `El proveedor de identidad "${this.authProvider.name}" no permite crear cuentas`,
      );
    }

    let created: { id: string };
    try {
      created = await this.authProvider.createAccount({
        email: dto.email,
        password: dto.password,
        name: dto.name,
      });
    } catch (error) {
      // Better Auth answers 422 for a duplicate email. Translated here so the
      // client sees this system's error catalogue, not the provider's.
      if (isDuplicateEmail(error)) throw new EmailAlreadyUsedError(dto.email);
      throw error;
    }

    // The provider assigns the default role; an explicit one is applied after.
    if (dto.role && dto.role !== 'user') {
      await this.users.updateRole(created.id, dto.role);
    }

    return this.findOne(created.id);
  }

  /**
   * Updates the editable profile fields.
   *
   * Email is the credential this person signs in with, so changing it changes
   * how they get in. The interface warns before saving; this checks that the
   * new address is free, because the unique index would otherwise surface as
   * a raw database error.
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    await this.getOrFail(id);

    if (dto.email) {
      const existing = await this.users.findByEmail(dto.email);
      // Re-saving the same address is a no-op, not a conflict: an edit form
      // sends every field, including the ones that did not change.
      if (existing && existing.id !== id) throw new EmailAlreadyUsedError(dto.email);
    }

    await this.users.updateProfile(id, dto.name, dto.email);
    return this.findOne(id);
  }

  /**
   * Changes a user's role.
   *
   * Refuses to let an admin demote themselves. The obvious failure mode of a
   * role screen is the last administrator removing their own access and
   * locking everyone out of the only screen that could undo it.
   */
  async updateRole(id: string, role: Role, callerId: string): Promise<UserDto> {
    await this.getOrFail(id);

    if (id === callerId && role !== 'admin') {
      throw new CannotActOnSelfError('degradar');
    }

    await this.users.updateRole(id, role);
    return this.findOne(id);
  }

  /**
   * Blocks an account, immediately.
   *
   * BetterAuthProvider rejects a banned user on every request, so the block
   * takes effect at once rather than when the session expires. Sessions are
   * revoked here as well, to free the rows instead of leaving them to lapse.
   */
  async ban(id: string, dto: BanUserDto, callerId: string): Promise<UserDto> {
    await this.getOrFail(id);

    if (id === callerId) throw new CannotActOnSelfError('bloquear');

    const until = dto.days ? new Date(Date.now() + dto.days * MS_PER_DAY) : null;

    await this.users.ban(id, dto.reason ?? null, until);
    await this.users.revokeSessions(id);

    return this.findOne(id);
  }

  async unban(id: string): Promise<UserDto> {
    await this.getOrFail(id);
    await this.users.unban(id);
    return this.findOne(id);
  }

  private async findOne(id: string): Promise<UserDto> {
    const user = await this.getOrFail(id);
    const counts = await this.users.countActiveReservationsFor([id]);
    return UserDto.from(user, counts.get(id) ?? 0);
  }

  private async getOrFail(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }
}

function isDuplicateEmail(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|duplicate|USER_ALREADY_EXISTS/i.test(message);
}
