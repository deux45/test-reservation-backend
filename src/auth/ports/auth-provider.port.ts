import { type RequestHandler } from 'express';

/**
 * Our contract for an authenticated identity.
 *
 * It deliberately does not mirror the shape of any provider. Better Auth
 * exposes `session.user.role` as a loose string; a JWT would carry `sub` and a
 * `scope` claim; an LDAP bind would return something else again. All of them
 * are translated into this, and the translation is the entire anti-corruption
 * layer.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

/**
 * The whole coupling surface between this system and its identity provider.
 *
 * Two methods. Everything else -- controllers, services, rules, DTOs -- talks
 * to `AuthenticatedUser` and the decorators in auth/decorators/, never to a
 * provider type. Replacing the provider is therefore one new file plus one
 * line in AuthModule, not a change spread across every controller.
 *
 * See docs/IMPLEMENTATION-PLAN.md section 3.10.
 */
export interface AuthProvider {
  /** Identifies the implementation in logs and in the health payload. */
  readonly name: string;

  /**
   * Resolves the identity from the raw request headers.
   * Returns null for an anonymous, malformed or expired credential -- never
   * throws for those, because "not signed in" is a normal outcome.
   */
  authenticate(headers: Headers): Promise<AuthenticatedUser | null>;

  /**
   * The provider's own HTTP routes (sign-in, sign-up, callbacks), mounted
   * under /api/auth. Null when a provider has none, as a bearer-token
   * verifier would.
   */
  getRequestHandler(): RequestHandler | null;

  /**
   * Provisions an account without a sign-up flow, for an administrator
   * creating one on someone else's behalf.
   *
   * Optional: not every provider can do it. One backed by corporate LDAP or
   * SSO has no say in who exists, and would leave this undefined rather than
   * throw. Callers check for it and answer 501 when it is absent, which is
   * honest about the capability instead of pretending it failed.
   */
  createAccount?(input: NewAccount): Promise<{ id: string }>;
}

export interface NewAccount {
  email: string;
  password: string;
  name: string;
}

/**
 * One of only two injection tokens in the backend.
 *
 * A plain class would be enough for substitution in tests, but this token does
 * something a class cannot: it *selects* between interchangeable
 * implementations at boot, driven by the AUTH_PROVIDER environment variable.
 */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
