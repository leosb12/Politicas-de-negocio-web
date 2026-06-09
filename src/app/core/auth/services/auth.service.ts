import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, timeout, from, firstValueFrom } from 'rxjs';
import { Usuario } from '../models/usuario.model';
import { API_ENDPOINTS } from '../../config/api.config';
import { IndexedDbService } from '../../offline/indexeddb.service';
import { OfflineStatusService } from '../../offline/offline-status.service';

const SESSION_STORAGE_KEY = 'usuarioSesion';
const LOGIN_TIMEOUT_MS = 8000;

export interface FuncionarioDepartamentoResponse {
  id: string | null;
  nombre: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.auth;
  private readonly indexedDb = inject(IndexedDbService);
  private readonly statusService = inject(OfflineStatusService);

  readonly session = signal<Usuario | null>(this.readStoredSession());
  readonly isOfflineSession = computed(() => {
    return this.session() !== null && this.statusService.isOfflineSession();
  });

  loginWeb(correo: string, password: string): Observable<Usuario> {
    return this.http
      .post<Usuario>(`${this.apiUrl}/web/login`, { correo, password })
      .pipe(
        timeout(LOGIN_TIMEOUT_MS),
        tap((usuario) => {
          this.statusService.setOfflineSession(false);
          this.guardarSesion(usuario);
          this.crearPerfilOffline(usuario).catch((err) =>
            console.warn('[AuthService] No se pudo guardar perfil offline:', err)
          );
        })
      );
  }

  loginOffline(correo: string): Observable<Usuario> {
    return from(this.ejecutarLoginOffline(correo));
  }

  private async ejecutarLoginOffline(correo: string): Promise<Usuario> {
    const cleanCorreo = correo.toLowerCase().trim();
    const profile = await this.indexedDb.get<any>('offlineAuthProfiles', cleanCorreo);

    if (!profile || !profile.offlineEnabled) {
      throw new Error('Primero debes iniciar sesión con internet para activar el modo offline.');
    }

    const usuario: Usuario = {
      id: profile.userId,
      nombre: profile.nombre,
      correo: profile.correo,
      rol: profile.rol,
      departamentoId: profile.departamentoId,
      departamentoNombre: profile.departamentoNombre,
      activo: true,
    };

    this.statusService.setOfflineSession(true);
    this.guardarSesion(usuario);

    // Actualizar fecha de último login offline
    profile.fechaUltimoLogin = new Date().toISOString();
    await this.indexedDb.put('offlineAuthProfiles', profile);

    return usuario;
  }

  async crearPerfilOffline(usuario: Usuario): Promise<void> {
    let deptoId = usuario.departamentoId || null;
    let deptoNombre = usuario.departamentoNombre || null;

    // Si es funcionario, enriquecer con depto
    if (usuario.rol === 'FUNCIONARIO' || usuario.rol === 'ROLE_FUNCIONARIO') {
      try {
        const depto = await firstValueFrom(this.obtenerDepartamentoFuncionario(usuario.id));
        deptoId = depto.id;
        deptoNombre = depto.nombre;
      } catch (err) {
        console.warn('[AuthService] No se pudo enriquecer departamento de funcionario:', err);
      }
    }

    const profile = {
      userId: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo.toLowerCase().trim(),
      rol: usuario.rol,
      departamentoId: deptoId,
      departamentoNombre: deptoNombre,
      fechaUltimoLogin: new Date().toISOString(),
      offlineEnabled: true,
    };

    await this.indexedDb.put('offlineAuthProfiles', profile);
  }

  async clearOfflineData(): Promise<void> {
    await this.indexedDb.clearOfflineData();
  }

  cambiarContrasena(
    correo: string,
    passwordActual: string,
    nuevaContrasena: string,
    confirmarNuevaContrasena: string,
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/cambiar-contrasena`, {
      correo,
      passwordActual,
      nuevaContrasena,
      confirmarNuevaContrasena,
    });
  }

  solicitarRecuperacionContrasena(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, {
      email,
    });
  }

  restablecerContrasena(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, {
      token,
      newPassword,
    });
  }

  obtenerDepartamentoFuncionario(funcionarioUserId: string): Observable<FuncionarioDepartamentoResponse> {
    return this.http.get<FuncionarioDepartamentoResponse>(
      `${this.apiUrl}/funcionario/departamento`,
      {
        headers: {
          'X-User-Id': funcionarioUserId,
        },
      }
    );
  }

  guardarSesion(usuario: Usuario, useSessionStorage = false): void {
    const storage = useSessionStorage ? sessionStorage : localStorage;

    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(usuario));
    this.session.set(usuario);
  }

  actualizarSesion(usuario: Usuario): void {
    const useSessionStorage = sessionStorage.getItem(SESSION_STORAGE_KEY) !== null;
    this.guardarSesion(usuario, useSessionStorage);
  }

  obtenerSesion(): Usuario | null {
    return this.session();
  }

  cerrarSesion(): void {
    const usuario = this.session();
    if (usuario) {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.http.post(`${this.apiUrl}/logout`, {}, {
          headers: {
            'X-User-Id': usuario.id || '',
            'X-Admin-User-Id': usuario.id || ''
          }
        }).subscribe({
          next: () => {},
          error: () => {}
        });
      }
    }
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    this.session.set(null);
    this.statusService.setOfflineSession(false);
  }

  estaAutenticado(): boolean {
    return !!this.session();
  }

  private readStoredSession(): Usuario | null {
    if (typeof window === 'undefined') return null;
    const localData = localStorage.getItem(SESSION_STORAGE_KEY);
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const data = localData ?? sessionData;

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as Usuario;
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }
}
