import { Component, computed, input } from '@angular/core';

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'fo-donut-chart',
  template: `
    <div class="donut" role="img" [attr.aria-label]="ariaLabel()">
      @if (total() === 0) {
        <p class="donut__empty">No data yet</p>
      } @else {
        <svg viewBox="0 0 120 120" class="donut__svg">
          <circle
            cx="60"
            cy="60"
            [attr.r]="radius"
            fill="none"
            stroke="var(--color-border-subtle)"
            stroke-width="14"
          />
          @for (seg of segments(); track seg.label) {
            <circle
              cx="60"
              cy="60"
              [attr.r]="radius"
              fill="none"
              [attr.stroke]="seg.color"
              stroke-width="14"
              stroke-linecap="butt"
              [attr.stroke-dasharray]="seg.dash"
              [attr.stroke-dashoffset]="seg.offset"
              transform="rotate(-90 60 60)"
              class="donut__seg"
            />
          }
          <text x="60" y="56" text-anchor="middle" class="donut__total">{{ total() }}</text>
          <text x="60" y="72" text-anchor="middle" class="donut__caption">{{ centerLabel() }}</text>
        </svg>
        <ul class="donut__legend">
          @for (d of data(); track d.label) {
            <li>
              <span class="swatch" [style.background]="d.color"></span>
              <span>{{ d.label }}</span>
              <span class="mono">{{ d.value }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .donut {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1rem;
      align-items: center;
      padding: 0.75rem;
      min-height: 11rem;
    }

    .donut__empty {
      grid-column: 1 / -1;
      text-align: center;
      color: var(--color-ink-muted);
      font-size: 0.8125rem;
    }

    .donut__svg {
      width: 8.5rem;
      height: 8.5rem;
    }

    .donut__seg {
      animation: fo-draw 560ms ease both;
    }

    .donut__total {
      fill: var(--color-ink);
      font-size: 1.1rem;
      font-weight: 600;
      font-family: var(--font-sans);
    }

    .donut__caption {
      fill: var(--color-ink-faint);
      font-size: 0.55rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-family: var(--font-sans);
    }

    .donut__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.75rem;
    }

    .donut__legend li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.5rem;
      align-items: center;
    }

    .swatch {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 2px;
    }

    .mono {
      font-family: var(--font-mono);
      color: var(--color-ink-muted);
    }

    @keyframes fo-draw {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (max-width: 640px) {
      .donut {
        grid-template-columns: 1fr;
        justify-items: center;
      }
    }
  `,
})
export class FoDonutChart {
  readonly data = input.required<DonutDatum[]>();
  readonly centerLabel = input('total');
  readonly ariaLabel = input('Donut chart');
  readonly radius = 42;

  readonly total = computed(() => this.data().reduce((s, d) => s + d.value, 0));

  readonly segments = computed(() => {
    const total = this.total();
    const circ = 2 * Math.PI * this.radius;
    let cursor = 0;
    return this.data()
      .filter((d) => d.value > 0)
      .map((d) => {
        const len = (d.value / total) * circ;
        const seg = {
          label: d.label,
          color: d.color,
          dash: `${len} ${circ - len}`,
          offset: -cursor,
        };
        cursor += len;
        return seg;
      });
  });
}
