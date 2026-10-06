import { Component, computed, input } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

@Component({
  selector: 'fo-bar-chart',
  template: `
    <div class="chart" role="img" [attr.aria-label]="ariaLabel()">
      @if (!data().length || max() === 0) {
        <p class="chart__empty">No data yet</p>
      } @else {
        <div class="chart__bars">
          @for (bar of data(); track bar.label; let i = $index) {
            <div class="chart__col" [style.animation-delay.ms]="i * 40">
              <div class="chart__value">{{ bar.value }}</div>
              <div class="chart__track">
                <div
                  class="chart__fill"
                  [style.height.%]="heightPct(bar.value)"
                  [style.background]="bar.color || 'var(--color-accent)'"
                ></div>
              </div>
              <div class="chart__label" [title]="bar.label">{{ bar.label }}</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .chart {
      min-height: 11rem;
      padding: 0.75rem 0.5rem 0.25rem;
    }

    .chart__empty {
      margin: 2.5rem 0;
      text-align: center;
      color: var(--color-ink-muted);
      font-size: 0.8125rem;
    }

    .chart__bars {
      display: flex;
      align-items: flex-end;
      gap: 0.45rem;
      height: 10rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .chart__col {
      flex: 1 1 2.5rem;
      min-width: 2.25rem;
      max-width: 4.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      animation: fo-rise 420ms ease both;
    }

    .chart__value {
      font-family: var(--font-mono);
      font-size: 0.625rem;
      color: var(--color-ink-muted);
      margin-bottom: 0.25rem;
    }

    .chart__track {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: flex-end;
      border-radius: 0.25rem 0.25rem 0 0;
      background: color-mix(in srgb, var(--color-surface-raised) 70%, transparent);
    }

    .chart__fill {
      width: 100%;
      min-height: 2px;
      border-radius: 0.25rem 0.25rem 0 0;
      transition: height 360ms ease;
    }

    .chart__label {
      margin-top: 0.35rem;
      font-size: 0.625rem;
      color: var(--color-ink-faint);
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @keyframes fo-rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class FoBarChart {
  readonly data = input.required<BarDatum[]>();
  readonly ariaLabel = input('Bar chart');

  readonly max = computed(() => Math.max(0, ...this.data().map((d) => d.value)));

  heightPct(value: number): number {
    const m = this.max();
    if (m <= 0) {
      return 0;
    }
    return Math.max(4, Math.round((value / m) * 100));
  }
}
