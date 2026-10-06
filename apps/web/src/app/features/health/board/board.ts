import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OpsApi } from '../../../core/api/catalog.api';
import { HealthSnapshot } from '../../../core/api/models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../../shared/ui/status-badge/status-badge';
import { relativeTime } from '../../../shared/util/format';

@Component({
  selector: 'app-health-page',
  imports: [PageHeader, StatusBadge],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class HealthPage implements OnInit {
  private readonly ops = inject(OpsApi);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly toneForStatus = toneForStatus;
  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<HealthSnapshot[]>([]);

  ngOnInit() {
    void this.realtime.connected();
    this.load();
    this.realtime.healthUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  load() {
    this.loading.set(true);
    this.ops.listHealth().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load health snapshots.');
      },
    });
  }
}
