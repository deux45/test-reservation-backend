import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../auth/decorators';
import { type AuthenticatedUser } from '../../auth/ports/auth-provider.port';
import { ApiPaginatedResponse } from '../../common/dtos/paginated-response.dto';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { FilterUsersDto, UpdateRoleDto, UserDto } from '../dtos/user.dto';
import { UserService } from '../services/user.service';

@ApiTags('Users')
@Roles('admin') // Applied at class level: every route here is administrative.
@Controller('users')
export class UsersController {
  constructor(private readonly service: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los usuarios',
    description:
      'Incluye cuántas reservas futuras confirmadas tiene cada uno, para que ' +
      'el impacto de un cambio de rol sea visible antes de hacerlo.',
  })
  @ApiPaginatedResponse(UserDto)
  findAll(@Query() filters: FilterUsersDto): Promise<PaginatedResult<UserDto>> {
    return this.service.findAllPaginated(filters);
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Cambia el rol de un usuario',
    description:
      'Un administrador no puede quitarse el rol a sí mismo: sería la forma ' +
      'más rápida de dejar el sistema sin nadie que pueda administrarlo.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Intento de auto-degradación' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserDto> {
    return this.service.updateRole(id, dto.role, caller.id);
  }
}
