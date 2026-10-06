import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { DEPLOYMENTS_QUEUE } from '../deployments/deployment-state.machine';
import { RollbackService } from './rollback.service';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => DeploymentsModule),
    BullModule.registerQueue({ name: DEPLOYMENTS_QUEUE }),
  ],
  providers: [RollbackService],
  exports: [RollbackService],
})
export class RollbackModule {}
