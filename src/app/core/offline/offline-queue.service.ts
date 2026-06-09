import { Injectable, inject, signal, computed } from '@angular/core';
import { IndexedDbService } from './indexeddb.service';

export type OfflineOperationStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED'
  | 'FAILED_PERMANENT';

export interface OfflineOperation {
  /** UUID único de la operación */
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  /** Headers importantes para reenviar (X-User-Id, X-Admin-User-Id, Content-Type) */
  headers: Record<string, string>;
  /** ID del usuario que generó la operación */
  userId: string;
  /** ID de admin si aplica */
  adminUserId: string | null;
  /** Timestamp epoch ms */
  timestamp: number;
  /** Fecha legible */
  createdAt: string;
  status: OfflineOperationStatus;
  retries: number;
  /** Descripción amigable de la operación para mostrar en UI */
  description: string;
  /** Hash para detectar duplicados */
  deduplicationKey: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineQueueService {
  private readonly db = inject(IndexedDbService);

  private readonly _pendingCount = signal<number>(0);
  readonly pendingCount = this._pendingCount.asReadonly();
  readonly hasPending = computed(() => this._pendingCount() > 0);

  constructor() {
    this.refreshCount();
  }

  /**
   * Encola una nueva operación pendiente.
   * Evita duplicados usando deduplicationKey.
   */
  async enqueue(
    op: Omit<OfflineOperation, 'id' | 'timestamp' | 'createdAt' | 'status' | 'retries' | 'deduplicationKey'>
  ): Promise<OfflineOperation> {
    const dedupKey = this.buildDeduplicationKey(op.method, op.url, op.body);

    // Verificar duplicado
    const all = await this.getPendingOperations();
    const duplicate = all.find(
      (o) =>
        o.deduplicationKey === dedupKey &&
        (o.status === 'PENDING' || o.status === 'SYNCING')
    );

    if (duplicate) {
      console.log('[OfflineQueue] Operación duplicada detectada, reutilizando:', dedupKey);
      return duplicate;
    }

    const now = Date.now();
    const operation: OfflineOperation = {
      ...op,
      id: this.generateId(),
      timestamp: now,
      createdAt: new Date(now).toISOString(),
      status: 'PENDING',
      retries: 0,
      deduplicationKey: dedupKey,
    };

    await this.db.put<OfflineOperation>('offlineQueue', operation);
    await this.refreshCount();
    console.log('[OfflineQueue] Operación encolada:', operation.id, op.description);
    return operation;
  }

  /**
   * Obtiene todas las operaciones PENDING en orden FIFO (por timestamp).
   */
  async getPendingOperations(): Promise<OfflineOperation[]> {
    const all = await this.db.getAll<OfflineOperation>('offlineQueue');
    return all
      .filter((op) => op.status === 'PENDING')
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Obtiene todas las operaciones sin filtro de estado.
   */
  async getAllOperations(): Promise<OfflineOperation[]> {
    const all = await this.db.getAll<OfflineOperation>('offlineQueue');
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Actualiza el estado de una operación.
   */
  async updateStatus(
    id: string,
    status: OfflineOperationStatus,
    incrementRetries = false
  ): Promise<void> {
    const op = await this.db.get<OfflineOperation>('offlineQueue', id);
    if (!op) return;

    const updated: OfflineOperation = {
      ...op,
      status,
      retries: incrementRetries ? op.retries + 1 : op.retries,
    };

    await this.db.put<OfflineOperation>('offlineQueue', updated);
    await this.refreshCount();
  }

  /**
   * Elimina una operación de la cola (tras sincronización exitosa).
   */
  async remove(id: string): Promise<void> {
    await this.db.delete('offlineQueue', id);
    await this.refreshCount();
  }

  /**
   * Elimina todas las operaciones sincronizadas.
   */
  async clearSynced(): Promise<void> {
    const all = await this.db.getAll<OfflineOperation>('offlineQueue');
    const synced = all.filter((op) => op.status === 'SYNCED');
    for (const op of synced) {
      await this.db.delete('offlineQueue', op.id);
    }
    await this.refreshCount();
  }

  /**
   * Refresca el contador de operaciones pendientes.
   */
  async refreshCount(): Promise<void> {
    const all = await this.db.getAll<OfflineOperation>('offlineQueue');
    const pending = all.filter(
      (op) => op.status === 'PENDING' || op.status === 'FAILED'
    ).length;
    this._pendingCount.set(pending);
  }

  private buildDeduplicationKey(
    method: string,
    url: string,
    body: unknown
  ): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    // Hash simple para deduplicar
    let hash = 0;
    const str = `${method}|${url}|${bodyStr}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `${method}|${url}|${hash}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
