import { Injectable } from '@angular/core';

export type IDBStoreName =
  | 'httpCache'
  | 'offlineQueue'
  | 'syncConflicts'
  | 'formDrafts'
  | 'reportDrafts'
  | 'documentDrafts'
  // Nuevos stores
  | 'offlineAuthProfiles'
  | 'adminSnapshot'
  | 'funcionarioSnapshot'
  | 'politicas'
  | 'politicaDetalles'
  | 'politicaFlujos'
  | 'politicaAuditoria'
  | 'auditoriaDocumental'
  | 'auditoriaSistema'
  | 'analiticaSistema'
  | 'usuarios'
  | 'roles'
  | 'departamentos'
  | 'documentosMetadata'
  | 'reportesCacheados'
  | 'tareasPendientes'
  | 'tareasEnProceso'
  | 'tareasCompletadas'
  | 'tareaDetalles';

const DB_NAME = 'politicas-negocio-offline';
const DB_VERSION = 2;

/**
 * Servicio de abstracción sobre IndexedDB.
 * Gestiona los stores offline de la aplicación.
 */
@Injectable({
  providedIn: 'root',
  })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no está disponible'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        const err = (event.target as IDBOpenDBRequest).error;
        console.error('[IndexedDB] Error al abrir la base de datos:', err);
        reject(err);
      };
    });

    return this.dbPromise;
  }

  private createStores(db: IDBDatabase): void {
    const stores: Array<{ name: IDBStoreName; keyPath: string; indexes?: Array<{ name: string; keyPath: string; unique: boolean }> }> = [
      {
        name: 'httpCache',
        keyPath: 'cacheKey',
        indexes: [
          { name: 'userId', keyPath: 'userId', unique: false },
          { name: 'url', keyPath: 'url', unique: false },
          { name: 'timestamp', keyPath: 'timestamp', unique: false },
        ],
      },
      {
        name: 'offlineQueue',
        keyPath: 'id',
        indexes: [
          { name: 'status', keyPath: 'status', unique: false },
          { name: 'timestamp', keyPath: 'timestamp', unique: false },
          { name: 'userId', keyPath: 'userId', unique: false },
        ],
      },
      {
        name: 'syncConflicts',
        keyPath: 'id',
        indexes: [
          { name: 'resolved', keyPath: 'resolved', unique: false },
          { name: 'userId', keyPath: 'userId', unique: false },
        ],
      },
      {
        name: 'formDrafts',
        keyPath: 'id',
        indexes: [
          { name: 'userId', keyPath: 'userId', unique: false },
          { name: 'formType', keyPath: 'formType', unique: false },
        ],
      },
      {
        name: 'reportDrafts',
        keyPath: 'id',
        indexes: [
          { name: 'userId', keyPath: 'userId', unique: false },
        ],
      },
      {
        name: 'documentDrafts',
        keyPath: 'id',
        indexes: [
          { name: 'userId', keyPath: 'userId', unique: false },
          { name: 'status', keyPath: 'status', unique: false },
        ],
      },
      {
        name: 'offlineAuthProfiles',
        keyPath: 'correo',
      },
      {
        name: 'adminSnapshot',
        keyPath: 'id',
      },
      {
        name: 'funcionarioSnapshot',
        keyPath: 'id',
      },
      {
        name: 'politicas',
        keyPath: 'id',
      },
      {
        name: 'politicaDetalles',
        keyPath: 'id',
      },
      {
        name: 'politicaFlujos',
        keyPath: 'id',
      },
      {
        name: 'politicaAuditoria',
        keyPath: 'id',
      },
      {
        name: 'auditoriaDocumental',
        keyPath: 'id',
      },
      {
        name: 'auditoriaSistema',
        keyPath: 'id',
      },
      {
        name: 'analiticaSistema',
        keyPath: 'id',
      },
      {
        name: 'usuarios',
        keyPath: 'id',
      },
      {
        name: 'roles',
        keyPath: 'id',
      },
      {
        name: 'departamentos',
        keyPath: 'id',
      },
      {
        name: 'documentosMetadata',
        keyPath: 'id',
      },
      {
        name: 'reportesCacheados',
        keyPath: 'id',
      },
      {
        name: 'tareasPendientes',
        keyPath: 'id',
      },
      {
        name: 'tareasEnProceso',
        keyPath: 'id',
      },
      {
        name: 'tareasCompletadas',
        keyPath: 'id',
      },
      {
        name: 'tareaDetalles',
        keyPath: 'id',
      },
    ];

    for (const storeConfig of stores) {
      if (!db.objectStoreNames.contains(storeConfig.name)) {
        const store = db.createObjectStore(storeConfig.name, {
          keyPath: storeConfig.keyPath,
        });

        if (storeConfig.indexes) {
          for (const index of storeConfig.indexes) {
            store.createIndex(index.name, index.keyPath, {
              unique: index.unique,
            });
          }
        }
      }
    }
  }

  /** Guarda o actualiza un registro en el store indicado */
  async put<T>(storeName: IDBStoreName, record: T): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Obtiene un registro por su key */
  async get<T>(storeName: IDBStoreName, key: string): Promise<T | undefined> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Obtiene todos los registros de un store */
  async getAll<T>(storeName: IDBStoreName): Promise<T[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Obtiene todos los registros filtrados por un índice */
  async getAllByIndex<T>(
    storeName: IDBStoreName,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Elimina un registro por su key */
  async delete(storeName: IDBStoreName, key: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Limpia todos los registros de un store */
  async clear(storeName: IDBStoreName): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Limpia todos los datos de un usuario específico en todos los stores */
  async clearUserData(userId: string): Promise<void> {
    const storesToClean: IDBStoreName[] = [
      'httpCache',
      'offlineQueue',
      'syncConflicts',
      'formDrafts',
      'reportDrafts',
      'documentDrafts',
    ];

    for (const store of storesToClean) {
      try {
        const records = await this.getAllByIndex<{ id: string; userId: string }>(
          store,
          'userId',
          userId
        );
        for (const record of records) {
          await this.delete(store, record.id);
        }
      } catch (err) {
        console.warn(`[IndexedDB] No se pudo limpiar store ${store}:`, err);
      }
    }
  }

  /** Cuenta registros en un store */
  async count(storeName: IDBStoreName): Promise<number> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  /** Limpia absolutamente todo el IndexedDB */
  async clearOfflineData(): Promise<void> {
    const storesToClean: IDBStoreName[] = [
      'httpCache',
      'offlineQueue',
      'syncConflicts',
      'formDrafts',
      'reportDrafts',
      'documentDrafts',
      'offlineAuthProfiles',
      'adminSnapshot',
      'funcionarioSnapshot',
      'politicas',
      'politicaDetalles',
      'politicaFlujos',
      'politicaAuditoria',
      'auditoriaDocumental',
      'auditoriaSistema',
      'analiticaSistema',
      'usuarios',
      'roles',
      'departamentos',
      'documentosMetadata',
      'reportesCacheados',
      'tareasPendientes',
      'tareasEnProceso',
      'tareasCompletadas',
      'tareaDetalles',
    ];

    for (const store of storesToClean) {
      try {
        await this.clear(store);
      } catch (err) {
        console.warn(`[IndexedDB] No se pudo limpiar store ${store}:`, err);
      }
    }
  }
}
