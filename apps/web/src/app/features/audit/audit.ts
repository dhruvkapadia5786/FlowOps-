import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-audit-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Audit log"
      subtitle="Immutable actions across auth, deploys, approvals, and rollbacks."
      emptyTitle="Audit explorer pending"
      emptyDescription="Read-only audit UI ships in M9."
    />
  `,
})
export class AuditPage {}
