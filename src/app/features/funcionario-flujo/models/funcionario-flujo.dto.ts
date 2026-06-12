export type FlujoFormularioCampoTipoDto =
  | 'TEXTO'
  | 'TEXTAREA'
  | 'NUMERO'
  | 'BOOLEANO'
  | 'ARCHIVO'
  | 'FECHA'
  | 'CHECKBOX'
  | 'SELECCION'
  | 'GRID'
  | 'LABEL'
  | 'DOCUMENTO_COLABORATIVO';

export interface FlujoFormularioCampoDefinicionDto {
  id?: string | null;
  campo?: string | null;
  clave?: string | null;
  nombre?: string | null;
  etiqueta?: string | null;
  label?: string | null;
  tipo?: FlujoFormularioCampoTipoDto | string | null;
  requerido?: boolean | null;
  required?: boolean | null;
  placeholder?: string | null;
  ayuda?: string | null;
  orden?: number | null;
  opciones?: string[] | null;
  options?: string[] | null;
  configuracionDocumento?: any;
}

export interface FlujoFormularioDefinicionObjetoDto {
  titulo?: string | null;
  descripcion?: string | null;
  campos?: FlujoFormularioCampoDefinicionDto[] | null;
}

export type FlujoFormularioDefinicionDto =
  | FlujoFormularioCampoDefinicionDto[]
  | FlujoFormularioDefinicionObjetoDto
  | null;

export interface TareaMiaResponseDto {
  id: string;
  nombreActividad: string;
  estadoTarea: string;
  instanciaId: string;
  politicaId: string;
  politicaNombre: string;
  fechaCreacion: string;
  fechaInicio: string | null;
  prioridad: string | null;
  responsableActual: string | null;
  responsableTipo: string | null;
  responsableId: string | null;
  codigoTramite: string | null;
  estadoInstancia: string | null;
  contextoResumen: Record<string, unknown> | null;
  recursoRecomendado?: string | null;
  motivoRecomendacion?: string | null;
}

export interface TareaActividadDetalleDto {
  nodoId: string;
  nombreActividad: string;
  responsableTipo: string | null;
  responsableId: string | null;
  formularioDefinicion: FlujoFormularioDefinicionDto;
}

export interface TareaPoliticaDetalleDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

export interface HistorialInstanciaEventoDto {
  id: string;
  instanciaId: string;
  tareaId: string | null;
  accion: string;
  usuario: string | null;
  fecha: string;
  detalle: string | null;
}

export interface InstanciaDetalleResponseDto {
  id: string;
  politicaId: string;
  politicaNombre: string;
  politicaDescripcion: string | null;
  politicaEstado: string;
  politicaVersion: number | null;
  codigoTramite: string | null;
  estadoInstancia: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadaPor: string | null;
  creadaPorNombre?: string | null;
  datosContexto: Record<string, unknown> | null;
  tokensJoin: Record<string, unknown> | null;
  totalTareas: number | null;
  tareasAbiertas: number | null;
  tareasCompletadas: number | null;
  tareasCanceladas: number | null;
  tareasRechazadas: number | null;
  requisitosInicialesDefinicion?: FlujoFormularioCampoDefinicionDto[] | null;
  respuestasRequisitosIniciales?: Record<string, unknown> | null;
}

export interface TareaDetalleResponseDto {
  id: string;
  instanciaId?: string | null;
  tramiteId?: string | null;
  processInstanceId?: string | null;
  instanciaPoliticaId?: string | null;
  estadoTarea: string;
  fechaCreacion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  asignadoA: string | null;
  asignadoANombre?: string | null;
  participantesIds?: string[] | null;
  participantesNombres?: string[] | null;
  observaciones: string | null;
  actividad: TareaActividadDetalleDto;
  formularioRespuesta: Record<string, unknown> | null;
  instancia: InstanciaDetalleResponseDto | null;
  politica: TareaPoliticaDetalleDto | null;
  historialRelevante: HistorialInstanciaEventoDto[] | null;
  prioridad?: string | null;
  recursoRecomendado?: string | null;
  recursoRecomendadoNombre?: string | null;
  motivoRecomendacion?: string | null;
}

export interface SubirArchivoRequestDto {
  archivo: File;
  instanciaId?: string | null;
  actividadId?: string | null;
  tareaId?: string | null;
  usuarioId?: string | null;
  campoId?: string | null;
  tramiteId?: string | null;
  clienteId?: string | null;
  politicaId?: string | null;
  nodoId?: string | null;
  descripcion?: string | null;
}

export interface ArchivoMetadataResponseDto {
  id: string;
  nombreOriginal: string;
  nombreGuardado: string;
  rutaOKey: string;
  storageType: string;
  contentType: string;
  extension: string | null;
  tamanoBytes: number;
  fechaSubida: string;
  subidoPor: string;
  subidoPorNombre?: string | null;
  instanciaId: string | null;
  actividadId: string | null;
  tareaId: string | null;
  usuarioId: string | null;
  estado: string;
  descripcion: string | null;
  urlAcceso: string | null;
  bucket: string | null;
  clienteId?: string | null;
  puedeVer?: boolean | null;
  puedeDescargar?: boolean | null;
  puedeEditar?: boolean | null;
  puedeReemplazar?: boolean | null;
  puedeEliminar?: boolean | null;
}

export interface CompletarTareaRequestDto {
  formularioRespuesta: Record<string, unknown>;
  observaciones: string | null;
}
