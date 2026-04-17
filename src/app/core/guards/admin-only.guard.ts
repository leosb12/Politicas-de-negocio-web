import { inject } from '@angular/core';
import {
  CanActivateChildFn,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../../services/auth.service';

function validateAdminAccess(): true | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);
  const session = authService.obtenerSesion();

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  if (session.rol !== 'ADMIN') {
    return router.createUrlTree(['/acceso-denegado']);
  }

  return true;
}

export const adminOnlyGuard: CanActivateFn = () => validateAdminAccess();

export const adminOnlyChildGuard: CanActivateChildFn = () => validateAdminAccess();
