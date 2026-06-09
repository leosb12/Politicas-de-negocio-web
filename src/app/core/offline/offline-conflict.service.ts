import { Injectable, inject, signal } from '@angular/core';
import { IndexedDbService } from './indexeddb.service';
import { OfflineOperation } from './offline-queue.service';

export interface SyncConflict {
  id: string;
  operationId: string;
  userId: string;
  url: string;
  method: string;
  /** Datos que el usuario intentó guardar */
  localData: unknown;
  /** Datos actuales en el servidor (más nuevos) */
  serverData: unknown;
  /** Versión local (si existe) */
  localVersion: string | number | null;
  /** Versión del servidor */
  serverVersion: string | number | null;
  /** Fecha del conflicto */
  detectedAt: string;
  resolved: boolean;
  resolution: 'USE_SERVER' | 'USE_LOCAL' | 'MANUAL' | null;
}

/** Campos que pueden indicar versión o fecha de actualización */
const VERSION_FIELDS = [
  'version',
  'fechaActualizacion',
  'updatedAt',
  'lastModified',
  'lastUpdated',
  'modifiedAt',
] as const;

@Injectable({
  providedIn: 'root',
})
export class OfflineConflictService {
  private readonly db = inject(IndexedDbService);

  private readonly _conflicts = signal<SyncConflict[]>([]);
  readonly conflicts = this._conflicts.asReadonly();

  constructor() {
    this.loadConflicts();
  }

  /**
   * Detecta si hay conflicto entre la operación offline y la respuesta del servidor.
   * Retorna true si se detectó conflicto.
   */
  async detectConflict(
    op: OfflineOperation,
    serverResponse: Record<string, unknown>
  ): Promise<boolean> {
    const localBody = op.body as Record<string, unknown> | null;
    if (!localBody) return false;

    const localVersion = this.extractVersion(localBody);
    const serverVersion = this.extractVersion(serverResponse);

    // Si ambos tienen versión y la del servidor es diferente (más nueva), hay conflicto
    if (localVersion !== null && serverVersion !== null && localVersion !== serverVersion) {
      const conflict = await this.saveConflict(op, serverResponse, localVersion, serverVersion);
      console.warn('[OfflineConflict] Conflicto detectado:', conflict.id);
      return true;
    }

    return false;
  }

  /**
   * Guarda un conflicto en IndexedDB y actualiza el signal.
   */
  async saveConflict(
    op: OfflineOperation,
    serverData: unknown,
    localVersion: string | number | null,
    serverVersion: string | number | null
  ): Promise<SyncConflict> {
    const conflict: SyncConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      operationId: op.id,
      userId: op.userId,
      url: op.url,
      method: op.method,
      localData: op.body,
      serverData,
      localVersion,
      serverVersion,
      detectedAt: new Date().toISOString(),
      resolved: false,
      resolution: null,
    };

    await this.db.put<SyncConflict>('syncConflicts', conflict);
    await this.loadConflicts();
    return conflict;
  }

  /**
   * Marca un conflicto como resuelto.
   */
  async resolveConflict(
    conflictId: string,
    resolution: SyncConflict['resolution']
  ): Promise<void> {
    const conflict = await this.db.get<SyncConflict>('syncConflicts', conflictId);
    if (!conflict) return;

    const resolved: SyncConflict = {
      ...conflict,
      resolved: true,
      resolution,
    };

    await this.db.put<SyncConflict>('syncConflicts', resolved);
    await this.loadConflicts();
  }

  /**
   * Obtiene conflictos sin resolver.
   */
  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const all = await this.db.getAll<SyncConflict>('syncConflicts');
    return all.filter((c) => !c.resolved);
  }

  /**
   * Carga conflictos en el signal reactivo.
   */
  async loadConflicts(): Promise<void> {
    const unresolved = await this.getUnresolvedConflicts();
    this._conflicts.set(unresolved);
  }

  private extractVersion(obj: Record<string, unknown>): string | number | null {
    for (const field of VERSION_FIELDS) {
      if (field in obj && obj[field] !== null && obj[field] !== undefined) {
        return obj[field] as string | number;
      }
    }
    return null;
  }
}
