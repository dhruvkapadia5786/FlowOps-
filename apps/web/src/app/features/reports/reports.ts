import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OpsApi } from '../../core/api/catalog.api';
import { DeploymentsApi } from '../../core/api/deployments.api';
import {
  ApprovalListItem,
  DeploymentStatus,
  DeploymentSummary,
  HealthSnapshot,
  IncidentSummary,
} from '../../core/api/models';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { FoSmartTable, SmartTableColumn } from '../../shared/ui/smart-table/smart-table';
import { StatusBadge, toneForStatus } from '../../shared/ui/status-badge/status-badge';
import {
  downloadCsv,
  downloadExcelWorkbook,
  ExcelColumn,
} from '../../shared/util/export-excel';
import { formatStatus, formatWhen, shortSha } from '../../shared/util/format';

@Component({
  selector: 'app-reports-page',
  imports: [PageHeader, StatusBadge, FoSmartTable],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class ReportsPage implements OnInit {
  private readonly deploymentsApi = inject(DeploymentsApi);
  private readonly ops = inject(OpsApi);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deployments = signal<DeploymentSummary[]>([]);
  readonly incidents = signal<IncidentSummary[]>([]);
  readonly approvals = signal<ApprovalListItem[]>([]);
  readonly health = signal<HealthSnapshot[]>([]);
  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly shortSha = shortSha;
  readonly formatWhen = formatWhen;

  readonly deployColumns: SmartTableColumn<DeploymentSummary>[] = [
    { key: 'service', header: 'Service', value: (r) => r.service.name },
    { key: 'env', header: 'Env', mono: true, value: (r) => r.environment.slug },
    { key: 'version', header: 'Version', mono: true },
    { key: 'commit', header: 'Commit', mono: true, value: (r) => shortSha(r.commitSha) },
    { key: 'status', header: 'Status', value: (r) => formatStatus(r.status) },
    { key: 'triggeredBy', header: 'Triggered', value: (r) => r.triggeredBy.fullName },
    { key: 'createdAt', header: 'Created', value: (r) => formatWhen(r.createdAt) },
  ];

  readonly incidentColumns: SmartTableColumn<IncidentSummary>[] = [
    { key: 'severity', header: 'Severity' },
    { key: 'status', header: 'Status', value: (r) => formatStatus(r.status) },
    { key: 'title', header: 'Title' },
    { key: 'service', header: 'Service', mono: true, value: (r) => r.service.slug },
    { key: 'openedAt', header: 'Opened', value: (r) => formatWhen(r.openedAt) },
  ];

  readonly approvalColumns: SmartTableColumn<ApprovalListItem>[] = [
    { key: 'service', header: 'Service', value: (r) => r.deployment.service.name },
    { key: 'env', header: 'Env', mono: true, value: (r) => r.deployment.environment.slug },
    { key: 'version', header: 'Version', mono: true, value: (r) => r.deployment.version },
    { key: 'status', header: 'Status', value: (r) => formatStatus(r.status) },
    { key: 'expiresAt', header: 'Expires', value: (r) => formatWhen(r.expiresAt) },
  ];

  readonly healthColumns: SmartTableColumn<HealthSnapshot>[] = [
    { key: 'service', header: 'Service', value: (r) => r.service.name },
    { key: 'env', header: 'Env', mono: true, value: (r) => r.environment.slug },
    { key: 'status', header: 'Status', value: (r) => r.overallStatus },
    { key: 'latency', header: 'Latency', mono: true, value: (r) => `${r.avgLatencyMs}ms` },
    { key: 'failures', header: 'Failures', mono: true, value: (r) => r.consecutiveFailures },
  ];

  readonly statusCounts = computed(() => {
    const counts = new Map<DeploymentStatus, number>();
    for (const d of this.deployments()) {
      counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  });

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      deploys: this.deploymentsApi.list({ page: 1, pageSize: 100 }),
      incidents: this.ops.listIncidents({ pageSize: 100 }),
      approvals: this.ops
        .listApprovals(undefined, 1, 100)
        .pipe(catchError(() => of({ data: [] as ApprovalListItem[], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } }))),
      health: this.ops.listHealth().pipe(catchError(() => of([] as HealthSnapshot[]))),
    }).subscribe({
      next: ({ deploys, incidents, approvals, health }) => {
        this.deployments.set(deploys.data);
        this.incidents.set(incidents.data);
        this.approvals.set(approvals.data);
        this.health.set(health);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load report datasets from the API.');
      },
    });
  }

  exportDeploymentsCsv() {
    const cols: ExcelColumn<DeploymentSummary>[] = [
      { key: 'service', header: 'Service', value: (r: DeploymentSummary) => r.service.name },
      { key: 'slug', header: 'Service slug', value: (r: DeploymentSummary) => r.service.slug },
      { key: 'env', header: 'Environment', value: (r: DeploymentSummary) => r.environment.slug },
      { key: 'version', header: 'Version' },
      { key: 'commit', header: 'Commit', value: (r: DeploymentSummary) => r.commitSha ?? '' },
      {
        key: 'status',
        header: 'Status',
        value: (r: DeploymentSummary) => formatStatus(r.status),
      },
      {
        key: 'triggeredBy',
        header: 'Triggered by',
        value: (r: DeploymentSummary) => r.triggeredBy.fullName,
      },
      {
        key: 'createdAt',
        header: 'Created',
        value: (r: DeploymentSummary) => formatWhen(r.createdAt),
      },
      {
        key: 'failureReason',
        header: 'Failure reason',
        value: (r: DeploymentSummary) => r.failureReason ?? '',
      },
    ];
    downloadCsv(this.deployments(), cols, `flowops-deployments-${stamp()}`);
  }

  exportIncidentsCsv() {
    const cols: ExcelColumn<IncidentSummary>[] = [
      { key: 'severity', header: 'Severity' },
      {
        key: 'status',
        header: 'Status',
        value: (r: IncidentSummary) => formatStatus(r.status),
      },
      { key: 'title', header: 'Title' },
      { key: 'service', header: 'Service', value: (r: IncidentSummary) => r.service.slug },
      {
        key: 'openedAt',
        header: 'Opened',
        value: (r: IncidentSummary) => formatWhen(r.openedAt),
      },
    ];
    downloadCsv(this.incidents(), cols, `flowops-incidents-${stamp()}`);
  }

  exportWorkbook() {
    downloadExcelWorkbook(
      [
        {
          name: 'Deployments',
          columns: [
            { key: 'service', header: 'Service' },
            { key: 'env', header: 'Environment' },
            { key: 'version', header: 'Version' },
            { key: 'status', header: 'Status' },
            { key: 'triggeredBy', header: 'Triggered by' },
            { key: 'createdAt', header: 'Created' },
          ],
          rows: this.deployments().map((r) => ({
            service: r.service.name,
            env: r.environment.slug,
            version: r.version,
            status: formatStatus(r.status),
            triggeredBy: r.triggeredBy.fullName,
            createdAt: formatWhen(r.createdAt),
          })),
        },
        {
          name: 'Incidents',
          columns: [
            { key: 'severity', header: 'Severity' },
            { key: 'status', header: 'Status' },
            { key: 'title', header: 'Title' },
            { key: 'service', header: 'Service' },
            { key: 'openedAt', header: 'Opened' },
          ],
          rows: this.incidents().map((r) => ({
            severity: r.severity,
            status: formatStatus(r.status),
            title: r.title,
            service: r.service.slug,
            openedAt: formatWhen(r.openedAt),
          })),
        },
        {
          name: 'Approvals',
          columns: [
            { key: 'service', header: 'Service' },
            { key: 'env', header: 'Environment' },
            { key: 'version', header: 'Version' },
            { key: 'status', header: 'Status' },
            { key: 'expiresAt', header: 'Expires' },
          ],
          rows: this.approvals().map((r) => ({
            service: r.deployment.service.name,
            env: r.deployment.environment.slug,
            version: r.deployment.version,
            status: formatStatus(r.status),
            expiresAt: formatWhen(r.expiresAt),
          })),
        },
        {
          name: 'Health',
          columns: [
            { key: 'service', header: 'Service' },
            { key: 'env', header: 'Environment' },
            { key: 'status', header: 'Status' },
            { key: 'latency', header: 'Avg latency ms' },
            { key: 'failures', header: 'Consecutive failures' },
          ],
          rows: this.health().map((r) => ({
            service: r.service.name,
            env: r.environment.slug,
            status: r.overallStatus,
            latency: r.avgLatencyMs,
            failures: r.consecutiveFailures,
          })),
        },
        {
          name: 'Status summary',
          columns: [
            { key: 'status', header: 'Pipeline status' },
            { key: 'count', header: 'Count' },
          ],
          rows: this.statusCounts().map((r) => ({
            status: formatStatus(r.status),
            count: r.count,
          })),
        },
      ],
      `flowops-ops-report-${stamp()}`,
    );
  }
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
