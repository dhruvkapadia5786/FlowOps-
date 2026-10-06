import { Component, input } from '@angular/core';

@Component({
  selector: 'fo-stat-card',
  template: `
    <div class="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div class="card-body gap-2 p-4 sm:p-5">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-base-content/55 m-0">
            {{ label() }}
          </p>
          @if (icon()) {
            <span
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm"
              aria-hidden="true"
              >{{ icon() }}</span
            >
          }
        </div>
        <p class="text-3xl font-bold tabular-nums tracking-tight m-0">{{ value() }}</p>
        @if (hint()) {
          <p class="text-xs text-base-content/55 m-0">{{ hint() }}</p>
        }
      </div>
    </div>
  `,
})
export class FoStatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string | null>(null);
  readonly icon = input<string | null>(null);
}
