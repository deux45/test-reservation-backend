import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { ROLES_KEY } from '../decorators';

/**
 * Authorisation, kept separate from authentication.
 *
 * Runs after AuthenticationGuard, so request.user is already populated. It
 * reads only our own AuthenticatedUser.roles, never a provider's claim
 * format -- which is why swapping the provider does not touch this file.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() means authentication alone is enough.
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<Request>();

    // 403, not 401: the caller is known, they simply lack the role. Returning
    // 401 here would tell a signed-in user to sign in again, which is a dead
    // end for them.
    if (!user || !required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException(`Se requiere uno de estos roles: ${required.join(', ')}`);
    }

    return true;
  }
}
