import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import { AdminUser } from '../models/admin-user.model';
import {
  AdminDepartment,
  CreateAdminDepartmentRequest,
  ReassignDepartmentUsersRequest,
  UpdateAdminDepartmentRequest,
} from '../models/admin-department.model';

@Injectable({
  providedIn: 'root',
})
export class AdminDepartmentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.adminDepartments;

  createDepartment(
    payload: CreateAdminDepartmentRequest
  ): Observable<AdminDepartment> {
    return this.http.post<AdminDepartment>(this.apiUrl, payload);
  }

  getDepartments(): Observable<AdminDepartment[]> {
    return this.http.get<AdminDepartment[]>(this.apiUrl);
  }

  getDepartmentById(departamentoId: string): Observable<AdminDepartment> {
    return this.http.get<AdminDepartment>(`${this.apiUrl}/${departamentoId}`);
  }

  updateDepartment(
    departamentoId: string,
    payload: UpdateAdminDepartmentRequest
  ): Observable<AdminDepartment> {
    return this.http.put<AdminDepartment>(`${this.apiUrl}/${departamentoId}`, payload);
  }

  activateDepartment(departamentoId: string): Observable<AdminDepartment> {
    return this.http.patch<AdminDepartment>(
      `${this.apiUrl}/${departamentoId}/activar`,
      null
    );
  }

  deactivateDepartment(departamentoId: string): Observable<AdminDepartment> {
    return this.http.patch<AdminDepartment>(
      `${this.apiUrl}/${departamentoId}/desactivar`,
      null
    );
  }

  deleteDepartment(departamentoId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${departamentoId}`);
  }

  getDepartmentUsers(departamentoId: string): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.apiUrl}/${departamentoId}/usuarios`);
  }

  reassignUsers(
    departamentoId: string,
    payload: ReassignDepartmentUsersRequest
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${departamentoId}/reasignar-usuarios`,
      payload
    );
  }
}
