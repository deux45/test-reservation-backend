import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { CreateResourceTypeDto } from '../dtos/create-resource-type.dto';
import { ResourceTypeDto } from '../dtos/resource.dto';
import { ResourceTypeService } from '../services/resource-type.service';

@ApiTags('Resource types')
@Controller('resource-types')
export class ResourceTypesController {
  constructor(private readonly service: ResourceTypeService) {}

  @Get()
  @ApiOperation({
    summary: 'List resource types',
    description: 'Families of bookable resources: rooms, laptops, vehicles.',
  })
  @ApiOkResponse({ type: [ResourceTypeDto] })
  findAll(): Promise<ResourceTypeDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one resource type' })
  @ApiOkResponse({ type: ResourceTypeDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResourceTypeDto> {
    return this.service.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Create a resource type',
    description: 'Registering a new family (vehicle, projector) is this call, not a deployment.',
  })
  @ApiCreatedResponse({ type: ResourceTypeDto })
  @ApiConflictResponse({ description: 'A type with that code already exists' })
  create(@Body() dto: CreateResourceTypeDto): Promise<ResourceTypeDto> {
    return this.service.create(dto);
  }
}
