import { Routes } from '@angular/router';
import {
  adminOnlyChildGuard,
  adminOnlyGuard,
} from '../../core/guards/admin-only.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminOnlyGuard],
    canActivateChild: [adminOnlyChildGuard],
    loadComponent: () =>
      import('./pages/admin-layout/admin-layout').then(
        (module) => module.AdminLayoutComponent
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'usuarios',
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/admin-users/admin-users').then(
            (module) => module.AdminUsersPageComponent
          ),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./pages/admin-roles/admin-roles').then(
            (module) => module.AdminRolesPageComponent
          ),
      },
      {
        path: 'departamentos',
        loadComponent: () =>
          import('./pages/admin-departments/admin-departments').then(
            (module) => module.AdminDepartmentsPageComponent
          ),
      },
      {
        path: 'politicas',
        loadComponent: () =>
          import('./pages/admin-politicas/admin-politicas').then(
            (module) => module.AdminPoliticasPageComponent
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/admin-analytics/admin-analytics').then(
            (module) => module.AdminAnalyticsPageComponent
          ),
      },
      {
        path: 'analisis-ia',
        loadComponent: () =>
          import('./pages/admin-analisis-ia/admin-analisis-ia').then(
            (module) => module.AdminAnalisisIaPageComponent
          ),
      },
      {
        path: 'servicios-ia',
        loadComponent: () =>
          import('./pages/admin-servicios-ia/admin-servicios-ia').then(
            (module) => module.AdminServiciosIaPageComponent
          ),
      },
      {
        path: 'simulations',
        loadComponent: () =>
          import('../simulations/pages/simulations-list/simulations-list').then(
            (module) => module.SimulationsListPageComponent
          ),
      },
      {
        path: 'simulations/:simulationId',
        loadComponent: () =>
          import('../simulations/pages/simulation-detail/simulation-detail').then(
            (module) => module.SimulationDetailPageComponent
          ),
      },
      {
        path: 'policies/compare',
        loadComponent: () =>
          import('../simulations/pages/policy-comparison/policy-comparison').then(
            (module) => module.PolicyComparisonPageComponent
          ),
      },
      {
        path: 'policies/simulate',
        loadComponent: () =>
          import('../simulations/pages/policy-simulation-form/policy-simulation-form').then(
            (module) => module.PolicySimulationFormPageComponent
          ),
      },
      {
        path: 'policies/:policyId/simulate',
        loadComponent: () =>
          import('../simulations/pages/policy-simulation-form/policy-simulation-form').then(
            (module) => module.PolicySimulationFormPageComponent
          ),
      },
    ],
  },
  // Canvas designer — full-screen, outside the admin layout shell
  {
    path: 'politicas/:id/canvas',
    canActivate: [adminOnlyGuard],
    loadComponent: () =>
      import('./pages/canvas-designer/canvas-designer').then(
        (module) => module.CanvasDesignerComponent
      ),
  },
];

