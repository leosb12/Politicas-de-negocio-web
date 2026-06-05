import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface PermisosEdicion {
  departamentos: string[];
  roles: string[];
  usuarios: string[];
}

export interface PermisosLectura {
  departamentos: string[];
  roles: string[];
  usuarios: string[];
  incluirClienteIniciador: boolean;
}

export interface PermisosAdicionales {
  puedeDescargar: boolean;
  puedeImprimir: boolean;
  puedeComentar: boolean;
  puedeReemplazar: boolean;
  puedeEliminar: boolean;
  puedeCompartirInternamente: boolean;
}

export interface PermisosDocumentoColaborativoUsuario {
  puedeLeer: boolean;
  puedeEditar: boolean;
  puedeDescargar: boolean;
  puedeImprimir: boolean;
  puedeComentar: boolean;
  puedeReemplazar: boolean;
  puedeEliminar: boolean;
  puedeCompartirInternamente: boolean;
}

export type DocumentoColaborativoAuditAction = 'EDITAR' | 'DESCARGAR' | 'IMPRIMIR';

export interface DocumentoColaborativoMetadata {
  documentoId: string;
  clienteId: string;
  tramiteId: string;
  campoFormularioId: string;
  nombreDocumento: string;
  descripcion: string;
  tipoDocumento: 'WORD' | 'EXCEL' | 'POWERPOINT';
  estado: 'CREADO' | 'PENDIENTE_CREACION' | 'ERROR_CREACION_S3' | 'TIPO_NO_SOPORTADO';
  s3Key: string | null;
  creadoPor: string;
  modificadoPor?: string | null;
  fechaCreacion: string;
  fechaUltimaModificacion: string | null;
  ultimoEventoOnlyOffice?: string | null;
  controlVersionesHabilitado?: boolean;
  versionActual?: number;
  permisosEdicion?: PermisosEdicion;
  permisosLectura?: PermisosLectura;
  permisosAdicionales?: PermisosAdicionales;
  permisosUsuario?: PermisosDocumentoColaborativoUsuario;
}

export interface DocumentoVersion {
  id?: string;
  documentoId: string;
  numeroVersion: number;
  s3KeyVersion: string;
  nombreArchivo: string;
  creadoPorUsuarioId?: string | null;
  creadoPorNombre?: string | null;
  fechaCreacion: string;
  origen?: string | null;
  accion: string;
  tamanioBytes?: number | null;
  hashArchivoOpcional?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentoColaborativoService {
  private readonly http = inject(HttpClient);

  listarPorTramite(tramiteId: string): Observable<DocumentoColaborativoMetadata[]> {
    return this.http.get<DocumentoColaborativoMetadata[]>(
      `${API_BASE_URL}/api/tramites/${encodeURIComponent(tramiteId)}/documentos-colaborativos`
    );
  }

  obtenerEditorConfig(documentoId: string): Observable<{
    documentServerUrl: string;
    config: any;
    controlVersionesHabilitado?: boolean;
    versionActual?: number;
  }> {
    return this.http.post<{
      documentServerUrl: string;
      config: any;
      controlVersionesHabilitado?: boolean;
      versionActual?: number;
    }>(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/editor-config`,
      {}
    );
  }

  listarVersiones(documentoId: string): Observable<DocumentoVersion[]> {
    return this.http.get<DocumentoVersion[]>(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/versiones`
    );
  }

  descargarVersion(documentoId: string, numeroVersion: number): Observable<Blob> {
    return this.http.get(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/versiones/${encodeURIComponent(numeroVersion)}/download`,
      { responseType: 'blob' }
    );
  }

  restaurarVersion(documentoId: string, numeroVersion: number): Observable<DocumentoVersion> {
    return this.http.post<DocumentoVersion>(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/versiones/${encodeURIComponent(numeroVersion)}/restaurar`,
      {}
    );
  }

  descargarAuditado(documentoId: string, format: 'pdf' | 'original'): Observable<Blob> {
    return this.http.get(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/download?format=${encodeURIComponent(format)}`,
      { responseType: 'blob' }
    );
  }

  registrarEventoEditor(
    documentoId: string,
    accion: DocumentoColaborativoAuditAction,
    detalle?: string
  ): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/audit-event`,
      { accion, detalle }
    );
  }
}
