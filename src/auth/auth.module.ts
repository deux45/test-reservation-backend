import { type DynamicModule, Logger, Module, type Type } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthenticationGuard } from './guards/authentication.guard';
import { RolesGuard } from './guards/roles.guard';
import { AUTH_PROVIDER, type AuthProvider } from './ports/auth-provider.port';
import { BetterAuthProvider } from './providers/better-auth.provider';
import { FakeAuthProvider } from './providers/fake-auth.provider';

/** Every implementation of the port, keyed by the AUTH_PROVIDER env value. */
const PROVIDERS: Record<string, Type<AuthProvider>> = {
  'better-auth': BetterAuthProvider,
  fake: FakeAuthProvider,
};

@Module({})
export class AuthModule {
  /**
   * Strategy selection at boot.
   *
   * Changing identity provider is an environment variable, not a redeploy of
   * modified code -- and in the e2e suite it is what lets every test act as a
   * user without driving a real sign-in flow.
   */
  static forRoot(): DynamicModule {
    const key = process.env.AUTH_PROVIDER ?? 'better-auth';
    const useClass = PROVIDERS[key];

    if (!useClass) {
      throw new Error(
        `Unknown AUTH_PROVIDER "${key}". Available: ${Object.keys(PROVIDERS).join(', ')}`,
      );
    }

    Logger.log(`Identity provider: ${key}`, AuthModule.name);

    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [{ provide: AUTH_PROVIDER, useClass }, AuthenticationGuard, RolesGuard],
      // The token and the guards are exported. The provider instance and the
      // Better Auth object never are.
      exports: [AUTH_PROVIDER, AuthenticationGuard, RolesGuard],
    };
  }
}
