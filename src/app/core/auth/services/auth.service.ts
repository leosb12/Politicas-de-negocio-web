import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, timeout } from 'rxjs';
import { Usuario } from '../models/usuario.model';
import { API_ENDPOINTS } from '../../config/api.config';

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

  readonly session = signal<Usuario | null>(this.readStoredSession());

  loginWeb(correo: string, password: string): Observable<Usuario> {
    return this.http
      .post<Usuario>(`${this.apiUrl}/web/login`, { correo, password })
      .pipe(
        timeout(LOGIN_TIMEOUT_MS),
        tap((usuario) => {
          this.guardarSesion(usuario);
        })
      );
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
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    this.session.set(null);
  }

  estaAutenticado(): boolean {
    return !!this.session();
  }

  private readStoredSession(): Usuario | null {
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
