import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  AdminUser,
  AssignAdminUserRoleRequest,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from '../models/admin-user.model';

@Injectable({
  providedIn: 'root',
})
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.adminUsers;

  createUser(payload: CreateAdminUserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>(this.apiUrl, payload);
  }

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.apiUrl);
  }

  getUserById(usuarioId: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.apiUrl}/${usuarioId}`);
  }

  updateUser(
    usuarioId: string,
    payload: UpdateAdminUserRequest
  ): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.apiUrl}/${usuarioId}`, payload);
  }

  activateUser(usuarioId: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${usuarioId}/activar`, null);
  }

  deactivateUser(usuarioId: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.apiUrl}/${usuarioId}/desactivar`,
      null
    );
  }

  assignRole(
    usuarioId: string,
    payload: AssignAdminUserRoleRequest
  ): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${usuarioId}/rol`, payload);
  }

  removeRole(usuarioId: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${usuarioId}/rol/quitar`, null);
  }
}
