import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type RequestHandler } from 'express';
import { type AuthenticatedUser, type AuthProvider } from '../ports/auth-provider.port';
import { getAuth } from './better-auth.config';

/**
 * Adapter: Better Auth behind the AuthProvider port.
 *
 * This class and better-auth.config.ts are the only two files in the backend
 * that know Better Auth exists.
 */
@Injectable()
export class BetterAuthProvider implements AuthProvider, OnModuleInit {
  readonly name = 'better-auth';

  private readonly logger = new Logger(BetterAuthProvider.name);
  private auth?: Awaited<ReturnType<typeof getAuth>>;
  private handler?: RequestHandler;

  /**
   * Resolves the ESM modules once, at startup.
   *
   * Doing it here rather than lazily on each call keeps the port's
   * getRequestHandler() synchronous, and surfaces a misconfigured provider as
   * a boot failure instead of a 500 on the first sign-in.
   */
  async onModuleInit(): Promise<void> {
    this.auth = await getAuth();

    const { toNodeHandler } = await import('better-auth/node');
    this.handler = toNodeHandler(this.auth);

    this.logger.log('Better Auth initialised');
  }

  async authenticate(headers: Headers): Promise<AuthenticatedUser | null> {
    if (!this.auth) throw new Error('BetterAuthProvider used before onModuleInit');

    const session = await this.auth.api.getSession({ headers });
    if (!session) return null;

    // The anti-corruption layer, and it is these four lines. Better Auth's
    // shape -- a nullable `role` string on the user -- dies here and never
    // reaches a controller, a service or a rule.
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: session.user.role ? [session.user.role] : ['user'],
    };
  }

  getRequestHandler(): RequestHandler | null {
    return this.handler ?? null;
  }
}
