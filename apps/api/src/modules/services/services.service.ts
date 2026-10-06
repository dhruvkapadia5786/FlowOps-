import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginateMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    orgId: string,
    query: PaginationQueryDto & {
      q?: string;
      teamId?: string;
      isActive?: boolean;
    },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.ServiceWhereInput = {
      organizationId: orgId,
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          team: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return { data, meta: paginateMeta(total, page, pageSize) };
  }

  async get(orgId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, organizationId: orgId },
      include: { team: { select: { id: true, name: true, slug: true } } },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async create(orgId: string, actorId: string, dto: CreateServiceDto) {
    try {
      const service = await this.prisma.service.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          teamId: dto.teamId,
          repositoryUrl: dto.repositoryUrl,
        },
      });
      await this.audit.log({
        organizationId: orgId,
        actorId,
        action: 'service.create',
        entityType: 'service',
        entityId: service.id,
        metadata: { slug: service.slug },
      });
      return service;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Service slug already exists in org');
      }
      throw error;
    }
  }

  async update(
    orgId: string,
    actorId: string,
    id: string,
    dto: UpdateServiceDto,
  ) {
    await this.get(orgId, id);
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        teamId: dto.teamId === undefined ? undefined : dto.teamId,
        repositoryUrl:
          dto.repositoryUrl === undefined ? undefined : dto.repositoryUrl,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'service.update',
      entityType: 'service',
      entityId: service.id,
    });
    return service;
  }

  async deactivate(orgId: string, actorId: string, id: string) {
    await this.get(orgId, id);
    const service = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'service.deactivate',
      entityType: 'service',
      entityId: service.id,
    });
    return service;
  }
}
