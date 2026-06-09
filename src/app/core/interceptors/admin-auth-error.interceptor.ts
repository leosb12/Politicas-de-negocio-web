import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { OfflineStatusService } from '../offline/offline-status.service';

export const adminAuthErrorInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const statusService = inject(OfflineStatusService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el status es 0 (servidor apagado/caído), marcar offline y propagar error sin cerrar sesión
      if (error.status === 0) {
        statusService.markOffline('HTTP_STATUS_0');
        return throwError(() => error);
      }

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

