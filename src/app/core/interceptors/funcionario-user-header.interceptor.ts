import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';

export const funcionarioUserHeaderInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const isWorkflowRequest =
    request.url.includes('/api/tareas') || request.url.includes('/api/instancias');

  if (!isWorkflowRequest) {
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

  const headerName = session.rol === 'FUNCIONARIO' ? 'X-User-Id' : 'X-Admin-User-Id';

  const requestWithActorHeader = request.clone({
    setHeaders: {
      [headerName]: session.id,
    },
  });

  return next(requestWithActorHeader);
};
