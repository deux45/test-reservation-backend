import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AuthenticatedUser } from '../ports/auth-provider.port';
import { RolesGuard } from './roles.guard';

const contextFor = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const userWith = (...roles: string[]): AuthenticatedUser => ({
  id: 'u-1',
  email: 'someone@example.com',
  name: 'Someone',
  roles,
});

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const requireRoles = (roles: string[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  it('allows the request when no role is required', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor(userWith('user')))).toBe(true);
  });

  it('allows the request when the user holds one of the required roles', () => {
    requireRoles(['admin', 'manager']);
    expect(guard.canActivate(contextFor(userWith('manager')))).toBe(true);
  });

  it('rejects with 403, not 401, when the role is missing', () => {
    // The caller is authenticated and simply lacks permission. A 401 would
    // tell a signed-in user to sign in again, which leads nowhere.
    requireRoles(['admin']);
    expect(() => guard.canActivate(contextFor(userWith('user')))).toThrow(ForbiddenException);
  });

  it('rejects when there is no user at all', () => {
    requireRoles(['admin']);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('names the required roles in the message', () => {
    requireRoles(['admin', 'auditor']);
    expect(() => guard.canActivate(contextFor(userWith('user')))).toThrow(/admin, auditor/);
  });
});
