import { inject } from '@angular/core';
import {
  CanActivateChildFn,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { isAdminRole } from '../auth/utils/role.util';

function validateAdminAccess(): true | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);
  const session = authService.obtenerSesion();

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  if (!isAdminRole(session.rol)) {
    return router.createUrlTree(['/acceso-denegado']);
  }

  return true;
}

export const adminOnlyGuard: CanActivateFn = () => validateAdminAccess();

export const adminOnlyChildGuard: CanActivateChildFn = () => validateAdminAccess();
