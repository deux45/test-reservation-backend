import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../auth/decorators';
import { type AuthenticatedUser } from '../../auth/ports/auth-provider.port';
import { ApiPaginatedResponse } from '../../common/dtos/paginated-response.dto';
import { type PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BanUserDto, CreateUserDto, UpdateUserDto } from '../dtos/create-user.dto';
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
      'el impacto de bloquear o degradar sea visible antes de hacerlo.',
  })
  @ApiPaginatedResponse(UserDto)
  findAll(@Query() filters: FilterUsersDto): Promise<PaginatedResult<UserDto>> {
    return this.service.findAllPaginated(filters);
  }

  @Post()
  @ApiOperation({
    summary: 'Crea una cuenta',
    description:
      'Alta por parte de un administrador, sin pasar por el registro público. ' +
      'La delega en el proveedor de identidad, que es quien sabe cifrar la ' +
      'contraseña. Un proveedor que no pueda crear cuentas responde 501.',
  })
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Ya existe una cuenta con ese correo' })
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita nombre y correo',
    description:
      'El correo es la credencial con la que esa persona inicia sesión, así ' +
      'que cambiarlo cambia cómo entra. El rol se cambia por su propia ruta, ' +
      'porque tiene su propia regla: nadie puede degradarse a sí mismo.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'El correo ya está en uso por otra cuenta' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.service.update(id, dto);
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

  /**
   * Blocking as a resource, not a flag on a PATCH.
   *
   * A ban carries a reason and an expiry, so it is a thing that gets created
   * and destroyed rather than a boolean that gets toggled.
   */
  @Post(':id/ban')
  @ApiOperation({
    summary: 'Bloquea a un usuario',
    description:
      'Surte efecto de inmediato: el adaptador rechaza al usuario bloqueado ' +
      'en cada petición, no solo al iniciar sesión, y además se revocan sus ' +
      'sesiones abiertas. Sin `days` el bloqueo es indefinido.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Intento de bloquearse a sí mismo' })
  ban(
    @Param('id') id: string,
    @Body() dto: BanUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserDto> {
    return this.service.ban(id, dto, caller.id);
  }

  @Delete(':id/ban')
  @ApiOperation({ summary: 'Desbloquea a un usuario' })
  @ApiOkResponse({ type: UserDto })
  unban(@Param('id') id: string): Promise<UserDto> {
    return this.service.unban(id);
  }
}
