/* ───────────────────────────────────────────────
 *  Models that mirror the Spring Boot backend
 *  exactly (PoliticaNegocio, Nodo, Conexion, etc.)
 * ─────────────────────────────────────────────── */

// ── Enums ────────────────────────────────────────
export type TipoNodo = 'INICIO' | 'ACTIVIDAD' | 'DECISION' | 'FORK' | 'JOIN' | 'FIN';
export type TipoCampo = 'TEXTO' | 'NUMERO' | 'BOOLEANO' | 'ARCHIVO' | 'FECHA';
export type EstadoPolitica = 'BORRADOR' | 'ACTIVA' | 'PAUSADA' | 'DESHABILITADA';
export type TipoPolitica = 'INTERNA' | 'EXTERNA' | 'AMBAS';
export type LaneOrientation = 'HORIZONTAL' | 'VERTICAL';

/**
 * Tipo del responsable LÓGICO de ejecución de una ACTIVIDAD.
 * NOTA: Es independiente del carril visual (departamentoId).
 */
export type ResponsableTipo = 'DEPARTAMENTO' | 'USUARIO';

// ── Sub-documents ────────────────────────────────
export interface CampoFormulario {
  campo: string;
  tipo: TipoCampo;
  etiqueta?: string | null;
  requerido?: boolean | null;
  placeholder?: string | null;
  ayuda?: string | null;
  orden?: number | null;
  opciones?: string[] | null;
  validaciones?: Record<string, unknown> | null;
}

export type OperadorLogicoDecision = 'AND' | 'OR';

export type OperadorCondicionDecision =
  | 'IGUAL'
  | 'DISTINTO'
  | 'MAYOR_QUE'
  | 'MAYOR_O_IGUAL'
  | 'MENOR_QUE'
  | 'MENOR_O_IGUAL'
  | 'CONTIENE'
  | 'NO_CONTIENE'
  | 'INICIA_CON'
  | 'TERMINA_CON'
  | 'ES_VERDADERO'
  | 'ES_FALSO'
  | 'ESTA_VACIO'
  | 'NO_ESTA_VACIO'
  | 'ANTES_DE'
  | 'DESPUES_DE'
  | 'EN_FECHA';

export interface ReglaCondicionDecision {
  campo: string;
  tipo: TipoCampo;
  operador: OperadorCondicionDecision;
  valor?: string | number | boolean | null;
}

export interface GrupoCondicionDecision {
  operadorLogico: OperadorLogicoDecision;
  reglas: ReglaCondicionDecision[];
  grupos: GrupoCondicionDecision[];
}

export interface CondicionDecision {
  resultado: string;
  siguiente: string;
  origenActividadId?: string | null;
  grupo?: GrupoCondicionDecision | null;
}

// ── Nodo ─────────────────────────────────────────
export interface Nodo {
  id: string;
  tipo: TipoNodo;
  nombre: string;
  /** Versión de concurrencia usada por backend para validaciones optimistas. */
  version?: number;
  /** Coordenadas persistidas del backend (opcionales en DTO). */
  posicionX?: number;
  posicionY?: number;
  /** Carril visual del diagrama (swimlane). No define quién ejecuta. */
  departamentoId: string | null;
  /** Responsable LÓGICO: solo aplica a nodos tipo ACTIVIDAD. */
  responsableTipo: ResponsableTipo | null;
  /** ID del usuario o departamento responsable. Solo aplica a tipo ACTIVIDAD. */
  responsableId: string | null;
  formulario: CampoFormulario[];
  condiciones: CondicionDecision[];
}

// ── Canvas-only extended type ─────────────────────
export interface NodoCanvas extends Nodo {
  x: number;
  y: number;
}

// ── Conexion ─────────────────────────────────────
export interface Conexion {
  origen: string;
  destino: string;
  puertoOrigen?: string;
  puertoDestino?: string;
}

// ── PoliticaNegocio (full document) ──────────────
export interface PoliticaNegocio {
  id: string;
  nombre: string;
  descripcion: string;
  requierePago?: boolean;
  montoPago?: number | null;
  monedaPago?: string | null;
  descripcionPago?: string | null;
  estado: EstadoPolitica;
  tipoPolitica: TipoPolitica;
  departamentoInicioId?: string | null;
  laneOrientation?: LaneOrientation | null;
  laneWidth?: number | null;
  laneHeight?: number | null;
  nodos: Nodo[];
  conexiones: Conexion[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

// ── Request DTOs ─────────────────────────────────
export interface CreatePoliticaRequest {
  nombre: string;
  descripcion: string;
  requierePago: boolean;
  montoPago: number | null;
  monedaPago: string;
  descripcionPago: string;
  tipoPolitica: TipoPolitica;
  departamentoInicioId?: string | null;
}

export interface UpdatePoliticaRequest {
  nombre?: string;
  descripcion?: string;
  requierePago?: boolean;
  montoPago?: number | null;
  monedaPago?: string;
  descripcionPago?: string;
  tipoPolitica?: TipoPolitica;
  departamentoInicioId?: string | null;
}

export interface UpdateFlujoRequest {
  nodos: Nodo[];
  conexiones: Conexion[];
  laneOrientation?: LaneOrientation | null;
  laneWidth?: number | null;
  laneHeight?: number | null;
}

export interface CambiarEstadoRequest {
  estado: EstadoPolitica;
}
