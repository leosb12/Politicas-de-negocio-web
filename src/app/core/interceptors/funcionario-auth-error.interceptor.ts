import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { isFuncionarioRole } from '../auth/utils/role.util';

export const funcionarioAuthErrorInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const isFlujoRequest =
    request.url.includes('/api/tareas') || request.url.includes('/api/instancias');
  const session = authService.obtenerSesion();
  const isFuncionarioSession = isFuncionarioRole(session?.rol);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!isFlujoRequest) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        authService.cerrarSesion();
        void router.navigate(['/login']);
      }

      if (error.status === 403 && !isFuncionarioSession) {
        void router.navigate(['/acceso-denegado']);
      }

      return throwError(() => error);
    })
  );
};
