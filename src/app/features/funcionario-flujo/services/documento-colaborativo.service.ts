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
  puedeComentar: boolean;
  puedeReemplazar: boolean;
  puedeEliminar: boolean;
  puedeCompartirInternamente: boolean;
}

export interface PermisosDocumentoColaborativoUsuario {
  puedeLeer: boolean;
  puedeEditar: boolean;
  puedeDescargar: boolean;
  puedeComentar: boolean;
  puedeReemplazar: boolean;
  puedeEliminar: boolean;
  puedeCompartirInternamente: boolean;
}

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
  permisosEdicion?: PermisosEdicion;
  permisosLectura?: PermisosLectura;
  permisosAdicionales?: PermisosAdicionales;
  permisosUsuario?: PermisosDocumentoColaborativoUsuario;
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

  obtenerEditorConfig(documentoId: string): Observable<{ documentServerUrl: string, config: any }> {
    return this.http.post<{ documentServerUrl: string, config: any }>(
      `${API_BASE_URL}/api/documentos-colaborativos/${encodeURIComponent(documentoId)}/editor-config`,
      {}
    );
  }
}
