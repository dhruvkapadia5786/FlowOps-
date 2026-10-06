import { Module, forwardRef } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { IncidentsModule } from '../incidents/incidents.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  HealthConfigsController,
  HealthController,
  ServiceHealthController,
} from './health.controller';
import { HealthMonitorService } from './health-monitor.service';

@Module({
  imports: [TerminusModule, RealtimeModule, forwardRef(() => IncidentsModule)],
  controllers: [
    HealthController,
    HealthConfigsController,
    ServiceHealthController,
  ],
  providers: [HealthMonitorService],
  exports: [HealthMonitorService],
})
export class HealthModule {}
