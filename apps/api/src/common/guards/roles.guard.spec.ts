import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/auth.decorators';

describe('RolesGuard', () => {
  const prisma = {
    organizationMember: {
      findUnique: jest.fn(),
    },
  };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let guard: RolesGuard;

  const makeContext = (user?: object, headers: Record<string, string> = {}) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
          params: {},
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      prisma as never,
    );
  });

  it('allows when no roles required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(
      true,
    );
  });

  it('rejects missing org context', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? [OrgRole.admin] : undefined,
    );
    await expect(
      guard.canActivate(makeContext({ id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects wrong role', async () => {
    reflector.getAllAndOverride.mockReturnValue([OrgRole.admin]);
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: OrgRole.viewer,
    });

    await expect(
      guard.canActivate(
        makeContext({ id: 'u1' }, { 'x-org-id': 'org-1' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows matching role from JWT org claim without header', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrgRole.admin,
      OrgRole.release_manager,
    ]);
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: OrgRole.release_manager,
    });
    const user = {
      id: 'u1',
      orgId: 'org-1',
    } as { id: string; orgId?: string; role?: OrgRole };

    await expect(guard.canActivate(makeContext(user))).resolves.toBe(true);
    expect(user.role).toBe(OrgRole.release_manager);
  });

  it('rejects non-members even with org header', async () => {
    reflector.getAllAndOverride.mockReturnValue([OrgRole.devops]);
    prisma.organizationMember.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeContext({ id: 'u1' }, { 'x-org-id': 'org-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows devops when listed among required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OrgRole.admin,
      OrgRole.devops,
      OrgRole.release_manager,
    ]);
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: OrgRole.devops,
    });

    await expect(
      guard.canActivate(
        makeContext({ id: 'u1' }, { 'x-org-id': 'org-1' }),
      ),
    ).resolves.toBe(true);
  });
});
