import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { ShellLayout } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: ShellLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'deployments',
        loadComponent: () =>
          import('./features/deployments/list/list').then((m) => m.DeploymentsPage),
      },
      {
        path: 'deployments/new',
        loadComponent: () =>
          import('./features/deployments/create/create').then(
            (m) => m.DeploymentCreatePage,
          ),
      },
      {
        path: 'deployments/:id',
        loadComponent: () =>
          import('./features/deployments/detail/detail').then(
            (m) => m.DeploymentDetailPage,
          ),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./features/services/overview/overview').then((m) => m.ServicesPage),
      },
      {
        path: 'environments',
        loadComponent: () =>
          import('./features/environments/overview/overview').then(
            (m) => m.EnvironmentsPage,
          ),
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/incidents/list/list').then((m) => m.IncidentsPage),
      },
      {
        path: 'incidents/:id',
        loadComponent: () =>
          import('./features/incidents/detail/detail').then((m) => m.IncidentDetailPage),
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./features/approvals/inbox/inbox').then((m) => m.ApprovalsPage),
      },
      {
        path: 'health',
        loadComponent: () =>
          import('./features/health/board/board').then((m) => m.HealthPage),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/explorer/explorer').then((m) => m.AuditPage),
      },
      {
        path: 'simulation',
        loadComponent: () =>
          import('./features/simulation/panel/panel').then((m) => m.SimulationPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
