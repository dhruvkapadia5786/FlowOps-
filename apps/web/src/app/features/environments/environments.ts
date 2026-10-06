import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-environments-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Environments"
      subtitle="Dev, QA, UAT, and Prod with approval gates."
      emptyTitle="Environments stub"
      emptyDescription="Wire /environments in a later UI milestone."
    />
  `,
})
export class EnvironmentsPage {}
