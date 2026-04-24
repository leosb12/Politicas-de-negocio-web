import { Routes } from '@angular/router';
import { HOME_ROUTES } from './features/home/home.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { ACCESS_ROUTES } from './features/access/access.routes';


export const routes: Routes = [
  ...HOME_ROUTES,
  ...AUTH_ROUTES,
  {
    path: 'analisis-ia',
    redirectTo: 'admin/analisis-ia',
    pathMatch: 'full',
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes').then((module) => module.ADMIN_ROUTES),
  },
  {
    path: 'funcionario',
    loadChildren: () =>
      import('./features/funcionario-workflow/funcionario-workflow.routes').then(
        (module) => module.FUNCIONARIO_WORKFLOW_ROUTES
      ),
  },
  ...DASHBOARD_ROUTES,
  ...ACCESS_ROUTES,
  { path: '**', redirectTo: '' }

];
