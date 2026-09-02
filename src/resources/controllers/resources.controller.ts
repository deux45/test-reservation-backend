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
  @ApiOperation({ summary: 'List resources with filters and pagination' })
  @ApiPaginatedResponse(ResourceDto)
  findAll(@Query() filters: FilterResourcesDto): Promise<PaginatedResult<ResourceDto>> {
    return this.service.findAllPaginated(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one resource, with its type and weekly schedule' })
  @ApiOkResponse({ type: ResourceDto })
  @ApiNotFoundResponse({ description: 'The resource does not exist' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResourceDto> {
    return this.service.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Create a resource',
    description: 'Registers a bookable resource under an existing type.',
  })
  @ApiCreatedResponse({ type: ResourceDto })
  @ApiConflictResponse({ description: 'A resource with that code already exists' })
  @ApiUnprocessableEntityResponse({
    description: 'The time zone is not valid',
  })
  create(@Body() dto: CreateResourceDto): Promise<ResourceDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Update a resource',
    description: 'code and resourceTypeId are not editable: both identify the resource.',
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
    summary: 'Deactivate a resource',
    description:
      'A soft delete. The resource can no longer be booked, but its reservation ' +
      'history is kept intact -- which is the reason it is not deleted.',
  })
  @ApiNoContentResponse()
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.deactivate(id);
  }

  @Post(':id/activation')
  @Roles('admin')
  @ApiOperation({ summary: 'Reactivate a deactivated resource' })
  @ApiOkResponse({ type: ResourceDto })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<ResourceDto> {
    return this.service.activate(id);
  }
}
