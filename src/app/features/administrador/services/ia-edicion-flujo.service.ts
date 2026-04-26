import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { AuthService } from '../../../core/auth/services/auth.service';
import {
  IaWorkflowEditApplyRequest,
  IaWorkflowEditApplyResponse,
  IaWorkflowEditPreviewRequest,
  IaWorkflowEditPreviewResponse,
} from '../models/ia-edicion-flujo.model';

@Injectable({ providedIn: 'root' })
export class IaEdicionFlujoService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${API_BASE_URL}/api/ia/flujos`;

  previewChanges(
    policyId: string,
    request: IaWorkflowEditPreviewRequest
  ): Observable<IaWorkflowEditPreviewResponse> {
    return this.http.post<IaWorkflowEditPreviewResponse>(
      `${this.baseUrl}/${policyId}/edicion/previsualizar`,
      request,
      {
        headers: this.buildHeaders(),
      }
    );
  }

  applyChanges(
    policyId: string,
    request: IaWorkflowEditApplyRequest
  ): Observable<IaWorkflowEditApplyResponse> {
    return this.http.post<IaWorkflowEditApplyResponse>(
      `${this.baseUrl}/${policyId}/edicion/aplicar`,
      request,
      {
        headers: this.buildHeaders(),
      }
    );
  }

  private buildHeaders(): HttpHeaders | undefined {
    const session = this.authService.obtenerSesion();
    if (!session?.id) {
      return undefined;
    }

    return new HttpHeaders({
      'X-Admin-User-Id': session.id,
    });
  }
}
