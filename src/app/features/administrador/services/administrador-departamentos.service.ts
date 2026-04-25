import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import { AdministradorUsuario } from '../models/administrador-usuario.model';
import {
  AdministradorDepartamento,
  CreateAdministradorDepartamentoRequest,
  ReasignarUsuariosDepartamentoRequest,
  UpdateAdministradorDepartamentoRequest,
} from '../models/administrador-departamento.model';

@Injectable({
  providedIn: 'root',
})
export class AdministradorDepartamentosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.adminDepartments;

  createDepartment(
    payload: CreateAdministradorDepartamentoRequest
  ): Observable<AdministradorDepartamento> {
    return this.http.post<AdministradorDepartamento>(this.apiUrl, payload);
  }

  getDepartments(): Observable<AdministradorDepartamento[]> {
    return this.http.get<AdministradorDepartamento[]>(this.apiUrl);
  }

  getDepartmentById(departamentoId: string): Observable<AdministradorDepartamento> {
    return this.http.get<AdministradorDepartamento>(`${this.apiUrl}/${departamentoId}`);
  }

  updateDepartment(
    departamentoId: string,
    payload: UpdateAdministradorDepartamentoRequest
  ): Observable<AdministradorDepartamento> {
    return this.http.put<AdministradorDepartamento>(`${this.apiUrl}/${departamentoId}`, payload);
  }

  activateDepartment(departamentoId: string): Observable<AdministradorDepartamento> {
    return this.http.patch<AdministradorDepartamento>(
      `${this.apiUrl}/${departamentoId}/activar`,
      null
    );
  }

  deactivateDepartment(departamentoId: string): Observable<AdministradorDepartamento> {
    return this.http.patch<AdministradorDepartamento>(
      `${this.apiUrl}/${departamentoId}/desactivar`,
      null
    );
  }

  deleteDepartment(departamentoId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${departamentoId}`);
  }

  getDepartmentUsers(departamentoId: string): Observable<AdministradorUsuario[]> {
    return this.http.get<AdministradorUsuario[]>(`${this.apiUrl}/${departamentoId}/usuarios`);
  }

  reassignUsers(
    departamentoId: string,
    payload: ReasignarUsuariosDepartamentoRequest
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${departamentoId}/reasignar-usuarios`,
      payload
    );
  }
}
