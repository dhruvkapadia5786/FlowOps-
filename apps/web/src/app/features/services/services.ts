import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-services-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Services"
      subtitle="Catalog of services in the selected organization."
      emptyTitle="Services list pending"
      emptyDescription="M8 will load /services into a filterable table."
    />
  `,
})
export class ServicesPage {}
