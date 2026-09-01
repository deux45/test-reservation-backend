import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { paginate } from '../../common/utils/paginate.util';
import { type FilterUsersDto, type Role } from '../dtos/user.dto';
import { UserAccount } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserAccount)
    private readonly repository: Repository<UserAccount>,
  ) {}

  findById(id: string): Promise<UserAccount | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findAllPaginated(filters: FilterUsersDto): Promise<PaginatedResult<UserAccount>> {
    const query = this.repository.createQueryBuilder('u');

    if (filters.q?.trim()) {
      // andWhere with a Brackets group. Not where(), which in TypeORM discards
      // everything added before it.
      query.andWhere(
        new Brackets((qb) => {
          qb.where('u.name ILIKE :term').orWhere('u.email ILIKE :term');
        }),
        { term: `%${filters.q.trim()}%` },
      );
    }

    query.orderBy('u."createdAt"', filters.sortOrder);

    return paginate(query, filters.page, filters.limit);
  }

  /**
   * Counts future confirmed reservations per user, in one query.
   *
   * Not a count per row: that is the N+1 that turns a 20-row page into 21
   * round trips, and it only shows up once the table has real data in it.
   */
  async countActiveReservationsFor(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.repository.manager.query<{ user_id: string; count: string }[]>(
      `SELECT user_id, COUNT(*)::text AS count
         FROM reservation
        WHERE user_id = ANY($1) AND status = 'CONFIRMED' AND end_at > now()
        GROUP BY user_id`,
      [userIds],
    );

    return new Map(rows.map((row) => [row.user_id, Number(row.count)]));
  }

  /**
   * The single write this module performs.
   *
   * An explicit UPDATE of one column rather than saving the entity: Better
   * Auth owns these rows, and a full save would write back every field this
   * projection happens to know about, silently reverting anything it does not.
   */
  async updateRole(id: string, role: Role): Promise<void> {
    await this.repository.manager.query('UPDATE "user" SET role = $1 WHERE id = $2', [role, id]);
  }

  /** Blocks an account. `until` is null for an indefinite ban. */
  async ban(id: string, reason: string | null, until: Date | null): Promise<void> {
    await this.repository.manager.query(
      'UPDATE "user" SET banned = true, "banReason" = $1, "banExpires" = $2 WHERE id = $3',
      [reason, until, id],
    );
  }

  async unban(id: string): Promise<void> {
    await this.repository.manager.query(
      'UPDATE "user" SET banned = false, "banReason" = NULL, "banExpires" = NULL WHERE id = $1',
      [id],
    );
  }

  /**
   * Drops every session the user holds.
   *
   * Belt and braces with the per-request ban check in BetterAuthProvider: that
   * one already stops a banned session being used, and this frees the rows
   * rather than leaving them to expire on their own.
   */
  async revokeSessions(id: string): Promise<void> {
    await this.repository.manager.query('DELETE FROM "session" WHERE "userId" = $1', [id]);
  }
}
