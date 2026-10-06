import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import {
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { OrgScoped } from '../../common/decorators/org-scoped.decorator';
import { ApprovalsService } from './approvals.service';
import {
  DecideApprovalDto,
  ListApprovalsQuery,
} from './dto/approvals.dto';

@OrgScoped()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Roles(OrgRole.admin, OrgRole.release_manager, OrgRole.devops)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListApprovalsQuery) {
    return this.approvals.list(user.orgId!, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approvals.get(user.orgId!, id);
  }

  @Roles(OrgRole.admin, OrgRole.release_manager)
  @Post(':id/decide')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decide(user.orgId!, id, user.id, dto);
  }
}
