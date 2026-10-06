export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export type DeploymentStatus =
  | 'queued'
  | 'building'
  | 'testing'
  | 'waiting_for_approval'
  | 'deploying'
  | 'health_check'
  | 'success'
  | 'failed'
  | 'rollback_required'
  | 'rolling_back'
  | 'rolled_back';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved';
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type HealthProbeStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface NamedRef {
  id: string;
  name: string;
  slug: string;
}

export interface UserRef {
  id: string;
  fullName: string;
  email: string;
}

export interface EnvironmentRef extends NamedRef {
  requiresApproval?: boolean;
  sortOrder?: number;
}

export interface ServiceSummary extends NamedRef {
  description?: string | null;
  isActive?: boolean;
  repositoryUrl?: string | null;
}

export interface DeploymentSummary {
  id: string;
  version: string;
  status: DeploymentStatus;
  commitSha?: string | null;
  failureReason?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceId: string;
  environmentId: string;
  service: NamedRef;
  environment: EnvironmentRef;
  triggeredBy: UserRef;
}

export interface DeploymentEvent {
  id: string;
  deploymentId: string;
  fromStatus: DeploymentStatus | null;
  toStatus: DeploymentStatus;
  message: string | null;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  deploymentId: string;
  status: ApprovalStatus;
  comment?: string | null;
  decidedAt?: string | null;
  expiresAt: string;
  createdAt: string;
  decidedBy?: UserRef | null;
}

export interface RollbackRecord {
  id: string;
  deploymentId: string;
  targetVersion?: string | null;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface DeploymentDetail extends DeploymentSummary {
  approval?: ApprovalRecord | null;
  events: DeploymentEvent[];
  rollback?: RollbackRecord | null;
  incident?: { id: string; title: string; severity: IncidentSeverity; status: IncidentStatus } | null;
}

export interface ApprovalListItem extends ApprovalRecord {
  deployment: {
    id: string;
    version: string;
    status: DeploymentStatus;
    service: NamedRef;
    environment: NamedRef;
    triggeredBy: UserRef;
  };
}

export interface IncidentSummary {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  openedAt: string;
  resolvedAt?: string | null;
  service: NamedRef;
  environment: NamedRef;
  deployment?: { id: string; version: string; status: DeploymentStatus } | null;
}

export interface HealthProbe {
  id: string;
  probeType: string;
  status: HealthProbeStatus;
  latencyMs: number;
  message?: string | null;
  checkedAt: string;
}

export interface HealthSnapshot {
  id: string;
  serviceId: string;
  environmentId: string;
  overallStatus: HealthProbeStatus;
  uptimePercent: number;
  avgLatencyMs: number;
  consecutiveFailures: number;
  checkedAt: string;
  service: NamedRef;
  environment: NamedRef;
  probes: HealthProbe[];
}

export interface CreateDeploymentRequest {
  serviceId: string;
  environmentId: string;
  version: string;
  commitSha?: string;
}

export interface ListDeploymentsParams {
  page?: number;
  pageSize?: number;
  status?: DeploymentStatus | '';
  serviceId?: string;
  environmentId?: string;
}
