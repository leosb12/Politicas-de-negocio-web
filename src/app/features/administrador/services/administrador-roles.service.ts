import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  AdministradorRol,
  CreateAdministradorRolRequest,
  UpdateAdministradorRolRequest,
} from '../models/administrador-rol.model';

@Injectable({
  providedIn: 'root',
})
export class AdministradorRolesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.adminRoles;

  createRole(payload: CreateAdministradorRolRequest): Observable<AdministradorRol> {
    return this.http.post<AdministradorRol>(this.apiUrl, payload);
  }

  getRoles(): Observable<AdministradorRol[]> {
    return this.http.get<AdministradorRol[]>(this.apiUrl);
  }

  getRoleById(rolId: string): Observable<AdministradorRol> {
    return this.http.get<AdministradorRol>(`${this.apiUrl}/${rolId}`);
  }

  updateRole(
    rolId: string,
    payload: UpdateAdministradorRolRequest
  ): Observable<AdministradorRol> {
    return this.http.put<AdministradorRol>(`${this.apiUrl}/${rolId}`, payload);
  }

  activateRole(rolId: string): Observable<AdministradorRol> {
    return this.http.patch<AdministradorRol>(`${this.apiUrl}/${rolId}/activar`, null);
  }

  deactivateRole(rolId: string): Observable<AdministradorRol> {
    return this.http.patch<AdministradorRol>(`${this.apiUrl}/${rolId}/desactivar`, null);
  }

  deleteRole(rolId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${rolId}`);
  }
}
