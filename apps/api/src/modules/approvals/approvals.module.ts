import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { DEPLOYMENTS_QUEUE } from '../deployments/deployment-state.machine';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => DeploymentsModule),
    BullModule.registerQueue({ name: DEPLOYMENTS_QUEUE }),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
