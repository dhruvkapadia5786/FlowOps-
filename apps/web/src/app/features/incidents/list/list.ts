import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogApi, OpsApi } from '../../../core/api/catalog.api';
import {
  EnvironmentRef,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
  ServiceSummary,
} from '../../../core/api/models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../../shared/ui/status-badge/status-badge';
import { formatStatus, relativeTime } from '../../../shared/util/format';

const STATUSES: IncidentStatus[] = ['open', 'investigating', 'mitigated', 'resolved'];
const SEVERITIES: IncidentSeverity[] = ['sev1', 'sev2', 'sev3', 'sev4'];

@Component({
  selector: 'app-incidents-page',
  imports: [PageHeader, StatusBadge, RouterLink, FormsModule],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export class IncidentsPage implements OnInit {
  private readonly ops = inject(OpsApi);
  private readonly catalog = inject(CatalogApi);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = STATUSES;
  readonly severities = SEVERITIES;
  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<IncidentSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 25;
  readonly services = signal<ServiceSummary[]>([]);
  readonly environments = signal<EnvironmentRef[]>([]);

  status: IncidentStatus | '' = '';
  severity: IncidentSeverity | '' = '';
  serviceId = '';
  environmentId = '';

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
    this.realtime.incidentCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(this.page()));
  }

  load(page = 1) {
    this.loading.set(true);
    this.error.set(null);
    this.page.set(page);
    this.ops
      .listIncidents({
        page,
        pageSize: this.pageSize,
        status: this.status || undefined,
        severity: this.severity || undefined,
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
          this.error.set('Unable to load incidents.');
        },
      });
  }

  applyFilters() {
    this.load(1);
  }

  clearFilters() {
    this.status = '';
    this.severity = '';
    this.serviceId = '';
    this.environmentId = '';
    this.load(1);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  severityTone(sev: IncidentSeverity) {
    return sev === 'sev1' || sev === 'sev2' ? 'danger' : 'warning';
  }
}
