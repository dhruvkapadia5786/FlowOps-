import { Component, input } from '@angular/core';

@Component({
  selector: 'fo-empty-state',
  template: `
    <div class="empty fo-panel">
      <p class="empty__title">{{ title() }}</p>
      <p class="empty__body">{{ description() }}</p>
      <div class="empty__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .empty {
      padding: 2.5rem 1.5rem;
      text-align: center;
    }

    .empty__title {
      margin: 0;
      font-weight: 600;
      font-size: 1rem;
    }

    .empty__body {
      margin: 0.5rem auto 0;
      max-width: 28rem;
      color: var(--color-ink-muted);
    }

    .empty__actions {
      margin-top: 1rem;
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input('');
}
