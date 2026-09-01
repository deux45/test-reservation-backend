import { type SelectQueryBuilder } from 'typeorm';
import { type PaginatedResult } from '../interfaces/pagination.interface';

/** Hard ceiling for un-paginated reads, so a forgotten filter cannot pull a table. */
export const MAX_ROWS = 500;

/**
 * Runs a query builder paginated and returns the standard envelope.
 *
 * Uses getManyAndCount(), which issues the COUNT in the same round trip and
 * -- unlike counting in JS -- stays correct when the query has joins.
 */
export async function paginate<T extends object>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number,
  limit: number,
): Promise<PaginatedResult<T>> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);

  const [data, total] = await queryBuilder
    .skip((safePage - 1) * safeLimit)
    .take(safeLimit)
    .getManyAndCount();

  return {
    data,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}
