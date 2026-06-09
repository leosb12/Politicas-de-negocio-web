import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { isFuncionarioRole } from '../auth/utils/role.util';
import { OfflineStatusService } from '../offline/offline-status.service';

function validateLoggedSession(): true | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);
  const statusService = inject(OfflineStatusService);

  const session = authService.obtenerSesion();
  // Si hay sesión local y offline activo, permitir acceso sin redirigir a login ni validar contra backend
  if (session && statusService.isOffline()) {
    return true;
  }

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  return true;
}

export const authGuard: CanActivateFn = () => validateLoggedSession();

export const funcionarioOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const statusService = inject(OfflineStatusService);
  const session = authService.obtenerSesion();

  // Si hay sesión local y offline activo, permitir entrar según rol, sin redirigir ni validar contra backend
  if (session && statusService.isOffline()) {
    if (isFuncionarioRole(session.rol)) {
      return true;
    }
    return router.createUrlTree(['/acceso-denegado']);
  }

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  if (!isFuncionarioRole(session.rol)) {
    return router.createUrlTree(['/acceso-denegado']);
  }

  return true;
};
