import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

export const funcionarioWorkflowGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const session = authService.obtenerSesion();

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  if (session.rol !== 'FUNCIONARIO' && session.rol !== 'ADMIN') {
    return router.createUrlTree(['/acceso-denegado']);
  }

  return true;
};
