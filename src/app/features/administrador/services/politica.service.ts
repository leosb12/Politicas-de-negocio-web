import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL, API_ENDPOINTS } from '../../../core/config/api.config';
import {
  PoliticaNegocio,
  CreatePoliticaRequest,
  UpdatePoliticaRequest,
  UpdateFlujoRequest,
  EstadoPolitica,
} from '../models/politica.model';

export interface DocumentoAuditoriaResponse {
  id: string;
  tipoOrigen: 'ARCHIVO' | 'DOCUMENTO_COLABORATIVO' | string;
  nombre: string;
  campoId: string | null;
  contentType: string | null;
  extension: string | null;
  tamanoBytes: number | null;
  estado: string | null;
  subidoOCreadoPor: string | null;
  subidoOCreadoPorNombre: string | null;
  fecha: string | null;
}

export interface TareaDocumentoAuditoriaResponse {
  tareaId: string;
  instanciaId: string;
  nodoId: string | null;
  nombreNodo: string | null;
  estadoTarea: string;
  fechaCreacion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  asignadoA: string | null;
  asignadoANombre: string | null;
  totalDocumentos: number;
  documentos: DocumentoAuditoriaResponse[];
}

export interface AuditoriaDocumentalPoliticaResponse {
  politicaId: string;
  totalTareas: number;
  totalDocumentos: number;
  tareas: TareaDocumentoAuditoriaResponse[];
}

export interface DocumentAuditEventResponse {
  id: string;
  documentoId: string | null;
  campoId: string | null;
  tramiteId: string | null;
  clienteId: string | null;
  politicaId: string | null;
  nodoId: string | null;
  accion: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  rol: string | null;
  departamentoId: string | null;
  departamentoNombre: string | null;
  fechaHora: string | null;
  ip: string | null;
  userAgent: string | null;
  detalle: string | null;
  resultado: string | null;
}

export interface DocumentoVersionResponse {
  documentoId: string;
  numeroVersion: number;
  s3KeyVersion: string;
  s3KeyActual?: string | null;
  nombreArchivo: string;
  createdAt?: string | null;
  createdBy?: string | null;
  creadoPorUsuarioId?: string | null;
  creadoPorNombre?: string | null;
  fechaCreacion: string;
  origen?: string | null;
  accion: string;
  tamanioBytes?: number | null;
  checksum?: string | null;
  hashArchivoOpcional?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PoliticaService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.politicas;
  private readonly documentPermissionsUrl = API_ENDPOINTS.documentPermissions;

  /** GET /api/politicas */
  getAll(): Observable<PoliticaNegocio[]> {
    return this.http.get<PoliticaNegocio[]>(this.url);
  }

  /** GET /api/politicas/:id */
  getById(id: string): Observable<PoliticaNegocio> {
    return this.http.get<PoliticaNegocio>(`${this.url}/${id}`);
  }

  /** GET /api/politicas/:id/auditoria/documental */
  getAuditoriaDocumental(id: string): Observable<AuditoriaDocumentalPoliticaResponse> {
    return this.http.get<AuditoriaDocumentalPoliticaResponse>(`${this.url}/${id}/auditoria/documental`);
  }

  /** GET /api/document-permissions/audit/by-document/:documentoId */
  getDocumentAuditEvents(documentoId: string): Observable<DocumentAuditEventResponse[]> {
    return this.http.get<DocumentAuditEventResponse[]>(
      `${this.documentPermissionsUrl}/audit/by-document/${documentoId}`
    );
  }

  /** GET /api/politicas/:id/auditoria/documental/documentos/:documentoId/versiones */
  getDocumentoVersionesAuditoria(id: string, documentoId: string): Observable<DocumentoVersionResponse[]> {
    return this.http.get<DocumentoVersionResponse[]>(
      `${this.url}/${id}/auditoria/documental/documentos/${encodeURIComponent(documentoId)}/versiones`
    );
  }

  /** GET /api/documentos-colaborativos/:documentoId/versiones/:numeroVersion/download */
  descargarVersionDocumento(documentoId: string, numeroVersion: number): Observable<Blob> {
    return this.http.get(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/versiones/${encodeURIComponent(numeroVersion)}/download`,
      { responseType: 'blob' }
    );
  }

  /** GET /api/document-permissions/audit/by-tramite/:tramiteId */
  getTramiteDocumentAuditEvents(tramiteId: string): Observable<DocumentAuditEventResponse[]> {
    return this.http.get<DocumentAuditEventResponse[]>(
      `${this.documentPermissionsUrl}/audit/by-tramite/${tramiteId}`
    );
  }

  /** POST /api/politicas */
  create(payload: CreatePoliticaRequest): Observable<PoliticaNegocio> {
    return this.http.post<PoliticaNegocio>(this.url, payload);
  }

  /** PATCH /api/politicas/:id */
  updateMetadata(id: string, payload: UpdatePoliticaRequest): Observable<PoliticaNegocio> {
    return this.http.patch<PoliticaNegocio>(`${this.url}/${id}`, payload);
  }

  /** PUT /api/politicas/:id/flujo */
  saveFlujo(id: string, payload: UpdateFlujoRequest): Observable<PoliticaNegocio> {
    return this.http.put<PoliticaNegocio>(`${this.url}/${id}/flujo`, payload);
  }

  /** PATCH /api/politicas/:id/estado */
  changeEstado(id: string, estado: EstadoPolitica): Observable<PoliticaNegocio> {
    return this.http.patch<PoliticaNegocio>(`${this.url}/${id}/estado`, { estado });
  }

  /** PATCH /api/politicas/:id/estado { estado: DESHABILITADA } */
  disable(id: string): Observable<PoliticaNegocio> {
    return this.http.patch<PoliticaNegocio>(`${this.url}/${id}/estado`, {
      estado: 'DESHABILITADA' as EstadoPolitica,
    });
  }

  /** DELETE /api/politicas/:id */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
