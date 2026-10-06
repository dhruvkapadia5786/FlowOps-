import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RealtimeEventName } from './realtime.events';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
    this.logger.log('Realtime server attached');
  }

  emitToOrg(orgId: string, event: RealtimeEventName, payload: unknown) {
    if (!this.server) {
      this.logger.debug(`Dropping ${event} — server not ready`);
      return;
    }
    this.server.to(`org:${orgId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: RealtimeEventName, payload: unknown) {
    if (!this.server) {
      return;
    }
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToDeployment(
    orgId: string,
    deploymentId: string,
    event: RealtimeEventName,
    payload: unknown,
  ) {
    if (!this.server) {
      return;
    }
    this.server.to(`org:${orgId}`).emit(event, payload);
    this.server.to(`deployment:${deploymentId}`).emit(event, payload);
  }
}
