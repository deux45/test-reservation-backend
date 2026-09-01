import { type AuthProvider } from './auth-provider.port';

export interface ContractFixtures {
  /** Headers a signed-in caller would send. */
  validHeaders: Headers;
  /** Headers carrying a malformed or expired credential. */
  invalidHeaders: Headers;
  /** What `authenticate(validHeaders)` must resolve to. */
  expected: { id: string; email: string; roles: string[] };
}

/**
 * The contract every AuthProvider must satisfy.
 *
 * An abstraction with no contract test is an intention, not a seam. This is
 * what makes "the identity provider can be replaced" a demonstrated claim: any
 * new implementation runs this same suite before it is switched on, and a
 * behavioural difference fails the build rather than surfacing in production.
 *
 * Exported as a function rather than written as a spec file so each
 * implementation calls it from its own spec, keeping failures attributed to
 * the implementation that caused them.
 */
export function testAuthProviderContract(
  name: string,
  setup: () => Promise<{ provider: AuthProvider; fixtures: ContractFixtures }>,
): void {
  describe(`AuthProvider contract: ${name}`, () => {
    let provider: AuthProvider;
    let fixtures: ContractFixtures;

    beforeAll(async () => {
      ({ provider, fixtures } = await setup());
    });

    it('exposes a non-empty name', () => {
      expect(provider.name).toBeTruthy();
    });

    it('resolves null when no credential is present', async () => {
      await expect(provider.authenticate(new Headers())).resolves.toBeNull();
    });

    it('resolves null for a malformed or expired credential', async () => {
      // Null, not a thrown error: "not signed in" is a normal outcome, and a
      // guard that has to catch exceptions to detect it is a guard that will
      // eventually swallow a real failure too.
      await expect(provider.authenticate(fixtures.invalidHeaders)).resolves.toBeNull();
    });

    it('resolves the identity for a valid credential', async () => {
      const user = await provider.authenticate(fixtures.validHeaders);

      expect(user).not.toBeNull();
      expect(user!.id).toBe(fixtures.expected.id);
      expect(user!.email).toBe(fixtures.expected.email);
      expect(user!.roles).toEqual(expect.arrayContaining(fixtures.expected.roles));
    });

    it('always assigns at least one role', async () => {
      // Downstream code does `user.roles.includes(...)`. A provider that
      // returns an empty array would make every authorisation check silently
      // fail closed in a way that is hard to trace.
      const user = await provider.authenticate(fixtures.validHeaders);
      expect(user!.roles.length).toBeGreaterThan(0);
    });

    it('leaks no provider-specific fields into AuthenticatedUser', async () => {
      // The assertion that actually protects the seam. The moment a provider
      // passes through an extra field, application code starts depending on
      // it, and the "one file" replacement cost quietly stops being true.
      const user = await provider.authenticate(fixtures.validHeaders);
      expect(Object.keys(user!).sort()).toEqual(['email', 'id', 'name', 'roles']);
    });
  });
}
