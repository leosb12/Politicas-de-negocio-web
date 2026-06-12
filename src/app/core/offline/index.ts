/**
 * Módulo offline — barrel exports
 * 
 * Importar servicios individualmente para tree-shaking óptimo.
 * Este archivo facilita las importaciones desde otros módulos.
 */
export { OfflineStatusService } from './offline-status.service';
export { IndexedDbService } from './indexeddb.service';
export { OfflineCacheService } from './offline-cache.service';
export { OfflineQueueService } from './offline-queue.service';
export { OfflineSyncService } from './offline-sync.service';
export { OfflineConflictService } from './offline-conflict.service';
export { OfflineHttpService } from './offline-http.service';
export { offlineHttpInterceptor } from './offline-http.interceptor';
export { OfflineInitialSyncService } from './offline-initial-sync.service';
export { OfflineBasicPredictionService } from './offline-basic-prediction.service';
export { BrowserSimpleOfflineReportService } from './browser-simple-offline-report.service';


export type { CachedHttpResponse } from './offline-cache.service';
export type { OfflineOperation, OfflineOperationStatus } from './offline-queue.service';
export type { SyncResult } from './offline-sync.service';
export type { SyncConflict } from './offline-conflict.service';
export type { OfflineMutationResult } from './offline-http.service';
export type { SyncState } from './offline-initial-sync.service';
export type { RichPredictionResponse } from './offline-basic-prediction.service';
