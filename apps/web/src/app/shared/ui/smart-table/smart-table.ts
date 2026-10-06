import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  TemplateRef,
  computed,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SmartTableColumn<T = unknown> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  mono?: boolean;
  width?: string;
  /** Plain-text value used for sort/filter when not using cell template alone. */
  value?: (row: T) => string | number | null | undefined;
}

type SortDir = 'asc' | 'desc';

@Component({
  selector: 'fo-smart-table',
  imports: [NgTemplateOutlet, FormsModule],
  template: `
    <div class="smart fo-animate-in">
      <div class="smart__toolbar">
        <label class="input input-bordered input-sm flex items-center gap-2 smart__search">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-60">
            <path
              fill-rule="evenodd"
              d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
              clip-rule="evenodd"
            />
          </svg>
          <input
            type="search"
            class="grow"
            [placeholder]="filterPlaceholder()"
            [(ngModel)]="filterText"
            (ngModelChange)="onFilterChange($event)"
            aria-label="Filter table"
          />
        </label>
        <span class="smart__meta">{{ filtered().length }} / {{ rows().length }}</span>
        <div class="smart__actions">
          <ng-content select="[toolbar]" />
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
        <table class="table table-sm table-zebra">
          <thead>
            <tr>
              @for (col of columns(); track col.key) {
                <th [style.width]="col.width || null">
                  @if (col.sortable !== false) {
                    <button
                      type="button"
                      class="smart__sort"
                      (click)="toggleSort(col.key)"
                      [attr.aria-sort]="ariaSort(col.key)"
                    >
                      {{ col.header }}
                      <span class="smart__sort-icon" aria-hidden="true">{{ sortGlyph(col.key) }}</span>
                    </button>
                  } @else {
                    {{ col.header }}
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr>
                <td [attr.colspan]="columns().length" class="text-center text-base-content/60 py-10">
                  <span class="loading loading-spinner loading-sm mr-2"></span>
                  Loading…
                </td>
              </tr>
            } @else if (!filtered().length) {
              <tr>
                <td [attr.colspan]="columns().length" class="text-center text-base-content/60 py-10">
                  {{ emptyMessage() }}
                </td>
              </tr>
            } @else {
              @for (row of filtered(); track trackBy()(row); let i = $index) {
                <tr class="smart__row" [style.animation-delay.ms]="Math.min(i, 12) * 28">
                  @for (col of columns(); track col.key) {
                    <td [class.font-mono]="col.mono" [class.text-xs]="col.mono">
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
    </div>
  `,
  styles: `
    .smart {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .smart__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.65rem;
    }

    .smart__search {
      flex: 1 1 14rem;
      max-width: 22rem;
      background: var(--color-surface);
      border-color: var(--color-border);
    }

    .smart__meta {
      font-size: 0.75rem;
      color: var(--color-ink-muted);
      font-variant-numeric: tabular-nums;
    }

    .smart__actions {
      margin-left: auto;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .smart__sort {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.6875rem;
      cursor: pointer;
      padding: 0;
    }

    .smart__sort:hover {
      color: var(--color-accent);
    }

    .smart__sort-icon {
      font-size: 0.65rem;
      opacity: 0.7;
      font-family: var(--font-mono);
    }

    .smart__row {
      animation: fo-row-in 360ms ease both;
    }

    :host ::ng-deep .table th {
      background: color-mix(in srgb, var(--color-surface-raised) 88%, transparent);
      color: var(--color-ink-muted);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    :host ::ng-deep .table-zebra tbody tr:nth-child(even) {
      background: color-mix(in srgb, var(--color-surface-raised) 45%, transparent);
    }

    :host ::ng-deep .table tbody tr:hover {
      background: color-mix(in srgb, var(--color-surface-hover) 70%, transparent) !important;
    }

    @keyframes fo-row-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class FoSmartTable<T extends object = Record<string, unknown>> {
  readonly Math = Math;

  readonly columns = input.required<SmartTableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly loading = input(false);
  readonly emptyMessage = input('No matching rows');
  readonly filterPlaceholder = input('Filter rows…');
  readonly trackBy = input<(row: T) => string>((row) =>
    'id' in row && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : JSON.stringify(row),
  );
  readonly cellTemplate =
    input<TemplateRef<{ $implicit: T; column: SmartTableColumn<T> }> | null>(null);

  filterText = '';
  private readonly filterSignal = signal('');
  private readonly sortKey = signal<string | null>(null);
  private readonly sortDir = signal<SortDir>('asc');

  readonly filtered = computed(() => {
    const q = this.filterSignal().trim().toLowerCase();
    const cols = this.columns();
    let list = [...this.rows()];

    if (q) {
      list = list.filter((row) =>
        cols.some((col) => {
          if (col.filterable === false) {
            return false;
          }
          return this.display(row, col).toLowerCase().includes(q);
        }),
      );
    }

    const key = this.sortKey();
    if (key) {
      const col = cols.find((c) => c.key === key);
      const dir = this.sortDir() === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        const av = this.raw(a, col ?? { key, header: key });
        const bv = this.raw(b, col ?? { key, header: key });
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * dir;
      });
    }

    return list;
  });

  onFilterChange(value: string) {
    this.filterSignal.set(value);
  }

  toggleSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortGlyph(key: string): string {
    if (this.sortKey() !== key) {
      return '↕';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) {
      return 'none';
    }
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  display(row: T, col: SmartTableColumn<T>): string {
    const raw = this.raw(row, col);
    if (raw == null || raw === '') {
      return '—';
    }
    return String(raw);
  }

  private raw(row: T, col: SmartTableColumn<T>): string | number | null | undefined {
    if (col.value) {
      return col.value(row);
    }
    return (row as Record<string, unknown>)[col.key] as string | number | null | undefined;
  }
}
