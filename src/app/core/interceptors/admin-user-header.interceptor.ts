import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

export const adminUserHeaderInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const needsAdminHeader = 
    request.url.includes('/api/admin') || 
    request.url.includes('/api/politicas');
  if (!needsAdminHeader) {
    return next(request);
  }

  const authService = inject(AuthService);
  const session = authService.obtenerSesion();
  if (!session?.id) {
    return next(request);
  }

  const requestWithHeader = request.clone({
    setHeaders: {
      'X-Admin-User-Id': session.id,
    },
  });

  return next(requestWithHeader);
};
