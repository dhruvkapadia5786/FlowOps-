import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { OrgScoped } from '../../common/decorators/org-scoped.decorator';
import { UpdateEnvironmentDto } from './dto/environments.dto';
import { EnvironmentsService } from './environments.service';

@OrgScoped()
@Controller('environments')
export class EnvironmentsController {
  constructor(private readonly environments: EnvironmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.environments.list(user.orgId!);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.environments.get(user.orgId!, id);
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnvironmentDto,
  ) {
    return this.environments.update(user.orgId!, user.id, id, dto);
  }
}
