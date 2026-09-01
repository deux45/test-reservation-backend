import { type AuthenticatedUser } from './ports/auth-provider.port';

/**
 * Augments Express's Request with our identity type.
 *
 * Note it is `AuthenticatedUser`, not any provider's session type: the shape
 * the rest of the application sees is ours, which is what makes the provider
 * replaceable.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
