import { Injectable } from '@nestjs/common';
import { type AuthenticatedUser, type AuthProvider } from '../ports/auth-provider.port';

/** Header an e2e test sets to act as a given user. */
export const FAKE_USER_HEADER = 'x-fake-user';

/**
 * Second implementation of the port, and a genuinely used one.
 *
 * End-to-end tests need an authenticated caller in almost every case. Driving
 * a real sign-in flow for each of them is slow and tests Better Auth rather
 * than this application's rules. This provider reads the identity straight
 * from a header instead.
 *
 * It exists for two reasons at once: it makes the e2e suite fast, and it is
 * the proof that the port is a real seam. Both implementations pass the same
 * contract test, which is what turns "the provider could be replaced" into
 * something demonstrated rather than claimed.
 *
 * env.validation.ts refuses to boot with AUTH_PROVIDER=fake when
 * NODE_ENV=production, because this class trusts a request header.
 */
@Injectable()
export class FakeAuthProvider implements AuthProvider {
  readonly name = 'fake';

  authenticate(headers: Headers): Promise<AuthenticatedUser | null> {
    const raw = headers.get(FAKE_USER_HEADER);
    if (!raw) return Promise.resolve(null);

    // Format: "<id>:<email>:<comma-separated roles>"
    const [id, email, roles] = raw.split(':');
    if (!id || !email) return Promise.resolve(null);

    return Promise.resolve({
      id,
      email,
      name: email.split('@')[0] ?? id,
      roles: roles ? roles.split(',').filter(Boolean) : ['user'],
    });
  }

  /** No sign-in routes: the header is the credential. */
  getRequestHandler(): null {
    return null;
  }
}
