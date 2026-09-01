import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators';
import { AUTH_PROVIDER, type AuthProvider } from '../ports/auth-provider.port';
import { toWebHeaders } from '../utils/headers.util';

/**
 * The only consumer of AuthProvider in the whole application.
 *
 * Registered globally, so every route is authenticated unless it carries
 * @Public(). Secure by default: adding a controller without thinking about
 * auth yields a protected controller, not an open one.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only HTTP is served here; anything else passes through untouched.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.provider.authenticate(toWebHeaders(request.headers));

    if (isPublic) {
      // A public route still gets the identity when there is one, so it can
      // personalise without requiring a session.
      if (user) request.user = user;
      return true;
    }

    if (!user) {
      throw new UnauthorizedException('Sesión no válida o expirada');
    }

    request.user = user;
    return true;
  }
}
