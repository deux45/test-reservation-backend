import { Injectable } from '@nestjs/common';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { type CreateResourceDto } from '../dtos/create-resource.dto';
import { type FilterResourcesDto } from '../dtos/filter-resources.dto';
import { ResourceDto } from '../dtos/resource.dto';
import { type UpdateResourceDto } from '../dtos/update-resource.dto';
import { type Resource } from '../entities/resource.entity';
import {
  DuplicateCodeError,
  InvalidTimeZoneError,
  ResourceNotFoundError,
  ResourceTypeNotFoundError,
} from '../errors/resource.errors';
import { ResourceRepository } from '../repositories/resource.repository';
import { ResourceTypeRepository } from '../repositories/resource-type.repository';

@Injectable()
export class ResourceService {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly types: ResourceTypeRepository,
  ) {}

  async create(dto: CreateResourceDto): Promise<ResourceDto> {
    const type = await this.types.findById(dto.resourceTypeId);
    if (!type) throw new ResourceTypeNotFoundError(dto.resourceTypeId);

    if (await this.resources.findByCode(dto.code)) {
      throw new DuplicateCodeError('recurso', dto.code);
    }

    const timeZone = dto.timeZone ?? 'UTC';
    assertValidTimeZone(timeZone);

    return ResourceDto.from(await this.resources.create({ ...dto, timeZone }));
  }

  async findAllPaginated(filters: FilterResourcesDto): Promise<PaginatedResult<ResourceDto>> {
    const result = await this.resources.findAllPaginated(filters);
    return { ...result, data: result.data.map((r) => ResourceDto.from(r)) };
  }

  async findById(id: string): Promise<ResourceDto> {
    return ResourceDto.from(await this.getOrFail(id));
  }

  async update(id: string, dto: UpdateResourceDto): Promise<ResourceDto> {
    await this.getOrFail(id);

    if (dto.timeZone) assertValidTimeZone(dto.timeZone);

    await this.resources.update(id, dto);
    return this.findById(id);
  }

  /**
   * Soft delete.
   *
   * Deactivating an already inactive resource is a no-op rather than an error,
   * because the caller's intent is already satisfied.
   */
  async deactivate(id: string): Promise<void> {
    const resource = await this.getOrFail(id);
    if (!resource.isActive) return;

    await this.resources.update(id, { isActive: false, deactivatedAt: new Date() });
  }

  async activate(id: string): Promise<ResourceDto> {
    const resource = await this.getOrFail(id);
    if (resource.isActive) return ResourceDto.from(resource);

    await this.resources.update(id, { isActive: true, deactivatedAt: null });
    return this.findById(id);
  }

  private async getOrFail(id: string): Promise<Resource> {
    const resource = await this.resources.findById(id);
    if (!resource) throw new ResourceNotFoundError(id);
    return resource;
  }
}

/**
 * Rejects a zone Node does not know.
 *
 * An invalid zone stored here would not fail until availability is computed,
 * days later and far from the change that caused it.
 */
function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new InvalidTimeZoneError(timeZone);
  }
}
