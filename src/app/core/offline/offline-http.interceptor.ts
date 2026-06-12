import { HttpInterceptorFn, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { OfflineStatusService } from './offline-status.service';
import { OfflineCacheService } from './offline-cache.service';
import { OfflineQueueService } from './offline-queue.service';
import { AuthService } from '../auth/services/auth.service';

/**
 * URLs que NUNCA se interceptan para soporte offline.
 * Estas rutas siempre requieren internet.
 */
const BYPASS_PATTERNS = [
  '/api/auth/',
  '/api/pagos/',
  '/api/ia/',
  '/api/push',
  '/api/health',
  '/api/predicciones/',
];

/**
 * Métodos de mutación que se encolan cuando no hay conexión.
 */
const MUTABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Descripción amigable para operaciones encoladas.
 */
function buildDescription(method: string, url: string): string {
  const path = url.split('/').slice(-2).join('/');
  const methodMap: Record<string, string> = {
    POST: 'Crear',
    PUT: 'Actualizar',
    PATCH: 'Modificar',
    DELETE: 'Eliminar',
  };
  return `${methodMap[method] ?? method} en /${path}`;
}

/**
 * Verifica si la URL debe ser interceptada para offline.
 */
function shouldBypass(url: string): boolean {
  return BYPASS_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * Verifica si el error es un error de red (sin conexión).
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    return error.status === 0;
  }
  return false;
}

/**
 * Interceptor funcional de Angular para soporte offline global.
 *
 * Para GET:
 *   - Online: pasa normal, guarda respuesta exitosa en cache IndexedDB.
 *   - Error de red (status 0): devuelve cache IndexedDB si existe.
 *   - Sin conexión: devuelve cache IndexedDB directamente.
 *
 * Para POST/PUT/PATCH/DELETE:
 *   - Online: pasa normal.
 *   - Sin conexión o error de red: encola operación en IndexedDB y retorna
 *     HttpResponse sintético con { queued: true }.
 *
 * No modifica endpoints, no cambia headers ya añadidos por otros interceptores.
 * Respeta orden en la cadena: este interceptor va ÚLTIMO para que los headers
 * de adminUserHeader y funcionarioUserHeader ya estén presentes.
 */
export const offlineHttpInterceptor: HttpInterceptorFn = (request, next) => {
  // Bypass si es una request de sincronización de la cola offline
  if (request.headers.has('X-Offline-Sync')) {
    const cleanRequest = request.clone({
      headers: request.headers.delete('X-Offline-Sync')
    });
    return next(cleanRequest);
  }

  const statusService = inject(OfflineStatusService);
  const cacheService = inject(OfflineCacheService);
  const queueService = inject(OfflineQueueService);
  const authService = inject(AuthService);

  const url = request.url;
  const method = request.method.toUpperCase();

  // Bypass: no interceptar rutas sensibles
  if (shouldBypass(url)) {
    return next(request);
  }

  // No interceptar si no hay sesión de usuario
  const session = authService.obtenerSesion();
  if (!session?.id) {
    return next(request);
  }

  const userId = session.id;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    // Si estamos offline, ir directo a cache
    const isOfflineMode = !statusService.isOnline() || authService.isOfflineSession();
    if (isOfflineMode) {
      return from(cacheService.getResponse(userId, 'GET', url)).pipe(
        switchMap((cached) => {
          if (cached) {
            console.log('[OfflineInterceptor] GET offline desde cache:', url);
            const syntheticResponse = new HttpResponse({
              status: 200,
              statusText: 'OK (Offline Cache)',
              body: cached.body,
              url,
            });
            return [syntheticResponse] as unknown as Observable<never>;
          }
          // Sin cache: dejar pasar (fallará, el componente manejará el error)
          return next(request);
        })
      );
    }

    // Online: ejecutar y guardar en cache
    return next(request).pipe(
      tap((event) => {
        if (event instanceof HttpResponse && event.status >= 200 && event.status < 300) {
          // Guardar respuesta en cache de forma asíncrona (no bloquear el flujo)
          cacheService
            .saveResponse(userId, 'GET', url, event.body, event.status, event.statusText)
            .catch((err) => console.warn('[OfflineInterceptor] Error al guardar cache:', err));
        }
      }),
      catchError((error) => {
        // Error de red → intentar cache
        if (isNetworkError(error)) {
          statusService.markOffline('HTTP_STATUS_0');
          return from(cacheService.getResponse(userId, 'GET', url)).pipe(
            switchMap((cached) => {
              if (cached) {
                console.log('[OfflineInterceptor] GET error de red, usando cache:', url);
                const syntheticResponse = new HttpResponse({
                  status: 200,
                  statusText: 'OK (Offline Cache)',
                  body: cached.body,
                  url,
                });
                return [syntheticResponse] as unknown as Observable<never>;
              }
              return throwError(() => error);
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // ── POST / PUT / PATCH / DELETE ──────────────────────────────────────────
  if (MUTABLE_METHODS.includes(method)) {
    // Si estamos offline, encolar la operación
    const isOfflineMode = !statusService.isOnline() || authService.isOfflineSession();
    if (isOfflineMode) {
      const headers: Record<string, string> = {};

      // Extraer headers importantes ya puestos por otros interceptores
      const headerNames = ['X-Admin-User-Id', 'X-User-Id', 'Content-Type', 'Authorization', 'X-Local-Id'];
      for (const name of headerNames) {
        const value = request.headers.get(name);
        if (value) {
          headers[name] = value;
        }
      }

      let body: unknown = null;
      try {
        body = request.body;
      } catch {
        body = null;
      }

      const adminUserId = request.headers.get('X-Admin-User-Id');

      return from(
        queueService.enqueue({
          method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          url,
          body,
          headers,
          userId,
          adminUserId,
          description: buildDescription(method, url),
        })
      ).pipe(
        switchMap((op) => {
          console.log('[OfflineInterceptor] Operación encolada:', op.id, op.description);
          const syntheticResponse = new HttpResponse({
            status: 202,
            statusText: 'Accepted (Offline Queue)',
            body: { queued: true, offlineId: op.id, message: 'Operación guardada. Se sincronizará cuando haya conexión.' },
            url,
          });
          return [syntheticResponse] as unknown as Observable<never>;
        })
      );
    }

    // Online: ejecutar normalmente, pero si hay error de red, encolar
    return next(request).pipe(
      catchError((error) => {
        if (isNetworkError(error)) {
          statusService.markOffline('HTTP_STATUS_0');
          const headers: Record<string, string> = {};
          const headerNames = ['X-Admin-User-Id', 'X-User-Id', 'Content-Type', 'Authorization', 'X-Local-Id'];
          for (const name of headerNames) {
            const value = request.headers.get(name);
            if (value) headers[name] = value;
          }

          const adminUserId = request.headers.get('X-Admin-User-Id');

          return from(
            queueService.enqueue({
              method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
              url,
              body: request.body,
              headers,
              userId,
              adminUserId,
              description: buildDescription(method, url),
            })
          ).pipe(
            switchMap((op) => {
              console.log('[OfflineInterceptor] Error de red (status 0), encolado:', op.id);
              const syntheticResponse = new HttpResponse({
                status: 202,
                statusText: 'Accepted (Offline Queue)',
                body: { queued: true, offlineId: op.id, message: 'Operación guardada. Se sincronizará cuando haya conexión.' },
                url,
              });
              return [syntheticResponse] as unknown as Observable<never>;
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // Cualquier otro método (HEAD, OPTIONS, etc.)
  return next(request);
};
