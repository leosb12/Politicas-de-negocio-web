import { Injectable, OnDestroy, signal, computed } from '@angular/core';
import { Observable, Subject, fromEvent } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class OfflineStatusService implements OnDestroy {
  private readonly _isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  private readonly _backendReachable = signal<boolean>(true);
  private readonly _lastCheckedAt = signal<Date | null>(null);
  private readonly _lastOfflineReason = signal<string | null>(null);
  private readonly _isOfflineSession = signal<boolean>(
    typeof window !== 'undefined' ? localStorage.getItem('isOfflineSession') === 'true' : false
  );

  /** Signal reactivo: true = backend responds and internet is active */
  readonly isOnline = this._isOnline.asReadonly();

  /** Computed: true when we are offline */
  readonly isOffline = computed(() => !this._isOnline());

  /** Signal: true when backend is reachable */
  readonly backendReachable = this._backendReachable.asReadonly();

  /** Signal: last check timestamp */
  readonly lastCheckedAt = this._lastCheckedAt.asReadonly();

  /** Signal: last reason for going offline */
  readonly lastOfflineReason = this._lastOfflineReason.asReadonly();

  /** Expose the offline session status */
  readonly isOfflineSession = this._isOfflineSession.asReadonly();

  private readonly _reconnect$ = new Subject<Event>();
  private readonly _disconnect$ = new Subject<Event>();

  /** Observable that emits when connection is recovered */
  readonly onReconnect$ = this._reconnect$.asObservable();

  /** Observable that emits when connection is lost */
  readonly onDisconnect$ = this._disconnect$.asObservable();

  private _intervalId: any = null;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    // Window events
    fromEvent(window, 'online').subscribe((event) => {
      console.log('[OfflineStatus] Evento window online detectado. Ejecutando check inmediato...');
      this.checkBackendNow().then((reachable) => {
        if (reachable) {
          this._reconnect$.next(event);
        }
      });
    });

    fromEvent(window, 'offline').subscribe((event) => {
      console.log('[OfflineStatus] Evento window offline detectado.');
      this.markOffline('WINDOW_OFFLINE_EVENT');
      this._disconnect$.next(event);
    });

    // Initial check on startup
    this.checkBackendNow();

    // Periodic check every 10 seconds
    this._intervalId = setInterval(() => {
      this.checkBackendNow();
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
  }

  /**
   * Explictly checks online status (cached value).
   */
  checkOnline(): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.markOffline('NAVIGATOR_OFFLINE');
    }
    return this._isOnline();
  }

  /**
   * Sets offline session state.
   */
  setOfflineSession(isOffline: boolean): void {
    this._isOfflineSession.set(isOffline);
    if (typeof window !== 'undefined') {
      if (isOffline) {
        localStorage.setItem('isOfflineSession', 'true');
      } else {
        localStorage.removeItem('isOfflineSession');
      }
    }
  }

  /**
   * Forces system to offline state
   */
  setOfflineForcefully(): void {
    this.markOffline('FORCEFUL_OFFLINE');
  }

  /**
   * Forces system to online state
   */
  setOnlineForcefully(): void {
    this.markOnline('FORCEFUL_ONLINE');
  }

  /**
   * Marks system as offline with a specific reason.
   */
  markOffline(reason: string): void {
    const wasOnline = this._isOnline();
    this._isOnline.set(false);
    this._backendReachable.set(false);
    this._lastOfflineReason.set(reason);
    this._lastCheckedAt.set(new Date());
    console.log(`[OfflineStatus] Estado marcado a OFFLINE. Razón: ${reason}`);

    if (wasOnline && typeof window !== 'undefined') {
      this._disconnect$.next(new Event('offline'));
    }
  }

  /**
   * Marks system as online with a specific reason.
   */
  markOnline(reason: string): void {
    const wasOffline = !this._isOnline();
    this._isOnline.set(true);
    this._backendReachable.set(true);
    this._lastOfflineReason.set(null);
    this._lastCheckedAt.set(new Date());
    console.log(`[OfflineStatus] Estado marcado a ONLINE. Razón: ${reason}`);

    if (wasOffline && typeof window !== 'undefined') {
      this._reconnect$.next(new Event('online'));
    }
  }

  /**
   * Checks the health check endpoint.
   */
  async checkBackendNow(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.markOffline('NAVIGATOR_OFFLINE');
      return false;
    }

    const healthUrl = API_BASE_URL ? `${API_BASE_URL}/api/health` : '/api/health';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'UP') {
          this.markOnline('HEALTH_CHECK_OK');
          return true;
        }
      }

      this.markOffline('HEALTH_CHECK_FAILED');
      return false;
    } catch (err) {
      console.warn('[OfflineStatus] Ping a /api/health falló:', err);
      this.markOffline('HEALTH_CHECK_FAILED');
      return false;
    }
  }

  /**
   * Keep compatibility with existing calls.
   */
  async verifyConnectionActive(): Promise<boolean> {
    return this.checkBackendNow();
  }
}

