import { Component, input } from '@angular/core';

export type StatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'accent';

@Component({
  selector: 'fo-status-badge',
  template: `
    <span
      class="badge badge-sm gap-1.5 font-semibold uppercase tracking-wide"
      [class]="daisyClass()"
      [attr.data-tip]="tooltip() || null"
      [class.tooltip]="!!tooltip()"
    >
      @if (dot()) {
        <span class="status-dot" aria-hidden="true"></span>
      }
      {{ label() }}
    </span>
  `,
  styles: `
    .status-dot {
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 999px;
      background: currentColor;
      opacity: 0.9;
    }
  `,
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
  readonly dot = input(true);
  readonly tooltip = input<string | null>(null);

  daisyClass(): string {
    switch (this.tone()) {
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'danger':
        return 'badge-error';
      case 'info':
        return 'badge-info';
      case 'accent':
        return 'badge-accent';
      default:
        return 'badge-ghost';
    }
  }
}

/** Map deployment / health statuses to badge tones. */
export function toneForStatus(status: string): StatusTone {
  const s = status.toLowerCase();
  if (['success', 'healthy', 'resolved', 'approved', 'rolled_back'].includes(s)) {
    return 'success';
  }
  if (['failed', 'unhealthy', 'rejected', 'critical', 'expired'].includes(s)) {
    return 'danger';
  }
  if (
    [
      'waiting_for_approval',
      'pending',
      'degraded',
      'rollback_required',
      'queued',
      'building',
      'testing',
      'deploying',
      'health_check',
      'rolling_back',
    ].includes(s)
  ) {
    return 'warning';
  }
  if (['investigating', 'mitigated', 'open'].includes(s)) {
    return 'info';
  }
  return 'neutral';
}
