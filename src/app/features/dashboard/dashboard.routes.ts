import { Routes } from '@angular/router';
import { DashboardAdministrador } from './pages/dashboard-administrador/dashboard-administrador';
import { DashboardFuncionario } from './pages/dashboard-funcionario/dashboard-funcionario';
import { DashboardAnaliticasMenuPageComponent } from './pages/dashboard-analiticas-menu/dashboard-analiticas-menu';
import { DashboardPoliticasMenuPageComponent } from './pages/dashboard-politicas-menu/dashboard-politicas-menu';
import { DashboardPoliticasIaMenuPageComponent } from './pages/dashboard-politicas-ia-menu/dashboard-politicas-ia-menu';
import { adminOnlyGuard } from '../../core/guards/admin-only.guard';
import { funcionarioOnlyGuard } from '../../core/guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard-admin',
    component: DashboardAdministrador,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-admin/administracion',
    canActivate: [adminOnlyGuard],
    loadComponent: () =>
      import('./pages/dashboard-administrador-menu/dashboard-administrador-menu').then(
        (module) => module.DashboardAdministradorMenuPageComponent
      ),
  },
  {
    path: 'dashboard-admin/politicas-negocio',
    component: DashboardPoliticasMenuPageComponent,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-admin/analitica',
    component: DashboardAnaliticasMenuPageComponent,
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
