import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { Tooltip } from 'primeng/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { OpsApi } from '../../core/api/catalog.api';
import { DeploymentsApi } from '../../core/api/deployments.api';
import {
  ApprovalListItem,
  DeploymentStatus,
  DeploymentSummary,
  HealthSnapshot,
  IncidentSummary,
  Paginated,
} from '../../core/api/models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { FoBreadcrumb } from '../../shared/ui/breadcrumb/breadcrumb';
import { FoBarChart, BarDatum } from '../../shared/ui/charts/bar-chart';
import { FoDonutChart, DonutDatum } from '../../shared/ui/charts/donut-chart';
import { FoSparkline, SparkPoint } from '../../shared/ui/charts/sparkline';
import { FoIconChip } from '../../shared/ui/icon-chip/icon-chip';
import { FoPipeline } from '../../shared/ui/pipeline/pipeline';
import { FoSkeleton } from '../../shared/ui/skeleton/skeleton';
import { FoStatCard } from '../../shared/ui/stat-card/stat-card';
import { StatusBadge, toneForStatus } from '../../shared/ui/status-badge/status-badge';
import { downloadCsv, ExcelColumn } from '../../shared/util/export-excel';
import { formatStatus, relativeTime, shortSha } from '../../shared/util/format';

const STATUS_COLORS: Partial<Record<DeploymentStatus, string>> = {
  success: 'var(--color-accent)',
  failed: 'var(--color-danger)',
  queued: 'var(--color-neutral)',
  building: 'var(--color-info)',
  testing: 'var(--color-info)',
  waiting_for_approval: 'var(--color-warning)',
  deploying: 'var(--color-info)',
  health_check: 'var(--color-info)',
  rollback_required: 'var(--color-danger)',
  rolling_back: 'var(--color-warning)',
  rolled_back: 'var(--color-neutral)',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [
    StatusBadge,
    RouterLink,
    FoBarChart,
    FoDonutChart,
    FoSparkline,
    FoPipeline,
    FoBreadcrumb,
    FoIconChip,
    FoSkeleton,
    FoStatCard,
    TableModule,
    Tooltip,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardPage implements OnInit {
  private readonly deploymentsApi = inject(DeploymentsApi);
  private readonly ops = inject(OpsApi);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly recent = signal<DeploymentSummary[]>([]);
  readonly pendingApprovals = signal<ApprovalListItem[]>([]);
  readonly openIncidents = signal<IncidentSummary[]>([]);
  readonly unhealthy = signal<HealthSnapshot[]>([]);
  readonly deployTotal = signal(0);
  readonly approvalTotal = signal(0);
  readonly incidentTotal = signal(0);
  readonly live = this.realtime.connected;

  readonly crumbs = [
    { label: 'FlowOps', path: '/' },
    { label: 'Operations overview' },
  ];

  readonly capabilities = [
    {
      art: '/illustrations/code-deployed.svg',
      title: 'Deployment lifecycle',
      body: 'Queue → build → test → approve → deploy → health, with failure and rollback paths.',
    },
    {
      art: '/illustrations/checklist.svg',
      title: 'Production gates',
      body: 'Release managers approve or reject prod releases with TTL, audit, and notifications.',
    },
    {
      art: '/illustrations/fixing-bugs.svg',
      title: 'Incidents & rollback',
      body: 'Failed deploys and unhealthy probes open incidents; rollbacks stay local simulations.',
    },
    {
      art: '/illustrations/cloud-sync.svg',
      title: 'Realtime ops feed',
      body: 'Socket.IO updates keep dashboards, approvals, and incident boards live.',
    },
  ];

  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly shortSha = shortSha;
  readonly relativeTime = relativeTime;

  readonly statusBars = computed<BarDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const d of this.recent()) {
      counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({
        label: formatStatus(label),
        value,
        color: STATUS_COLORS[label as DeploymentStatus] ?? 'var(--color-accent)',
      }))
      .sort((a, b) => b.value - a.value);
  });

  readonly outcomeDonut = computed<DonutDatum[]>(() => {
    let success = 0;
    let failed = 0;
    let inFlight = 0;
    let rollback = 0;
    for (const d of this.recent()) {
      if (d.status === 'success') success += 1;
      else if (d.status === 'failed') failed += 1;
      else if (
        d.status === 'rollback_required' ||
        d.status === 'rolling_back' ||
        d.status === 'rolled_back'
      ) {
        rollback += 1;
      } else {
        inFlight += 1;
      }
    }
    return [
      { label: 'Success', value: success, color: 'var(--color-accent)' },
      { label: 'In flight', value: inFlight, color: 'var(--color-info)' },
      { label: 'Failed', value: failed, color: 'var(--color-danger)' },
      { label: 'Rollback', value: rollback, color: 'var(--color-warning)' },
    ].filter((d) => d.value > 0);
  });

  readonly spotlight = computed(
    () =>
      this.recent().find((d) => !['success', 'failed', 'rolled_back'].includes(d.status)) ??
      this.recent()[0] ??
      null,
  );

  /** Bucket recent deploys by hour for the activity sparkline. */
  readonly activitySeries = computed<SparkPoint[]>(() => {
    const buckets = new Map<string, { label: string; value: number; sort: number }>();
    const now = Date.now();
    for (let i = 11; i >= 0; i -= 1) {
      const t = new Date(now - i * 60 * 60 * 1000);
      const key = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}`;
      const label = t.toLocaleTimeString(undefined, { hour: 'numeric' });
      buckets.set(key, { label, value: 0, sort: t.getTime() });
    }
    for (const d of this.recent()) {
      const t = new Date(d.createdAt);
      if (Number.isNaN(t.getTime())) continue;
      const key = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.value += 1;
      }
    }
    return [...buckets.values()]
      .sort((a, b) => a.sort - b.sort)
      .map(({ label, value }) => ({ label, value }));
  });

  readonly envBars = computed<BarDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const d of this.recent()) {
      const slug = d.environment.slug;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    const palette = [
      'var(--color-accent)',
      'var(--color-info)',
      'var(--color-warning)',
      'var(--color-danger)',
      'var(--color-neutral)',
    ];
    return [...counts.entries()]
      .map(([label, value], i) => ({
        label,
        value,
        color: palette[i % palette.length],
      }))
      .sort((a, b) => b.value - a.value);
  });

  readonly showApprovalBanner = computed(() => this.approvalTotal() > 0);
  readonly showIncidentBanner = computed(() => this.incidentTotal() > 0);

  ngOnInit() {
    void this.realtime.connected();
    this.reload();
    this.realtime.deploymentUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
    this.realtime.approvalRequested$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
    this.realtime.approvalResolved$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
    this.realtime.incidentCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
  }

  reload() {
    this.loading.set(true);
    this.error.set(null);
    this.fetch().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load operations overview from the API.');
      },
    });
  }

  exportRecent() {
    const cols: ExcelColumn<DeploymentSummary>[] = [
      { key: 'service', header: 'Service', value: (r) => r.service.name },
      { key: 'env', header: 'Environment', value: (r) => r.environment.slug },
      { key: 'version', header: 'Version' },
      { key: 'status', header: 'Status', value: (r) => formatStatus(r.status) },
      { key: 'triggeredBy', header: 'Triggered by', value: (r) => r.triggeredBy.fullName },
      { key: 'createdAt', header: 'Created', value: (r) => r.createdAt },
    ];
    downloadCsv(this.recent(), cols, 'flowops-recent-deployments');
  }

  private reloadQuiet() {
    this.fetch().subscribe({ error: () => undefined });
  }

  private fetch() {
    const emptyApprovals: Paginated<ApprovalListItem> = {
      data: [],
      meta: { page: 1, pageSize: 8, total: 0, totalPages: 1 },
    };

    return forkJoin({
      deploys: this.deploymentsApi.list({ page: 1, pageSize: 40 }),
      approvals: this.ops.listApprovals('pending', 1, 8).pipe(catchError(() => of(emptyApprovals))),
      incidents: this.ops.listIncidents({ status: 'open', pageSize: 8 }),
      health: this.ops.listHealth().pipe(catchError(() => of([] as HealthSnapshot[]))),
    }).pipe(
      tap(({ deploys, approvals, incidents, health }) => {
        this.recent.set(deploys.data);
        this.deployTotal.set(deploys.meta.total);
        this.pendingApprovals.set(approvals.data);
        this.approvalTotal.set(approvals.meta.total);
        this.openIncidents.set(incidents.data);
        this.incidentTotal.set(incidents.meta.total);
        this.unhealthy.set(
          health.filter((h) => h.overallStatus === 'unhealthy' || h.overallStatus === 'degraded'),
        );
      }),
    );
  }
}
