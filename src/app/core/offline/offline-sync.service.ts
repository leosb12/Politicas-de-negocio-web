import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { OfflineStatusService } from './offline-status.service';
import { OfflineQueueService, OfflineOperation } from './offline-queue.service';
import { OfflineConflictService } from './offline-conflict.service';
import { IndexedDbService } from './indexeddb.service';
import { ToastService } from '../../shared/services/toast.service';

export interface SyncResult {
  synced: string[];
  failed: string[];
  conflicts: string[];
}

@Injectable({
  providedIn: 'root',
})
export class OfflineSyncService {
  private readonly http = inject(HttpClient);
  private readonly statusService = inject(OfflineStatusService);
  private readonly queueService = inject(OfflineQueueService);
  private readonly conflictService = inject(OfflineConflictService);
  private readonly db = inject(IndexedDbService);
  private readonly toast = inject(ToastService);

  private readonly idMappingSubject = new Subject<{ localId: string; realId: string }>();
  readonly idMapping$ = this.idMappingSubject.asObservable();

  private readonly _isSyncing = signal(false);
  readonly isSyncing = this._isSyncing.asReadonly();

  private readonly _lastSyncResult = signal<SyncResult | null>(null);
  readonly lastSyncResult = this._lastSyncResult.asReadonly();

  constructor() {
    // Escuchar reconexión para disparar sincronización automática
    this.statusService.onReconnect$.subscribe(async () => {
      console.log('[OfflineSync] Reconexión detectada. Iniciando sincronización...');
      // Pequeño delay para dejar que la conexión se estabilice
      await this.delay(1500);
      await this.syncAll();
    });
  }

  /**
   * Procesa todas las operaciones PENDING en la cola FIFO.
   */
  async syncAll(): Promise<SyncResult> {
    if (this._isSyncing()) {
      console.log('[OfflineSync] Sincronización ya en progreso');
      return { synced: [], failed: [], conflicts: [] };
    }

    if (!this.statusService.isOnline()) {
      console.log('[OfflineSync] Sin conexión, sincronización pospuesta');
      return { synced: [], failed: [], conflicts: [] };
    }

    this._isSyncing.set(true);
    const result: SyncResult = { synced: [], failed: [], conflicts: [] };

    try {
      const pending = await this.queueService.getPendingOperations();

      if (pending.length === 0) {
        console.log('[OfflineSync] No hay operaciones pendientes');
        return result;
      }

      console.log(`[OfflineSync] Procesando ${pending.length} operaciones pendientes`);

      for (const op of pending) {
        await this.queueService.updateStatus(op.id, 'SYNCING');
        const success = await this.executeOperation(op, result);

        if (success) {
          result.synced.push(op.id);
          await this.queueService.remove(op.id);
        }
      }

      // Limpiar operaciones sincronizadas residuales
      await this.queueService.clearSynced();

      if (result.synced.length > 0) {
        this.toast.success('Sincronización', 'Cambios sincronizados correctamente');
      }

    } catch (err) {
      console.error('[OfflineSync] Error durante sincronización:', err);
    } finally {
      this._isSyncing.set(false);
      this._lastSyncResult.set(result);
      await this.queueService.refreshCount();
    }

    console.log(
      `[OfflineSync] Completado. Sincronizados: ${result.synced.length}, Fallidos: ${result.failed.length}, Conflictos: ${result.conflicts.length}`
    );
    return result;
  }

  /**
   * Ejecuta una operación individual contra el backend.
   * Retorna true si fue exitosa.
   */
  private async executeOperation(
    op: OfflineOperation,
    result: SyncResult
  ): Promise<boolean> {
    try {
      const headers = new HttpHeaders(op.headers).set('X-Offline-Sync', 'true');

      let response: unknown;

      switch (op.method) {
        case 'POST':
          response = await firstValueFrom(
            this.http.post(op.url, op.body, { headers })
          );
          break;
        case 'PUT':
          response = await firstValueFrom(
            this.http.put(op.url, op.body, { headers })
          );
          break;
        case 'PATCH':
          response = await firstValueFrom(
            this.http.patch(op.url, op.body, { headers })
          );
          break;
        case 'DELETE':
          response = await firstValueFrom(
            this.http.delete(op.url, { headers })
          );
          break;
        default:
          console.warn('[OfflineSync] Método no soportado:', op.method);
          result.failed.push(op.id);
          await this.queueService.updateStatus(op.id, 'FAILED_PERMANENT');
          return false;
      }

      // Si fue una creación (POST) y tiene X-Local-Id, mapear el ID temporal al ID real
      const localId = op.headers['X-Local-Id'];
      const realId = (response as any)?.id;
      if (op.method === 'POST' && localId && realId && localId !== realId) {
        console.log(`[OfflineSync] Mapeando ID temporal ${localId} a ID real ${realId}`);
        await this.queueService.updatePendingQueueWithRealId(localId, realId);
        await this.db.renameKey('politicas', localId, realId);
        await this.db.renameKey('politicaDetalles', localId, realId);
        await this.db.renameKey('politicaFlujos', localId, realId);
        await this.db.renameKey('formDrafts', `requisitos-${localId}`, `requisitos-${realId}`);
        this.idMappingSubject.next({ localId, realId });
      }

      // Verificar conflictos si hay versión en la respuesta
      if (op.body && typeof op.body === 'object' && response && typeof response === 'object') {
        const hasConflict = await this.conflictService.detectConflict(op, response as Record<string, unknown>);
        if (hasConflict) {
          result.conflicts.push(op.id);
        }
      }

      console.log(`[OfflineSync] ✓ Operación ${op.id} sincronizada: ${op.method} ${op.url}`);
      return true;

    } catch (err: unknown) {
      const httpError = err as { status?: number };
      const status = httpError?.status ?? 0;

      if (status === 0 || status === 503 || status === 504) {
        // Error de red → mantener en cola para reintentar
        console.warn(`[OfflineSync] Error de red en operación ${op.id}, se reintentará:`, err);
        await this.queueService.updateStatus(op.id, 'PENDING', true);
        result.failed.push(op.id);
        return false;
      }

      if (status >= 400 && status < 500) {
        // Error del cliente → no tiene sentido reintentar
        console.error(`[OfflineSync] Error permanente en operación ${op.id} (HTTP ${status}):`, err);
        await this.queueService.updateStatus(op.id, 'FAILED_PERMANENT');
        result.failed.push(op.id);
        return false;
      }

      // Error de servidor → reintentar
      console.warn(`[OfflineSync] Error de servidor en operación ${op.id} (HTTP ${status}), se reintentará:`, err);
      await this.queueService.updateStatus(op.id, 'PENDING', true);
      result.failed.push(op.id);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
