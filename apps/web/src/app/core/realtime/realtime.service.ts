import { Injectable, effect, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { DeploymentStatus } from '../api/models';

export interface DeploymentUpdatedEvent {
  id: string;
  status: DeploymentStatus;
  version?: string;
  serviceId?: string;
  environmentId?: string;
  fromStatus?: DeploymentStatus;
  failureReason?: string | null;
}

export interface ApprovalRequestedEvent {
  approvalId: string;
  deploymentId: string;
  expiresAt: string;
}

export interface ApprovalResolvedEvent {
  approvalId: string;
  deploymentId: string;
  status: string;
}

export interface IncidentCreatedEvent {
  id: string;
  title?: string;
  severity?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private joinedOrgId: string | null = null;

  private readonly deploymentUpdatedSubject = new Subject<DeploymentUpdatedEvent>();
  private readonly approvalRequestedSubject = new Subject<ApprovalRequestedEvent>();
  private readonly approvalResolvedSubject = new Subject<ApprovalResolvedEvent>();
  private readonly incidentCreatedSubject = new Subject<IncidentCreatedEvent>();
  private readonly healthUpdatedSubject = new Subject<{ serviceId?: string; environmentId?: string }>();
  private readonly simulationUpdatedSubject = new Subject<{
    activeEffects?: unknown[];
  }>();
  private readonly connectedSignal = signal(false);

  readonly connected = this.connectedSignal.asReadonly();
  readonly deploymentUpdated$ = this.deploymentUpdatedSubject.asObservable();
  readonly approvalRequested$ = this.approvalRequestedSubject.asObservable();
  readonly approvalResolved$ = this.approvalResolvedSubject.asObservable();
  readonly incidentCreated$ = this.incidentCreatedSubject.asObservable();
  readonly healthUpdated$ = this.healthUpdatedSubject.asObservable();
  readonly simulationUpdated$ = this.simulationUpdatedSubject.asObservable();

  constructor() {
    effect(() => {
      const session = this.auth.session();
      const token = session?.accessToken;
      const orgId = session?.organization?.id;
      if (token && orgId) {
        this.connect(token, orgId);
      } else {
        this.disconnect();
      }
    });
  }

  joinDeployment(deploymentId: string) {
    this.socket?.emit('join', {
      orgId: this.joinedOrgId,
      deploymentId,
    });
  }

  leaveDeployment(deploymentId: string) {
    this.socket?.emit('leave', { deploymentId });
  }

  private connect(token: string, orgId: string) {
    if (this.socket?.connected && this.joinedOrgId === orgId) {
      return;
    }
    this.disconnect();

    this.socket = io(environment.wsUrl, {
      path: environment.wsPath,
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.connectedSignal.set(true);
      this.joinedOrgId = orgId;
      this.socket?.emit('join', { orgId });
    });

    this.socket.on('disconnect', () => {
      this.connectedSignal.set(false);
    });

    this.socket.on('deployment.updated', (payload: DeploymentUpdatedEvent) => {
      this.deploymentUpdatedSubject.next(payload);
    });
    this.socket.on('approval.requested', (payload: ApprovalRequestedEvent) => {
      this.approvalRequestedSubject.next(payload);
    });
    this.socket.on('approval.resolved', (payload: ApprovalResolvedEvent) => {
      this.approvalResolvedSubject.next(payload);
    });
    this.socket.on('incident.created', (payload: IncidentCreatedEvent) => {
      this.incidentCreatedSubject.next(payload);
    });
    this.socket.on('health.updated', (payload: { serviceId?: string; environmentId?: string }) => {
      this.healthUpdatedSubject.next(payload);
    });
    this.socket.on('simulation.updated', (payload: { activeEffects?: unknown[] }) => {
      this.simulationUpdatedSubject.next(payload);
    });
  }

  private disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.joinedOrgId = null;
    this.connectedSignal.set(false);
  }
}
