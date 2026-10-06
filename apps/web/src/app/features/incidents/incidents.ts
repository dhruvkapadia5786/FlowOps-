import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-incidents-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Incidents"
      subtitle="Auto-correlated release incidents — full UI in M9."
      emptyTitle="Incident explorer pending"
      emptyDescription="API and WebSocket incident.created events are ready from M5/M6."
    />
  `,
})
export class IncidentsPage {}
