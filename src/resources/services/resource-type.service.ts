import { Injectable } from '@nestjs/common';
import { type CreateResourceTypeDto } from '../dtos/create-resource-type.dto';
import { ResourceTypeDto } from '../dtos/resource.dto';
import { DuplicateCodeError, ResourceTypeNotFoundError } from '../errors/resource.errors';
import { ResourceTypeRepository } from '../repositories/resource-type.repository';
import { ResourceAttributesService } from './resource-attributes.service';

@Injectable()
export class ResourceTypeService {
  constructor(
    private readonly repository: ResourceTypeRepository,
    private readonly attributes: ResourceAttributesService,
  ) {}

  async create(dto: CreateResourceTypeDto): Promise<ResourceTypeDto> {
    const schema = dto.attributesSchema ?? { type: 'object' };

    // Rejected here rather than the first time someone creates a resource of
    // this type, which would surface as a confusing failure far from the
    // change that caused it.
    this.attributes.assertValidSchema(schema);

    if (await this.repository.findByCode(dto.code)) {
      throw new DuplicateCodeError('tipo de recurso', dto.code);
    }

    const created = await this.repository.create({ ...dto, attributesSchema: schema });
    return ResourceTypeDto.from(created);
  }

  async findAll(): Promise<ResourceTypeDto[]> {
    const types = await this.repository.findAll();
    return types.map((type) => ResourceTypeDto.from(type));
  }

  async findById(id: string): Promise<ResourceTypeDto> {
    return ResourceTypeDto.from(await this.getOrFail(id));
  }

  async updateSchema(id: string, schema: Record<string, unknown>): Promise<ResourceTypeDto> {
    await this.getOrFail(id);
    this.attributes.assertValidSchema(schema);

    await this.repository.update(id, { attributesSchema: schema });
    // Compiled validators are cached per type; a stale one would keep
    // enforcing the previous schema.
    this.attributes.invalidate(id);

    return this.findById(id);
  }

  /** Shared lookup so "not found" is one error with one message everywhere. */
  private async getOrFail(id: string) {
    const type = await this.repository.findById(id);
    if (!type) throw new ResourceTypeNotFoundError(id);
    return type;
  }
}
