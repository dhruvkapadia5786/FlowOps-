import { Controller, Get, Query } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import {
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { OrgScoped } from '../../common/decorators/org-scoped.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsQuery } from './dto/audit.dto';

@OrgScoped()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(OrgRole.admin, OrgRole.release_manager, OrgRole.viewer, OrgRole.devops)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAuditLogsQuery) {
    return this.audit.list(user.orgId!, query);
  }

  @Roles(OrgRole.admin, OrgRole.release_manager, OrgRole.viewer, OrgRole.devops)
  @Get('facets')
  facets(@CurrentUser() user: AuthUser) {
    return this.audit.facets(user.orgId!);
  }
}
