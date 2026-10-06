import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { OpsApi } from '../../../core/api/catalog.api';
import { DeploymentsApi } from '../../../core/api/deployments.api';
import { DeploymentDetail, HealthSnapshot } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../../shared/ui/status-badge/status-badge';
import { formatStatus, formatWhen, relativeTime, shortSha } from '../../../shared/util/format';

@Component({
  selector: 'app-deployment-detail-page',
  imports: [PageHeader, StatusBadge, RouterLink, DecimalPipe],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class DeploymentDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(DeploymentsApi);
  private readonly ops = inject(OpsApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly toneForStatus = toneForStatus;
  readonly formatStatus = formatStatus;
  readonly shortSha = shortSha;
  readonly formatWhen = formatWhen;
  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deployment = signal<DeploymentDetail | null>(null);
  readonly health = signal<HealthSnapshot | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionBusy = signal(false);

  private deploymentId: string | null = null;

  ngOnInit() {
    void this.realtime.connected();
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = params.get('id');
          this.deploymentId = id;
          if (!id) {
            this.error.set('Missing deployment id');
            this.loading.set(false);
            return of(null);
          }
          this.realtime.joinDeployment(id);
          this.loading.set(true);
          return this.api.get(id);
        }),
      )
      .subscribe({
        next: (dep) => {
          if (!dep) {
            return;
          }
          this.deployment.set(dep);
          this.loading.set(false);
          this.error.set(null);
          this.loadHealth(dep.serviceId, dep.environmentId);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deployment not found or API unavailable.');
        },
      });

    this.realtime.deploymentUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evt) => {
        if (evt.id !== this.deploymentId) {
          return;
        }
        this.refresh();
      });
  }

  ngOnDestroy() {
    if (this.deploymentId) {
      this.realtime.leaveDeployment(this.deploymentId);
    }
  }

  canRollback(): boolean {
    const dep = this.deployment();
    if (!dep) {
      return false;
    }
    if (dep.status !== 'rollback_required' && dep.status !== 'failed') {
      return false;
    }
    const role = this.auth.role();
    return role === 'admin' || role === 'devops' || role === 'release_manager';
  }

  refresh() {
    if (!this.deploymentId) {
      return;
    }
    this.api.get(this.deploymentId).subscribe({
      next: (dep) => {
        this.deployment.set(dep);
        this.loadHealth(dep.serviceId, dep.environmentId);
      },
    });
  }

  rollback() {
    const dep = this.deployment();
    if (!dep || !this.canRollback()) {
      return;
    }
    this.confirm
      .open({
        title: 'Start rollback?',
        body: `Simulate rollback for ${dep.service.name} ${dep.version} in ${dep.environment.slug}.`,
        confirmLabel: 'Start rollback',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.actionBusy.set(true);
        this.actionError.set(null);
        this.api.startRollback(dep.id).subscribe({
          next: () => {
            this.actionBusy.set(false);
            this.refresh();
          },
          error: (err: { error?: { message?: string } }) => {
            this.actionBusy.set(false);
            this.actionError.set(err?.error?.message ?? 'Rollback failed');
          },
        });
      });
  }

  private loadHealth(serviceId: string, environmentId: string) {
    this.ops
      .getHealth(serviceId, environmentId)
      .pipe(catchError(() => of(null)))
      .subscribe((snap) => this.health.set(snap));
  }
}
