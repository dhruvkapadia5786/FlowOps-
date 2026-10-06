import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../decorators/auth.decorators';
import { ORG_SCOPED_KEY } from '../decorators/org-scoped.decorator';
import { PrismaService } from '../../database/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';

/** Request flag set after membership is verified against Postgres/cache. */
export const MEMBERSHIP_VERIFIED_KEY = 'flowopsMembershipVerified';

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(ORG_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
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

    const cached = await this.cache.getMembership(orgId, user.id);
    if (cached) {
      user.orgId = orgId;
      user.role = cached.role;
      request[MEMBERSHIP_VERIFIED_KEY] = true;
      return true;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    await this.cache.setMembership(orgId, user.id, membership.role);
    user.orgId = orgId;
    user.role = membership.role;
    request[MEMBERSHIP_VERIFIED_KEY] = true;
    return true;
  }
}
