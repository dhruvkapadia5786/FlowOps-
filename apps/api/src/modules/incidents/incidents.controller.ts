import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  CreateIncidentDto,
  ListIncidentsQuery,
  UpdateIncidentDto,
} from './dto/incidents.dto';
import { IncidentsService } from './incidents.service';

@OrgScoped()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListIncidentsQuery) {
    return this.incidents.list(user.orgId!, query);
  }

  @Roles(OrgRole.admin, OrgRole.devops, OrgRole.release_manager)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncidentDto) {
    return this.incidents.create(user.orgId!, user.id, dto);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidents.get(user.orgId!, id);
  }

  @Roles(OrgRole.admin, OrgRole.devops, OrgRole.release_manager)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidents.update(user.orgId!, user.id, id, dto);
  }

  @Roles(OrgRole.admin, OrgRole.devops, OrgRole.release_manager)
  @Post(':id/resolve')
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { note?: string },
  ) {
    return this.incidents.resolve(user.orgId!, user.id, id, body?.note);
  }
}
