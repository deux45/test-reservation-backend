import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
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
    description:
      'Cada tipo trae su JSON Schema de atributos, que el cliente usa para ' +
      'renderizar el formulario de alta de recursos de ese tipo.',
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
      'Dar de alta una familia nueva (vehículo, proyector) es esta llamada, ' +
      'no un despliegue. El esquema se valida como JSON Schema antes de guardarlo.',
  })
  @ApiCreatedResponse({ type: ResourceTypeDto })
  @ApiConflictResponse({ description: 'Ya existe un tipo con ese código' })
  @ApiUnprocessableEntityResponse({ description: 'El esquema no es un JSON Schema válido' })
  create(@Body() dto: CreateResourceTypeDto): Promise<ResourceTypeDto> {
    return this.service.create(dto);
  }

  @Put(':id/attributes-schema')
  @Roles('admin')
  @ApiOperation({
    summary: 'Reemplaza el esquema de atributos de un tipo',
    description:
      'No revalida los recursos existentes: endurecer un esquema puede dejar ' +
      'recursos previos fuera de él, y rechazarlos en masa aquí sería peor que ' +
      'dejarlos como están hasta su próxima edición.',
  })
  @ApiOkResponse({ type: ResourceTypeDto })
  updateSchema(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() schema: Record<string, unknown>,
  ): Promise<ResourceTypeDto> {
    return this.service.updateSchema(id, schema);
  }
}
