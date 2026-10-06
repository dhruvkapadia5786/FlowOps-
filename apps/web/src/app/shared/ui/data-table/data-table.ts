import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, input } from '@angular/core';

export interface DataTableColumn<T = unknown> {
  key: string;
  header: string;
  mono?: boolean;
  cell?: (row: T) => string;
}

@Component({
  selector: 'fo-data-table',
  imports: [NgTemplateOutlet],
  template: `
    <div class="table-wrap fo-panel">
      <table class="table">
        <thead>
          <tr>
            @for (col of columns(); track col.key) {
              <th>{{ col.header }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr>
              <td [attr.colspan]="columns().length" class="table__state">Loading…</td>
            </tr>
          } @else if (!rows().length) {
            <tr>
              <td [attr.colspan]="columns().length" class="table__state">
                {{ emptyMessage() }}
              </td>
            </tr>
          } @else {
            @for (row of rows(); track trackBy()(row)) {
              <tr>
                @for (col of columns(); track col.key) {
                  <td [class.table__mono]="col.mono">
                    @if (cellTemplate()) {
                      <ng-container
                        *ngTemplateOutlet="
                          cellTemplate()!;
                          context: { $implicit: row, column: col }
                        "
                      />
                    } @else {
                      {{ display(row, col) }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .table-wrap {
      overflow: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    th,
    td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    th {
      color: var(--color-ink-muted);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: color-mix(in srgb, var(--color-surface-raised) 80%, transparent);
      position: sticky;
      top: 0;
    }

    tbody tr:hover td {
      background: color-mix(in srgb, var(--color-surface-hover) 55%, transparent);
    }

    .table__mono {
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }

    .table__state {
      color: var(--color-ink-muted);
      text-align: center;
      padding: 2rem 1rem;
    }
  `,
})
export class DataTable<T extends object = Record<string, unknown>> {
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly loading = input(false);
  readonly emptyMessage = input('No rows yet');
  readonly trackBy = input<(row: T) => string>((row) =>
    'id' in row && typeof (row as { id?: unknown }).id === 'string'
      ? ((row as { id: string }).id)
      : JSON.stringify(row),
  );
  readonly cellTemplate = input<TemplateRef<{ $implicit: T; column: DataTableColumn<T> }> | null>(
    null,
  );

  display(row: T, col: DataTableColumn<T>): string {
    if (col.cell) {
      return col.cell(row);
    }
    const value = (row as Record<string, unknown>)[col.key];
    if (value == null) {
      return '—';
    }
    return String(value);
  }
}
