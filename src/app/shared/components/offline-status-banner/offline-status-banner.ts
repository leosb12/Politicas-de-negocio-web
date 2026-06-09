import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { OfflineSyncService } from '../../../core/offline/offline-sync.service';
import { OfflineConflictService } from '../../../core/offline/offline-conflict.service';
import { OfflineInitialSyncService } from '../../../core/offline/offline-initial-sync.service';
import { AuthService } from '../../../core/auth/services/auth.service';

type BannerState =
  | 'hidden'
  | 'offline'
  | 'offline-pending'
  | 'syncing'
  | 'synced'
  | 'conflict';

@Component({
  selector: 'app-offline-status-banner',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './offline-status-banner.html',
  styleUrl: './offline-status-banner.css',
})
export class OfflineStatusBannerComponent implements OnInit, OnDestroy {
  private readonly statusService = inject(OfflineStatusService);
  private readonly queueService = inject(OfflineQueueService);
  private readonly syncService = inject(OfflineSyncService);
  private readonly conflictService = inject(OfflineConflictService);
  private readonly syncServiceInitial = inject(OfflineInitialSyncService);
  private readonly authService = inject(AuthService);

  readonly isOffline = computed(() => this.statusService.isOffline() || this.authService.isOfflineSession());
  readonly isSyncing = this.syncService.isSyncing;
  readonly pendingCount = this.queueService.pendingCount;
  readonly conflicts = this.conflictService.conflicts;

  private _synced = signal(false);
  private _syncedTimer: ReturnType<typeof setTimeout> | null = null;
  readonly probandoConexion = signal(false);

  readonly bannerState = computed((): BannerState => {
    if (this.conflicts().length > 0) return 'conflict';
    if (this.isSyncing()) return 'syncing';
    if (this._synced()) return 'synced';
    if (this.isOffline() && this.pendingCount() > 0) return 'offline-pending';
    if (this.isOffline()) return 'offline';
    return 'hidden';
  });

  readonly isVisible = computed(() => this.bannerState() !== 'hidden');

  readonly bannerConfig = computed(() => {
    const state = this.bannerState();
    switch (state) {
      case 'offline':
        const lastSync = this.syncServiceInitial.lastSyncTime();
        return {
          icon: 'wifi-off',
          title: 'Modo offline',
          subtitle: lastSync ? `Usando datos guardados (Sincronizado: ${lastSync})` : 'Usando datos guardados previamente',
          type: 'offline',
        };
      case 'offline-pending':
        return {
          icon: 'wifi-off',
          title: 'Modo offline',
          subtitle: `${this.pendingCount()} cambio${this.pendingCount() !== 1 ? 's' : ''} pendiente${this.pendingCount() !== 1 ? 's' : ''} por sincronizar`,
          type: 'pending',
        };
      case 'syncing':
        return {
          icon: 'refresh-cw',
          title: 'Sincronizando cambios pendientes...',
          subtitle: `Enviando ${this.pendingCount()} operación${this.pendingCount() !== 1 ? 'es' : ''} al servidor`,
          type: 'syncing',
        };
      case 'synced':
        return {
          icon: 'cloud-check',
          title: 'Cambios sincronizados',
          subtitle: 'Todos los cambios fueron enviados correctamente',
          type: 'synced',
        };
      case 'conflict':
        return {
          icon: 'alert-triangle',
          title: `Conflictos detectados (${this.conflicts().length})`,
          subtitle: 'Algunos cambios entraron en conflicto con el servidor',
          type: 'conflict',
        };
      default:
        return { icon: 'wifi', title: '', subtitle: '', type: 'hidden' };
    }
  });

  ngOnInit(): void {
    // Observar cambios en el estado de sincronización
    // Cuando isSyncing pasa de true a false, mostrar "Sincronizado" por 3s
    let wasSyncing = false;
    const checkSync = () => {
      const syncing = this.isSyncing();
      if (wasSyncing && !syncing) {
        this._synced.set(true);
        if (this._syncedTimer) clearTimeout(this._syncedTimer);
        this._syncedTimer = setTimeout(() => {
          this._synced.set(false);
        }, 3000);
      }
      wasSyncing = syncing;
    };

    // Polling ligero solo para el estado de sincronización (250ms)
    const interval = setInterval(checkSync, 250);
    this._intervalId = interval;
  }

  recomprobarConectividad(): void {
    this.probandoConexion.set(true);
    this.statusService.verifyConnectionActive().then(() => {
      this.probandoConexion.set(false);
    });
  }

  ngOnDestroy(): void {
    if (this._intervalId) clearInterval(this._intervalId);
    if (this._syncedTimer) clearTimeout(this._syncedTimer);
  }

  private _intervalId: ReturnType<typeof setInterval> | null = null;
}
