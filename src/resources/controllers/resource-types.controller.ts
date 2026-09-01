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
    summary: 'Lista los tipos de recurso',
    description: 'Familias de recursos reservables: salas, portátiles, vehículos.',
  })
  @ApiOkResponse({ type: [ResourceTypeDto] })
  findAll(): Promise<ResourceTypeDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un tipo de recurso' })
  @ApiOkResponse({ type: ResourceTypeDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResourceTypeDto> {
    return this.service.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Crea un tipo de recurso',
    description:
      'Dar de alta una familia nueva (vehículo, proyector) es esta llamada, no un despliegue.',
  })
  @ApiCreatedResponse({ type: ResourceTypeDto })
  @ApiConflictResponse({ description: 'Ya existe un tipo con ese código' })
  create(@Body() dto: CreateResourceTypeDto): Promise<ResourceTypeDto> {
    return this.service.create(dto);
  }
}
