export type WorkflowFormularioCampoTipo =
  | 'TEXTO'
  | 'NUMERO'
  | 'BOOLEANO'
  | 'ARCHIVO'
  | 'FECHA';

export interface WorkflowArchivoMetadata {
  nombre: string;
  tipoMime: string;
  sizeBytes: number;
  fechaCarga: string;
}

export interface WorkflowFormularioCampo {
  clave: string;
  etiqueta: string;
  tipo: WorkflowFormularioCampoTipo;
  requerido: boolean;
  placeholder: string | null;
  ayuda: string | null;
  orden: number;
}

export interface WorkflowFormularioDefinicion {
  titulo: string | null;
  descripcion: string | null;
  campos: WorkflowFormularioCampo[];
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
  formularioDefinicion: WorkflowFormularioDefinicion;
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

export interface WorkflowUiError {
  status: number;
  title: string;
  message: string;
  rawMessage: string | null;
  canRetry: boolean;
}

export type WorkflowConflictType =
  | 'double-completed'
  | 'invalid-decision'
  | 'join-blocked'
  | 'policy-version'
  | 'generic';

export type WorkflowBadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';
