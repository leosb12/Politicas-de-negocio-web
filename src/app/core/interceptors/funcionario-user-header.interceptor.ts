import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { isAdminRole, isFuncionarioRole } from '../auth/utils/role.util';

export const funcionarioUserHeaderInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const isFlujoRequest =
    request.url.includes('/api/tareas') ||
    request.url.includes('/api/instancias') ||
    request.url.includes('/api/tramites') ||
    request.url.includes('/api/politicas/movil/disponibles') ||
    request.url.includes('/api/politicas') && request.url.includes('/requisitos-iniciales') ||
    request.url.includes('/api/pagos') ||
    request.url.includes('/api/archivos') ||
    request.url.includes('/api/documentos') ||
    request.url.includes('/api/guide/employee') ||
    request.url.includes('/api/push');

  if (!isFlujoRequest) {
    return next(request);
  }

  if (
    request.headers.has('X-User-Id') ||
    request.headers.has('X-Admin-User-Id')
  ) {
    return next(request);
  }

  const authService = inject(AuthService);
  const session = authService.obtenerSesion();

  if (!session?.id) {
    return next(request);
  }

  const headerName = isAdminRole(session.rol) && !isFuncionarioRole(session.rol)
    ? 'X-Admin-User-Id'
    : 'X-User-Id';

  const requestWithActorHeader = request.clone({
    setHeaders: {
      [headerName]: session.id,
    },
  });

  return next(requestWithActorHeader);
};
