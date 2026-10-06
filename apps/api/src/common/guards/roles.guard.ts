import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { AuthUser, ROLES_KEY } from '../decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { MEMBERSHIP_VERIFIED_KEY } from './org-context.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | undefined>;
      params: Record<string, string>;
      [MEMBERSHIP_VERIFIED_KEY]?: boolean;
    }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const headerOrg = request.headers['x-org-id'];
    const orgId = user.orgId ?? headerOrg ?? request.params.orgId;
    if (!orgId) {
      throw new ForbiddenException(
        'Organization context required (select org or send X-Org-Id)',
      );
    }

    // OrgContextGuard already verified membership for this request — reuse role.
    if (request[MEMBERSHIP_VERIFIED_KEY] && user.orgId === orgId && user.role) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException(
          `Requires one of roles: ${requiredRoles.join(', ')}`,
        );
      }
      return true;
    }

    const role = await this.resolveRole(orgId, user.id);
    if (!role) {
      throw new ForbiddenException('Not a member of this organization');
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }

    user.orgId = orgId;
    user.role = role;
    request[MEMBERSHIP_VERIFIED_KEY] = true;
    return true;
  }

  private async resolveRole(
    orgId: string,
    userId: string,
  ): Promise<OrgRole | null> {
    const cached = await this.cache.getMembership(orgId, userId);
    if (cached) {
      return cached.role;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });
    if (!membership) {
      return null;
    }
    await this.cache.setMembership(orgId, userId, membership.role);
    return membership.role;
  }
}
