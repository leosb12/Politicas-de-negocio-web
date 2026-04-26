import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  MessagePayload,
  Messaging,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from 'firebase/messaging';
import { Subject, firstValueFrom } from 'rxjs';
import { Usuario } from '../auth/models/usuario.model';
import { AuthService } from '../auth/services/auth.service';
import { API_ENDPOINTS } from '../config/api.config';
import {
  resolveFirebaseWebConfig,
  resolveFirebaseWebVapidKey,
} from '../config/firebase.config';

type RegistroTokenPushRequest = {
  userId: string;
  token: string;
  platform: 'WEB';
  role: string;
  deviceId?: string;
  appVersion?: string;
};

const DEVICE_ID_STORAGE_KEY = 'pushWebDeviceId';
const ROLES_HABILITADOS = new Set(['ADMIN', 'FUNCIONARIO']);
const FIREBASE_APP_NAME = 'politicas-negocio-web';
const ESTADOS_FUNCIONARIO_NOTIFICABLES = new Set(['PENDIENTE', 'EN_PROCESO', 'COMPLETADA']);

@Injectable({
  providedIn: 'root'
})
export class NotificacionesPushService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly mensajesPrimerPlanoSubject = new Subject<MessagePayload>();

  private messagingPromise: Promise<Messaging | null> | null = null;
  private foregroundListenerRegistered = false;
  private ultimoUsuarioRegistrado: string | null = null;
  private ultimoTokenRegistrado: string | null = null;

  readonly permiso = signal<NotificationPermission | 'unsupported'>(this.resolveCurrentPermission());
  readonly ultimoMensajePrimerPlano = signal<MessagePayload | null>(null);
  readonly mensajesPrimerPlano$ = this.mensajesPrimerPlanoSubject.asObservable();

  constructor() {
    effect(() => {
      const usuario = this.authService.session();
      void this.sincronizarSesion(usuario);
    });
  }

  inicializar(): void {
    // La inicializacion reactiva ocurre en el constructor via effect().
  }

  private async sincronizarSesion(usuario: Usuario | null): Promise<void> {
    if (!this.isPushEnabledUser(usuario)) {
      return;
    }

    const messaging = await this.ensureMessaging();
    if (!messaging) {
      return;
    }

    this.registerForegroundListener(messaging);
    await this.requestPermissionAndRegisterToken(usuario, messaging);
  }

  private async ensureMessaging(): Promise<Messaging | null> {
    if (!this.messagingPromise) {
      this.messagingPromise = this.createMessaging();
    }

    return this.messagingPromise;
  }

  private async createMessaging(): Promise<Messaging | null> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      this.permiso.set('unsupported');
      return null;
    }

    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      this.permiso.set('unsupported');
      return null;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      this.permiso.set('unsupported');
      return null;
    }

    const firebaseConfig = resolveFirebaseWebConfig();
    if (!firebaseConfig) {
      console.warn('Firebase Web Messaging no esta configurado en runtime-config.js.');
      return null;
    }

    const app = this.resolveFirebaseApp(firebaseConfig);
    return getMessaging(app);
  }

  private resolveFirebaseApp(firebaseConfig: FirebaseOptions): FirebaseApp {
    return getApps().some((app) => app.name === FIREBASE_APP_NAME)
      ? getApp(FIREBASE_APP_NAME)
      : initializeApp(firebaseConfig, FIREBASE_APP_NAME);
  }

  private registerForegroundListener(messaging: Messaging): void {
    if (this.foregroundListenerRegistered) {
      return;
    }

    onMessage(messaging, (payload) => {
      if (!this.shouldHandleIncomingMessage(payload)) {
        return;
      }

      this.ultimoMensajePrimerPlano.set(payload);
      this.mensajesPrimerPlanoSubject.next(payload);
    });
    this.foregroundListenerRegistered = true;
  }

  private async requestPermissionAndRegisterToken(
    usuario: Usuario,
    messaging: Messaging,
  ): Promise<void> {
    const vapidKey = resolveFirebaseWebVapidKey();
    if (!vapidKey) {
      console.warn('No se encontro la VAPID KEY para Firebase Web Messaging.');
      return;
    }

    const permission = await Notification.requestPermission().catch(
      () => 'default' as NotificationPermission,
    );
    this.permiso.set(permission);

    if (permission !== 'granted') {
      return;
    }

    const serviceWorkerRegistration = await this.registerServiceWorker();
    if (!serviceWorkerRegistration) {
      return;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    }).catch((error) => {
      console.warn('No se pudo obtener el token web de Firebase.', error);
      return null;
    });

    if (!token) {
      return;
    }

    if (this.ultimoUsuarioRegistrado === usuario.id && this.ultimoTokenRegistrado === token) {
      return;
    }

    const request: RegistroTokenPushRequest = {
      userId: usuario.id,
      token,
      platform: 'WEB',
      role: usuario.rol,
      deviceId: this.resolveDeviceId(),
      appVersion: this.resolveAppVersion(),
    };

    const registered = await firstValueFrom(this.http.post(API_ENDPOINTS.pushTokens, request))
      .then(() => true)
      .catch((error) => {
      console.warn('No se pudo registrar el token push web en el backend.', error);
      return false;
    });

    if (registered) {
      this.ultimoUsuarioRegistrado = usuario.id;
      this.ultimoTokenRegistrado = token;
    }
  }

  private async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    const registration = await navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .catch((error) => {
        console.warn('No se pudo registrar firebase-messaging-sw.js.', error);
        return null;
      });

    if (!registration) {
      return null;
    }

    if (registration.active) {
      return registration;
    }

    return this.waitForServiceWorkerActivation(registration);
  }

  private waitForServiceWorkerActivation(
    registration: ServiceWorkerRegistration,
  ): Promise<ServiceWorkerRegistration | null> {
    if (registration.active) {
      return Promise.resolve(registration);
    }

    const worker = registration.installing ?? registration.waiting;
    if (!worker) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve(registration.active ? registration : null);
      }, 10000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        worker.removeEventListener('statechange', handleStateChange);
      };

      const handleStateChange = () => {
        if (worker.state === 'activated' || !!registration.active) {
          cleanup();
          resolve(registration);
        }
      };

      worker.addEventListener('statechange', handleStateChange);
    });
  }

  private isPushEnabledUser(usuario: Usuario | null): usuario is Usuario {
    return !!usuario?.id && !!usuario.rol && ROLES_HABILITADOS.has(usuario.rol.toUpperCase());
  }

  private shouldHandleIncomingMessage(payload: MessagePayload): boolean {
    const sessionRole = this.authService.session()?.rol?.trim().toUpperCase();
    if (sessionRole !== 'FUNCIONARIO') {
      return true;
    }

    const estado = this.resolveNotificationTaskState(payload);
    return !!estado && ESTADOS_FUNCIONARIO_NOTIFICABLES.has(estado);
  }

  private resolveNotificationTaskState(payload: MessagePayload): string | null {
    const data = payload.data ?? {};
    const candidate =
      data['estadoTarea'] ??
      data['taskState'] ??
      data['taskStatus'] ??
      data['estado'] ??
      data['status'] ??
      data['nuevoEstado'] ??
      data['newStatus'];

    if (typeof candidate !== 'string') {
      return null;
    }

    const normalized = candidate.trim().toUpperCase();
    return normalized || null;
  }

  private resolveCurrentPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    return Notification.permission;
  }

  private resolveDeviceId(): string {
    try {
      const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
      if (existing) {
        return existing;
      }

      const generated = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
      return generated;
    } catch {
      return 'web-browser';
    }
  }

  private resolveAppVersion(): string | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return window.location.host || undefined;
  }
}
