import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { isFuncionarioRole } from '../auth/utils/role.util';
import { OfflineStatusService } from '../offline/offline-status.service';

export const funcionarioFlujoGuard: CanActivateFn = () => {
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
