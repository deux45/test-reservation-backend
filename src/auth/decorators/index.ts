import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';
import { type AuthenticatedUser } from '../ports/auth-provider.port';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/**
 * Opts an endpoint out of authentication.
 *
 * Authentication is on by default via a globally registered guard, so a new
 * controller is protected unless someone deliberately says otherwise. The
 * reverse default -- opt in -- means one forgotten decorator silently exposes
 * an endpoint.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires the caller to hold at least one of these roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Injects the authenticated user.
 *
 * This is the only way the rest of the application reads identity. No
 * controller imports anything from better-auth; the ESLint rule in
 * eslint.config.mjs makes that a build error rather than a convention.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      // Reaching here means @CurrentUser() was used on a @Public() route
      // without a session. Failing loudly beats handing the handler undefined
      // under a non-optional type.
      throw new UnauthorizedException('No hay una sesión activa');
    }
    return request.user;
  },
);
