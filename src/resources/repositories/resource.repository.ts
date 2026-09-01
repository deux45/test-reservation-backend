import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, Repository } from 'typeorm';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { paginate } from '../../common/utils/paginate.util';
import { Resource } from '../entities/resource.entity';
import { type FilterResourcesDto } from '../dtos/filter-resources.dto';

/** Columns a client is allowed to sort by. */
const SORTABLE = new Set(['name', 'code', 'capacity', 'createdAt']);

/**
 * Fields an update may touch.
 *
 * Deliberately narrower than Partial<Resource>: it excludes relations, the
 * primary key and the immutable `code` and `resourceTypeId`, so a typo cannot
 * quietly reassign a resource to another type.
 */
export type ResourceUpdate = {
  name?: string;
  description?: string | null;
  capacity?: number | null;
  location?: string | null;
  timeZone?: string;
  isActive?: boolean;
  deactivatedAt?: Date | null;
};

/**
 * All Resource persistence.
 *
 * QueryBuilder never leaves this folder. That is the boundary the layered
 * architecture was really after: services express intent, this file knows SQL,
 * and swapping the ORM touches one directory.
 */
@Injectable()
export class ResourceRepository {
  constructor(
    @InjectRepository(Resource)
    private readonly repository: Repository<Resource>,
  ) {}

  /** Scoped to a transaction when one is given, so callers can compose. */
  private scope(manager?: EntityManager): Repository<Resource> {
    return manager ? manager.getRepository(Resource) : this.repository;
  }

  create(data: Partial<Resource>, manager?: EntityManager): Promise<Resource> {
    const scope = this.scope(manager);
    return scope.save(scope.create(data));
  }

  findById(id: string, manager?: EntityManager): Promise<Resource | null> {
    return this.scope(manager).findOne({
      where: { id },
      // Object form: TypeORM 1.x dropped the string-array shorthand.
      relations: { resourceType: true, availability: true },
    });
  }

  /**
   * Only an active resource, with no relations loaded.
   *
   * The reservation path calls this on every booking and needs one row, not a
   * resource plus its type plus its weekly windows.
   */
  findActiveById(id: string, manager?: EntityManager): Promise<Resource | null> {
    return this.scope(manager).findOne({ where: { id, isActive: true } });
  }

  findByCode(code: string, manager?: EntityManager): Promise<Resource | null> {
    return this.scope(manager).findOne({ where: { code } });
  }

  async update(id: string, data: ResourceUpdate, manager?: EntityManager): Promise<void> {
    // One cast, at the ORM boundary, because TypeORM's deep-partial mapping
    // rejects a jsonb column typed as Record<string, unknown>. ResourceUpdate
    // above is what actually constrains callers.
    await this.scope(manager).update(id, data);
  }

  async findAllPaginated(filters: FilterResourcesDto): Promise<PaginatedResult<Resource>> {
    const query = this.scope()
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.resourceType', 'resourceType');

    if (filters.typeId) {
      query.andWhere('resource.resource_type_id = :typeId', { typeId: filters.typeId });
    }

    if (filters.isActive !== undefined) {
      query.andWhere('resource.is_active = :isActive', { isActive: filters.isActive });
    }

    if (filters.minCapacity !== undefined) {
      query.andWhere('resource.capacity >= :minCapacity', { minCapacity: filters.minCapacity });
    }

    if (filters.location) {
      query.andWhere('resource.location ILIKE :location', { location: `%${filters.location}%` });
    }

    if (filters.q?.trim()) {
      // andWhere with a Brackets group, never where(): in TypeORM, .where()
      // DISCARDS every condition added before it, which would silently drop
      // the filters above as soon as a search term is present.
      query.andWhere(
        new Brackets((qb) => {
          qb.where('resource.name ILIKE :term').orWhere('resource.code ILIKE :term');
        }),
        { term: `%${filters.q.trim()}%` },
      );
    }

    // Whitelisted: a client-supplied column name interpolated into ORDER BY is
    // an injection vector that parameter binding does not cover.
    const sortBy = SORTABLE.has(filters.sortBy ?? '') ? filters.sortBy! : 'name';
    query.orderBy(`resource.${sortBy}`, filters.sortBy ? filters.sortOrder : 'ASC');

    return paginate(query, filters.page, filters.limit);
  }
}
