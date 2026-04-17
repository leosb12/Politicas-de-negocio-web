import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { DashboardAdmin } from './pages/dashboard-admin/dashboard-admin';
import { DashboardFuncionario } from './pages/dashboard-funcionario/dashboard-funcionario';
import { AccessDeniedComponent } from './pages/access-denied/access-denied';
import { adminOnlyGuard } from './core/guards/admin-only.guard';
import { funcionarioOnlyGuard } from './core/guards/auth.guard';


export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes').then((module) => module.ADMIN_ROUTES),
  },
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
  { path: 'acceso-denegado', component: AccessDeniedComponent },
  { path: '**', redirectTo: '' }

];