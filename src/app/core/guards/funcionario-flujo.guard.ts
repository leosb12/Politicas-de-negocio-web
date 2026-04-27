import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { isFuncionarioRole } from '../auth/utils/role.util';

export const funcionarioFlujoGuard: CanActivateFn = () => {
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
