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
    <span class="badge" [attr.data-tone]="tone()">
      @if (dot()) {
        <span class="badge__dot" aria-hidden="true"></span>
      }
      <span class="badge__label">{{ label() }}</span>
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--tone) 35%, var(--color-border));
      background: color-mix(in srgb, var(--tone) 14%, transparent);
      color: color-mix(in srgb, var(--tone) 75%, white);
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      --tone: var(--color-neutral);
    }

    .badge[data-tone='success'] {
      --tone: var(--color-accent);
    }
    .badge[data-tone='warning'] {
      --tone: var(--color-warning);
    }
    .badge[data-tone='danger'] {
      --tone: var(--color-danger);
    }
    .badge[data-tone='info'] {
      --tone: var(--color-info);
    }
    .badge[data-tone='accent'] {
      --tone: var(--color-accent);
    }
    .badge[data-tone='neutral'] {
      --tone: var(--color-neutral);
    }

    .badge__dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 999px;
      background: var(--tone);
    }
  `,
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
  readonly dot = input(true);
}

/** Map deployment / health statuses to badge tones for M8+. */
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
