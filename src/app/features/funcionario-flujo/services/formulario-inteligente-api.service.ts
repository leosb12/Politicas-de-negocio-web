import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  FormularioInteligenteRequestDto,
  FormularioInteligenteResponseDto,
} from '../models/formulario-inteligente.model';

@Injectable({
  providedIn: 'root',
})
export class FormularioInteligenteApiService {
  private readonly http = inject(HttpClient);
  private readonly endpointUrl = `${API_ENDPOINTS.ia}/forms/fill`;

  completarFormulario(
    payload: FormularioInteligenteRequestDto
  ): Observable<FormularioInteligenteResponseDto> {
    return this.http.post<FormularioInteligenteResponseDto>(this.endpointUrl, payload);
  }
}
