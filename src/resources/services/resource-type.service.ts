import { Injectable } from '@nestjs/common';
import { type CreateResourceTypeDto } from '../dtos/create-resource-type.dto';
import { ResourceTypeDto } from '../dtos/resource.dto';
import { DuplicateCodeError, ResourceTypeNotFoundError } from '../errors/resource.errors';
import { ResourceTypeRepository } from '../repositories/resource-type.repository';

@Injectable()
export class ResourceTypeService {
  constructor(private readonly repository: ResourceTypeRepository) {}

  async create(dto: CreateResourceTypeDto): Promise<ResourceTypeDto> {
    if (await this.repository.findByCode(dto.code)) {
      throw new DuplicateCodeError('tipo de recurso', dto.code);
    }

    return ResourceTypeDto.from(await this.repository.create(dto));
  }

  async findAll(): Promise<ResourceTypeDto[]> {
    const types = await this.repository.findAll();
    return types.map((type) => ResourceTypeDto.from(type));
  }

  async findById(id: string): Promise<ResourceTypeDto> {
    const type = await this.repository.findById(id);
    if (!type) throw new ResourceTypeNotFoundError(id);
    return ResourceTypeDto.from(type);
  }
}
