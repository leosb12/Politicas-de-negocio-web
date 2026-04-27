import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { isFuncionarioRole } from '../auth/utils/role.util';

function validateLoggedSession(): true | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.obtenerSesion()) {
    return router.createUrlTree(['/login']);
  }

  return true;
}

export const authGuard: CanActivateFn = () => validateLoggedSession();

export const funcionarioOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const session = authService.obtenerSesion();

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  if (!isFuncionarioRole(session.rol)) {
    return router.createUrlTree(['/acceso-denegado']);
  }

  return true;
};
