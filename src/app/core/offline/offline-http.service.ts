import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { OfflineStatusService } from './offline-status.service';
import { OfflineCacheService } from './offline-cache.service';
import { OfflineQueueService } from './offline-queue.service';
import { AuthService } from '../auth/services/auth.service';

export interface OfflineMutationResult<T = unknown> {
  queued: boolean;
  offlineId?: string;
  data?: T;
}

const SENSIBLE_URL_PATTERNS = [
  '/api/auth/',
  '/api/pagos/',
  '/api/ia/',
  '/api/push',
];

function isSensibleUrl(url: string): boolean {
  return SENSIBLE_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * Wrapper reutilizable para operaciones HTTP con soporte offline.
 * Usar en servicios que quieran integración offline nativa.
 *
 * Para la mayoría de los casos, el interceptor offline-http.interceptor.ts
 * maneja la lógica automáticamente sin modificar los servicios existentes.
 */
@Injectable({
  providedIn: 'root',
})
export class OfflineHttpService {
  private readonly http = inject(HttpClient);
  private readonly statusService = inject(OfflineStatusService);
  private readonly cacheService = inject(OfflineCacheService);
  private readonly queueService = inject(OfflineQueueService);
  private readonly authService = inject(AuthService);

  /**
   * GET con soporte offline.
   * - Online: llama al backend y guarda en cache.
   * - Offline o error de red: devuelve cache local.
   */
  get<T>(url: string, options?: { headers?: Record<string, string> }): Observable<T> {
    if (isSensibleUrl(url)) {
      return this.http.get<T>(url, { headers: options?.headers });
    }

    const userId = this.authService.obtenerSesion()?.id ?? 'anonymous';

    const isOfflineMode = !this.statusService.isOnline() || this.authService.isOfflineSession();
    if (isOfflineMode) {
      return from(this.cacheService.getResponse(userId, 'GET', url)).pipe(
        switchMap((cached) => {
          if (cached) {
            console.log('[OfflineHttp] Devolviendo cache para:', url);
            return of(cached.body as T);
          }
          return throwError(() => new Error(`Sin conexión y sin datos cacheados para: ${url}`));
        })
      );
    }

    return this.http.get<T>(url, { headers: options?.headers }).pipe(
      tap(async (data) => {
        if (!isSensibleUrl(url)) {
          await this.cacheService.saveResponse(userId, 'GET', url, data, 200, 'OK');
        }
      }),
      catchError(async (error) => {
        if (error?.status === 0) {
          const cached = await this.cacheService.getResponse(userId, 'GET', url);
          if (cached) {
            console.log('[OfflineHttp] Error de red, usando cache para:', url);
            return cached.body as T;
          }
        }
        throw error;
      })
    );
  }

  /**
   * Mutación (POST/PUT/PATCH/DELETE) con soporte offline.
   * - Online: ejecuta normalmente.
   * - Offline: encola la operación y retorna resultado local controlado.
   */
  mutate<T>(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body: unknown,
    options?: {
      headers?: Record<string, string>;
      description?: string;
    }
  ): Observable<OfflineMutationResult<T>> {
    if (isSensibleUrl(url)) {
      const httpOp = method === 'DELETE'
        ? this.http.delete<T>(url, { headers: options?.headers })
        : this.http.request<T>(method, url, { body, headers: new HttpHeaders(options?.headers ?? {}) });

      return httpOp.pipe(
        switchMap((data) => of({ queued: false, data } as OfflineMutationResult<T>))
      );
    }

    const isOfflineMode = !this.statusService.isOnline() || this.authService.isOfflineSession();
    if (isOfflineMode) {
      return from(this.enqueueOperation(method, url, body, options)).pipe(
        switchMap((op) =>
          of({
            queued: true,
            offlineId: op.id,
          } as OfflineMutationResult<T>)
        )
      );
    }

    const session = this.authService.obtenerSesion();
    const headers = new HttpHeaders(options?.headers ?? {});
    const httpOp = method === 'DELETE'
      ? this.http.delete<T>(url, { headers })
      : this.http.request<T>(method, url, { body, headers });

    return httpOp.pipe(
      switchMap((data) => of({ queued: false, data } as OfflineMutationResult<T>)),
      catchError(async (error) => {
        if (error?.status === 0) {
          this.statusService.markOffline('HTTP_STATUS_0');
          const op = await this.enqueueOperation(method, url, body, options);
          return { queued: true, offlineId: op.id } as OfflineMutationResult<T>;
        }
        throw error;
      })
    );
  }

  private async enqueueOperation(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string>; description?: string }
  ) {
    const session = this.authService.obtenerSesion();
    return this.queueService.enqueue({
      method,
      url,
      body,
      headers: options?.headers ?? {},
      userId: session?.id ?? 'anonymous',
      adminUserId: null,
      description: options?.description ?? `${method} ${url}`,
    });
  }
}
