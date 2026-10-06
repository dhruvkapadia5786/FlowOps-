import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogApi } from '../../../core/api/catalog.api';
import { DeploymentsApi } from '../../../core/api/deployments.api';
import {
  DeploymentStatus,
  DeploymentSummary,
  EnvironmentRef,
  ServiceSummary,
} from '../../../core/api/models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../../shared/ui/status-badge/status-badge';
import { formatStatus, relativeTime, shortSha } from '../../../shared/util/format';

const STATUSES: DeploymentStatus[] = [
  'queued',
  'building',
  'testing',
  'waiting_for_approval',
  'deploying',
  'health_check',
  'success',
  'failed',
  'rollback_required',
  'rolling_back',
  'rolled_back',
];

@Component({
  selector: 'app-deployments-page',
  imports: [PageHeader, StatusBadge, RouterLink, FormsModule],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export class DeploymentsPage implements OnInit {
  private readonly api = inject(DeploymentsApi);
  private readonly catalog = inject(CatalogApi);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = STATUSES;
  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly shortSha = shortSha;
  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<DeploymentSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 25;
  readonly services = signal<ServiceSummary[]>([]);
  readonly environments = signal<EnvironmentRef[]>([]);

  serviceId = '';
  environmentId = '';
  status: DeploymentStatus | '' = '';

  ngOnInit() {
    void this.realtime.connected();
    forkJoin({
      services: this.catalog.listServices(100),
      environments: this.catalog.listEnvironments(),
    }).subscribe({
      next: ({ services, environments }) => {
        this.services.set(services.data);
        this.environments.set(environments);
      },
    });
    this.load();
    this.realtime.deploymentUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evt) => {
        this.rows.update((list) =>
          list.map((row) =>
            row.id === evt.id
              ? {
                  ...row,
                  status: evt.status,
                  failureReason: evt.failureReason ?? row.failureReason,
                }
              : row,
          ),
        );
      });
  }

  load(page = 1) {
    this.loading.set(true);
    this.error.set(null);
    this.page.set(page);
    this.api
      .list({
        page,
        pageSize: this.pageSize,
        status: this.status || undefined,
        serviceId: this.serviceId || undefined,
        environmentId: this.environmentId || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Unable to load deployments.');
        },
      });
  }

  applyFilters() {
    this.load(1);
  }

  clearFilters() {
    this.serviceId = '';
    this.environmentId = '';
    this.status = '';
    this.load(1);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }
}
