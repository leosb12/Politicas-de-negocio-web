import { Conexion, Nodo } from './politica.model';

export type ColaboracionEventTipo =
  | 'CREATE_NODE'
  | 'UPDATE_NODE'
  | 'MOVE_NODE'
  | 'DELETE_NODE'
  | 'CREATE_EDGE'
  | 'DELETE_EDGE'
  | 'REPLACE_FLOW';

export type ColaboracionEventEstado = 'APLICADO' | 'DUPLICADO';

export type SocketConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING';

export interface ColaboracionNodo extends Nodo {
  posicionX?: number;
  posicionY?: number;
  x?: number;
  y?: number;
  version?: number;
}

export interface ColaboracionEventoRequest {
  eventId: string;
  actorUserId: string;
  tipo: ColaboracionEventTipo;
  expectedSequence?: number;
  nodeId?: string;
  expectedNodeVersion?: number;
  posX?: number;
  posY?: number;
  nodo?: Partial<ColaboracionNodo>;
  conexion?: Conexion;
  nodos?: ColaboracionNodo[];
  conexiones?: Conexion[];
}

export interface ColaboracionEventoAplicado {
  politicaId: string;
  eventId: string;
  actorUserId: string;
  tipo: ColaboracionEventTipo;
  secuencia: number;
  estado: ColaboracionEventEstado;
  detalle?: string;
  nodeId?: string;
  nodeVersion?: number;
  posX?: number;
  posY?: number;
  nodo?: ColaboracionNodo;
  conexion?: Conexion;
  nodos?: ColaboracionNodo[];
  conexiones?: Conexion[];
  serverTimestamp?: string;
}

export interface ColaboracionEstadoSnapshot {
  politicaId?: string;
  secuencia?: number;
  secuenciaActual?: number;
  nodos?: ColaboracionNodo[];
  conexiones?: Conexion[];
  timestamp?: string;
}

export interface ColaboracionHistorialItem {
  eventId: string;
  actorUserId: string;
  tipo: ColaboracionEventTipo;
  secuencia: number;
  detalle?: string;
  serverTimestamp?: string;
}

export interface ColaboracionUsuarioPresente {
  userId: string;
  nombre: string;
  sesionesActivas: number;
  ultimaActividad: string;
}

export interface ColaboracionPresenciaPayload {
  politicaId: string;
  totalUsuariosConectados: number;
  usuarios: ColaboracionUsuarioPresente[];
  timestamp?: string;
}

export interface ColaboracionNodoEditor {
  userId: string;
  nombre: string;
  sesionesActivas: number;
  ultimaActividad: string;
}

export interface ColaboracionNodoBloqueadoPayload {
  politicaId: string;
  nodeId: string;
  editores: ColaboracionNodoEditor[];
  advertenciaColision: boolean;
  aviso?: string;
  timestamp?: string;
}

export interface ColaboracionErrorPayload {
  politicaId?: string;
  mensaje?: string;
  detalle?: string;
  codigo?: string;
  timestamp?: string;
}

export interface ColaboracionActor {
  userId: string;
  nombre: string;
}

export interface ColaboracionFlowState {
  politicaId: string;
  secuencia: number;
  nodos: ColaboracionNodo[];
  conexiones: Conexion[];
  lastEventId?: string;
  updatedAt?: string;
}

export type ColaboracionNodosBloqueadosState = Record<
  string,
  ColaboracionNodoBloqueadoPayload
>;
