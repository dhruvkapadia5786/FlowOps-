import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { OpsApi } from '../../core/api/catalog.api';
import { DeploymentsApi } from '../../core/api/deployments.api';
import {
  ApprovalListItem,
  DeploymentSummary,
  HealthSnapshot,
  IncidentSummary,
  Paginated,
} from '../../core/api/models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../shared/ui/status-badge/status-badge';
import { formatStatus, relativeTime, shortSha } from '../../shared/util/format';

@Component({
  selector: 'app-dashboard-page',
  imports: [PageHeader, StatusBadge, RouterLink],
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

  private reloadQuiet() {
    this.fetch().subscribe({ error: () => undefined });
  }

  private fetch() {
    const emptyApprovals: Paginated<ApprovalListItem> = {
      data: [],
      meta: { page: 1, pageSize: 8, total: 0, totalPages: 1 },
    };

    return forkJoin({
      deploys: this.deploymentsApi.list({ page: 1, pageSize: 12 }),
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
