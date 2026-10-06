import { Component, input } from '@angular/core';

@Component({
  selector: 'fo-page-header',
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h1 class="m-0 text-2xl font-bold tracking-tight">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 mb-0 max-w-2xl text-sm text-base-content/65">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex flex-wrap gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
