import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataTable, DataTableColumn } from '../../shared/ui/data-table/data-table';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { StatusBadge, toneForStatus } from '../../shared/ui/status-badge/status-badge';

interface SampleDeploy {
  id: string;
  service: string;
  environment: string;
  status: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [PageHeader, EmptyState, DataTable, StatusBadge, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardPage {
  readonly toneForStatus = toneForStatus;

  readonly sampleColumns: DataTableColumn<SampleDeploy>[] = [
    { key: 'service', header: 'Service' },
    { key: 'environment', header: 'Environment' },
    { key: 'status', header: 'Status' },
    { key: 'id', header: 'Id', mono: true },
  ];

  /** Placeholder rows for design-system preview; live data lands in M8. */
  readonly sampleRows: SampleDeploy[] = [
    {
      id: 'dep_preview_01',
      service: 'payments-api',
      environment: 'prod',
      status: 'waiting_for_approval',
    },
    {
      id: 'dep_preview_02',
      service: 'checkout-web',
      environment: 'qa',
      status: 'success',
    },
    {
      id: 'dep_preview_03',
      service: 'inventory-worker',
      environment: 'uat',
      status: 'health_check',
    },
  ];
}
