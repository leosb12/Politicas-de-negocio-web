import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  PoliticaNegocio,
  CreatePoliticaRequest,
  UpdateFlujoRequest,
  EstadoPolitica,
} from '../models/politica.model';

@Injectable({ providedIn: 'root' })
export class PoliticaService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.politicas;

  /** GET /api/politicas */
  getAll(): Observable<PoliticaNegocio[]> {
    return this.http.get<PoliticaNegocio[]>(this.url);
  }

  /** GET /api/politicas/:id */
  getById(id: string): Observable<PoliticaNegocio> {
    return this.http.get<PoliticaNegocio>(`${this.url}/${id}`);
  }

  /** POST /api/politicas */
  create(payload: CreatePoliticaRequest): Observable<PoliticaNegocio> {
    return this.http.post<PoliticaNegocio>(this.url, payload);
  }

  /** PUT /api/politicas/:id/flujo */
  saveFlujo(id: string, payload: UpdateFlujoRequest): Observable<PoliticaNegocio> {
    return this.http.put<PoliticaNegocio>(`${this.url}/${id}/flujo`, payload);
  }

  /** PATCH /api/politicas/:id/estado */
  changeEstado(id: string, estado: EstadoPolitica): Observable<PoliticaNegocio> {
    return this.http.patch<PoliticaNegocio>(`${this.url}/${id}/estado`, { estado });
  }
}
