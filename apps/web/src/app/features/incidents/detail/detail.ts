import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { OpsApi } from '../../../core/api/catalog.api';
import { IncidentDetail, IncidentStatus } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../../shared/ui/status-badge/status-badge';
import { formatStatus, formatWhen, relativeTime, shortSha } from '../../../shared/util/format';

const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['investigating', 'mitigated', 'resolved'],
  investigating: ['mitigated', 'resolved', 'open'],
  mitigated: ['resolved', 'investigating'],
  resolved: ['open', 'investigating'],
};

@Component({
  selector: 'app-incident-detail-page',
  imports: [PageHeader, StatusBadge, RouterLink, FormsModule],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class IncidentDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ops = inject(OpsApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly formatWhen = formatWhen;
  readonly relativeTime = relativeTime;
  readonly shortSha = shortSha;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly incident = signal<IncidentDetail | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  nextStatus: IncidentStatus | '' = '';
  note = '';

  ngOnInit() {
    void this.realtime.connected();
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = params.get('id')!;
          this.loading.set(true);
          return this.ops.getIncident(id);
        }),
      )
      .subscribe({
        next: (inc) => {
          this.incident.set(inc);
          this.nextStatus = '';
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Incident not found or API unavailable.');
        },
      });

    this.realtime.incidentCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evt) => {
        if (evt.id === this.incident()?.id) {
          this.refresh();
        }
      });
  }

  canUpdate(): boolean {
    const role = this.auth.role();
    return role === 'admin' || role === 'devops' || role === 'release_manager';
  }

  allowedTransitions(): IncidentStatus[] {
    const status = this.incident()?.status;
    if (!status) {
      return [];
    }
    return TRANSITIONS[status] ?? [];
  }

  refresh() {
    const id = this.incident()?.id;
    if (!id) {
      return;
    }
    this.ops.getIncident(id).subscribe({
      next: (inc) => this.incident.set(inc),
    });
  }

  applyUpdate() {
    const inc = this.incident();
    if (!inc || !this.canUpdate()) {
      return;
    }
    if (!this.nextStatus && !this.note.trim()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.ops
      .updateIncident(inc.id, {
        status: this.nextStatus || undefined,
        note: this.note.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.incident.set(updated);
          this.nextStatus = '';
          this.note = '';
          this.busy.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.actionError.set(err?.error?.message ?? 'Update failed');
        },
      });
  }

  resolve() {
    const inc = this.incident();
    if (!inc || !this.canUpdate()) {
      return;
    }
    this.busy.set(true);
    this.ops.resolveIncident(inc.id, this.note.trim() || undefined).subscribe({
      next: (updated) => {
        this.incident.set(updated);
        this.note = '';
        this.busy.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.actionError.set(err?.error?.message ?? 'Resolve failed');
      },
    });
  }
}
