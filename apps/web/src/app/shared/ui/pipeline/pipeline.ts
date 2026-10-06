import { Component, computed, input } from '@angular/core';
import { DeploymentStatus } from '../../../core/api/models';
import { formatStatus } from '../../util/format';
import { toneForStatus } from '../status-badge/status-badge';

const HAPPY_PATH: DeploymentStatus[] = [
  'queued',
  'building',
  'testing',
  'waiting_for_approval',
  'deploying',
  'health_check',
  'success',
];

const FAILURE_TAIL: DeploymentStatus[] = [
  'failed',
  'rollback_required',
  'rolling_back',
  'rolled_back',
];

type StageState = 'done' | 'active' | 'pending' | 'failed' | 'skipped';

@Component({
  selector: 'fo-pipeline',
  template: `
    <div class="pipe" role="list" [attr.aria-label]="ariaLabel()">
      @for (stage of stages(); track stage.key; let last = $last) {
        <div class="pipe__stage" role="listitem" [attr.data-state]="stage.state">
          <div class="pipe__node" [title]="stage.label">
            <span class="pipe__dot"></span>
            <span class="pipe__label">{{ stage.short }}</span>
          </div>
          @if (!last) {
            <div class="pipe__edge" aria-hidden="true"></div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .pipe {
      display: flex;
      align-items: center;
      gap: 0;
      overflow-x: auto;
      padding: 0.75rem 0.25rem;
    }

    .pipe__stage {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      min-width: 4.5rem;
      animation: fo-fade-up 380ms ease both;
    }

    .pipe__node {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      min-width: 3.75rem;
    }

    .pipe__dot {
      width: 0.85rem;
      height: 0.85rem;
      border-radius: 999px;
      border: 2px solid var(--color-border);
      background: var(--color-surface);
      transition:
        background 200ms ease,
        border-color 200ms ease,
        box-shadow 200ms ease,
        transform 200ms ease;
    }

    .pipe__label {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-ink-faint);
      text-align: center;
      white-space: nowrap;
    }

    .pipe__edge {
      flex: 1;
      height: 2px;
      margin: 0 0.2rem 1.1rem;
      background: var(--color-border-subtle);
      border-radius: 1px;
      min-width: 0.75rem;
      transition: background 200ms ease;
    }

    .pipe__stage[data-state='done'] .pipe__dot {
      background: var(--color-accent);
      border-color: var(--color-accent);
    }

    .pipe__stage[data-state='done'] .pipe__label {
      color: var(--color-ink-muted);
    }

    .pipe__stage[data-state='done'] .pipe__edge {
      background: color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
    }

    .pipe__stage[data-state='active'] .pipe__dot {
      background: var(--color-info);
      border-color: var(--color-info);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-info) 25%, transparent);
      animation: fo-pulse 1.4s ease infinite;
    }

    .pipe__stage[data-state='active'] .pipe__label {
      color: var(--color-info);
    }

    .pipe__stage[data-state='failed'] .pipe__dot {
      background: var(--color-danger);
      border-color: var(--color-danger);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-danger) 22%, transparent);
    }

    .pipe__stage[data-state='failed'] .pipe__label {
      color: var(--color-danger);
    }

    .pipe__stage[data-state='skipped'] {
      opacity: 0.35;
    }

    @keyframes fo-pulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.12);
      }
    }

    @keyframes fo-fade-up {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class FoPipeline {
  readonly status = input.required<DeploymentStatus>();
  readonly requiresApproval = input(true);
  readonly ariaLabel = input('Deployment pipeline');

  readonly stages = computed(() => {
    const current = this.status();
    const path = this.requiresApproval()
      ? HAPPY_PATH
      : HAPPY_PATH.filter((s) => s !== 'waiting_for_approval');

    const inFailure = FAILURE_TAIL.includes(current);
    const happyIdx = path.indexOf(current as (typeof path)[number]);

    const happyStages = path.map((key, i) => {
      let state: StageState = 'pending';
      if (inFailure) {
        state = i < path.length - 1 ? 'done' : 'skipped';
        if (key === 'success') {
          state = 'skipped';
        }
      } else if (current === 'success') {
        state = 'done';
      } else if (happyIdx === i) {
        state = 'active';
      } else if (happyIdx > i) {
        state = 'done';
      }
      return {
        key,
        label: formatStatus(key),
        short: shortLabel(key),
        state,
        tone: toneForStatus(key),
      };
    });

    if (!inFailure) {
      return happyStages;
    }

    const failIdx = FAILURE_TAIL.indexOf(current);
    const failStages = FAILURE_TAIL.map((key, i) => {
      let state: StageState = 'pending';
      if (i < failIdx) {
        state = 'done';
      } else if (i === failIdx) {
        state = key === 'failed' || key === 'rollback_required' ? 'failed' : 'active';
      }
      return {
        key,
        label: formatStatus(key),
        short: shortLabel(key),
        state,
        tone: toneForStatus(key),
      };
    });

    return [...happyStages.filter((s) => s.key !== 'success'), ...failStages];
  });
}

function shortLabel(status: DeploymentStatus): string {
  const map: Record<DeploymentStatus, string> = {
    queued: 'Queue',
    building: 'Build',
    testing: 'Test',
    waiting_for_approval: 'Approve',
    deploying: 'Deploy',
    health_check: 'Health',
    success: 'Success',
    failed: 'Failed',
    rollback_required: 'RB req',
    rolling_back: 'Rollback',
    rolled_back: 'Rolled',
  };
  return map[status];
}
