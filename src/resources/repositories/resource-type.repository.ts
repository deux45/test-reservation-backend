import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, type QueryDeepPartialEntity, Repository } from 'typeorm';
import { ResourceType } from '../entities/resource-type.entity';

/**
 * Fields an update may touch. `code` is excluded: it is the stable public
 * identifier and changing it would break every reference to the type.
 */
export type ResourceTypeUpdate = {
  name?: string;
  description?: string | null;
  attributesSchema?: Record<string, unknown>;
  isActive?: boolean;
};

@Injectable()
export class ResourceTypeRepository {
  constructor(
    @InjectRepository(ResourceType)
    private readonly repository: Repository<ResourceType>,
  ) {}

  private scope(manager?: EntityManager): Repository<ResourceType> {
    return manager ? manager.getRepository(ResourceType) : this.repository;
  }

  create(data: Partial<ResourceType>, manager?: EntityManager): Promise<ResourceType> {
    const scope = this.scope(manager);
    return scope.save(scope.create(data));
  }

  findById(id: string, manager?: EntityManager): Promise<ResourceType | null> {
    return this.scope(manager).findOne({ where: { id } });
  }

  findByCode(code: string, manager?: EntityManager): Promise<ResourceType | null> {
    return this.scope(manager).findOne({ where: { code } });
  }

  findAll(manager?: EntityManager): Promise<ResourceType[]> {
    return this.scope(manager).find({ order: { name: 'ASC' } });
  }

  async update(id: string, data: ResourceTypeUpdate, manager?: EntityManager): Promise<void> {
    // See ResourceRepository.update: one cast at the ORM boundary, because
    // TypeORM's deep partial does not map jsonb columns.
    await this.scope(manager).update(id, data as QueryDeepPartialEntity<ResourceType>);
  }
}
