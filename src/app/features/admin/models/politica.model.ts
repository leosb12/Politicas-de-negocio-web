/* ───────────────────────────────────────────────
 *  Models that mirror the Spring Boot backend
 *  exactly (PoliticaNegocio, Nodo, Conexion, etc.)
 * ─────────────────────────────────────────────── */

// ── Enums ────────────────────────────────────────
export type TipoNodo = 'INICIO' | 'ACTIVIDAD' | 'DECISION' | 'FORK' | 'JOIN' | 'FIN';
export type TipoCampo = 'TEXTO' | 'NUMERO' | 'BOOLEANO' | 'ARCHIVO' | 'FECHA';
export type EstadoPolitica = 'BORRADOR' | 'ACTIVA' | 'PAUSADA';

/**
 * Tipo del responsable LÓGICO de ejecución de una ACTIVIDAD.
 * NOTA: Es independiente del carril visual (departamentoId).
 */
export type ResponsableTipo = 'DEPARTAMENTO' | 'USUARIO';

// ── Sub-documents ────────────────────────────────
export interface CampoFormulario {
  campo: string;
  tipo: TipoCampo;
}

export interface CondicionDecision {
  resultado: string;
  siguiente: string;
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
  estado: EstadoPolitica;
  nodos: Nodo[];
  conexiones: Conexion[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

// ── Request DTOs ─────────────────────────────────
export interface CreatePoliticaRequest {
  nombre: string;
  descripcion: string;
}

export interface UpdateFlujoRequest {
  nodos: Nodo[];
  conexiones: Conexion[];
}

export interface CambiarEstadoRequest {
  estado: EstadoPolitica;
}
