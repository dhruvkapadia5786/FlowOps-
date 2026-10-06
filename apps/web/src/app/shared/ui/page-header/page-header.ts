import { Component, input } from '@angular/core';

@Component({
  selector: 'fo-page-header',
  template: `
    <header class="header">
      <div>
        <h1 class="header__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="header__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .header__title {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 600;
      letter-spacing: -0.03em;
    }

    .header__subtitle {
      margin: 0.25rem 0 0;
      color: var(--color-ink-muted);
      max-width: 42rem;
    }

    .header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
