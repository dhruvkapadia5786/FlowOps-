import { Component } from '@angular/core';
import { StubPage } from '../../shared/ui/stub-page';

@Component({
  selector: 'app-approvals-page',
  imports: [StubPage],
  template: `
    <app-stub-page
      title="Approvals"
      subtitle="Production release inbox for release managers."
      emptyTitle="Approval inbox pending"
      emptyDescription="M9 connects approve/reject actions to the existing API."
    />
  `,
})
export class ApprovalsPage {}
