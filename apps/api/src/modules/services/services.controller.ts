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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { OrgScoped } from '../../common/decorators/org-scoped.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';
import { ServicesService } from './services.service';

class ListServicesQuery extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

@OrgScoped()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListServicesQuery) {
    return this.services.list(user.orgId!, query);
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) {
    return this.services.create(user.orgId!, user.id, dto);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.services.get(user.orgId!, id);
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(user.orgId!, user.id, id, dto);
  }

  @Roles(OrgRole.admin)
  @Post(':id/deactivate')
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.services.deactivate(user.orgId!, user.id, id);
  }
}
