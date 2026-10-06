import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DEPLOYMENTS_QUEUE } from './deployment-state.machine';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsProcessor } from './deployments.processor';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [
    AuditModule,
    BullModule.registerQueue({ name: DEPLOYMENTS_QUEUE }),
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentsProcessor],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
