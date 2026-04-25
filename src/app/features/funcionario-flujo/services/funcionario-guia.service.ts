import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  FuncionarioGuiaRequest,
  FuncionarioGuiaResponse,
} from '../models/funcionario-guia.model';

@Injectable({ providedIn: 'root' })
export class FuncionarioGuiaService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.guideEmployee;

  ask(request: FuncionarioGuiaRequest): Observable<FuncionarioGuiaResponse> {
    return this.http.post<FuncionarioGuiaResponse>(this.url, request);
  }
}
