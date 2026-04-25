import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  AdministradorUsuario,
  AsignarRolAdministradorUsuarioRequest,
  CreateAdministradorUsuarioRequest,
  UpdateAdministradorUsuarioRequest,
} from '../models/administrador-usuario.model';

@Injectable({
  providedIn: 'root',
})
export class AdministradorUsuariosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.adminUsers;

  createUser(payload: CreateAdministradorUsuarioRequest): Observable<AdministradorUsuario> {
    return this.http.post<AdministradorUsuario>(this.apiUrl, payload);
  }

  getUsers(): Observable<AdministradorUsuario[]> {
    return this.http.get<AdministradorUsuario[]>(this.apiUrl);
  }

  getUserById(usuarioId: string): Observable<AdministradorUsuario> {
    return this.http.get<AdministradorUsuario>(`${this.apiUrl}/${usuarioId}`);
  }

  updateUser(
    usuarioId: string,
    payload: UpdateAdministradorUsuarioRequest
  ): Observable<AdministradorUsuario> {
    return this.http.put<AdministradorUsuario>(`${this.apiUrl}/${usuarioId}`, payload);
  }

  activateUser(usuarioId: string): Observable<AdministradorUsuario> {
    return this.http.patch<AdministradorUsuario>(`${this.apiUrl}/${usuarioId}/activar`, null);
  }

  deactivateUser(usuarioId: string): Observable<AdministradorUsuario> {
    return this.http.patch<AdministradorUsuario>(
      `${this.apiUrl}/${usuarioId}/desactivar`,
      null
    );
  }

  assignRole(
    usuarioId: string,
    payload: AsignarRolAdministradorUsuarioRequest
  ): Observable<AdministradorUsuario> {
    return this.http.patch<AdministradorUsuario>(`${this.apiUrl}/${usuarioId}/rol`, payload);
  }

  removeRole(usuarioId: string): Observable<AdministradorUsuario> {
    return this.http.patch<AdministradorUsuario>(`${this.apiUrl}/${usuarioId}/rol/quitar`, null);
  }
}
