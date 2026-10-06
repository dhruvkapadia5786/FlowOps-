import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import {
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { AuthService } from '../auth/auth.service';
import {
  AddMemberDto,
  CreateOrganizationDto,
  UpdateMemberRoleDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('orgs')
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.orgs.create(user.id, dto);
  }

  @Get(':orgId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    return this.orgs.get(orgId, user.id);
  }

  @Post(':orgId/select')
  select(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    return this.auth.selectOrganization(user.id, orgId);
  }

  @Get(':orgId/members')
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    return this.orgs.listMembers(orgId, user.id);
  }

  @Roles(OrgRole.admin)
  @Post(':orgId/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.orgs.addMember(orgId, user.id, dto);
  }

  @Roles(OrgRole.admin)
  @Patch(':orgId/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.orgs.updateMemberRole(orgId, user.id, userId, dto);
  }

  @Roles(OrgRole.admin)
  @Delete(':orgId/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.orgs.removeMember(orgId, user.id, userId);
  }
}
