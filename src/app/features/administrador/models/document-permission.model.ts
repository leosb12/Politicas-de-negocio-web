export type DocumentSubjectType = 'ROL' | 'USUARIO' | 'DEPARTAMENTO' | 'CLIENTE' | 'TRAMITE';
export type DocumentPermissionAction =
  | 'LEER'
  | 'SUBIR'
  | 'DESCARGAR'
  | 'EDITAR'
  | 'REEMPLAZAR'
  | 'ELIMINAR'
  | 'ADMINISTRAR_PERMISOS'
  | 'COLABORAR';

export type DocumentFileType =
  | 'PDF'
  | 'WORD'
  | 'EXCEL'
  | 'POWERPOINT'
  | 'IMAGEN'
  | 'VIDEO'
  | 'OTRO';

export type DocumentCategory =
  | 'DOCUMENTO_CLIENTE'
  | 'DOCUMENTO_INTERNO'
  | 'EVIDENCIA'
  | 'CONTRATO'
  | 'FORMULARIO'
  | 'RESPALDO'
  | 'OTRO';

export type DocumentConfidentialityLevel =
  | 'PUBLICO_TRAMITE'
  | 'INTERNO'
  | 'CONFIDENCIAL'
  | 'RESTRINGIDO';

export interface DocumentPermissionSet {
  leer: boolean;
  subir: boolean;
  descargar: boolean;
  editar: boolean;
  reemplazar: boolean;
  eliminar: boolean;
  administrarPermisos: boolean;
  colaborar: boolean;
}

export interface DocumentPermissionRule {
  tipoSujeto: DocumentSubjectType;
  sujetoId: string;
  sujetoNombre: string;
  permisos: DocumentPermissionSet;
  aplicaDesde: string;
  aplicaHasta?: string | null;
  activo: boolean;
}

export interface DocumentAuditConfig {
  auditarVisualizacion: boolean;
  auditarDescarga: boolean;
  auditarSubida: boolean;
  auditarEdicion: boolean;
  auditarEliminacion: boolean;
  auditarCambioPermisos: boolean;
  guardarIpDispositivo: boolean;
  guardarUserAgent: boolean;
  guardarFechaHora: boolean;
  guardarUsuarioActor: boolean;
}

export interface DocumentPermissionScope {
  clienteId?: string | null;
  tramiteId?: string | null;
  departamentoId?: string | null;
}

export interface DocumentPermissionConfigRequest {
  politicaId?: string | null;
  nodoId?: string | null;
  formularioId?: string | null;
  campoId: string;
  campoNombre: string;
  descripcion?: string | null;
  obligatorio: boolean;
  permiteMultiplesArchivos: boolean;
  tiposArchivoPermitidos: DocumentFileType[];
  tamanoMaximoMb: number;
  categoriaDocumental: DocumentCategory;
  nivelConfidencialidad: DocumentConfidentialityLevel;
  alcance: DocumentPermissionScope;
  reglasPermiso: DocumentPermissionRule[];
  auditoria: DocumentAuditConfig;
  activo: boolean;
}

export interface DocumentPermissionConfigResponse extends DocumentPermissionConfigRequest {
  id: string;
  tipoCampo: 'ARCHIVO';
  creadoPor?: string | null;
  fechaCreacion?: string | null;
  actualizadoPor?: string | null;
  fechaActualizacion?: string | null;
}

export interface DocumentSubjectOptionResponse {
  tipoSujeto: DocumentSubjectType;
  id: string;
  nombre: string;
  detalle?: string | null;
}
