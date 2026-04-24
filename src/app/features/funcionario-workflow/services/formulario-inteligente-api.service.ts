import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IA_API_BASE_URL } from '../../../core/config/api.config';
import {
  FormularioInteligenteRequestDto,
  FormularioInteligenteResponseDto,
} from '../models/formulario-inteligente.model';

@Injectable({
  providedIn: 'root',
})
export class FormularioInteligenteApiService {
  private readonly http = inject(HttpClient);
  private readonly endpointUrl = `${IA_API_BASE_URL}/api/ia/forms/fill`;

  completarFormulario(
    payload: FormularioInteligenteRequestDto
  ): Observable<FormularioInteligenteResponseDto> {
    return this.http.post<FormularioInteligenteResponseDto>(this.endpointUrl, payload);
  }
}
