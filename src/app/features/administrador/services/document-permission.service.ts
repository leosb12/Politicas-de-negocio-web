import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  DocumentPermissionConfigRequest,
  DocumentPermissionConfigResponse,
  DocumentSubjectOptionResponse,
  DocumentSubjectType,
} from '../models/document-permission.model';

@Injectable({ providedIn: 'root' })
export class DocumentPermissionService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.documentPermissions;

  createConfig(payload: DocumentPermissionConfigRequest): Observable<DocumentPermissionConfigResponse> {
    return this.http.post<DocumentPermissionConfigResponse>(this.url, payload);
  }

  updateConfig(id: string, payload: DocumentPermissionConfigRequest): Observable<DocumentPermissionConfigResponse> {
    return this.http.put<DocumentPermissionConfigResponse>(`${this.url}/${id}`, payload);
  }

  getByField(campoId: string): Observable<DocumentPermissionConfigResponse> {
    return this.http.get<DocumentPermissionConfigResponse>(`${this.url}/by-field/${encodeURIComponent(campoId)}`);
  }

  getSubjectOptions(tipoSujeto: DocumentSubjectType): Observable<DocumentSubjectOptionResponse[]> {
    return this.http.get<DocumentSubjectOptionResponse[]>(
      `${this.url}/subjects/${encodeURIComponent(tipoSujeto)}/options`
    );
  }
}
