import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { OpsApi } from '../../../core/api/catalog.api';
import {
  SimulationEffect,
  SimulationScenario,
  SimulationSettings,
} from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { relativeTime } from '../../../shared/util/format';

@Component({
  selector: 'app-simulation-page',
  imports: [PageHeader, StatusBadge, FormsModule, RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class SimulationPage implements OnInit {
  private readonly ops = inject(OpsApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly relativeTime = relativeTime;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly settings = signal<SimulationSettings | null>(null);
  readonly scenarios = signal<SimulationScenario[]>([]);
  readonly framing = signal(
    'Local simulation only — FlowOps does not touch real production infrastructure.',
  );
  readonly busyKey = signal<string | null>(null);

  buildFailRate = 0;
  deployFailRate = 0;
  healthFailRate = 0;
  stageDelayMs = 400;
  deterministic = false;

  ngOnInit() {
    void this.realtime.connected();
    this.reload();
    this.realtime.simulationUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
    this.realtime.healthUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
    this.realtime.incidentCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadQuiet());
  }

  canWriteSettings(): boolean {
    return this.auth.role() === 'admin';
  }

  canRun(): boolean {
    const role = this.auth.role();
    return role === 'admin' || role === 'devops';
  }

  reload() {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      settings: this.ops.getSimulationSettings(),
      scenarios: this.ops.listSimulationScenarios(),
    }).subscribe({
      next: ({ settings, scenarios }) => {
        this.applySettings(settings);
        this.scenarios.set(scenarios.scenarios);
        this.framing.set(scenarios.framing || settings.framing);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        this.error.set(
          err?.status === 403
            ? 'Simulation controls require admin or devops.'
            : 'Unable to load simulation controls.',
        );
      },
    });
  }

  private reloadQuiet() {
    this.ops.getSimulationSettings().subscribe({
      next: (settings) => this.applySettings(settings),
      error: () => undefined,
    });
  }

  private applySettings(settings: SimulationSettings) {
    this.settings.set(settings);
    this.buildFailRate = settings.buildFailRate;
    this.deployFailRate = settings.deployFailRate;
    this.healthFailRate = settings.healthFailRate;
    this.stageDelayMs = settings.stageDelayMs;
    this.deterministic = settings.deterministic;
  }

  saveSettings() {
    if (!this.canWriteSettings()) {
      return;
    }
    this.busyKey.set('settings');
    this.ops
      .updateSimulationSettings({
        buildFailRate: Number(this.buildFailRate),
        deployFailRate: Number(this.deployFailRate),
        healthFailRate: Number(this.healthFailRate),
        stageDelayMs: Number(this.stageDelayMs),
        deterministic: this.deterministic,
      })
      .subscribe({
        next: (settings) => {
          this.applySettings(settings);
          this.busyKey.set(null);
          this.message.set('Simulation knobs saved (local worker rates).');
        },
        error: (err: { error?: { message?: string } }) => {
          this.busyKey.set(null);
          this.error.set(err?.error?.message ?? 'Failed to save settings');
        },
      });
  }

  run(scenario: SimulationScenario) {
    if (!this.canRun()) {
      return;
    }
    this.busyKey.set(scenario.key);
    this.error.set(null);
    this.message.set(null);
    this.ops.runSimulationScenario(scenario.key).subscribe({
      next: (res) => {
        this.busyKey.set(null);
        this.applySettings(res.settings);
        this.message.set(
          `${scenario.label} applied. ${res.framing}` +
            (res.incident?.id ? ` Incident ${res.incident.id.slice(0, 8)}…` : '') +
            (res.deployment?.id ? ` Deployment ${res.deployment.id.slice(0, 8)}…` : ''),
        );
      },
      error: (err: { error?: { message?: string } }) => {
        this.busyKey.set(null);
        this.error.set(err?.error?.message ?? 'Scenario failed');
      },
    });
  }

  recover(effect: SimulationEffect) {
    if (!this.canRun()) {
      return;
    }
    this.busyKey.set(effect.id);
    this.ops.recoverSimulationScenario(effect.scenarioKey, effect.id).subscribe({
      next: (res) => {
        this.busyKey.set(null);
        this.applySettings(res.settings);
        this.message.set(`Recovered: ${effect.label}`);
      },
      error: (err: { error?: { message?: string } }) => {
        this.busyKey.set(null);
        this.error.set(err?.error?.message ?? 'Recovery failed');
      },
    });
  }

  chaosBurst() {
    if (!this.canWriteSettings()) {
      return;
    }
    this.busyKey.set('chaos');
    this.ops.runChaosBurst(5).subscribe({
      next: (res) => {
        this.busyKey.set(null);
        this.message.set(`Chaos burst queued ${res.created.length} local deploys.`);
      },
      error: (err: { error?: { message?: string } }) => {
        this.busyKey.set(null);
        this.error.set(err?.error?.message ?? 'Chaos burst failed');
      },
    });
  }

  activeEffects(): SimulationEffect[] {
    return this.settings()?.activeEffects ?? [];
  }

  isRecoverable(scenarioKey: string): boolean {
    return !!this.scenarios().find((s) => s.key === scenarioKey)?.recoverable;
  }
}
