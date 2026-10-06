import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
  ChaosBurstDto,
  RunScenarioDto,
  UpdateSimulationSettingsDto,
} from './dto/simulation.dto';
import { SimulationService } from './simulation.service';

@OrgScoped()
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Roles(OrgRole.admin, OrgRole.devops)
  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser) {
    return this.simulation.getSettings(user.orgId!);
  }

  @Roles(OrgRole.admin)
  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSimulationSettingsDto,
  ) {
    return this.simulation.updateSettings(user.orgId!, user.id, dto);
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Get('scenarios')
  listScenarios() {
    return this.simulation.listScenarios();
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Post('scenarios/:key/run')
  runScenario(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() dto: RunScenarioDto,
  ) {
    return this.simulation.runScenario(
      user.orgId!,
      user.id,
      user.role,
      key,
      dto,
    );
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Post('scenarios/:key/recover')
  recover(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Query('effectId') effectId?: string,
  ) {
    return this.simulation.recoverScenario(
      user.orgId!,
      user.id,
      key,
      effectId,
    );
  }

  @Roles(OrgRole.admin)
  @Post('run-chaos-burst')
  chaos(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChaosBurstDto,
  ) {
    return this.simulation.runChaosBurst(
      user.orgId!,
      user.id,
      user.role,
      dto,
    );
  }
}
