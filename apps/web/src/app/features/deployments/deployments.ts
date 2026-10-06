import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-deployments-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Deployments"
      subtitle="List, detail timeline, and create wizard land in M8."
      emptyTitle="Deployment UI not connected"
      emptyDescription="Routing stub ready. API endpoints already exist under /deployments."
    />
  `,
})
export class DeploymentsPage {}
