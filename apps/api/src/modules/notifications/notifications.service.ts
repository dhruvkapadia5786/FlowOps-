import { Injectable } from '@nestjs/common';
import { OrgRole, Prisma } from '@prisma/client';
import {
  paginateMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(
    userId: string,
    query: PaginationQueryDto & { unreadOnly?: boolean },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, meta: paginateMeta(total, page, pageSize) };
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return null;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async notifyUsers(input: {
    organizationId: string;
    userIds: string[];
    type: string;
    payload: Prisma.InputJsonValue;
  }) {
    const unique = [...new Set(input.userIds)];
    if (unique.length === 0) {
      return [];
    }

    const created = await this.prisma.$transaction(
      unique.map((userId) =>
        this.prisma.notification.create({
          data: {
            organizationId: input.organizationId,
            userId,
            type: input.type,
            payload: input.payload,
          },
        }),
      ),
    );

    for (const row of created) {
      this.realtime.emitToUser(row.userId, REALTIME_EVENTS.NOTIFICATION_CREATED, {
        id: row.id,
        type: row.type,
        payload: row.payload,
        organizationId: row.organizationId,
        createdAt: row.createdAt,
      });
    }

    return created;
  }

  async notifyOrgRoles(
    organizationId: string,
    roles: OrgRole[],
    type: string,
    payload: Prisma.InputJsonValue,
  ) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, role: { in: roles } },
      select: { userId: true },
    });
    return this.notifyUsers({
      organizationId,
      userIds: members.map((m) => m.userId),
      type,
      payload,
    });
  }
}
