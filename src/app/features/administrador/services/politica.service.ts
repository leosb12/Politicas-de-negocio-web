import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IndexedDbService } from '../../../core/offline/indexeddb.service';
import { API_BASE_URL, API_ENDPOINTS } from '../../../core/config/api.config';
import {
  PoliticaNegocio,
  CreatePoliticaRequest,
  UpdatePoliticaRequest,
  UpdateFlujoRequest,
  CampoFormulario,
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

export interface EdicionAuditoriaDto {
  id: string;
  tipoAccion: string;
  usuarioId: string;
  usuarioNombre: string;
  fecha: string;
  detalle: string;
}

export interface IniciadorAuditoriaDto {
  instanciaId: string;
  codigoTramite: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioCorreo: string;
  fechaInicio: string;
  estadoInstancia: string;
}

export interface TramiteRealizadoDto {
  instanciaId: string;
  codigoTramite: string;
  tareaId: string;
  nodoId: string;
  nombreNodo: string;
  funcionarioId: string;
  funcionarioNombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  estadoTarea: string;
}

export interface ColaboradorAuditoriaDto {
  usuarioId: string;
  nombre: string;
  correo: string;
  rolEnSistema: string;
  participacion: string;
  totalActividades: number;
}

export interface PoliticaAuditoriaGeneralResponse {
  id: string;
  nombre: string;
  descripcion: string;
  estado: string;
  creadoPorId: string;
  creadoPorNombre: string;
  fechaCreacion: string;
  ediciones: EdicionAuditoriaDto[];
  iniciadores: IniciadorAuditoriaDto[];
  tramitesRealizados: TramiteRealizadoDto[];
  colaboradores: ColaboradorAuditoriaDto[];
}

@Injectable({ providedIn: 'root' })
export class PoliticaService {
  private readonly http = inject(HttpClient);
  private readonly db = inject(IndexedDbService);
  private readonly url = API_ENDPOINTS.politicas;
  private readonly documentPermissionsUrl = API_ENDPOINTS.documentPermissions;

  // ===== MÉTODOS OFFLINE EXPLÍCITOS =====

  async getPoliticasOffline(): Promise<PoliticaNegocio[]> {
    return this.db.getAll<PoliticaNegocio>('politicas');
  }

  async getPoliticaDetalleOffline(id: string): Promise<PoliticaNegocio> {
    const detail = await this.db.get<PoliticaNegocio>('politicaDetalles', id);
    if (!detail) throw new Error(`Política no encontrada en caché: ${id}`);
    return detail;
  }

  async getPoliticaFlujoOffline(id: string): Promise<any> {
    const flow = await this.db.get<any>('politicaFlujos', id);
    if (!flow) throw new Error(`Flujo no encontrado en caché: ${id}`);
    return flow;
  }

  async getAuditoriaPoliticaOffline(id: string): Promise<PoliticaAuditoriaGeneralResponse> {
    const audit = await this.db.get<PoliticaAuditoriaGeneralResponse>('politicaAuditoria', id);
    if (!audit) throw new Error(`Auditoría de política no encontrada en caché: ${id}`);
    return audit;
  }

  async getAuditoriaDocumentalOffline(id: string): Promise<AuditoriaDocumentalPoliticaResponse> {
    const audit = await this.db.get<AuditoriaDocumentalPoliticaResponse>('auditoriaDocumental', id);
    if (!audit) throw new Error(`Auditoría documental no encontrada en caché: ${id}`);
    return audit;
  }

  // =======================================

  getAll(): Observable<PoliticaNegocio[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getPoliticasOffline());
    }
    return this.http.get<PoliticaNegocio[]>(this.url).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getPoliticasOffline());
        return throwError(() => err);
      })
    );
  }

  /** GET /api/politicas/:id */
  getById(id: string): Observable<PoliticaNegocio> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getPoliticaDetalleOffline(id));
    }
    return this.http.get<PoliticaNegocio>(`${this.url}/${id}`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getPoliticaDetalleOffline(id));
        return throwError(() => err);
      })
    );
  }

  /** GET /api/politicas/:id/auditoria/documental */
  getAuditoriaDocumental(id: string): Observable<AuditoriaDocumentalPoliticaResponse> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getAuditoriaDocumentalOffline(id));
    }
    return this.http.get<AuditoriaDocumentalPoliticaResponse>(`${this.url}/${id}/auditoria/documental`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getAuditoriaDocumentalOffline(id));
        return throwError(() => err);
      })
    );
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

  /** GET /api/politicas/:id/requisitos-iniciales */
  getRequisitosIniciales(id: string): Observable<CampoFormulario[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.db.get<any>('formDrafts', `requisitos-${id}`).then(d => d?.campos || []));
    }
    return this.http.get<CampoFormulario[]>(`${this.url}/${id}/requisitos-iniciales`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.db.get<any>('formDrafts', `requisitos-${id}`).then(d => d?.campos || []));
        return throwError(() => err);
      })
    );
  }

  /** PUT /api/politicas/:id/requisitos-iniciales */
  saveRequisitosIniciales(
    id: string,
    requisitosIniciales: CampoFormulario[]
  ): Observable<PoliticaNegocio> {
    return this.http.put<PoliticaNegocio>(`${this.url}/${id}/requisitos-iniciales`, {
      requisitosIniciales,
    });
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

  /** GET /api/politicas/:id/auditoria/general */
  getAuditoriaGeneral(id: string): Observable<PoliticaAuditoriaGeneralResponse> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getAuditoriaPoliticaOffline(id));
    }
    return this.http.get<PoliticaAuditoriaGeneralResponse>(`${this.url}/${id}/auditoria/general`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getAuditoriaPoliticaOffline(id));
        return throwError(() => err);
      })
    );
  }
}
