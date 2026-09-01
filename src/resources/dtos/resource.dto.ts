import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type Resource } from '../entities/resource.entity';
import { type ResourceType } from '../entities/resource-type.entity';

export class ResourceTypeDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'meeting-room' }) code: string;
  @ApiProperty({ example: 'Sala de reuniones' }) name: string;
  @ApiPropertyOptional() description: string | null;

  @ApiProperty() isActive: boolean;

  static from(entity: ResourceType): ResourceTypeDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      isActive: entity.isActive,
    };
  }
}

export class ResourceDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'aurora' }) code: string;
  @ApiProperty({ example: 'Sala Aurora' }) name: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional({ example: 12 }) capacity: number | null;
  @ApiPropertyOptional({ example: 'Planta 2' }) location: string | null;

  /** IANA zone. The client formats times in this zone, not the browser's. */
  @ApiProperty({ example: 'Europe/Madrid' }) timeZone: string;

  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ type: ResourceTypeDto }) resourceType?: ResourceTypeDto;
  @ApiProperty() createdAt: Date;

  static from(entity: Resource): ResourceDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      capacity: entity.capacity,
      location: entity.location,
      timeZone: entity.timeZone,
      isActive: entity.isActive,
      resourceType: entity.resourceType ? ResourceTypeDto.from(entity.resourceType) : undefined,
      createdAt: entity.createdAt,
    };
  }
}
