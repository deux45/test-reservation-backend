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
    summary: 'List users',
    description:
      'Includes how many confirmed future reservations each one has, so the ' +
      'impact of banning or demoting is visible before doing it.',
  })
  @ApiPaginatedResponse(UserDto)
  findAll(@Query() filters: FilterUsersDto): Promise<PaginatedResult<UserDto>> {
    return this.service.findAllPaginated(filters);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Created by an administrator, bypassing public sign-up. Delegated to the ' +
      'identity provider, which is what knows how to hash the password. A ' +
      'provider that cannot create accounts answers 501.',
  })
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'An account with that email already exists' })
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit name and email',
    description:
      'The email is the credential this person signs in with, so changing it ' +
      'changes how they get in. The role is changed through its own route, ' +
      'because it has its own rule: nobody can demote themselves.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'The email is already used by another account' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.service.update(id, dto);
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: "Change a user's role",
    description:
      'An administrator cannot remove their own role: it would be the quickest ' +
      'way to leave the system with nobody able to administer it.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Attempted self-demotion' })
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
    summary: 'Ban a user',
    description:
      'Takes effect immediately: the adapter rejects a banned user on every ' +
      'request, not only at sign-in, and their open sessions are revoked. ' +
      'Without `days` the ban is indefinite.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Attempted self-ban' })
  ban(
    @Param('id') id: string,
    @Body() dto: BanUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserDto> {
    return this.service.ban(id, dto, caller.id);
  }

  @Delete(':id/ban')
  @ApiOperation({ summary: 'Unban a user' })
  @ApiOkResponse({ type: UserDto })
  unban(@Param('id') id: string): Promise<UserDto> {
    return this.service.unban(id);
  }
}
