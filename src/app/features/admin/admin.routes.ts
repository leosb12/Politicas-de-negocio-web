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
    ],
  },
];
