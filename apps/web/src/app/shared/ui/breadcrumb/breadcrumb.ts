import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type BreadcrumbItem = { label: string; path?: string };

@Component({
  selector: 'fo-breadcrumb',
  imports: [RouterLink],
  template: `
    <div class="breadcrumbs text-sm py-0 mb-3">
      <ul>
        @for (item of items(); track item.label; let last = $last) {
          <li>
            @if (item.path && !last) {
              <a [routerLink]="item.path" class="link link-hover text-base-content/70">{{
                item.label
              }}</a>
            } @else {
              <span [class.text-base-content]="last" [class.font-medium]="last">{{
                item.label
              }}</span>
            }
          </li>
        }
      </ul>
    </div>
  `,
})
export class FoBreadcrumb {
  readonly items = input.required<BreadcrumbItem[]>();
}
