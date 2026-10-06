import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-health-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Health"
      subtitle="Simulated probe snapshots per service and environment."
      emptyTitle="Health board pending"
      emptyDescription="M8/M9 will surface /service-health with live health.updated events."
    />
  `,
})
export class HealthPage {}
