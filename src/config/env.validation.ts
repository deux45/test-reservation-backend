import { z } from 'zod';

/**
 * Environment contract, validated once at boot.
 *
 * The point is failing at second zero with a readable message instead of
 * throwing on the first request that happens to touch a missing variable.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  // Signs session cookies. Anything shorter is not worth signing with.
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),

  // Single allowed origin. Without it the session cookie never reaches the SPA.
  FRONTEND_URL: z.url(),

  AUTH_PROVIDER: z.enum(['better-auth', 'jwt', 'fake']).default('better-auth'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  // A fake identity provider in production would mean no authentication at
  // all. Refuse to start rather than serve an open API.
  if (result.data.AUTH_PROVIDER === 'fake' && result.data.NODE_ENV === 'production') {
    throw new Error('AUTH_PROVIDER=fake is not allowed when NODE_ENV=production');
  }

  return result.data;
}
