import { All, Controller, Get, Inject, NotFoundException, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { CurrentUser, Public } from './decorators';
import {
  AUTH_PROVIDER,
  type AuthenticatedUser,
  type AuthProvider,
} from './ports/auth-provider.port';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(@Inject(AUTH_PROVIDER) private readonly provider: AuthProvider) {}

  /**
   * Mounts the provider's own routes: sign-in, sign-up, sign-out, callbacks.
   *
   * These thirteen lines are the entire replacement for
   * @thallesp/nestjs-better-auth, a community package that would otherwise sit
   * in the authentication path of every request. Writing them removes a
   * third-party dependency AND creates the substitution point -- an
   * improvement in both directions.
   */
  @Public()
  @All('api/auth/*splat')
  @ApiExcludeEndpoint() // Better Auth documents these itself via its openAPI plugin.
  handleAuthRoutes(@Req() request: Request, @Res() response: Response): void {
    const handler = this.provider.getRequestHandler();
    if (!handler) throw new NotFoundException();

    handler(request, response, () => undefined);
  }

  /**
   * The identity as this application sees it.
   *
   * Deliberately not a passthrough of the provider's session object: it
   * returns AuthenticatedUser, so the web client is coupled to our contract
   * and not to Better Auth's.
   */
  @Get('me')
  @ApiOperation({ summary: 'The current session user' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
