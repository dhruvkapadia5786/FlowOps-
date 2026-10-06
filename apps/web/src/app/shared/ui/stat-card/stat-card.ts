import { Component, input } from '@angular/core';

@Component({
  selector: 'fo-stat-card',
  template: `
    <div class="stat">
      <div class="stat__top">
        <p class="stat__label">{{ label() }}</p>
        @if (icon()) {
          <span class="stat__icon" aria-hidden="true">{{ icon() }}</span>
        }
      </div>
      <p class="stat__value">{{ value() }}</p>
      @if (hint()) {
        <p class="stat__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    .stat {
      border: 1px solid var(--color-border-subtle);
      border-radius: 0.375rem;
      background: var(--color-surface);
      padding: 0.85rem 0.95rem;
      transition: border-color 140ms ease;
    }
    .stat:hover {
      border-color: color-mix(in srgb, var(--color-accent) 28%, var(--color-border-subtle));
    }
    .stat__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .stat__label {
      margin: 0;
      font-size: 0.6875rem;
      font-weight: 650;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-ink-muted);
    }
    .stat__icon {
      display: inline-flex;
      height: 1.65rem;
      width: 1.65rem;
      align-items: center;
      justify-content: center;
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--color-accent) 14%, transparent);
      color: var(--color-accent);
      font-size: 0.75rem;
    }
    .stat__value {
      margin: 0.45rem 0 0;
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .stat__hint {
      margin: 0.35rem 0 0;
      font-size: 0.7rem;
      color: var(--color-ink-faint);
    }
  `,
})
export class FoStatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string | null>(null);
  readonly icon = input<string | null>(null);
}
