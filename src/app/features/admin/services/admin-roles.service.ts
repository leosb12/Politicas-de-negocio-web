import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  AdminRole,
  CreateAdminRoleRequest,
  UpdateAdminRoleRequest,
} from '../models/admin-role.model';

@Injectable({
  providedIn: 'root',
})
export class AdminRolesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.adminRoles;

  createRole(payload: CreateAdminRoleRequest): Observable<AdminRole> {
    return this.http.post<AdminRole>(this.apiUrl, payload);
  }

  getRoles(): Observable<AdminRole[]> {
    return this.http.get<AdminRole[]>(this.apiUrl);
  }

  getRoleById(rolId: string): Observable<AdminRole> {
    return this.http.get<AdminRole>(`${this.apiUrl}/${rolId}`);
  }

  updateRole(
    rolId: string,
    payload: UpdateAdminRoleRequest
  ): Observable<AdminRole> {
    return this.http.put<AdminRole>(`${this.apiUrl}/${rolId}`, payload);
  }

  activateRole(rolId: string): Observable<AdminRole> {
    return this.http.patch<AdminRole>(`${this.apiUrl}/${rolId}/activar`, null);
  }

  deactivateRole(rolId: string): Observable<AdminRole> {
    return this.http.patch<AdminRole>(`${this.apiUrl}/${rolId}/desactivar`, null);
  }

  deleteRole(rolId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${rolId}`);
  }
}
