import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';

jest.mock('argon2', () => ({
  hash: jest.fn(async () => 'hashed'),
  verify: jest.fn(async () => true),
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
  };

  const jwt = {
    signAsync: jest.fn(async () => 'access-token'),
  };

  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'secret';
      throw new Error(`missing ${key}`);
    }),
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_TTL') return '15m';
      if (key === 'JWT_REFRESH_TTL') return '7d';
      return undefined;
    }),
  };

  const audit = {
    log: jest.fn(async () => ({ id: 'audit-1' })),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    service = new AuthService(
      prisma as never,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      audit as unknown as AuditService,
    );
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'maya.chen@northstar.io',
        fullName: 'Maya Chen',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'Maya.Chen@northstar.io',
        password: 'FlowOps!demo1',
        fullName: 'Maya Chen',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.register' }),
      );
    });

    it('rejects duplicate emails', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(
        service.register({
          email: 'maya.chen@northstar.io',
          password: 'FlowOps!demo1',
          fullName: 'Maya Chen',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'maya.chen@northstar.io',
        fullName: 'Maya Chen',
        passwordHash: 'hashed',
        isActive: true,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'maya.chen@northstar.io',
        password: 'FlowOps!demo1',
      });

      expect(result.user.email).toBe('maya.chen@northstar.io');
      expect(result.accessToken).toBe('access-token');
    });

    it('rejects invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'maya.chen@northstar.io',
        fullName: 'Maya Chen',
        passwordHash: 'hashed',
        isActive: true,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'maya.chen@northstar.io',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects unknown users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({
          email: 'nobody@northstar.io',
          password: 'FlowOps!demo1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it('rejects inactive users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'maya.chen@northstar.io',
        fullName: 'Maya Chen',
        passwordHash: 'hashed',
        isActive: false,
      });

      await expect(
        service.login({
          email: 'maya.chen@northstar.io',
          password: 'FlowOps!demo1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh / logout', () => {
    it('rotates a valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'u1',
          email: 'maya.chen@northstar.io',
          fullName: 'Maya Chen',
          isActive: true,
        },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('raw-refresh-token');
      expect(result.accessToken).toBe('access-token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('rejects expired refresh tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', isActive: true },
      });

      await expect(service.refresh('stale')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes refresh token on logout', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.logout('u1', 'raw-refresh')).resolves.toEqual({
        success: true,
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.logout' }),
      );
    });
  });

  describe('roles / org select', () => {
    it('embeds org role in access token claims when selecting org', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'o1',
        role: 'admin',
        user: {
          id: 'u1',
          email: 'maya.chen@northstar.io',
          fullName: 'Maya Chen',
        },
        organization: {
          id: 'o1',
          name: 'Northstar Commerce',
          slug: 'northstar-commerce',
        },
      });
      prisma.refreshToken.create.mockResolvedValue({});

      await service.selectOrganization('u1', 'o1');

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'u1',
          orgId: 'o1',
          role: 'admin',
        }),
        expect.any(Object),
      );
    });
  });
});
