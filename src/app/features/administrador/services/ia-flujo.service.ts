import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IA_API_BASE_URL } from '../../../core/config/api.config';
import {
  IaFlujoResponse,
  IaFlujoRequest,
  IaFlujoRequestContext,
} from '../models/ia-flujo.model';

@Injectable({ providedIn: 'root' })
export class IaFlujoService {
  private readonly http = inject(HttpClient);
  private readonly iaUrl = `${IA_API_BASE_URL}/api/ia`;

  /**
   * Consume el microservicio de IA para generar un workflow
   * POST /api/ia/texto-a-flujo
   *
   * @param descripcion Descripción en texto del flujo de negocio
   * @returns Observable con la respuesta del microservicio
   */
  generarFlujoDesdeTexto(
    descripcion: string,
    context?: IaFlujoRequestContext
  ): Observable<IaFlujoResponse> {
    const payload: IaFlujoRequest = {
      descripcion,
      context,
    };
    return this.http.post<IaFlujoResponse>(
      `${this.iaUrl}/texto-a-flujo`,
      payload
    );
  }
}
