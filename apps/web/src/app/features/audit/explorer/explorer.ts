import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CatalogApi, OpsApi } from '../../../core/api/catalog.api';
import {
  AuditFacets,
  AuditLogRow,
  EnvironmentRef,
  UserRef,
} from '../../../core/api/models';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { formatWhen, relativeTime } from '../../../shared/util/format';

@Component({
  selector: 'app-audit-page',
  imports: [PageHeader, FormsModule],
  templateUrl: './explorer.html',
  styleUrl: './explorer.css',
})
export class AuditPage implements OnInit {
  private readonly ops = inject(OpsApi);
  private readonly catalog = inject(CatalogApi);

  readonly formatWhen = formatWhen;
  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<AuditLogRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 25;
  readonly facets = signal<AuditFacets>({ actions: [], entityTypes: [], actors: [] });
  readonly environments = signal<EnvironmentRef[]>([]);

  actorId = '';
  action = '';
  entityType = '';
  entityId = '';
  environmentId = '';
  from = '';
  to = '';

  ngOnInit() {
    forkJoin({
      facets: this.ops.auditFacets(),
      environments: this.catalog.listEnvironments(),
    }).subscribe({
      next: ({ facets, environments }) => {
        this.facets.set(facets);
        this.environments.set(environments);
      },
      error: () => undefined,
    });
    this.load();
  }

  load(page = 1) {
    this.loading.set(true);
    this.error.set(null);
    this.page.set(page);
    this.ops
      .listAuditLogs({
        page,
        pageSize: this.pageSize,
        actorId: this.actorId || undefined,
        action: this.action || undefined,
        entityType: this.entityType || undefined,
        entityId: this.entityId || undefined,
        environmentId: this.environmentId || undefined,
        from: this.from ? new Date(this.from).toISOString() : undefined,
        to: this.to ? new Date(this.to).toISOString() : undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: (err: { status?: number }) => {
          this.loading.set(false);
          this.error.set(
            err?.status === 403
              ? 'Audit read requires admin, release_manager, viewer, or devops.'
              : 'Unable to load audit logs.',
          );
        },
      });
  }

  applyFilters() {
    this.load(1);
  }

  clearFilters() {
    this.actorId = '';
    this.action = '';
    this.entityType = '';
    this.entityId = '';
    this.environmentId = '';
    this.from = '';
    this.to = '';
    this.load(1);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  actorLabel(actor: UserRef) {
    return `${actor.fullName} · ${actor.email}`;
  }

  metaPreview(row: AuditLogRow): string {
    try {
      return JSON.stringify(row.metadata ?? {});
    } catch {
      return '';
    }
  }
}
