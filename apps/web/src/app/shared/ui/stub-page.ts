import { Component, input } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-stub-page',
  imports: [PageHeader, EmptyState],
  template: `
    <fo-page-header [title]="title()" [subtitle]="subtitle()" />
    <fo-empty-state [title]="emptyTitle()" [description]="emptyDescription()" />
  `,
})
export class StubPage {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly emptyTitle = input('Coming soon');
  readonly emptyDescription = input('This screen is scaffolded for a later milestone.');
}
