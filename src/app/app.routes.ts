import { Routes } from '@angular/router';
import { HOME_ROUTES } from './features/home/home.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { ACCESS_ROUTES } from './features/access/access.routes';


export const routes: Routes = [
  ...HOME_ROUTES,
  ...AUTH_ROUTES,
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes').then((module) => module.ADMIN_ROUTES),
  },
  ...DASHBOARD_ROUTES,
  ...ACCESS_ROUTES,
  { path: '**', redirectTo: '' }

];