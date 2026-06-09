import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from './indexeddb.service';

export interface CachedHttpResponse {
  /** Key única: userId|method|url */
  cacheKey: string;
  userId: string;
  method: string;
  url: string;
  body: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** Timestamp epoch ms */
  timestamp: number;
  /** Fecha legible de cuando se guardó */
  cachedAt: string;
  /** true si el dato viene del servidor, false si es de cache */
  fromServer: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineCacheService {
  private readonly db = inject(IndexedDbService);

  /**
   * Construye la clave de cache única por usuario + método + url.
   * Normaliza la URL eliminando parámetros de query variables si se desea.
   */
  buildCacheKey(userId: string, method: string, url: string): string {
    // Normalizamos la URL: quitamos query params porque pueden variar
    // pero para endpoints con filtros importantes los mantenemos
    const normalizedUrl = url.split('?')[0];
    return `${userId}|${method.toUpperCase()}|${normalizedUrl}`;
  }

  /**
   * Guarda una respuesta GET exitosa en cache.
   */
  async saveResponse(
    userId: string,
    method: string,
    url: string,
    body: unknown,
    status: number,
    statusText: string,
    responseHeaders: Record<string, string> = {}
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(userId, method, url);
    const now = Date.now();

    const entry: CachedHttpResponse = {
      cacheKey,
      userId,
      method: method.toUpperCase(),
      url,
      body,
      status,
      statusText,
      headers: responseHeaders,
      timestamp: now,
      cachedAt: new Date(now).toISOString(),
      fromServer: true,
    };

    await this.db.put<CachedHttpResponse>('httpCache', entry);
  }

  /**
   * Recupera la última respuesta cacheada para la URL dada.
   * Returns undefined si no hay cache.
   */
  async getResponse(
    userId: string,
    method: string,
    url: string
  ): Promise<CachedHttpResponse | undefined> {
    const cacheKey = this.buildCacheKey(userId, method, url);
    return this.db.get<CachedHttpResponse>('httpCache', cacheKey);
  }

  /**
   * Verifica si existe cache para una URL.
   */
  async hasCachedResponse(
    userId: string,
    method: string,
    url: string
  ): Promise<boolean> {
    const cached = await this.getResponse(userId, method, url);
    return cached !== undefined;
  }

  /**
   * Elimina la cache de una URL específica.
   */
  async invalidate(
    userId: string,
    method: string,
    url: string
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(userId, method, url);
    await this.db.delete('httpCache', cacheKey);
  }

  /**
   * Obtiene todas las entradas de cache de un usuario.
   */
  async getAllForUser(userId: string): Promise<CachedHttpResponse[]> {
    return this.db.getAllByIndex<CachedHttpResponse>('httpCache', 'userId', userId);
  }
}
