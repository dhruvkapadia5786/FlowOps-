import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OpsApi } from '../../../core/api/catalog.api';
import { ApprovalListItem, ApprovalStatus } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../../shared/ui/status-badge/status-badge';
import { formatStatus, formatWhen, relativeTime } from '../../../shared/util/format';

@Component({
  selector: 'app-approvals-page',
  imports: [PageHeader, StatusBadge, RouterLink, FormsModule],
  templateUrl: './inbox.html',
  styleUrl: './inbox.css',
})
export class ApprovalsPage implements OnInit {
  private readonly ops = inject(OpsApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly formatWhen = formatWhen;
  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ApprovalListItem[]>([]);
  readonly total = signal(0);
  readonly busyId = signal<string | null>(null);

  status: ApprovalStatus | '' = 'pending';
  comment = '';

  ngOnInit() {
    void this.realtime.connected();
    this.load();
    this.realtime.approvalRequested$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
    this.realtime.approvalResolved$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  canDecide(): boolean {
    const role = this.auth.role();
    return role === 'admin' || role === 'release_manager';
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.ops.listApprovals(this.status || undefined, 1, 50).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.total.set(res.meta.total);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        this.error.set(
          err?.status === 403
            ? 'Your role cannot list approvals (need admin, release_manager, or devops).'
            : 'Unable to load approvals.',
        );
      },
    });
  }

  decide(row: ApprovalListItem, decision: 'approved' | 'rejected') {
    if (!this.canDecide()) {
      return;
    }
    this.confirm
      .open({
        title: decision === 'approved' ? 'Approve deployment?' : 'Reject deployment?',
        body: `${row.deployment.service.name} ${row.deployment.version} → ${row.deployment.environment.slug}`,
        confirmLabel: decision === 'approved' ? 'Approve' : 'Reject',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busyId.set(row.id);
        this.ops.decideApproval(row.id, decision, this.comment.trim() || undefined).subscribe({
          next: () => {
            this.busyId.set(null);
            this.comment = '';
            this.load();
          },
          error: (err: { error?: { message?: string } }) => {
            this.busyId.set(null);
            this.error.set(err?.error?.message ?? 'Decision failed');
          },
        });
      });
  }
}
