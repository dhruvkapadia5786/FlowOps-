import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { HealthModule } from '../health/health.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RollbackModule } from '../rollback/rollback.module';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';

@Module({
  imports: [
    AuditModule,
    RealtimeModule,
    forwardRef(() => HealthModule),
    forwardRef(() => IncidentsModule),
    forwardRef(() => DeploymentsModule),
    forwardRef(() => RollbackModule),
  ],
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
