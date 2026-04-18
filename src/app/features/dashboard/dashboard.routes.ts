import { Routes } from '@angular/router';
import { DashboardAdmin } from './pages/dashboard-admin/dashboard-admin';
import { DashboardFuncionario } from './pages/dashboard-funcionario/dashboard-funcionario';
import { adminOnlyGuard } from '../../core/guards/admin-only.guard';
import { funcionarioOnlyGuard } from '../../core/guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard-admin',
    component: DashboardAdmin,
    canActivate: [adminOnlyGuard],
  },
  {
    path: 'dashboard-funcionario',
    component: DashboardFuncionario,
    canActivate: [funcionarioOnlyGuard],
  },
];
