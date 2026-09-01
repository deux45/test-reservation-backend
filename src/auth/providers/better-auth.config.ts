import { Pool } from 'pg';

/**
 * Better Auth instance, loaded lazily.
 *
 * better-auth@1.7.x is pure ESM ("type": "module", only a .mjs build). This
 * application emits CommonJS, as NestJS does by default, so it cannot
 * `require()` it -- a dynamic `import()` is the bridge.
 *
 * That bridge lives here, in the adapter, and nowhere else. It is a concrete
 * dividend of the port in auth/ports/auth-provider.port.ts: an ESM/CJS
 * mismatch in a third-party library stays contained in one file instead of
 * forcing the whole codebase to ESM.
 *
 * Deliberately NOT exported outside this module -- enforced by the
 * no-restricted-imports rule in eslint.config.mjs. See
 * docs/IMPLEMENTATION-PLAN.md section 3.10.
 */

type BetterAuthInstance = Awaited<ReturnType<typeof buildAuth>>;

let cached: Promise<BetterAuthInstance> | undefined;

async function buildAuth() {
  const { betterAuth } = await import('better-auth');
  const { admin, openAPI } = await import('better-auth/plugins');

  return betterAuth({
    database: new Pool({ connectionString: process.env.DATABASE_URL }),

    emailAndPassword: { enabled: true, minPasswordLength: 10 },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',

    // The SPA is on another origin. Without this the session cookie is refused.
    trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:3001'],

    advanced: {
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },

    plugins: [
      // Adds user.role, which the adapter maps into AuthenticatedUser.roles.
      admin({ defaultRole: 'user', adminRoles: ['admin'] }),
      openAPI(),
    ],
  });
}

/** Resolves the shared instance, building it on first use. */
export function getAuth(): Promise<BetterAuthInstance> {
  cached ??= buildAuth();
  return cached;
}
