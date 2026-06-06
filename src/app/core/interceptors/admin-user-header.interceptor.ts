import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { isAdminRole } from '../auth/utils/role.util';

export const adminUserHeaderInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const needsAdminHeader = 
    request.url.includes('/api/admin') || 
    request.url.includes('/api/politicas') ||
    request.url.includes('/api/document-permissions') ||
    request.url.includes('/api/documentos') ||
    request.url.includes('/api/guide/admin') ||
    request.url.includes('/api/analytics') ||
    request.url.includes('/api/simulations');
  if (!needsAdminHeader) {
    return next(request);
  }

  if (request.headers.has('X-User-Id') || request.headers.has('X-Admin-User-Id')) {
    return next(request);
  }

  const authService = inject(AuthService);
  const session = authService.obtenerSesion();
  if (!session?.id) {
    return next(request);
  }

  if (!isAdminRole(session.rol)) {
    return next(request);
  }

  const requestWithHeader = request.clone({
    setHeaders: {
      'X-Admin-User-Id': session.id,
    },
  });

  return next(requestWithHeader);
};
