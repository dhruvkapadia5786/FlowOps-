import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

export interface ConfirmDialogData {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'fo-confirm-dialog',
  template: `
    <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="data.title">
      <h2 class="dialog__title">{{ data.title }}</h2>
      <p class="dialog__body">{{ data.body }}</p>
      <div class="dialog__actions">
        <button type="button" class="fo-btn fo-btn-ghost" (click)="ref.close(false)">
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        <button type="button" class="fo-btn fo-btn-primary" (click)="ref.close(true)">
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      width: min(100vw - 2rem, 26rem);
      padding: 1.25rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
    }

    .dialog__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .dialog__body {
      margin: 0.5rem 0 1.25rem;
      color: var(--color-ink-muted);
      font-size: 0.875rem;
    }

    .dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class ConfirmDialog {
  readonly ref = inject(DialogRef<boolean>);
  readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
}
