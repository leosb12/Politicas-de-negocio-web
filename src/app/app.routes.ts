import { Routes } from '@angular/router';
import { HOME_ROUTES } from './features/home/home.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { ACCESS_ROUTES } from './features/access/access.routes';
import { authGuard } from './core/guards/auth.guard';


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
      import('./features/administrador/administrador.routes').then((module) => module.ADMINISTRADOR_ROUTES),
  },
  {
    path: 'funcionario',
    loadChildren: () =>
      import('./features/funcionario-flujo/funcionario-flujo.routes').then(
        (module) => module.FUNCIONARIO_FLUJO_ROUTES
      ),
  },
  {
    path: 'usuario/tramites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/usuario-tramites/usuario-tramites').then(
        (module) => module.UsuarioTramitesPage
      ),
  },
  ...DASHBOARD_ROUTES,
  ...ACCESS_ROUTES,
  { path: '**', redirectTo: '' }

];
