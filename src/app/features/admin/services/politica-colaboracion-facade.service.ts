import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  Subscription,
  forkJoin,
  map,
  of,
  catchError,
} from 'rxjs';
import { Conexion, EstadoPolitica, LaneOrientation } from '../models/politica.model';
import {
  ColaboracionActor,
  ColaboracionErrorPayload,
  ColaboracionEstadoSnapshot,
  ColaboracionEventoAplicado,
  ColaboracionEventoRequest,
  ColaboracionFlowState,
  ColaboracionNodo,
  ColaboracionNodoBloqueadoPayload,
  ColaboracionNodosBloqueadosState,
  ColaboracionPresenciaPayload,
  ColaboracionUsuarioPresente,
  SocketConnectionState,
} from '../models/politica-colaboracion.model';
import { PoliticaColaboracionSocketService } from './politica-colaboracion-socket.service';
import { PoliticaColaboracionRestService } from './politica-colaboracion-rest.service';

interface StartSessionInput {
  politicaId: string;
  actor: ColaboracionActor;
  initialNodos: ColaboracionNodo[];
  initialConexiones: Conexion[];
  initialLaneOrientation?: LaneOrientation;
  initialLaneWidth?: number;
  initialLaneHeight?: number;
}

interface PendingEdgeMutation {
  action: 'ADD' | 'REMOVE';
  expiresAt: number;
  conexion: Conexion;
}

type EdgePort = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

const MAX_REMEMBERED_EVENTS = 1500;
const EDGE_PORT_METADATA_PREFIX = '__EDGE_PORTS__:';

@Injectable({ providedIn: 'root' })
export class PoliticaColaboracionFacadeService {
  private readonly socket = inject(PoliticaColaboracionSocketService);
  private readonly rest = inject(PoliticaColaboracionRestService);

  private readonly flowStateSubject = new BehaviorSubject<ColaboracionFlowState | null>(
    null
  );
  readonly flowState$ = this.flowStateSubject.asObservable();

  private readonly politicaEstadoSubject =
    new BehaviorSubject<EstadoPolitica | null>(null);
  readonly politicaEstado$ = this.politicaEstadoSubject.asObservable();

  private readonly connectedUsersSubject =
    new BehaviorSubject<ColaboracionUsuarioPresente[]>([]);
  readonly connectedUsers$ = this.connectedUsersSubject.asObservable();

  private readonly nodeLocksSubject =
    new BehaviorSubject<ColaboracionNodosBloqueadosState>({});
  readonly nodeLocks$ = this.nodeLocksSubject.asObservable();

  private readonly errorMessagesSubject = new Subject<string>();
  readonly errorMessages$ = this.errorMessagesSubject.asObservable();

  readonly connectionState$ = this.socket.connectionState$;

  private activePolicyId: string | null = null;
  private actor: ColaboracionActor | null = null;
  private editingNodeId: string | null = null;
  private sessionEnabled = false;
  private resyncInFlight = false;
  private lastResyncAt = 0;
  private lastServerSyncRequestAt = 0;
  private readonly serverSyncMinIntervalMs = 700;

  private readonly rememberedEventIds = new Set<string>();
  private readonly rememberedEventQueue: string[] = [];
  private readonly pendingEdgeMutations = new Map<string, PendingEdgeMutation>();

  private connectionSubscription: Subscription | null = null;
  private topicUnsubscribers: Array<() => void> = [];

  startSession(input: StartSessionInput): void {
    this.activePolicyId = input.politicaId;
    this.actor = input.actor;
    this.sessionEnabled = true;
    this.editingNodeId = null;
    this.lastServerSyncRequestAt = 0;
    this.rememberedEventIds.clear();
    this.rememberedEventQueue.length = 0;
    this.pendingEdgeMutations.clear();

    this.flowStateSubject.next({
      politicaId: input.politicaId,
      secuencia: 0,
      nodos: [...input.initialNodos],
      conexiones: [...input.initialConexiones],
      laneOrientation: input.initialLaneOrientation,
      laneWidth: input.initialLaneWidth,
      laneHeight: input.initialLaneHeight,
      updatedAt: new Date().toISOString(),
    });

    this.connectedUsersSubject.next([]);
    this.nodeLocksSubject.next({});
    this.politicaEstadoSubject.next(null);

    this.watchConnectionState();
    this.socket.connect();
  }

  stopSession(sendLeave = true): void {
    const activePolicyId = this.activePolicyId;
    const actor = this.actor;

    if (sendLeave && activePolicyId && actor && this.socket.isConnected()) {
      if (this.editingNodeId) {
        this.publishNodeEditing(this.editingNodeId, false);
      }

      this.socket.publish(
        `/app/politicas/${activePolicyId}/presencia/leave`,
        this.actorPayload()
      );
    }

    this.editingNodeId = null;
    this.sessionEnabled = false;
    this.clearTopicSubscriptions();
    this.connectionSubscription?.unsubscribe();
    this.connectionSubscription = null;

    this.activePolicyId = null;
    this.actor = null;
    this.lastServerSyncRequestAt = 0;
    this.connectedUsersSubject.next([]);
    this.nodeLocksSubject.next({});
    this.politicaEstadoSubject.next(null);
    this.pendingEdgeMutations.clear();

    void this.socket.disconnect();
  }

  setEditingNode(nodeId: string | null): void {
    if (!this.sessionEnabled || !this.activePolicyId || !this.actor) {
      this.editingNodeId = nodeId;
      return;
    }

    if (this.editingNodeId === nodeId) {
      return;
    }

    const previousNode = this.editingNodeId;
    this.editingNodeId = nodeId;

    if (previousNode) {
      this.publishNodeEditing(previousNode, false);
    }

    if (nodeId) {
      this.publishNodeEditing(nodeId, true);
    }
  }

  emitCreateNode(node: ColaboracionNodo): void {
    this.publishEvent({
      tipo: 'CREATE_NODE',
      nodeId: node.id,
      nodo: this.normalizeNodePayload(node),
      expectedNodeVersion: node.version,
    });
  }

  emitUpdateNode(
    nodeId: string,
    patch: Partial<ColaboracionNodo>,
    expectedNodeVersion?: number
  ): void {
    this.publishEvent({
      tipo: 'UPDATE_NODE',
      nodeId,
      nodo: this.normalizeNodePayload(patch),
      expectedNodeVersion,
    });
  }

  emitMoveNode(
    nodeId: string,
    posX: number,
    posY: number,
    expectedNodeVersion?: number
  ): void {
    this.applyOptimisticMove(nodeId, posX, posY);

    this.publishEvent({
      tipo: 'MOVE_NODE',
      nodeId,
      posX,
      posY,
      expectedNodeVersion,
    });

    this.requestServerSync();
  }

  emitDeleteNode(nodeId: string, expectedNodeVersion?: number): void {
    this.publishEvent({
      tipo: 'DELETE_NODE',
      nodeId,
      expectedNodeVersion,
    });
  }

  emitCreateEdge(conexion: Conexion): void {
    this.applyOptimisticCreateEdge(conexion);
    this.registerPendingEdgeMutation(conexion, 'ADD');

    const edgePortMetadata = this.encodeEdgePortMetadata(conexion);

    this.publishEvent({
      tipo: 'CREATE_EDGE',
      conexion,
      ...(edgePortMetadata ? { nodeId: edgePortMetadata } : {}),
    });

    this.requestServerSync();
  }

  emitDeleteEdge(conexion: Conexion): void {
    this.applyOptimisticDeleteEdge(conexion);
    this.registerPendingEdgeMutation(conexion, 'REMOVE');

    this.publishEvent({
      tipo: 'DELETE_EDGE',
      conexion,
    });

    this.requestServerSync();
  }

  emitReplaceFlow(nodos: ColaboracionNodo[], conexiones: Conexion[]): void {
    this.publishEvent({
      tipo: 'REPLACE_FLOW',
      nodos: nodos.map((n) => this.normalizeNodePayload(n) as ColaboracionNodo),
      conexiones,
    });
  }

  emitUpdateCanvasConfig(config: {
    laneOrientation?: LaneOrientation;
    laneWidth?: number;
    laneHeight?: number;
  }, options?: { requestSnapshot?: boolean }): void {
    const current = this.flowStateSubject.value;
    if (current) {
      this.flowStateSubject.next({
        ...current,
        laneOrientation:
          this.resolveLaneOrientation(config.laneOrientation) ??
          current.laneOrientation,
        laneWidth: this.resolveLaneDimension(config.laneWidth) ?? current.laneWidth,
        laneHeight:
          this.resolveLaneDimension(config.laneHeight) ?? current.laneHeight,
        updatedAt: new Date().toISOString(),
      });
    }

    this.publishEvent({
      tipo: 'UPDATE_CANVAS_CONFIG',
      laneOrientation: this.resolveLaneOrientation(config.laneOrientation) ?? undefined,
      laneWidth: this.resolveLaneDimension(config.laneWidth) ?? undefined,
      laneHeight: this.resolveLaneDimension(config.laneHeight) ?? undefined,
    });

    if (options?.requestSnapshot) {
      this.requestServerSync();
    }
  }

  requestResync(reason: string, silent = false): void {
    this.performFullResync(reason, silent);
  }

  private requestServerSync(options?: { force?: boolean }): void {
    if (!this.activePolicyId) {
      return;
    }

    const now = Date.now();
    if (!options?.force && now - this.lastServerSyncRequestAt < this.serverSyncMinIntervalMs) {
      return;
    }

    this.lastServerSyncRequestAt = now;

    this.socket.publish(
      `/app/politicas/${this.activePolicyId}/sync`,
      this.actorPayload()
    );
  }

  private watchConnectionState(): void {
    this.connectionSubscription?.unsubscribe();
    this.connectionSubscription = this.connectionState$.subscribe((state) => {
      if (!this.sessionEnabled || !this.activePolicyId) {
        return;
      }

      if (state === 'CONNECTED') {
        this.subscribeToPolicyTopics(this.activePolicyId);
        this.bootstrapState(this.activePolicyId);
        this.socket.publish(
          `/app/politicas/${this.activePolicyId}/presencia/join`,
          this.actorPayload()
        );
        this.socket.publish(
          `/app/politicas/${this.activePolicyId}/sync`,
          this.actorPayload()
        );
        this.socket.publish(
          `/app/politicas/${this.activePolicyId}/nodos/edicion/sync`,
          this.actorPayload()
        );

        this.connectedUsersSubject.next(
          this.ensureCurrentActorInPresence(this.connectedUsersSubject.value)
        );

        if (this.editingNodeId) {
          this.publishNodeEditing(this.editingNodeId, true);
        }
      }

      if (state === 'RECONNECTING') {
        this.errorMessagesSubject.next(
          'Reconectando colaboración en vivo...'
        );
      }
    });
  }

  private subscribeToPolicyTopics(politicaId: string): void {
    this.clearTopicSubscriptions();

    const destinations = {
      eventos: `/topic/politicas/${politicaId}/eventos`,
      estado: `/topic/politicas/${politicaId}/estado`,
      errores: `/topic/politicas/${politicaId}/errores`,
      presencia: `/topic/politicas/${politicaId}/presencia`,
      nodosBloqueados: `/topic/politicas/${politicaId}/nodos-bloqueados`,
    };

    const eventosUnsub = this.socket.subscribe<ColaboracionEventoAplicado>(
      destinations.eventos,
      (event) => this.handleEvent(event)
    );
    if (eventosUnsub) {
      this.topicUnsubscribers.push(eventosUnsub);
    }

    const estadoUnsub = this.socket.subscribe<ColaboracionEstadoSnapshot>(
      destinations.estado,
      (snapshot) => this.applySnapshot(snapshot)
    );
    if (estadoUnsub) {
      this.topicUnsubscribers.push(estadoUnsub);
    }

    const erroresUnsub = this.socket.subscribe<ColaboracionErrorPayload>(
      destinations.errores,
      (errorPayload) => this.handleErrorPayload(errorPayload)
    );
    if (erroresUnsub) {
      this.topicUnsubscribers.push(erroresUnsub);
    }

    const presenciaUnsub = this.socket.subscribe<ColaboracionPresenciaPayload>(
      destinations.presencia,
      (presencePayload) => this.applyPresencePayload(presencePayload)
    );
    if (presenciaUnsub) {
      this.topicUnsubscribers.push(presenciaUnsub);
    }

    const nodeLocksUnsub =
      this.socket.subscribe<
        ColaboracionNodoBloqueadoPayload[] | ColaboracionNodoBloqueadoPayload
      >(destinations.nodosBloqueados, (locksPayload) => {
        this.applyNodeLocksPayload(locksPayload);
      });

    if (nodeLocksUnsub) {
      this.topicUnsubscribers.push(nodeLocksUnsub);
    }
  }

  private clearTopicSubscriptions(): void {
    while (this.topicUnsubscribers.length) {
      const unsubscribe = this.topicUnsubscribers.pop();
      unsubscribe?.();
    }
  }

  private bootstrapState(politicaId: string): void {
    forkJoin({
      estado: this.rest
        .getEstado(politicaId)
        .pipe(catchError(() => of<ColaboracionEstadoSnapshot | null>(null))),
      presencia: this.rest
        .getPresencia(politicaId)
        .pipe(catchError(() => of<ColaboracionPresenciaPayload | null>(null))),
      locks: this.rest
        .getNodosBloqueados(politicaId)
        .pipe(
          catchError(() =>
            of<
              ColaboracionNodoBloqueadoPayload[] | ColaboracionNodoBloqueadoPayload | null
            >(null)
          )
        ),
    }).subscribe(({ estado, presencia, locks }) => {
      if (estado) {
        this.applySnapshot(estado);
      } else {
        this.performFullResync('No se pudo leer estado inicial de colaboración');
      }

      if (presencia) {
        this.applyPresencePayload(presencia);
      }

      if (locks) {
        this.applyNodeLocksPayload(locks);
      }
    });
  }

  private handleEvent(event: ColaboracionEventoAplicado): void {
    const current = this.flowStateSubject.value;
    if (!current) {
      return;
    }

    if (!event?.eventId || typeof event.secuencia !== 'number') {
      this.performFullResync('Evento colaborativo inválido');
      return;
    }

    if (this.rememberedEventIds.has(event.eventId)) {
      return;
    }

    const currentSeq = current.secuencia ?? 0;
    if (currentSeq > 0 && event.secuencia > currentSeq + 1) {
      this.performFullResync(
        `Desalineación de secuencia detectada (${currentSeq} -> ${event.secuencia})`
      );
      return;
    }

    if (event.secuencia <= currentSeq) {
      this.rememberEvent(event.eventId);
      return;
    }

    this.rememberEvent(event.eventId);

    if (event.estado === 'DUPLICADO') {
      this.flowStateSubject.next({
        ...current,
        secuencia: event.secuencia,
        updatedAt: event.serverTimestamp ?? new Date().toISOString(),
      });
      return;
    }

    const nextState = this.reduceEvent(current, event);
    this.flowStateSubject.next({
      ...nextState,
      secuencia: event.secuencia,
      lastEventId: event.eventId,
      updatedAt: event.serverTimestamp ?? new Date().toISOString(),
    });
  }

  private reduceEvent(
    current: ColaboracionFlowState,
    event: ColaboracionEventoAplicado
  ): ColaboracionFlowState {
    let nextNodes = [...current.nodos];
    let nextConnections = [...current.conexiones];
    let nextLaneOrientation = current.laneOrientation;
    let nextLaneWidth = current.laneWidth;
    let nextLaneHeight = current.laneHeight;

    switch (event.tipo) {
      case 'CREATE_NODE': {
        if (!event.nodo) {
          this.performFullResync('CREATE_NODE sin nodo en payload');
          return current;
        }

        nextNodes = this.upsertNode(nextNodes, event.nodo, event.nodeVersion);
        break;
      }

      case 'UPDATE_NODE': {
        const nodeId = event.nodeId ?? event.nodo?.id;
        const nodePatch = event.nodo;
        if (!nodeId || !nodePatch) {
          this.performFullResync('UPDATE_NODE sin nodeId o patch');
          return current;
        }

        nextNodes = nextNodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const merged = this.mergeNodePatch(node, nodePatch);
          if (typeof event.nodeVersion === 'number') {
            merged.version = event.nodeVersion;
          }
          return merged;
        });
        break;
      }

      case 'MOVE_NODE': {
        const nodeId = event.nodeId ?? event.nodo?.id;
        if (!nodeId) {
          this.performFullResync('MOVE_NODE sin nodeId');
          return current;
        }

        const eventPosX =
          typeof event.posX === 'number'
            ? event.posX
            : typeof event.nodo?.posicionX === 'number'
              ? event.nodo.posicionX
              : typeof (event.nodo as any)?.posX === 'number'
                ? (event.nodo as any).posX
                : event.nodo?.x;
        const eventPosY =
          typeof event.posY === 'number'
            ? event.posY
            : typeof event.nodo?.posicionY === 'number'
              ? event.nodo.posicionY
              : typeof (event.nodo as any)?.posY === 'number'
                ? (event.nodo as any).posY
                : event.nodo?.y;

        nextNodes = nextNodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const moved: ColaboracionNodo = {
            ...node,
            ...(typeof eventPosX === 'number'
              ? { posicionX: eventPosX, x: eventPosX }
              : {}),
            ...(typeof eventPosY === 'number'
              ? { posicionY: eventPosY, y: eventPosY }
              : {}),
          };

          if (typeof event.nodeVersion === 'number') {
            moved.version = event.nodeVersion;
          }

          return moved;
        });
        break;
      }

      case 'UPDATE_CANVAS_CONFIG': {
        const eventOrientation = this.resolveLaneOrientation(event.laneOrientation);
        const eventWidth = this.resolveLaneDimension(event.laneWidth);
        const eventHeight = this.resolveLaneDimension(event.laneHeight);

        if (eventOrientation) {
          nextLaneOrientation = eventOrientation;
        }

        if (typeof eventWidth === 'number') {
          nextLaneWidth = eventWidth;
        }

        if (typeof eventHeight === 'number') {
          nextLaneHeight = eventHeight;
        }

        break;
      }

      case 'DELETE_NODE': {
        const nodeId = event.nodeId ?? event.nodo?.id;
        if (!nodeId) {
          this.performFullResync('DELETE_NODE sin nodeId');
          return current;
        }

        nextNodes = nextNodes.filter((node) => node.id !== nodeId);
        nextConnections = nextConnections.filter(
          (connection) =>
            connection.origen !== nodeId && connection.destino !== nodeId
        );
        break;
      }

      case 'CREATE_EDGE': {
        if (!event.conexion) {
          this.performFullResync('CREATE_EDGE sin conexión');
          return current;
        }

        const existingIndex = nextConnections.findIndex(
          (connection) =>
            connection.origen === event.conexion?.origen &&
            connection.destino === event.conexion?.destino
        );

        const eventConnection = this.hydrateEventConnectionPorts(
          event.conexion,
          event.nodeId,
          existingIndex >= 0 ? nextConnections[existingIndex] : undefined
        );

        if (existingIndex === -1) {
          nextConnections = [...nextConnections, eventConnection];
        } else {
          nextConnections = nextConnections.map((connection, index) =>
            index === existingIndex ? eventConnection : connection
          );
        }

        this.clearPendingEdgeMutation(eventConnection);
        break;
      }

      case 'DELETE_EDGE': {
        if (!event.conexion) {
          this.performFullResync('DELETE_EDGE sin conexión');
          return current;
        }

        nextConnections = nextConnections.filter(
          (connection) =>
            !(
              connection.origen === event.conexion?.origen &&
              connection.destino === event.conexion?.destino
            )
        );

        this.clearPendingEdgeMutation(event.conexion);
        break;
      }

      case 'REPLACE_FLOW': {
        if (!event.nodos || !event.conexiones) {
          // Some backend implementations acknowledge REPLACE_FLOW without
          // echoing payload. Ignore the ack to keep client state stable.
          break;
        }

        nextNodes = [...event.nodos];
        nextConnections = this.mergeConnectionsPreservingPorts(
          [...event.conexiones],
          current.conexiones
        );

        const eventOrientation = this.resolveLaneOrientation(event.laneOrientation);
        const eventWidth = this.resolveLaneDimension(event.laneWidth);
        const eventHeight = this.resolveLaneDimension(event.laneHeight);
        if (eventOrientation) {
          nextLaneOrientation = eventOrientation;
        }
        if (typeof eventWidth === 'number') {
          nextLaneWidth = eventWidth;
        }
        if (typeof eventHeight === 'number') {
          nextLaneHeight = eventHeight;
        }
        break;
      }

      default:
        break;
    }

    return {
      ...current,
      nodos: nextNodes,
      conexiones: nextConnections,
      laneOrientation: nextLaneOrientation,
      laneWidth: nextLaneWidth,
      laneHeight: nextLaneHeight,
    };
  }

  private applySnapshot(
    snapshot: ColaboracionEstadoSnapshot,
    options?: { force?: boolean }
  ): void {
    const policyId = this.activePolicyId;
    if (!policyId) {
      return;
    }

    const forceApply = options?.force === true;
    const snapshotEstado = this.extractPolicyEstado(snapshot);
    if (snapshotEstado && snapshotEstado !== this.politicaEstadoSubject.value) {
      this.politicaEstadoSubject.next(snapshotEstado);
    }

    const current = this.flowStateSubject.value;
    const nextSequence =
      snapshot.secuencia ?? snapshot.secuenciaActual ?? current?.secuencia ?? 0;

    if (current && !forceApply && nextSequence <= current.secuencia) {
      return;
    }

    const appliedSequence = forceApply
      ? Math.max(nextSequence, current?.secuencia ?? 0)
      : nextSequence;

    const nextNodes = Array.isArray(snapshot.nodos)
      ? [...snapshot.nodos]
      : current?.nodos ?? [];
    const snapshotConnections = Array.isArray(snapshot.conexiones)
      ? this.mergeConnectionsPreservingPorts(
          [...snapshot.conexiones],
          current?.conexiones ?? []
        )
      : current?.conexiones ?? [];
    const nextConnections = this.applyPendingEdgeMutations(snapshotConnections);
    const snapshotLaneOrientation = this.resolveLaneOrientation(
      snapshot.laneOrientation
    );
    const snapshotLaneWidth = this.resolveLaneDimension(snapshot.laneWidth);
    const snapshotLaneHeight = this.resolveLaneDimension(snapshot.laneHeight);

    this.flowStateSubject.next({
      politicaId: policyId,
      secuencia: appliedSequence,
      nodos: nextNodes,
      conexiones: nextConnections,
      laneOrientation: snapshotLaneOrientation ?? current?.laneOrientation,
      laneWidth:
        typeof snapshotLaneWidth === 'number'
          ? snapshotLaneWidth
          : current?.laneWidth,
      laneHeight:
        typeof snapshotLaneHeight === 'number'
          ? snapshotLaneHeight
          : current?.laneHeight,
      updatedAt: snapshot.timestamp ?? new Date().toISOString(),
    });
  }

  private applyPresencePayload(payload: unknown): void {
    if (!payload) {
      return;
    }

    if (Array.isArray(payload)) {
      this.connectedUsersSubject.next(
        this.ensureCurrentActorInPresence(this.normalizePresenceUsers(payload))
      );
      return;
    }

    if (!this.isRecord(payload)) {
      return;
    }

    const rawUsers =
      payload['usuarios'] ??
      payload['usuariosConectados'] ??
      payload['conectados'] ??
      payload['onlineUsers'] ??
      payload['usuariosPresentes'];

    if (!Array.isArray(rawUsers)) {
      return;
    }

    this.connectedUsersSubject.next(
      this.ensureCurrentActorInPresence(this.normalizePresenceUsers(rawUsers))
    );
  }

  private edgeKey(conexion: Conexion): string {
    return `${conexion.origen}->${conexion.destino}`;
  }

  private normalizeEdgePort(value: unknown): EdgePort | null {
    if (
      value === 'LEFT' ||
      value === 'RIGHT' ||
      value === 'TOP' ||
      value === 'BOTTOM'
    ) {
      return value;
    }

    return null;
  }

  private resolveLaneOrientation(value: unknown): LaneOrientation | null {
    if (value === 'VERTICAL' || value === 'HORIZONTAL') {
      return value;
    }

    return null;
  }

  private resolveLaneDimension(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  private mergeConnectionsPreservingPorts(
    incomingConnections: Conexion[],
    currentConnections: Conexion[]
  ): Conexion[] {
    const currentByKey = new Map<string, Conexion>();

    for (const connection of currentConnections) {
      currentByKey.set(this.edgeKey(connection), connection);
    }

    return incomingConnections.map((connection) =>
      this.hydrateEventConnectionPorts(
        connection,
        undefined,
        currentByKey.get(this.edgeKey(connection))
      )
    );
  }

  private encodeEdgePortMetadata(conexion: Conexion): string | null {
    const sourcePort = this.normalizeEdgePort(conexion.puertoOrigen);
    const targetPort = this.normalizeEdgePort(conexion.puertoDestino);

    if (!sourcePort && !targetPort) {
      return null;
    }

    return `${EDGE_PORT_METADATA_PREFIX}${conexion.origen}|${conexion.destino}|${sourcePort ?? ''}|${targetPort ?? ''}`;
  }

  private decodeEdgePortMetadata(
    metadata: string | null | undefined,
    conexion: Conexion
  ): Partial<Conexion> | null {
    if (!metadata || !metadata.startsWith(EDGE_PORT_METADATA_PREFIX)) {
      return null;
    }

    const payload = metadata.slice(EDGE_PORT_METADATA_PREFIX.length);
    const [origen, destino, sourcePortRaw, targetPortRaw] = payload.split('|');

    if (origen !== conexion.origen || destino !== conexion.destino) {
      return null;
    }

    const sourcePort = this.normalizeEdgePort(sourcePortRaw);
    const targetPort = this.normalizeEdgePort(targetPortRaw);

    const next: Partial<Conexion> = {};
    if (sourcePort) {
      next.puertoOrigen = sourcePort;
    }
    if (targetPort) {
      next.puertoDestino = targetPort;
    }

    return next;
  }

  private hydrateEventConnectionPorts(
    conexion: Conexion,
    metadataNodeId?: string,
    existingConnection?: Conexion
  ): Conexion {
    const decodedPorts = this.decodeEdgePortMetadata(metadataNodeId, conexion);

    const sourcePort =
      this.normalizeEdgePort(conexion.puertoOrigen) ??
      this.normalizeEdgePort(decodedPorts?.puertoOrigen) ??
      this.normalizeEdgePort(existingConnection?.puertoOrigen);

    const targetPort =
      this.normalizeEdgePort(conexion.puertoDestino) ??
      this.normalizeEdgePort(decodedPorts?.puertoDestino) ??
      this.normalizeEdgePort(existingConnection?.puertoDestino);

    const hydrated: Conexion = {
      origen: conexion.origen,
      destino: conexion.destino,
    };

    if (sourcePort) {
      hydrated.puertoOrigen = sourcePort;
    }

    if (targetPort) {
      hydrated.puertoDestino = targetPort;
    }

    return hydrated;
  }

  private registerPendingEdgeMutation(
    conexion: Conexion,
    action: PendingEdgeMutation['action']
  ): void {
    this.pendingEdgeMutations.set(this.edgeKey(conexion), {
      action,
      expiresAt: Date.now() + 4000,
      conexion: { ...conexion },
    });
  }

  private clearPendingEdgeMutation(conexion: Conexion): void {
    this.pendingEdgeMutations.delete(this.edgeKey(conexion));
  }

  private applyPendingEdgeMutations(conexiones: Conexion[]): Conexion[] {
    const now = Date.now();
    const activeMutations = new Map<string, PendingEdgeMutation>();

    for (const [key, mutation] of this.pendingEdgeMutations.entries()) {
      if (mutation.expiresAt <= now) {
        this.pendingEdgeMutations.delete(key);
        continue;
      }

      activeMutations.set(key, mutation);
    }

    let nextConnections = [...conexiones];

    for (const [key, mutation] of activeMutations.entries()) {
      const [origen, destino] = key.split('->');
      if (!origen || !destino) {
        continue;
      }

      if (mutation.action === 'ADD') {
        const existingIndex = nextConnections.findIndex(
          (connection) =>
            connection.origen === origen && connection.destino === destino
        );
        if (existingIndex === -1) {
          const hydratedConnection = this.hydrateEventConnectionPorts(
            mutation.conexion
          );
          nextConnections = [...nextConnections, hydratedConnection];
        } else {
          const hydratedConnection = this.hydrateEventConnectionPorts(
            mutation.conexion,
            undefined,
            nextConnections[existingIndex]
          );
          nextConnections = nextConnections.map((connection, index) =>
            index === existingIndex ? hydratedConnection : connection
          );
        }
        continue;
      }

      nextConnections = nextConnections.filter(
        (connection) =>
          !(connection.origen === origen && connection.destino === destino)
      );
    }

    return nextConnections;
  }

  private applyOptimisticCreateEdge(conexion: Conexion): void {
    const current = this.flowStateSubject.value;
    if (!current) {
      return;
    }

    const existingIndex = current.conexiones.findIndex(
      (connection) =>
        connection.origen === conexion.origen &&
        connection.destino === conexion.destino
    );

    if (existingIndex >= 0) {
      const hydratedConnection = this.hydrateEventConnectionPorts(
        conexion,
        undefined,
        current.conexiones[existingIndex]
      );
      const nextConnections = current.conexiones.map((connection, index) =>
        index === existingIndex ? hydratedConnection : connection
      );
      this.flowStateSubject.next({
        ...current,
        conexiones: nextConnections,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const hydratedConnection = this.hydrateEventConnectionPorts(conexion);
    this.flowStateSubject.next({
      ...current,
      conexiones: [...current.conexiones, hydratedConnection],
      updatedAt: new Date().toISOString(),
    });
  }

  private applyOptimisticDeleteEdge(conexion: Conexion): void {
    const current = this.flowStateSubject.value;
    if (!current) {
      return;
    }

    const nextConnections = current.conexiones.filter(
      (connection) =>
        !(
          connection.origen === conexion.origen &&
          connection.destino === conexion.destino
        )
    );

    if (nextConnections.length === current.conexiones.length) {
      return;
    }

    this.flowStateSubject.next({
      ...current,
      conexiones: nextConnections,
      updatedAt: new Date().toISOString(),
    });
  }

  private applyOptimisticMove(nodeId: string, posX: number, posY: number): void {
    const current = this.flowStateSubject.value;
    if (!current) {
      return;
    }

    let hasChanges = false;
    const nextNodes = current.nodos.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }

      if (node.posicionX === posX && node.posicionY === posY) {
        return node;
      }

      hasChanges = true;
      return {
        ...node,
        posicionX: posX,
        posicionY: posY,
        x: posX,
        y: posY,
      };
    });

    if (!hasChanges) {
      return;
    }

    this.flowStateSubject.next({
      ...current,
      nodos: nextNodes,
      updatedAt: new Date().toISOString(),
    });
  }

  private normalizePresenceUsers(users: unknown[]): ColaboracionUsuarioPresente[] {
    const nextUsers: ColaboracionUsuarioPresente[] = [];
    const seenUserIds = new Set<string>();

    for (const user of users) {
      const normalized = this.toPresenceUser(user);
      if (!normalized || seenUserIds.has(normalized.userId)) {
        continue;
      }

      seenUserIds.add(normalized.userId);
      nextUsers.push(normalized);
    }

    return nextUsers;
  }

  private toPresenceUser(value: unknown): ColaboracionUsuarioPresente | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const userId =
      typeof value['userId'] === 'string'
        ? value['userId']
        : typeof value['id'] === 'string'
          ? value['id']
          : null;

    const nombre =
      typeof value['nombre'] === 'string'
        ? value['nombre']
        : typeof value['actorNombre'] === 'string'
          ? value['actorNombre']
          : typeof value['name'] === 'string'
            ? value['name']
            : null;

    if (!userId || !nombre) {
      return null;
    }

    return {
      userId,
      nombre,
      sesionesActivas:
        typeof value['sesionesActivas'] === 'number'
          ? value['sesionesActivas']
          : typeof value['sessions'] === 'number'
            ? value['sessions']
            : 1,
      ultimaActividad:
        typeof value['ultimaActividad'] === 'string'
          ? value['ultimaActividad']
          : typeof value['lastActivity'] === 'string'
            ? value['lastActivity']
            : new Date().toISOString(),
    };
  }

  private ensureCurrentActorInPresence(
    users: ColaboracionUsuarioPresente[]
  ): ColaboracionUsuarioPresente[] {
    if (!this.actor || !this.socket.isConnected()) {
      return users;
    }

    if (users.some((user) => user.userId === this.actor?.userId)) {
      return users;
    }

    return [
      {
        userId: this.actor.userId,
        nombre: this.actor.nombre,
        sesionesActivas: 1,
        ultimaActividad: new Date().toISOString(),
      },
      ...users,
    ];
  }

  private applyNodeLocksPayload(
    payload: unknown
  ): void {
    if (!payload) {
      return;
    }

    if (Array.isArray(payload)) {
      const nextState: ColaboracionNodosBloqueadosState = {};
      for (const lock of payload) {
        if (!this.isNodeLockPayload(lock)) {
          continue;
        }

        if ((lock.editores ?? []).length) {
          nextState[lock.nodeId] = lock;
        }
      }
      this.nodeLocksSubject.next(nextState);
      return;
    }

    if (this.isRecord(payload)) {
      const wrappedLocks = payload['bloqueos'] ?? payload['nodosBloqueados'];
      if (Array.isArray(wrappedLocks)) {
        this.applyNodeLocksPayload(wrappedLocks);
        return;
      }
    }

    if (!this.isNodeLockPayload(payload)) {
      return;
    }

    const currentLocks = this.nodeLocksSubject.value;
    const nextLocks = { ...currentLocks };
    if ((payload.editores ?? []).length) {
      nextLocks[payload.nodeId] = payload;
    } else {
      delete nextLocks[payload.nodeId];
    }
    this.nodeLocksSubject.next(nextLocks);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isNodeLockPayload(
    value: unknown
  ): value is ColaboracionNodoBloqueadoPayload {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value['nodeId'] === 'string' &&
      Array.isArray(value['editores']) &&
      typeof value['advertenciaColision'] === 'boolean'
    );
  }

  private publishEvent(
    payload: Omit<ColaboracionEventoRequest, 'eventId' | 'actorUserId'>
  ): void {
    if (!this.activePolicyId || !this.actor) {
      return;
    }

    const destination = `/app/politicas/${this.activePolicyId}/eventos`;
    const eventId = this.generateEventId();

    const event: ColaboracionEventoRequest = {
      ...payload,
      eventId,
      actorUserId: this.actor.userId,
    };

    // Temporary diagnostics for production socket troubleshooting.
    console.debug('[COLLAB] publishEvent entered');
    console.debug('[COLLAB] publishEvent destination', destination);
    console.debug('[COLLAB] publishEvent payload', event);
    console.debug('[COLLAB] publishEvent eventId', eventId);

    let wasSent = false;
    try {
      wasSent = this.socket.publish(destination, event);
    } catch (error) {
      console.error(
        '[COLLAB] publishEvent failed unexpectedly',
        { destination, event },
        error
      );
      wasSent = false;
    }

    if (!wasSent) {
      this.errorMessagesSubject.next(
        'No hay conexión activa para enviar cambios colaborativos. Intentando re-sync...'
      );
      this.performFullResync('Evento no enviado por desconexión');
    }
  }

  private generateEventId(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return (
      'evt-' +
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2) +
      '-' +
      Math.random().toString(36).slice(2)
    );
  }

  private publishNodeEditing(nodeId: string, editing: boolean): void {
    if (!this.activePolicyId || !this.actor) {
      return;
    }

    this.socket.publish(
      `/app/politicas/${this.activePolicyId}/nodos/edicion`,
      {
        actorUserId: this.actor.userId,
        actorNombre: this.actor.nombre,
        nodeId,
        editing,
      }
    );
  }

  private actorPayload(): { actorUserId: string; actorNombre: string } {
    return {
      actorUserId: this.actor?.userId ?? '',
      actorNombre: this.actor?.nombre ?? 'Usuario',
    };
  }

  private mergeNodePatch(
    node: ColaboracionNodo,
    patch: Partial<ColaboracionNodo>
  ): ColaboracionNodo {
    const merged = {
      ...node,
      ...patch,
    };
    const anyPatch = patch as any;

    // Handle backend posX/posY field names
    if (typeof anyPatch.posX === 'number') {
      merged.posicionX = anyPatch.posX;
      merged.x = anyPatch.posX;
    }
    if (typeof anyPatch.posY === 'number') {
      merged.posicionY = anyPatch.posY;
      merged.y = anyPatch.posY;
    }

    if (typeof patch.x === 'number') {
      merged.posicionX = patch.x;
    }

    if (typeof patch.y === 'number') {
      merged.posicionY = patch.y;
    }

    if (typeof patch.posicionX === 'number') {
      merged.x = patch.posicionX;
    }

    if (typeof patch.posicionY === 'number') {
      merged.y = patch.posicionY;
    }

    return merged;
  }

  private upsertNode(
    nodes: ColaboracionNodo[],
    incomingNode: ColaboracionNodo,
    nodeVersion?: number
  ): ColaboracionNodo[] {
    const normalized = this.normalizeNodePayload(incomingNode) as ColaboracionNodo;
    if (typeof nodeVersion === 'number') {
      normalized.version = nodeVersion;
    }

    const existingIndex = nodes.findIndex((node) => node.id === normalized.id);
    if (existingIndex === -1) {
      return [...nodes, normalized];
    }

    const nextNodes = [...nodes];
    nextNodes[existingIndex] = {
      ...nextNodes[existingIndex],
      ...normalized,
    };
    return nextNodes;
  }

  private normalizeNodePayload(
    node: Partial<ColaboracionNodo>
  ): Partial<ColaboracionNodo> {
    const nextNode: Partial<ColaboracionNodo> = { ...node };
    const anyNode = node as any;

    // Map posX/posY (backend naming) to posicionX/posicionY/x/y
    if (typeof anyNode.posX === 'number' && typeof node.posicionX !== 'number') {
      nextNode.posicionX = anyNode.posX;
    }
    if (typeof anyNode.posY === 'number' && typeof node.posicionY !== 'number') {
      nextNode.posicionY = anyNode.posY;
    }

    if (typeof node.x === 'number' && typeof node.posicionX !== 'number') {
      nextNode.posicionX = node.x;
    }

    if (typeof node.y === 'number' && typeof node.posicionY !== 'number') {
      nextNode.posicionY = node.y;
    }

    if (typeof node.posicionX === 'number' && typeof node.x !== 'number') {
      nextNode.x = node.posicionX;
    }

    if (typeof node.posicionY === 'number' && typeof node.y !== 'number') {
      nextNode.y = node.posicionY;
    }

    return nextNode;
  }

  private handleErrorPayload(errorPayload: ColaboracionErrorPayload): void {
    const message =
      errorPayload.mensaje ||
      errorPayload.detalle ||
      'Se recibió un error de colaboración en vivo.';

    const normalizedMessage = message.toLowerCase();
    const errorCode = String(errorPayload.codigo ?? '').trim();
    const isRecoverableConsistencyError =
      normalizedMessage.includes('secuencia') ||
      normalizedMessage.includes('desactualizado') ||
      normalizedMessage.includes('versi') ||
      normalizedMessage.includes('nodo no encontrado') ||
      normalizedMessage.includes('nodos inexistentes') ||
      normalizedMessage.includes('evento no enviado') ||
      errorCode === '404' ||
      errorCode === '409' ||
      errorCode === '410' ||
      errorCode === '412';

    if (isRecoverableConsistencyError) {
      this.errorMessagesSubject.next(
        'Se detectaron cambios remotos. Sincronizando pizarra...'
      );
      this.performFullResync('Error de consistencia reportado por backend', true);
      return;
    }

    this.errorMessagesSubject.next(message);
  }

  private performFullResync(reason: string, silent = false): void {
    if (!this.activePolicyId || this.resyncInFlight) {
      return;
    }

    const now = Date.now();
    if (now - this.lastResyncAt < 1200) {
      return;
    }
    this.lastResyncAt = now;

    this.resyncInFlight = true;
    if (!silent) {
      this.errorMessagesSubject.next(`Re-sync de colaboración: ${reason}`);
    }

    this.rest
      .getEstado(this.activePolicyId)
      .pipe(
        map((snapshot) => ({
          secuencia:
            snapshot.secuencia ??
            snapshot.secuenciaActual ??
            this.flowStateSubject.value?.secuencia ??
            0,
          laneOrientation: snapshot.laneOrientation,
          laneWidth: snapshot.laneWidth,
          laneHeight: snapshot.laneHeight,
          nodos: snapshot.nodos,
          conexiones: snapshot.conexiones,
          timestamp: snapshot.timestamp,
        })),
        catchError(() =>
          of({
            secuencia: this.flowStateSubject.value?.secuencia ?? 0,
            laneOrientation: this.flowStateSubject.value?.laneOrientation,
            laneWidth: this.flowStateSubject.value?.laneWidth,
            laneHeight: this.flowStateSubject.value?.laneHeight,
            nodos: this.flowStateSubject.value?.nodos ?? [],
            conexiones: this.flowStateSubject.value?.conexiones ?? [],
            timestamp: new Date().toISOString(),
          })
        )
      )
      .subscribe({
        next: (snapshot) => {
          this.applySnapshot({
            secuencia: snapshot.secuencia,
            laneOrientation: snapshot.laneOrientation,
            laneWidth: snapshot.laneWidth,
            laneHeight: snapshot.laneHeight,
            nodos: snapshot.nodos,
            conexiones: snapshot.conexiones,
            timestamp: snapshot.timestamp,
          }, { force: true });

          if (this.activePolicyId) {
            this.socket.publish(
              `/app/politicas/${this.activePolicyId}/sync`,
              this.actorPayload()
            );
          }

          this.resyncInFlight = false;
        },
        error: () => {
          if (!silent) {
            this.errorMessagesSubject.next(
              'No se pudo completar el re-sync colaborativo.'
            );
          }
          this.resyncInFlight = false;
        },
      });
  }

  private extractPolicyEstado(snapshot: ColaboracionEstadoSnapshot): EstadoPolitica | null {
    const raw = snapshot as unknown as Record<string, unknown>;

    const directEstado =
      this.normalizeEstadoPolitica(raw['estado']) ??
      this.normalizeEstadoPolitica(raw['estadoPolitica']) ??
      this.normalizeEstadoPolitica(raw['status']) ??
      this.normalizeEstadoPolitica(raw['policyStatus']);

    if (directEstado) {
      return directEstado;
    }

    const politicaRaw = raw['politica'];
    if (typeof politicaRaw === 'object' && politicaRaw !== null) {
      const politicaRecord = politicaRaw as Record<string, unknown>;
      return (
        this.normalizeEstadoPolitica(politicaRecord['estado']) ??
        this.normalizeEstadoPolitica(politicaRecord['status'])
      );
    }

    return null;
  }

  private normalizeEstadoPolitica(value: unknown): EstadoPolitica | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toUpperCase();
    if (
      normalized === 'BORRADOR' ||
      normalized === 'ACTIVA' ||
      normalized === 'PAUSADA' ||
      normalized === 'DESHABILITADA'
    ) {
      return normalized;
    }

    return null;
  }

  private rememberEvent(eventId: string): void {
    this.rememberedEventIds.add(eventId);
    this.rememberedEventQueue.push(eventId);

    if (this.rememberedEventQueue.length <= MAX_REMEMBERED_EVENTS) {
      return;
    }

    const oldest = this.rememberedEventQueue.shift();
    if (!oldest) {
      return;
    }

    this.rememberedEventIds.delete(oldest);
  }
}
