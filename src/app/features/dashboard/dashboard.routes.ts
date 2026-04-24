import { Routes } from '@angular/router';
import { DashboardAdmin } from './pages/dashboard-admin/dashboard-admin';
import { DashboardFuncionario } from './pages/dashboard-funcionario/dashboard-funcionario';
import { DashboardAnalyticsMenuPageComponent } from './pages/dashboard-analytics-menu/dashboard-analytics-menu';
import { DashboardPoliticasMenuPageComponent } from './pages/dashboard-politicas-menu/dashboard-politicas-menu';
import { DashboardPoliticasIaMenuPageComponent } from './pages/dashboard-politicas-ia-menu/dashboard-politicas-ia-menu';
import { adminOnlyGuard } from '../../core/guards/admin-only.guard';
import { funcionarioOnlyGuard } from '../../core/guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard-admin',
    component: DashboardAdmin,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-admin/administracion',
    canActivate: [adminOnlyGuard],
    loadComponent: () =>
      import('./pages/dashboard-admin-menu/dashboard-admin-menu').then(
        (module) => module.DashboardAdminMenuPageComponent
      ),
  },
  {
    path: 'dashboard-admin/politicas-negocio',
    component: DashboardPoliticasMenuPageComponent,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-admin/analitica',
    component: DashboardAnalyticsMenuPageComponent,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-admin/politicas-negocio/simulaciones-ia',
    component: DashboardPoliticasIaMenuPageComponent,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-funcionario',
    component: DashboardFuncionario,
    canActivate: [funcionarioOnlyGuard],
  },
];
