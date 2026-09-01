import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { ApiPaginatedResponse } from '../../common/dtos/paginated-response.dto';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { CreateResourceDto } from '../dtos/create-resource.dto';
import { FilterResourcesDto } from '../dtos/filter-resources.dto';
import { ResourceDto } from '../dtos/resource.dto';
import { UpdateResourceDto } from '../dtos/update-resource.dto';
import { ResourceService } from '../services/resource.service';

@ApiTags('Resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly service: ResourceService) {}

  @Get()
  @ApiOperation({ summary: 'Lista recursos con filtros y paginación' })
  @ApiPaginatedResponse(ResourceDto)
  findAll(@Query() filters: FilterResourcesDto): Promise<PaginatedResult<ResourceDto>> {
    return this.service.findAllPaginated(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un recurso, con su tipo y horario semanal' })
  @ApiOkResponse({ type: ResourceDto })
  @ApiNotFoundResponse({ description: 'El recurso no existe' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResourceDto> {
    return this.service.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Crea un recurso',
    description:
      'Los atributos se validan contra el JSON Schema de su tipo, así que un ' +
      'recurso no puede existir con datos que su propia familia no admite.',
  })
  @ApiCreatedResponse({ type: ResourceDto })
  @ApiConflictResponse({ description: 'Ya existe un recurso con ese código' })
  @ApiUnprocessableEntityResponse({
    description: 'Los atributos no cumplen el esquema, o la zona horaria no es válida',
  })
  create(@Body() dto: CreateResourceDto): Promise<ResourceDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Actualiza un recurso',
    description:
      'code y resourceTypeId no son editables: cambiar cualquiera invalidaría ' +
      'en silencio los atributos ya guardados.',
  })
  @ApiOkResponse({ type: ResourceDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Da de baja un recurso',
    description:
      'Baja lógica. El recurso deja de poder reservarse pero su histórico de ' +
      'reservas se conserva intacto, que es la razón de no borrarlo.',
  })
  @ApiNoContentResponse()
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.deactivate(id);
  }

  @Post(':id/activation')
  @Roles('admin')
  @ApiOperation({ summary: 'Reactiva un recurso dado de baja' })
  @ApiOkResponse({ type: ResourceDto })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<ResourceDto> {
    return this.service.activate(id);
  }
}
