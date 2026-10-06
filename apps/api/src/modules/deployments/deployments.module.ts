import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HealthModule } from '../health/health.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { RollbackModule } from '../rollback/rollback.module';
import { DEPLOYMENTS_QUEUE } from './deployment-state.machine';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsProcessor } from './deployments.processor';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [
    AuditModule,
    BullModule.registerQueue({ name: DEPLOYMENTS_QUEUE }),
    forwardRef(() => RollbackModule),
    forwardRef(() => IncidentsModule),
    forwardRef(() => HealthModule),
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentsProcessor],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
