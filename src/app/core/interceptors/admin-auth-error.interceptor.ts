import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';

export const adminAuthErrorInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAdminRequest = request.url.includes('/api/admin');

      if (isAdminRequest && error.status === 401) {
        authService.cerrarSesion();
        void router.navigate(['/login']);
      }

      if (isAdminRequest && error.status === 403) {
        void router.navigate(['/acceso-denegado']);
      }

      return throwError(() => error);
    })
  );
};
