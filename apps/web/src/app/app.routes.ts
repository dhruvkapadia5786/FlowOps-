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
          import('./features/deployments/deployments').then((m) => m.DeploymentsPage),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./features/services/services').then((m) => m.ServicesPage),
      },
      {
        path: 'environments',
        loadComponent: () =>
          import('./features/environments/environments').then((m) => m.EnvironmentsPage),
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/incidents/incidents').then((m) => m.IncidentsPage),
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./features/approvals/approvals').then((m) => m.ApprovalsPage),
      },
      {
        path: 'health',
        loadComponent: () =>
          import('./features/health/health').then((m) => m.HealthPage),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit').then((m) => m.AuditPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
