import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AddMemberDto,
  CreateOrganizationDto,
  UpdateMemberRoleDto,
} from './dto/organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });
  }

  async get(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { members: true, teams: true, services: true } },
      },
    });
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        members: {
          create: { userId, role: OrgRole.admin },
        },
      },
    });

    await this.audit.log({
      organizationId: org.id,
      actorId: userId,
      action: 'org.create',
      entityType: 'organization',
      entityId: org.id,
      metadata: { slug: org.slug },
    });

    return org;
  }

  async listMembers(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
    });
  }

  async addMember(orgId: string, actorId: string, dto: AddMemberDto) {
    await this.requireRole(orgId, actorId, [OrgRole.admin]);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const member = await this.prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: dto.role,
        },
        include: {
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      });

      await this.audit.log({
        organizationId: orgId,
        actorId,
        action: 'org.member.add',
        entityType: 'organization_member',
        entityId: member.id,
        metadata: { userId: user.id, role: dto.role },
      });

      return member;
    } catch {
      throw new ConflictException('User is already a member');
    }
  }

  async updateMemberRole(
    orgId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.requireRole(orgId, actorId, [OrgRole.admin]);
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: targetUserId },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'org.member.role_change',
      entityType: 'organization_member',
      entityId: member.id,
      metadata: { userId: targetUserId, role: dto.role },
    });

    return updated;
  }

  async removeMember(orgId: string, actorId: string, targetUserId: string) {
    await this.requireRole(orgId, actorId, [OrgRole.admin]);
    if (actorId === targetUserId) {
      throw new ForbiddenException('Cannot remove yourself');
    }
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: targetUserId },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    await this.prisma.organizationMember.delete({ where: { id: member.id } });
    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'org.member.remove',
      entityType: 'organization_member',
      entityId: member.id,
      metadata: { userId: targetUserId },
    });
    return { success: true };
  }

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }
    return membership;
  }

  private async requireRole(orgId: string, userId: string, roles: OrgRole[]) {
    const membership = await this.requireMembership(orgId, userId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of roles: ${roles.join(', ')}`,
      );
    }
    return membership;
  }
}
