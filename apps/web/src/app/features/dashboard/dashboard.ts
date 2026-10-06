import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
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
import { FoBarChart, BarDatum } from '../../shared/ui/charts/bar-chart';
import { FoDonutChart, DonutDatum } from '../../shared/ui/charts/donut-chart';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { FoPipeline } from '../../shared/ui/pipeline/pipeline';
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
    PageHeader,
    StatusBadge,
    RouterLink,
    FoBarChart,
    FoDonutChart,
    FoPipeline,
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

  readonly spotlight = computed(() => this.recent().find((d) =>
    !['success', 'failed', 'rolled_back'].includes(d.status),
  ) ?? this.recent()[0] ?? null);

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
