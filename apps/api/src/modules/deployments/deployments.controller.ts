import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { OrgScoped } from '../../common/decorators/org-scoped.decorator';
import { RollbackService } from '../rollback/rollback.service';
import {
  CreateDeploymentDto,
  ListDeploymentsQuery,
} from './dto/deployments.dto';
import { DeploymentsService } from './deployments.service';

@OrgScoped()
@Controller('deployments')
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly rollbacks: RollbackService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDeploymentsQuery) {
    return this.deployments.list(user.orgId!, query);
  }

  @Roles(
    OrgRole.admin,
    OrgRole.devops,
    OrgRole.developer,
    OrgRole.release_manager,
  )
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeploymentDto) {
    if (user.role === OrgRole.viewer) {
      throw new ForbiddenException('Viewers cannot create deployments');
    }
    return this.deployments.create(user.orgId!, user.id, user.role, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.deployments.get(user.orgId!, id);
  }

  @Get(':id/events')
  events(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deployments.listEvents(user.orgId!, id);
  }

  @Get(':id/rollback')
  getRollback(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rollbacks.get(user.orgId!, id);
  }

  @Roles(OrgRole.admin, OrgRole.devops, OrgRole.release_manager)
  @Post(':id/rollback')
  startRollback(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rollbacks.start(user.orgId!, id, user.id);
  }
}
