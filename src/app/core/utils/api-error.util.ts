import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse } from '../models/api-error.model';

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté levantado.';
    }

    const errorBody = error.error as Partial<ApiErrorResponse> | string | null;
    if (
      errorBody &&
      typeof errorBody === 'object' &&
      typeof errorBody.message === 'string' &&
      errorBody.message.trim().length > 0
    ) {
      return errorBody.message;
    }

    if (typeof errorBody === 'string' && errorBody.trim().length > 0) {
      return errorBody;
    }

    if (error.status === 401) {
      return 'Tu sesion expiro. Inicia sesion nuevamente.';
    }

    if (error.status === 403) {
      return 'No tienes permisos para ejecutar esta accion.';
    }
  }

  return fallbackMessage;
}
