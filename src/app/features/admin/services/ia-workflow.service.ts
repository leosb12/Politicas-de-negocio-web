import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IA_API_BASE_URL } from '../../../core/config/api.config';
import {
  IaWorkflowResponse,
  IaWorkflowRequest,
  IaWorkflowRequestContext,
} from '../models/ia-workflow.model';

@Injectable({ providedIn: 'root' })
export class IaWorkflowService {
  private readonly http = inject(HttpClient);
  private readonly iaUrl = `${IA_API_BASE_URL}/api/ia`;

  /**
   * Consume el microservicio de IA para generar un workflow
   * POST /api/ia/texto-a-flujo
   *
   * @param descripcion Descripción en texto del flujo de negocio
   * @returns Observable con la respuesta del microservicio
   */
  generarWorkflowDesdeTexto(
    descripcion: string,
    context?: IaWorkflowRequestContext
  ): Observable<IaWorkflowResponse> {
    const payload: IaWorkflowRequest = {
      descripcion,
      context,
    };
    return this.http.post<IaWorkflowResponse>(
      `${this.iaUrl}/texto-a-flujo`,
      payload
    );
  }
}
