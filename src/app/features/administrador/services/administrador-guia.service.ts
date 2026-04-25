import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import { AdministradorGuiaRequest, AdministradorGuiaResponse } from '../models/administrador-guia.model';

@Injectable({ providedIn: 'root' })
export class AdministradorGuiaService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.guideAdmin;

  ask(request: AdministradorGuiaRequest): Observable<AdministradorGuiaResponse> {
    return this.http.post<AdministradorGuiaResponse>(this.url, request);
  }
}
