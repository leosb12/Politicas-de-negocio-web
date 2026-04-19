import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse } from '../../../core/models/api-error.model';
import {
  WorkflowConflictType,
  WorkflowUiError,
} from '../models/funcionario-workflow.model';

export function mapWorkflowUiError(
  error: unknown,
  fallbackMessage: string
): WorkflowUiError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: -1,
      title: 'Error inesperado',
      message: fallbackMessage,
      rawMessage: null,
      canRetry: true,
    };
  }

  const backendMessage = getBackendErrorMessage(error);

  if (error.status === 0) {
    return {
      status: 0,
      title: 'Sin conexion',
      message:
        backendMessage ??
        'No se pudo conectar con el servidor. Verifica que el backend este activo.',
      rawMessage: backendMessage,
      canRetry: true,
    };
  }

  const mapByStatus: Record<number, { title: string; fallback: string; canRetry: boolean }> = {
    400: {
      title: 'Validacion fallida',
      fallback: 'Hay datos invalidos en la solicitud. Revisa el formulario antes de continuar.',
      canRetry: true,
    },
    401: {
      title: 'Sesion expirada',
      fallback: 'Tu sesion no es valida. Inicia sesion nuevamente.',
      canRetry: false,
    },
    403: {
      title: 'Permiso insuficiente',
      fallback: 'No tienes permisos para ejecutar esta accion.',
      canRetry: false,
    },
    404: {
      title: 'No encontrado',
      fallback: 'El recurso solicitado no existe o fue eliminado.',
      canRetry: true,
    },
    409: {
      title: 'Conflicto de negocio',
      fallback: 'El estado de la tarea cambio y no se pudo completar la operacion.',
      canRetry: true,
    },
    500: {
      title: 'Error interno',
      fallback: 'Ocurrio un error interno. Intenta nuevamente en unos minutos.',
      canRetry: true,
    },
  };

  const statusData = mapByStatus[error.status];
  if (!statusData) {
    return {
      status: error.status,
      title: 'Error HTTP',
      message: backendMessage ?? fallbackMessage,
      rawMessage: backendMessage,
      canRetry: true,
    };
  }

  return {
    status: error.status,
    title: statusData.title,
    message: backendMessage ?? statusData.fallback,
    rawMessage: backendMessage,
    canRetry: statusData.canRetry,
  };
}

export function classifyWorkflowConflict(message: string | null | undefined): WorkflowConflictType {
  const normalized = (message ?? '').toLowerCase();

  if (
    normalized.includes('doble completado') ||
    normalized.includes('ya fue completada') ||
    normalized.includes('completada por otro')
  ) {
    return 'double-completed';
  }

  if (
    normalized.includes('sin salida valida') ||
    normalized.includes('sin salida') ||
    normalized.includes('decision')
  ) {
    return 'invalid-decision';
  }

  if (normalized.includes('join') && normalized.includes('bloque')) {
    return 'join-blocked';
  }

  if (normalized.includes('version') && normalized.includes('politica')) {
    return 'policy-version';
  }

  return 'generic';
}

function getBackendErrorMessage(error: HttpErrorResponse): string | null {
  const body = error.error as Partial<ApiErrorResponse> | string | null;

  if (body && typeof body === 'object' && typeof body.message === 'string') {
    const message = body.message.trim();
    return message.length > 0 ? message : null;
  }

  if (typeof body === 'string') {
    const message = body.trim();
    return message.length > 0 ? message : null;
  }

  return null;
}
