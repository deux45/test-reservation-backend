import { testAuthProviderContract } from '../ports/auth-provider.contract';
import { FAKE_USER_HEADER, FakeAuthProvider } from './fake-auth.provider';

const headersWith = (value: string): Headers => {
  const headers = new Headers();
  headers.set(FAKE_USER_HEADER, value);
  return headers;
};

testAuthProviderContract('fake', () =>
  Promise.resolve({
    provider: new FakeAuthProvider(),
    fixtures: {
      validHeaders: headersWith('u-1:admin@example.com:admin,user'),
      // Missing the email segment: structurally present, semantically unusable.
      invalidHeaders: headersWith('u-1'),
      expected: { id: 'u-1', email: 'admin@example.com', roles: ['admin', 'user'] },
    },
  }),
);

describe('FakeAuthProvider', () => {
  const provider = new FakeAuthProvider();

  it('defaults to the user role when none is given', async () => {
    const user = await provider.authenticate(headersWith('u-2:someone@example.com'));
    expect(user?.roles).toEqual(['user']);
  });

  it('derives a display name from the email local part', async () => {
    const user = await provider.authenticate(headersWith('u-3:ana.lopez@example.com'));
    expect(user?.name).toBe('ana.lopez');
  });

  it('exposes no sign-in routes', () => {
    // The header is the credential, so there is nothing to mount. The guard
    // must cope with a provider that has no HTTP surface of its own.
    expect(provider.getRequestHandler()).toBeNull();
  });
});
