import { Component, computed, input } from '@angular/core';

export interface SparkPoint {
  label: string;
  value: number;
}

@Component({
  selector: 'fo-sparkline',
  template: `
    <div class="spark" role="img" [attr.aria-label]="ariaLabel()">
      @if (points().length < 2) {
        <p class="spark__empty">Not enough history yet</p>
      } @else {
        <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="spark__svg" preserveAspectRatio="none">
          <defs>
            <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.35" />
              <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path class="spark__area" [attr.d]="areaPath()" [attr.fill]="'url(#' + gradId + ')'" />
          <path
            class="spark__line"
            [attr.d]="linePath()"
            fill="none"
            [attr.stroke]="color()"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          @for (dot of dots(); track $index; let last = $last) {
            @if (last) {
              <circle
                class="spark__dot"
                [attr.cx]="dot.x"
                [attr.cy]="dot.y"
                r="3.5"
                [attr.fill]="color()"
              />
            }
          }
        </svg>
        <div class="spark__meta">
          <span>{{ startLabel() }}</span>
          <span class="spark__peak">peak {{ max() }}</span>
          <span>{{ endLabel() }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .spark {
      min-height: 9.5rem;
      padding: 0.5rem 0.25rem 0.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .spark__empty {
      margin: 2rem 0;
      text-align: center;
      color: var(--color-ink-muted);
      font-size: 0.8125rem;
      font-family: 'Roboto', var(--font-sans);
    }

    .spark__svg {
      width: 100%;
      height: 7.5rem;
      display: block;
    }

    .spark__area {
      animation: fo-fade 520ms ease both;
    }

    .spark__line {
      stroke-dasharray: 800;
      stroke-dashoffset: 800;
      animation: fo-stroke 900ms ease forwards;
    }

    .spark__dot {
      animation: fo-pulse-soft 1.6s ease-in-out infinite;
    }

    .spark__meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.65rem;
      color: var(--color-ink-faint);
      font-family: 'Roboto', var(--font-sans);
      letter-spacing: 0.02em;
    }

    .spark__peak {
      color: var(--color-ink-muted);
      font-family: 'Roboto Mono', var(--font-mono);
    }

    @keyframes fo-stroke {
      to {
        stroke-dashoffset: 0;
      }
    }

    @keyframes fo-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes fo-pulse-soft {
      0%,
      100% {
        opacity: 1;
        r: 3.5;
      }
      50% {
        opacity: 0.55;
        r: 4.5;
      }
    }
  `,
})
export class FoSparkline {
  readonly points = input.required<SparkPoint[]>();
  readonly color = input('var(--color-accent)');
  readonly ariaLabel = input('Activity sparkline');
  readonly width = 320;
  readonly height = 120;
  readonly gradId = `fo-spark-${Math.random().toString(36).slice(2, 8)}`;

  readonly max = computed(() => Math.max(1, ...this.points().map((p) => p.value)));
  readonly startLabel = computed(() => this.points()[0]?.label ?? '');
  readonly endLabel = computed(() => this.points().at(-1)?.label ?? '');

  readonly dots = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return [];
    const max = this.max();
    const padX = 6;
    const padY = 10;
    const w = this.width - padX * 2;
    const h = this.height - padY * 2;
    return pts.map((p, i) => {
      const x = padX + (i / (pts.length - 1)) * w;
      const y = padY + (1 - p.value / max) * h;
      return { x, y };
    });
  });

  linePath(): string {
    const dots = this.dots();
    if (dots.length < 2) return '';
    return dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
  }

  areaPath(): string {
    const dots = this.dots();
    if (dots.length < 2) return '';
    const base = this.height - 6;
    const line = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
    const last = dots.at(-1)!;
    const first = dots[0];
    return `${line} L${last.x.toFixed(1)} ${base} L${first.x.toFixed(1)} ${base} Z`;
  }
}
