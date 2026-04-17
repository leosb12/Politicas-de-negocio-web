import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, timeout } from 'rxjs';
import { Usuario } from '../models/usuario.model';
import { API_ENDPOINTS } from '../core/config/api.config';

const SESSION_STORAGE_KEY = 'usuarioSesion';
const LOGIN_TIMEOUT_MS = 8000;

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

  guardarSesion(usuario: Usuario, useSessionStorage = false): void {
    const storage = useSessionStorage ? sessionStorage : localStorage;

    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(usuario));
    this.session.set(usuario);
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