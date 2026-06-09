import { inject } from '@angular/core';
import {
  CanActivateChildFn,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { isAdminRole } from '../auth/utils/role.util';
import { OfflineStatusService } from '../offline/offline-status.service';

function validateAdminAccess(): true | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);
  const statusService = inject(OfflineStatusService);
  const session = authService.obtenerSesion();

  // Si hay sesión local y offline activo, permitir entrar según rol, sin redirigir ni validar contra backend
  if (session && statusService.isOffline()) {
    if (isAdminRole(session.rol)) {
      return true;
    }
    return router.createUrlTree(['/acceso-denegado']);
  }

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
