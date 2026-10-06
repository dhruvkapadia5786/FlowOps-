import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'fo-skeleton',
  template: `
    <div class="flex flex-col gap-3" [attr.aria-busy]="true" aria-label="Loading">
      @for (row of rowList(); track $index) {
        <div
          class="skeleton h-4 w-full rounded-md"
          [style.width.%]="widths()[$index % widths().length]"
        ></div>
      }
      @if (cards()) {
        <div class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <div class="skeleton h-24 w-full rounded-box"></div>
          }
        </div>
      }
    </div>
  `,
})
export class FoSkeleton {
  readonly rows = input(4);
  readonly cards = input(false);
  readonly widths = input<number[]>([100, 92, 88, 96, 70]);
  readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
