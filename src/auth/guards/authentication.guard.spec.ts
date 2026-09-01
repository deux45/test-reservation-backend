import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationGuard } from './authentication.guard';
import { FAKE_USER_HEADER, FakeAuthProvider } from '../providers/fake-auth.provider';

const contextFor = (headers: Record<string, string>) => {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  return {
    context: {
      getType: () => 'http',
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
};

describe('AuthenticationGuard', () => {
  let reflector: Reflector;
  let guard: AuthenticationGuard;

  beforeEach(() => {
    reflector = new Reflector();
    // Depends on the port, so any implementation works here. The fake is a
    // real provider rather than a mock: the guard is exercised against
    // something that satisfies the same contract as the production adapter.
    guard = new AuthenticationGuard(new FakeAuthProvider(), reflector);
  });

  const markPublic = (isPublic: boolean) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

  it('rejects a protected route without a credential', async () => {
    markPublic(false);
    const { context } = contextFor({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the user to the request on a protected route', async () => {
    markPublic(false);
    const { context, request } = contextFor({
      [FAKE_USER_HEADER]: 'u-1:ana@example.com:admin',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'u-1', roles: ['admin'] });
  });

  it('allows a public route with no credential', async () => {
    markPublic(true);
    const { context, request } = contextFor({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('still attaches the user on a public route when one is present', async () => {
    // A public endpoint can then personalise its response without requiring
    // a session -- the reason `isPublic` does not short-circuit before
    // authenticate() is called.
    markPublic(true);
    const { context, request } = contextFor({
      [FAKE_USER_HEADER]: 'u-2:beto@example.com',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'u-2' });
  });
});
