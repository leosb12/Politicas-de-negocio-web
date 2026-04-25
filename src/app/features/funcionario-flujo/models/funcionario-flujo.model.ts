export type FlujoFormularioCampoTipo =
  | 'TEXTO'
  | 'NUMERO'
  | 'BOOLEANO'
  | 'ARCHIVO'
  | 'FECHA';

export interface FlujoArchivoMetadata {
  archivoId: string | null;
  nombre: string;
  nombreOriginal: string | null;
  tipoMime: string;
  sizeBytes: number;
  fechaCarga: string;
  rutaOKey: string | null;
  storageType: string | null;
  urlAcceso: string | null;
  bucket: string | null;
}

export interface FlujoFormularioCampo {
  clave: string;
  etiqueta: string;
  tipo: FlujoFormularioCampoTipo;
  requerido: boolean;
  placeholder: string | null;
  ayuda: string | null;
  orden: number;
}

export interface FlujoFormularioDefinicion {
  titulo: string | null;
  descripcion: string | null;
  campos: FlujoFormularioCampo[];
}

export interface TareaResumen {
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
}

export interface HistorialEvento {
  id: string;
  instanciaId: string;
  tareaId: string | null;
  accion: string;
  usuario: string | null;
  fecha: string;
  detalle: string | null;
}

export interface InstanciaDetalle {
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
  datosContexto: Record<string, unknown>;
  tokensJoin: Record<string, unknown>;
  totalTareas: number;
  tareasAbiertas: number;
  tareasCompletadas: number;
  tareasCanceladas: number;
  tareasRechazadas: number;
}

export interface TareaActividadDetalle {
  nodoId: string;
  nombreActividad: string;
  responsableTipo: string | null;
  responsableId: string | null;
  formularioDefinicion: FlujoFormularioDefinicion;
}

export interface TareaPoliticaDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

export interface TareaDetalle {
  id: string;
  estadoTarea: string;
  fechaCreacion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  asignadoA: string | null;
  asignadoANombre?: string | null;
  observaciones: string | null;
  actividad: TareaActividadDetalle;
  formularioRespuesta: Record<string, unknown>;
  instanciaId: string | null;
  instancia: InstanciaDetalle | null;
  politica: TareaPoliticaDetalle | null;
  historialRelevante: HistorialEvento[];
}

export interface CompletarTareaPayload {
  formularioRespuesta: Record<string, unknown>;
  observaciones: string | null;
}

export interface FlujoUiError {
  status: number;
  title: string;
  message: string;
  rawMessage: string | null;
  canRetry: boolean;
}

export type FlujoConflictType =
  | 'double-completed'
  | 'invalid-decision'
  | 'join-blocked'
  | 'policy-version'
  | 'generic';

export type FlujoBadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';
