import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { type FilterUsersDto, type Role, UserDto } from '../dtos/user.dto';
import { UserRepository } from '../repositories/user.repository';

class UserNotFoundError extends NotFoundError {
  readonly code = 'USER_NOT_FOUND';

  constructor(id: string) {
    super(`No existe el usuario ${id}`, { userId: id });
  }
}

class CannotDemoteSelfError extends ConflictError {
  readonly code = 'CANNOT_DEMOTE_SELF';

  constructor() {
    super('No puedes quitarte a ti mismo el rol de administrador');
  }
}

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

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
   * Changes a user's role.
   *
   * Refuses to let an admin demote themselves. The obvious failure mode of a
   * role screen is the last administrator removing their own access and
   * locking everyone out of the only screen that could undo it.
   */
  async updateRole(id: string, role: Role, callerId: string): Promise<UserDto> {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundError(id);

    if (id === callerId && role !== 'admin') {
      throw new CannotDemoteSelfError();
    }

    await this.users.updateRole(id, role);

    const updated = await this.users.findById(id);
    const counts = await this.users.countActiveReservationsFor([id]);
    return UserDto.from(updated!, counts.get(id) ?? 0);
  }
}
