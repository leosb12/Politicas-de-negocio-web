import {
  Component,
  OnInit,
  OnDestroy,
  effect,
  signal,
  inject,
  computed,
  ElementRef,
  ViewChild,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PoliticaService } from '../../services/politica.service';
import { AdministradorDepartamentosService } from '../../services/administrador-departamentos.service';
import { AdministradorUsuariosService } from '../../services/administrador-usuarios.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import {
  PoliticaNegocio,
  Nodo,
  NodoCanvas,
  Conexion,
  TipoNodo,
  TipoCampo,
  CampoFormulario,
  CondicionDecision,
  EstadoPolitica,
  ResponsableTipo,
  GrupoCondicionDecision,
  ReglaCondicionDecision,
  OperadorCondicionDecision,
  OperadorLogicoDecision,
} from '../../models/politica.model';
import {
  ColaboracionNodosBloqueadosState,
  ColaboracionNodo,
  ColaboracionNodoBloqueadoPayload,
  ColaboracionUsuarioPresente,
  SocketConnectionState,
} from '../../models/politica-colaboracion.model';
import { AdministradorDepartamento } from '../../models/administrador-departamento.model';
import { AdministradorUsuario } from '../../models/administrador-usuario.model';
import { FindNodePipe } from '../../pipes/find-node.pipe';
import { PoliticaColaboracionFacadeService } from '../../services/politica-colaboracion-facade.service';
import { IaGeneradorFlujoComponent } from '../../components/ia-generador-flujo/ia-generador-flujo';
import { AdministradorGuiaContextService } from '../../services/administrador-guia-context.service';
import { IaFlujoMapperService } from '../../services/ia-flujo-mapper.service';
import { IaFlujoResponse } from '../../models/ia-flujo.model';

// ── Drag state ───────────────────────────────────────────────────
interface DragState {
  nodeId: string;
  startMouseX: number;
  startMouseY: number;
  startNodeX: number;
  startNodeY: number;
}

interface LaneResizeState {
  startMouseX: number;
  startMouseY: number;
  startLaneWidth: number;
  startLaneHeight: number;
  initialActivityPositions: Record<string, { x: number; y: number }>;
}

// ── Connection drawing state ──────────────────────────────────────
interface ConnectState {
  fromNodeId: string;
  fromPort: ConnectionPort;
  currentX: number;
  currentY: number;
}

type ConnectionPort = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
type ConnectionTargetPort = ConnectionPort;
type LaneOrientation = 'HORIZONTAL' | 'VERTICAL';

interface FlujoPayload {
  nodos: Nodo[];
  conexiones: Conexion[];
  laneOrientation?: LaneOrientation | null;
  laneWidth?: number | null;
  laneHeight?: number | null;
}

interface PendingFlowBackup {
  savedAt: string;
  payload: FlujoPayload;
}

interface CanvasUiPrefsBackup {
  connectionSourcePorts?: Record<string, ConnectionPort>;
  connectionTargetPorts?: Record<string, ConnectionTargetPort>;
}

interface DeferredCollaborativeFlow {
  signature: string;
}

interface PendingNodeNameGuard {
  nombre: string;
  expiresAt: number;
}

interface PendingNodeMoveGuard {
  x: number;
  y: number;
  expiresAt: number;
  version?: number;
}

interface PendingLaneConfigGuard {
  laneOrientation: LaneOrientation;
  laneWidth: number;
  laneHeight: number;
  expiresAt: number;
}

// ── Node palette item ─────────────────────────────────────────────
interface PaletteItem {
  tipo: TipoNodo;
  label: string;
  icon: string;
  color: string;
  description: string;
}

interface DecisionOperatorOption {
  value: OperadorCondicionDecision;
  label: string;
  requiresValue: boolean;
}

interface DecisionRuleBuilderRow {
  id: string;
  campo: string;
  operador: OperadorCondicionDecision;
  valor: string;
}

interface DecisionGroupBuilder {
  id: string;
  operadorLogico: OperadorLogicoDecision;
  reglas: DecisionRuleBuilderRow[];
  grupos: DecisionGroupBuilder[];
}

interface DecisionBuilderState {
  sourceActivityId: string | null;
  group: DecisionGroupBuilder;
}

interface DecisionConditionDraft {
  origenActividadId: string | null;
  grupo: GrupoCondicionDecision;
}

import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-canvas-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FindNodePipe,
    SlicePipe,
    LucideAngularModule,
    IaGeneradorFlujoComponent,
  ],
  templateUrl: './canvas-designer.html',
  styleUrl: './canvas-designer.css',
})
export class CanvasDesignerComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl') canvasEl!: ElementRef<SVGElement>;
  @ViewChild('canvasWrap') canvasWrap!: ElementRef<HTMLDivElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc = inject(PoliticaService);
  private readonly deptSvc = inject(AdministradorDepartamentosService);
  private readonly userSvc = inject(AdministradorUsuariosService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly collabFacade = inject(PoliticaColaboracionFacadeService);
  private readonly guideContext = inject(AdministradorGuiaContextService);
  private readonly iaMapperService = inject(IaFlujoMapperService);

  // ── State ─────────────────────────────────────────────────────
  politica = signal<PoliticaNegocio | null>(null);
  loading = signal(true);
  saving = signal(false);
  departamentos = signal<AdministradorDepartamento[]>([]);
  usuarios = signal<AdministradorUsuario[]>([]);
  connectedUsers = signal<ColaboracionUsuarioPresente[]>([]);
  nodeSoftLocks = signal<ColaboracionNodosBloqueadosState>({});
  collaborationConnectionState = signal<SocketConnectionState>('DISCONNECTED');

  nodos = signal<NodoCanvas[]>([]);
  conexiones = signal<Conexion[]>([]);
  connectionTargetPorts = signal<Record<string, ConnectionTargetPort>>({});
  connectionSourcePorts = signal<Record<string, ConnectionPort>>({});

  selectedNodeId = signal<string | null>(null);
  connectState = signal<ConnectState | null>(null);
  dragState: DragState | null = null;
  laneResizeState: LaneResizeState | null = null;

  readonly CANVAS_WIDTH = 100_000;
  readonly CANVAS_HEIGHT = 100_000;
  readonly CANVAS_ORIGIN_X = 50_000;
  readonly CANVAS_ORIGIN_Y = 50_000;

  // ── View ──────────────────────────────────────────────────────
  zoom = signal(1);
  panX = signal(-this.CANVAS_ORIGIN_X);
  panY = signal(-this.CANVAS_ORIGIN_Y);
  isPanning = false;
  panMoved = false;
  panStart = { x: 0, y: 0, px: 0, py: 0 };

  showSidebar = signal(false);
  showIaFlujoModal = signal(false);
  isApplyingIaFlujo = signal(false);
  sidebarNode = computed(() =>
    this.nodos().find((n) => n.id === this.selectedNodeId()) ?? null
  );
  selectedNodeLock = computed(() => {
    const selectedNodeId = this.selectedNodeId();
    if (!selectedNodeId) {
      return null;
    }

    return this.nodeSoftLocks()[selectedNodeId] ?? null;
  });
  selectedNodeCollisionWarning = computed(() => {
    const lock = this.selectedNodeLock();
    if (!lock || !lock.editores?.length) {
      return null;
    }

    const otherEditors = lock.editores.filter(
      (editor) => editor.userId !== this.currentUserId()
    );

    if (!otherEditors.length) {
      return null;
    }

    if (lock.advertenciaColision || otherEditors.length > 1) {
      return lock.aviso || 'Edición concurrente detectada en este nodo.';
    }

    return `${otherEditors[0].nombre} está editando este nodo.`;
  });
  collaborationStatusLabel = computed(() => {
    const status = this.collaborationConnectionState();
    if (status === 'CONNECTED') return 'En vivo';
    if (status === 'RECONNECTING') return 'Reconectando';
    if (status === 'CONNECTING') return 'Conectando';
    return 'Desconectado';
  });
  readonly isCanvasReadOnly = computed(() => this.politicaEstado === 'ACTIVA');
  readonly canvasReadOnlyMessage =
    'La politica esta activa. La pizarra esta en modo solo visual.';

  responsableItems = computed(() => {
    const node = this.sidebarNode();
    if (!node || node.tipo !== 'ACTIVIDAD') return [];
    if (node.responsableTipo === 'USUARIO') {
      return this.usuarios()
        .filter(
          (u) =>
            Boolean(u.activo) &&
            typeof u.rol === 'string' &&
            u.rol.trim().toUpperCase() === 'FUNCIONARIO'
        )
        .map((u) => ({ id: u.id, nombre: u.nombre }));
    }
    if (node.responsableTipo === 'DEPARTAMENTO') {
      return this.departamentos().map(d => ({ id: d.id, nombre: d.nombre }));
    }
    return [];
  });

  tiposNodoOptions: TipoNodo[] = ['INICIO', 'ACTIVIDAD', 'DECISION', 'FORK', 'JOIN', 'FIN'];

  // ── Palette ───────────────────────────────────────────────────
  palette: PaletteItem[] = [
    { tipo: 'INICIO', label: 'Inicio', icon: 'play', color: '#4ade80', description: 'Punto de entrada del flujo' },
    { tipo: 'ACTIVIDAD', label: 'Actividad', icon: 'square', color: '#6366f1', description: 'Tarea asignada a un departamento' },
    { tipo: 'DECISION', label: 'Decisión', icon: 'diamond', color: '#f59e0b', description: 'Bifurcación condicional del flujo' },
    { tipo: 'FORK', label: 'Fork', icon: 'split', color: '#06b6d4', description: 'Divide en procesos paralelos' },
    { tipo: 'JOIN', label: 'Join', icon: 'merge', color: '#06b6d4', description: 'Une procesos paralelos' },
    { tipo: 'FIN', label: 'Fin', icon: 'stop-circle', color: '#f43f5e', description: 'Punto de cierre del flujo' },
  ];

  tipoCampoOptions: TipoCampo[] = ['TEXTO', 'NUMERO', 'BOOLEANO', 'ARCHIVO', 'FECHA'];

  readonly decisionLogicalOperatorOptions: Array<{
    value: OperadorLogicoDecision;
    label: string;
  }> = [
    { value: 'AND', label: 'Cumplir todas (AND)' },
    { value: 'OR', label: 'Cumplir alguna (OR)' },
  ];

  private readonly decisionOperatorCatalog: Record<
    TipoCampo,
    DecisionOperatorOption[]
  > = {
    TEXTO: [
      { value: 'IGUAL', label: 'Es igual a', requiresValue: true },
      { value: 'DISTINTO', label: 'Es distinto de', requiresValue: true },
      { value: 'CONTIENE', label: 'Contiene', requiresValue: true },
      { value: 'NO_CONTIENE', label: 'No contiene', requiresValue: true },
      { value: 'INICIA_CON', label: 'Inicia con', requiresValue: true },
      { value: 'TERMINA_CON', label: 'Termina con', requiresValue: true },
      { value: 'ESTA_VACIO', label: 'Esta vacio', requiresValue: false },
      { value: 'NO_ESTA_VACIO', label: 'No esta vacio', requiresValue: false },
    ],
    NUMERO: [
      { value: 'IGUAL', label: 'Es igual a', requiresValue: true },
      { value: 'DISTINTO', label: 'Es distinto de', requiresValue: true },
      { value: 'MAYOR_QUE', label: 'Es mayor que', requiresValue: true },
      { value: 'MAYOR_O_IGUAL', label: 'Es mayor o igual', requiresValue: true },
      { value: 'MENOR_QUE', label: 'Es menor que', requiresValue: true },
      { value: 'MENOR_O_IGUAL', label: 'Es menor o igual', requiresValue: true },
      { value: 'ESTA_VACIO', label: 'Esta vacio', requiresValue: false },
      { value: 'NO_ESTA_VACIO', label: 'No esta vacio', requiresValue: false },
    ],
    BOOLEANO: [
      { value: 'ES_VERDADERO', label: 'Es verdadero', requiresValue: false },
      { value: 'ES_FALSO', label: 'Es falso', requiresValue: false },
      { value: 'IGUAL', label: 'Es igual a', requiresValue: true },
      { value: 'DISTINTO', label: 'Es distinto de', requiresValue: true },
    ],
    FECHA: [
      { value: 'ANTES_DE', label: 'Es antes de', requiresValue: true },
      { value: 'DESPUES_DE', label: 'Es despues de', requiresValue: true },
      { value: 'EN_FECHA', label: 'Es exactamente', requiresValue: true },
      { value: 'ESTA_VACIO', label: 'Esta vacio', requiresValue: false },
      { value: 'NO_ESTA_VACIO', label: 'No esta vacio', requiresValue: false },
    ],
    ARCHIVO: [
      { value: 'ESTA_VACIO', label: 'No se adjunto archivo', requiresValue: false },
      { value: 'NO_ESTA_VACIO', label: 'Tiene archivo adjunto', requiresValue: false },
      { value: 'CONTIENE', label: 'Nombre contiene', requiresValue: true },
      { value: 'NO_CONTIENE', label: 'Nombre no contiene', requiresValue: true },
    ],
  };

  decisionBuilderVisible = false;
  decisionBuilderNodeId: string | null = null;
  decisionBuilderState: DecisionBuilderState | null = null;
  decisionConditionPreviewState = signal<Record<string, boolean>>({});
  decisionConditionDraftState = signal<Record<string, DecisionConditionDraft>>({});

  // ── New campo form ────────────────────────────────────────────
  newCampo = { campo: '', tipo: 'TEXTO' as TipoCampo };
  newCondicion = { resultado: '', siguiente: '' };

  // ── Swimlane / Dept control ────────────────────────────────────
  showDeptModal = signal(false);
  pendingNodeFromPalette: { tipo: TipoNodo; x: number; y: number } | null = null;
  laneOrientation = signal<LaneOrientation>('VERTICAL');
  laneWidth = signal(320);
  laneHeight = signal(220);
  isVerticalLaneOrientation = computed(() => this.laneOrientation() === 'VERTICAL');

  creatingNewDept = signal(false);
  newDeptName = signal('');
  savingDept = signal(false);

  editingDeptId = signal<string | null>(null);
  editDeptName = signal('');

  private idCounter = 0;
  private lastCollabErrorMessage = '';
  private lastCollabErrorAt = 0;
  private lastReadOnlyToastAt = 0;
  private policyEstadoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private policyEstadoSyncInFlight = false;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveQueued = false;
  private lastSavedDraftSignature = '';
  private readonly pendingFlowStorageKeyPrefix = 'canvas-designer-pending-flow:';
  private readonly uiPrefsStorageKeyPrefix = 'canvas-designer-ui:';
  private readonly beforeUnloadHandler = (): void => {
    this.backupUnsavedDraftLocally();
  };
  private readonly storageSyncHandler = (event: StorageEvent): void => {
    this.handleUiPrefsStorageSync(event);
  };
  private pendingNodeMoveGuards = new Map<string, PendingNodeMoveGuard>();
  private pendingNodeNameSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingNodeNameGuards = new Map<string, PendingNodeNameGuard>();
  private pendingLaneConfigGuard: PendingLaneConfigGuard | null = null;
  private readonly nodeNameSyncDebounceMs = 280;
  private readonly nodeNameGuardTtlMs = 1200;
  private readonly nodeMoveGuardTtlMs = 5000;
  private readonly autoSaveProtectionMs = 1400;
  private lastAutoSaveQueuedAt = 0;
  private readonly RESPONSABLE_USUARIO_FINAL_ID = '__RESPONSABLE_USUARIO_FINAL__';
  private readonly RESPONSABLE_INICIADOR_TRAMITE_ID = '__RESPONSABLE_INICIADOR_TRAMITE__';
  private readonly laneConfigGuardTtlMs = 1800;
  private readonly laneConfigSyncIntervalMs = 120;
  private lastLaneConfigSyncAt = 0;
  private deferredCollaborativeFlow: DeferredCollaborativeFlow | null = null;
  readonly MIN_LANE_WIDTH = 220;
  readonly MAX_LANE_WIDTH = 960;
  readonly MIN_LANE_HEIGHT = 140;
  readonly MAX_LANE_HEIGHT = 680;

  constructor() {
    effect(() => {
      const policy = this.politica();
      const selectedNodeId = this.selectedNodeId();
      const availableActions = this.buildGuideAvailableActions();

      this.guideContext.updateDesignerContext({
        policyId: policy?.id ?? null,
        selectedNodeId,
        availableActions,
      });
    });
  }

  // ── Computed ──────────────────────────────────────────────────
  swimlanes = computed(() => {
    const depts = this.departamentos();
    const deptById = new Map(depts.map((d) => [d.id, d]));
    const activityNodes = this.nodos().filter((n) => n.tipo === 'ACTIVIDAD');

    const laneIds: string[] = [];
    const laneIdSet = new Set<string>();
    const laneNodesByDept = new Map<string, NodoCanvas[]>();

    const addLane = (deptId: string | null | undefined): void => {
      if (!deptId || !deptById.has(deptId) || laneIdSet.has(deptId)) {
        return;
      }
      laneIdSet.add(deptId);
      laneIds.push(deptId);
    };

    for (const node of activityNodes) {
      const deptId = node.departamentoId;
      if (!deptId || !deptById.has(deptId)) {
        continue;
      }

      const existingNodes = laneNodesByDept.get(deptId) ?? [];
      laneNodesByDept.set(deptId, [...existingNodes, node]);
      addLane(deptId);
    }

    return laneIds.map((deptId) => ({
      id: deptId,
      label: deptById.get(deptId)?.nombre ?? deptId,
      color: this.deptColor(deptId),
      nodes: laneNodesByDept.get(deptId) ?? [],
    }));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/admin/politicas']); return; }

    this.bindCollaborationStreams();

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
      window.addEventListener('storage', this.storageSyncHandler);
    }

    // Load departments
    this.deptSvc.getDepartments().subscribe({
      next: (d) => {
        this.departamentos.set(d);
        this.enforceActivitiesAssignedToLane();
      },
    });
    // Load users
    this.userSvc.getUsers().subscribe({ next: (u) => this.usuarios.set(u) });

    this.svc.getById(id).subscribe({
      next: (p) => {
        this.setPoliticaState(p);
        this.hydrateCanvas(p);
        this.startCollaborationSession(p.id);
        this.startPolicyEstadoSync();
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error', 'No se pudo cargar la política');
        this.router.navigate(['/admin/politicas']);
      },
    });
  }

  ngOnDestroy(): void {
    this.guideContext.clearDesignerContext();

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('storage', this.storageSyncHandler);
    }

    this.backupUnsavedDraftLocally();
    this.stopPolicyEstadoSync();

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.autoSaveQueued) {
      this.flushAutoSave();
    }

    for (const timer of this.pendingNodeNameSyncTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingNodeNameSyncTimers.clear();
    this.pendingNodeNameGuards.clear();

    this.collabFacade.stopSession(true);
  }

  private backupUnsavedDraftLocally(): void {
    const policyId = this.politica()?.id;
    if (!policyId) {
      return;
    }

    this.persistUiPreferences(policyId);

    const signature = this.buildDraftSignature();
    if (this.autoSaveQueued || signature !== this.lastSavedDraftSignature) {
      this.persistPendingFlowBackup(policyId, this.buildFlujoPayload());
    }
  }

  private bindCollaborationStreams(): void {
    this.collabFacade.flowState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((flowState) => {
        if (!flowState) {
          return;
        }

        if (flowState.politicaId !== this.politica()?.id) {
          return;
        }

        this.applyCollaborativeFlow(
          flowState.nodos,
          flowState.conexiones,
          flowState.laneOrientation,
          flowState.laneWidth,
          flowState.laneHeight
        );
      });

    this.collabFacade.politicaEstado$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) => {
        if (!estado) {
          return;
        }

        const currentPolicy = this.politica();
        if (!currentPolicy || currentPolicy.estado === estado) {
          return;
        }

        this.setPoliticaState({
          ...currentPolicy,
          estado,
        });
      });

    this.collabFacade.connectedUsers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        this.connectedUsers.set(users);
        this.syncPolicyEstadoFromBackend();
      });

    this.collabFacade.nodeLocks$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((locks) => {
        this.nodeSoftLocks.set(locks);
      });

    this.collabFacade.connectionState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        this.collaborationConnectionState.set(status);
        if (status === 'CONNECTED') {
          this.syncPolicyEstadoFromBackend();
        }
      });

    this.collabFacade.errorMessages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => {
        const now = Date.now();
        const normalizedMessage = message.toLowerCase();
        const isAutoSyncNotice = normalizedMessage.includes(
          'sincronizando pizarra'
        );
        if (
          message === this.lastCollabErrorMessage &&
          now - this.lastCollabErrorAt < 2500
        ) {
          return;
        }

        this.lastCollabErrorMessage = message;
        this.lastCollabErrorAt = now;

        if (isAutoSyncNotice) {
          this.toast.info('Colaboración', message);
          return;
        }

        this.toast.error('Colaboración', message);
      });
  }

  private startPolicyEstadoSync(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.stopPolicyEstadoSync();
    this.policyEstadoSyncTimer = setInterval(() => {
      this.syncPolicyEstadoFromBackend();
    }, 1500);

    this.syncPolicyEstadoFromBackend();
  }

  private stopPolicyEstadoSync(): void {
    if (this.policyEstadoSyncTimer) {
      clearInterval(this.policyEstadoSyncTimer);
      this.policyEstadoSyncTimer = null;
    }

    this.policyEstadoSyncInFlight = false;
  }

  private syncPolicyEstadoFromBackend(): void {
    const currentPolicy = this.politica();
    if (!currentPolicy || this.policyEstadoSyncInFlight) {
      return;
    }

    if (this.collaborationConnectionState() === 'DISCONNECTED') {
      return;
    }

    this.policyEstadoSyncInFlight = true;
    this.svc.getById(currentPolicy.id).subscribe({
      next: (remotePolicy) => {
        const localPolicy = this.politica();
        if (!localPolicy) {
          return;
        }

        const nextLaneOrientation =
          remotePolicy.laneOrientation === 'HORIZONTAL' ||
          remotePolicy.laneOrientation === 'VERTICAL'
            ? remotePolicy.laneOrientation
            : localPolicy.laneOrientation;
        const nextLaneWidth =
          typeof remotePolicy.laneWidth === 'number'
            ? this.normalizeLaneWidth(remotePolicy.laneWidth)
            : localPolicy.laneWidth;
        const nextLaneHeight =
          typeof remotePolicy.laneHeight === 'number'
            ? this.normalizeLaneHeight(remotePolicy.laneHeight)
            : localPolicy.laneHeight;

        const laneConfigChanged =
          nextLaneOrientation !== localPolicy.laneOrientation ||
          nextLaneWidth !== localPolicy.laneWidth ||
          nextLaneHeight !== localPolicy.laneHeight;
        const estadoChanged = remotePolicy.estado !== localPolicy.estado;

        if (!estadoChanged && !laneConfigChanged) {
          return;
        }

        this.setPoliticaState({
          ...localPolicy,
          estado: remotePolicy.estado,
          laneOrientation: nextLaneOrientation,
          laneWidth: nextLaneWidth,
          laneHeight: nextLaneHeight,
        });
      },
      error: () => {
        // Silent fallback; websocket stream remains the primary source.
      },
      complete: () => {
        this.policyEstadoSyncInFlight = false;
      },
    });
  }

  private startCollaborationSession(politicaId: string): void {
    this.pendingNodeMoveGuards.clear();

    const session = this.auth.obtenerSesion();
    if (!session?.id) {
      this.toast.error(
        'Colaboración',
        'No se detectó la sesión del administrador para habilitar tiempo real.'
      );
      return;
    }

    this.collabFacade.startSession({
      politicaId,
      actor: {
        userId: session.id,
        nombre: session.nombre,
      },
      initialNodos: this.nodos().map((node) => this.toCollaborativeNode(node)),
      initialConexiones: this.withResolvedConnectionPorts(this.conexiones()),
      initialLaneOrientation: this.laneOrientation(),
      initialLaneWidth: this.laneWidth(),
      initialLaneHeight: this.laneHeight(),
    });
  }

  private applyCollaborativeFlow(
    rawNodes: ColaboracionNodo[],
    connections: Conexion[],
    laneOrientation?: LaneOrientation,
    laneWidth?: number,
    laneHeight?: number
  ): void {
    if (!this.laneResizeState) {
      this.applyCollaborativeLaneConfig(laneOrientation, laneWidth, laneHeight);
    }

    const resolvedConnections = this.withResolvedConnectionPorts(connections);
    const currentNodesById = new Map(this.nodos().map((node) => [node.id, node]));
    const canvasNodes = rawNodes.map((node, index) => {
      const incomingNode = this.toCanvasNode(node, index);
      const guardedNode = this.applyStaleNodeVersionGuard(
        incomingNode,
        currentNodesById.get(incomingNode.id)
      );

      return this.applyPendingNodeNameGuard(
        this.applyPendingMoveGuard(guardedNode)
      );
    });

    const incomingSignature = this.buildFlowSyncSignature(
      canvasNodes,
      resolvedConnections
    );
    const currentSignature = this.buildFlowSyncSignature(
      this.nodos(),
      this.withResolvedConnectionPorts(this.conexiones())
    );

    if (
      this.shouldProtectLocalFlowFromRemoteSnapshot() &&
      incomingSignature !== currentSignature
    ) {
      this.deferredCollaborativeFlow = {
        signature: incomingSignature,
      };
      return;
    }

    this.deferredCollaborativeFlow = null;
    this.applyCollaborativeCanvasState(canvasNodes, resolvedConnections);
  }

  private applyCollaborativeLaneConfig(
    laneOrientation?: LaneOrientation,
    laneWidth?: number,
    laneHeight?: number
  ): void {
    if (
      this.shouldIgnoreIncomingLaneConfig(
        laneOrientation,
        laneWidth,
        laneHeight
      )
    ) {
      return;
    }

    let configChanged = false;

    if (
      (laneOrientation === 'HORIZONTAL' || laneOrientation === 'VERTICAL') &&
      laneOrientation !== this.laneOrientation()
    ) {
      this.laneOrientation.set(laneOrientation);
      configChanged = true;
    }

    if (typeof laneWidth === 'number') {
      const normalizedWidth = this.normalizeLaneWidth(laneWidth);
      if (normalizedWidth !== this.laneWidth()) {
        this.laneWidth.set(normalizedWidth);
        configChanged = true;
      }
    }

    if (typeof laneHeight === 'number') {
      const normalizedHeight = this.normalizeLaneHeight(laneHeight);
      if (normalizedHeight !== this.laneHeight()) {
        this.laneHeight.set(normalizedHeight);
        configChanged = true;
      }
    }

    if (configChanged) {
      this.enforceActivitiesAssignedToLane();
    }
  }

  private shouldIgnoreIncomingLaneConfig(
    laneOrientation?: LaneOrientation,
    laneWidth?: number,
    laneHeight?: number
  ): boolean {
    const guard = this.pendingLaneConfigGuard;
    if (!guard) {
      return false;
    }

    if (Date.now() > guard.expiresAt) {
      this.pendingLaneConfigGuard = null;
      return false;
    }

    const hasOrientation =
      laneOrientation === 'HORIZONTAL' || laneOrientation === 'VERTICAL';
    const hasWidth = typeof laneWidth === 'number' && Number.isFinite(laneWidth);
    const hasHeight =
      typeof laneHeight === 'number' && Number.isFinite(laneHeight);

    if (!hasOrientation && !hasWidth && !hasHeight) {
      return false;
    }

    const orientationMatches =
      !hasOrientation || laneOrientation === guard.laneOrientation;
    const widthMatches =
      !hasWidth || this.normalizeLaneWidth(laneWidth) === guard.laneWidth;
    const heightMatches =
      !hasHeight || this.normalizeLaneHeight(laneHeight) === guard.laneHeight;

    if (orientationMatches && widthMatches && heightMatches) {
      this.pendingLaneConfigGuard = null;
      return false;
    }

    return true;
  }

  private syncLaneConfigFromPolicy(policy: PoliticaNegocio): void {
    if (this.laneResizeState) {
      return;
    }

    this.applyCollaborativeLaneConfig(
      policy.laneOrientation === 'HORIZONTAL' || policy.laneOrientation === 'VERTICAL'
        ? policy.laneOrientation
        : undefined,
      typeof policy.laneWidth === 'number' ? policy.laneWidth : undefined,
      typeof policy.laneHeight === 'number' ? policy.laneHeight : undefined
    );
  }

  private emitLaneConfigSync(force = false): void {
    const laneOrientation = this.laneOrientation();
    const laneWidth = this.laneWidth();
    const laneHeight = this.laneHeight();

    if (!force) {
      const now = Date.now();
      if (now - this.lastLaneConfigSyncAt < this.laneConfigSyncIntervalMs) {
        return;
      }
      this.lastLaneConfigSyncAt = now;
    } else {
      const now = Date.now();
      this.lastLaneConfigSyncAt = now;
      this.pendingLaneConfigGuard = {
        laneOrientation,
        laneWidth,
        laneHeight,
        expiresAt: now + this.laneConfigGuardTtlMs,
      };
    }

    this.collabFacade.emitUpdateCanvasConfig({
      laneOrientation,
      laneWidth,
      laneHeight,
    }, {
      requestSnapshot: false,
    });
  }

  private shouldProtectLocalFlowFromRemoteSnapshot(): boolean {
    const shouldProtectQueuedDraft =
      this.autoSaveQueued &&
      Date.now() - this.lastAutoSaveQueuedAt < this.autoSaveProtectionMs;

    return (
      this.saving() ||
      shouldProtectQueuedDraft ||
      this.autoSaveTimer !== null ||
      this.pendingNodeNameSyncTimers.size > 0
    );
  }

  private applyPendingNodeNameGuard(node: NodoCanvas): NodoCanvas {
    const guard = this.pendingNodeNameGuards.get(node.id);
    if (!guard) {
      return node;
    }

    if (Date.now() > guard.expiresAt) {
      this.pendingNodeNameGuards.delete(node.id);
      return node;
    }

    if (node.nombre === guard.nombre) {
      this.pendingNodeNameGuards.delete(node.id);
      return node;
    }

    return {
      ...node,
      nombre: guard.nombre,
    };
  }

  private setPendingNodeNameGuard(nodeId: string, nombre: string): void {
    this.pendingNodeNameGuards.set(nodeId, {
      nombre,
      expiresAt: Date.now() + this.nodeNameGuardTtlMs,
    });
  }

  private emitNodeNameSync(nodeId: string): void {
    const node = this.nodos().find((n) => n.id === nodeId);
    if (!node) {
      this.pendingNodeNameGuards.delete(nodeId);
      return;
    }

    const nombre = node.nombre ?? '';
    this.setPendingNodeNameGuard(nodeId, nombre);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { nombre }
    );
  }

  private scheduleNodeNameSync(nodeId: string): void {
    const currentTimer = this.pendingNodeNameSyncTimers.get(nodeId);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    const timer = setTimeout(() => {
      this.pendingNodeNameSyncTimers.delete(nodeId);
      this.emitNodeNameSync(nodeId);
    }, this.nodeNameSyncDebounceMs);

    this.pendingNodeNameSyncTimers.set(nodeId, timer);
  }

  flushNodeNameSync(nodeId: string): void {
    const timer = this.pendingNodeNameSyncTimers.get(nodeId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.pendingNodeNameSyncTimers.delete(nodeId);
    this.emitNodeNameSync(nodeId);
  }

  private buildFlowSyncSignature(
    nodes: NodoCanvas[],
    connections: Conexion[]
  ): string {
    const normalizedNodes = [...nodes]
      .map((node) => ({
        id: node.id,
        tipo: node.tipo,
        nombre: node.nombre,
        departamentoId: node.departamentoId ?? null,
        responsableTipo: node.responsableTipo ?? null,
        responsableId: node.responsableId ?? null,
        x: Math.round(node.x * 100) / 100,
        y: Math.round(node.y * 100) / 100,
        formulario: (node.formulario ?? []).map((campo) => ({
          campo: campo.campo,
          tipo: campo.tipo,
        })),
        condiciones: (node.condiciones ?? []).map((condicion) => ({
          resultado: condicion.resultado,
          siguiente: condicion.siguiente,
          origenActividadId: condicion.origenActividadId ?? null,
          grupo: condicion.grupo ?? null,
        })),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const normalizedConnections = [...connections]
      .map((connection) => ({
        origen: connection.origen,
        destino: connection.destino,
        puertoOrigen: this.normalizeConnectionPort(connection.puertoOrigen) ?? null,
        puertoDestino: this.normalizeConnectionPort(connection.puertoDestino) ?? null,
      }))
      .sort((a, b) => {
        const keyA = this.connectionKey(a.origen, a.destino);
        const keyB = this.connectionKey(b.origen, b.destino);
        return keyA.localeCompare(keyB);
      });

    return JSON.stringify({
      nodos: normalizedNodes,
      conexiones: normalizedConnections,
    });
  }

  private applyCollaborativeCanvasState(
    canvasNodes: NodoCanvas[],
    resolvedConnections: Conexion[]
  ): void {
    this.nodos.set(canvasNodes);
    this.reconcileDecisionConditionDrafts(canvasNodes);
    this.conexiones.set(resolvedConnections);
    this.initializeConnectionPorts(canvasNodes, resolvedConnections);

    const selectedNodeId = this.selectedNodeId();
    if (selectedNodeId && !canvasNodes.some((node) => node.id === selectedNodeId)) {
      this.deselectAll();
    }
  }

  private tryApplyDeferredCollaborativeFlow(): void {
    if (this.shouldProtectLocalFlowFromRemoteSnapshot()) {
      return;
    }

    const deferredFlow = this.deferredCollaborativeFlow;
    if (!deferredFlow) {
      return;
    }
    this.deferredCollaborativeFlow = null;

    const currentSignature = this.buildFlowSyncSignature(
      this.nodos(),
      this.withResolvedConnectionPorts(this.conexiones())
    );

    if (deferredFlow.signature === currentSignature) {
      return;
    }

    this.collabFacade.requestResync(
      'Reconciliacion tras cambios rapidos durante autosave',
      true
    );
  }

  private setPoliticaState(policy: PoliticaNegocio): void {
    this.politica.set(policy);
    this.syncLaneConfigFromPolicy(policy);
    this.syncReadOnlyUiState();
  }

  private syncReadOnlyUiState(): void {
    if (!this.isCanvasReadOnly()) {
      return;
    }

    this.dragState = null;
    this.laneResizeState = null;
    this.pendingLaneConfigGuard = null;
    this.isPanning = false;
    this.panMoved = false;
    this.connectState.set(null);
    this.pendingNodeFromPalette = null;
    this.showDeptModal.set(false);
    this.creatingNewDept.set(false);
    this.editingDeptId.set(null);
    this.editDeptName.set('');

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.autoSaveQueued = false;
  }

  private isCanvasEditBlocked(showToast = false): boolean {
    if (!this.isCanvasReadOnly()) {
      return false;
    }

    this.syncReadOnlyUiState();

    if (showToast) {
      this.notifyReadOnlyMode();
    }

    return true;
  }

  private notifyReadOnlyMode(): void {
    const now = Date.now();
    if (now - this.lastReadOnlyToastAt < 1500) {
      return;
    }

    this.lastReadOnlyToastAt = now;
    this.toast.error('Flujo activo', 'No se puede modificar el flujo de una politica activa.');
  }

  private currentUserId(): string | null {
    return this.auth.obtenerSesion()?.id ?? null;
  }

  private toWorldCoordinate(
    persistedValue: unknown,
    fallbackLocalValue: number,
    origin: number,
    maxCanvas: number
  ): number {
    const n = typeof persistedValue === 'number' ? persistedValue : Number(persistedValue);

    if (!Number.isFinite(n)) {
      return fallbackLocalValue + origin;
    }

    // Backward-compatibility: old saves may already contain world coords.
    const looksLikeWorldCoord = n > origin * 0.5;
    let world = looksLikeWorldCoord ? n : n + origin;

    // Recovery for previously over-shifted coordinates near canvas edge.
    if (world > maxCanvas - 1500) {
      world -= origin;
    }

    return world;
  }

  private toPersistedCoordinate(worldValue: number, origin: number): number {
    return Math.round((worldValue - origin) * 100) / 100;
  }

  private resolveNodeCoordinate(
    node: Partial<ColaboracionNodo>,
    axis: 'X' | 'Y'
  ): unknown {
    if (axis === 'X') {
      if (typeof node.posicionX === 'number') return node.posicionX;
      if (typeof (node as any).posX === 'number') return (node as any).posX;
      if (typeof node.x === 'number') return node.x;
      return undefined;
    }

    if (typeof node.posicionY === 'number') return node.posicionY;
    if (typeof (node as any).posY === 'number') return (node as any).posY;
    if (typeof node.y === 'number') return node.y;
    return undefined;
  }

  private toCanvasNode(node: Partial<ColaboracionNodo>, index: number): NodoCanvas {
    const resolvedTipo = (node.tipo ?? 'ACTIVIDAD') as TipoNodo;
    const resolvedDeptId =
      resolvedTipo === 'ACTIVIDAD'
        ? this.resolveRequiredDepartmentId(node.departamentoId ?? null)
        : node.departamentoId ?? null;

    const rawX = this.toWorldCoordinate(
      this.resolveNodeCoordinate(node, 'X'),
      100 + (index % 6) * 220,
      this.CANVAS_ORIGIN_X,
      this.CANVAS_WIDTH
    );
    const rawY = this.toWorldCoordinate(
      this.resolveNodeCoordinate(node, 'Y'),
      100 + Math.floor(index / 6) * 160,
      this.CANVAS_ORIGIN_Y,
      this.CANVAS_HEIGHT
    );
    const clamped = this.clampNodePosition(rawX, rawY);
    const laneClamped =
      resolvedTipo === 'ACTIVIDAD' && resolvedDeptId
        ? this.clampActivityPositionToLane(resolvedDeptId, clamped.x, clamped.y)
        : clamped;

    return {
      id: node.id ?? this.genId(),
      tipo: resolvedTipo,
      nombre: node.nombre ?? 'Nodo',
      departamentoId: resolvedDeptId,
      responsableTipo: node.responsableTipo ?? null,
      responsableId: node.responsableId ?? null,
      formulario: node.formulario ?? [],
      condiciones: node.condiciones ?? [],
      version: node.version,
      x: laneClamped.x,
      y: laneClamped.y,
    };
  }

  private resolveRequiredDepartmentId(deptId: string | null | undefined): string | null {
    if (typeof deptId === 'string' && deptId.trim().length > 0) {
      return deptId;
    }

    const firstDepartment = this.departamentos()[0];
    return firstDepartment?.id ?? null;
  }

  private normalizeLaneWidth(value: number): number {
    if (!Number.isFinite(value)) {
      return this.laneWidth();
    }

    return Math.round(
      Math.min(Math.max(value, this.MIN_LANE_WIDTH), this.MAX_LANE_WIDTH)
    );
  }

  private normalizeLaneHeight(value: number): number {
    if (!Number.isFinite(value)) {
      return this.laneHeight();
    }

    return Math.round(
      Math.min(Math.max(value, this.MIN_LANE_HEIGHT), this.MAX_LANE_HEIGHT)
    );
  }

  private getActivityLaneBounds(deptId: string):
    | { minX: number; maxX: number; minY: number; maxY: number }
    | null {
    const laneIds = this.getLaneIdsForPlacement(deptId);
    const laneIndex = laneIds.indexOf(deptId);
    if (laneIndex < 0) {
      return null;
    }

    const nodeWidth = this.getNodeWidth('ACTIVIDAD');
    const nodeHeight = this.getNodeHeight('ACTIVIDAD');
    const laneWidth = this.laneWidth();
    const laneHeight = this.laneHeight();

    if (this.isVerticalLaneOrientation()) {
      const laneX = this.CANVAS_ORIGIN_X + laneIndex * laneWidth;
      const minX = laneX;
      const maxX = Math.max(minX, laneX + laneWidth - nodeWidth);
      const minY = this.CANVAS_ORIGIN_Y;
      const maxY = Math.max(minY, this.CANVAS_HEIGHT - nodeHeight);
      return { minX, maxX, minY, maxY };
    }

    const laneY = this.CANVAS_ORIGIN_Y + laneIndex * laneHeight;
    const minY = laneY;
    const maxY = Math.max(minY, laneY + laneHeight - nodeHeight);
    const minX = this.CANVAS_ORIGIN_X;
    const maxX = Math.max(minX, this.CANVAS_WIDTH - nodeWidth);
    return { minX, maxX, minY, maxY };
  }

  private clampActivityPositionToLane(
    deptId: string,
    x: number,
    y: number
  ): { x: number; y: number } {
    const clamped = this.clampNodePosition(x, y);
    const bounds = this.getActivityLaneBounds(deptId);
    if (!bounds) {
      return clamped;
    }

    return {
      x: Math.min(Math.max(clamped.x, bounds.minX), bounds.maxX),
      y: Math.min(Math.max(clamped.y, bounds.minY), bounds.maxY),
    };
  }

  private clampNodePositionForNode(node: NodoCanvas, x: number, y: number): { x: number; y: number } {
    if (node.tipo === 'ACTIVIDAD' && node.departamentoId) {
      return this.clampActivityPositionToLane(node.departamentoId, x, y);
    }

    return this.clampNodePosition(x, y);
  }

  private enforceActivitiesAssignedToLane(): void {
    const fallbackDepartmentId = this.resolveRequiredDepartmentId(null);
    if (!fallbackDepartmentId) {
      return;
    }

    this.nodos.update((nodes) =>
      nodes.map((node) => {
        if (node.tipo !== 'ACTIVIDAD') {
          return node;
        }

        const nextDeptId = this.resolveRequiredDepartmentId(node.departamentoId) ?? fallbackDepartmentId;
        const nextPos = this.clampActivityPositionToLane(nextDeptId, node.x, node.y);
        const nextResponsableId =
          node.responsableTipo === 'DEPARTAMENTO' ? nextDeptId : node.responsableId;

        if (
          nextDeptId === node.departamentoId &&
          nextPos.x === node.x &&
          nextPos.y === node.y &&
          nextResponsableId === node.responsableId
        ) {
          return node;
        }

        return {
          ...node,
          departamentoId: nextDeptId,
          responsableId: nextResponsableId,
          x: nextPos.x,
          y: nextPos.y,
        };
      })
    );
  }

  private toCollaborativeNode(node: NodoCanvas): ColaboracionNodo {
    const persistedX = this.toPersistedCoordinate(node.x, this.CANVAS_ORIGIN_X);
    const persistedY = this.toPersistedCoordinate(node.y, this.CANVAS_ORIGIN_Y);

    return {
      id: node.id,
      tipo: node.tipo,
      nombre: node.nombre,
      departamentoId: node.departamentoId,
      responsableTipo: node.responsableTipo,
      responsableId: node.responsableId,
      formulario: node.formulario ?? [],
      condiciones: node.condiciones ?? [],
      version: node.version,
      x: persistedX,
      y: persistedY,
      posicionX: persistedX,
      posicionY: persistedY,
    };
  }

  private clampNodeX(nextX: number): number {
    return Math.max(this.CANVAS_ORIGIN_X, nextX);
  }

  private clampNodeY(nextY: number): number {
    return Math.max(this.CANVAS_ORIGIN_Y, nextY);
  }

  private clampNodePosition(x: number, y: number): { x: number; y: number } {
    return {
      x: this.clampNodeX(x),
      y: this.clampNodeY(y),
    };
  }

  private setPendingMoveGuard(nodeId: string, x: number, y: number): void {
    const version = this.getNodeVersion(nodeId);

    this.pendingNodeMoveGuards.set(nodeId, {
      x,
      y,
      expiresAt: Date.now() + this.nodeMoveGuardTtlMs,
      version,
    });
  }

  private applyStaleNodeVersionGuard(
    incomingNode: NodoCanvas,
    currentNode: NodoCanvas | undefined
  ): NodoCanvas {
    if (!currentNode) {
      return incomingNode;
    }

    if (
      typeof incomingNode.version === 'number' &&
      typeof currentNode.version === 'number' &&
      incomingNode.version < currentNode.version
    ) {
      return currentNode;
    }

    return incomingNode;
  }

  private applyPendingMoveGuard(node: NodoCanvas): NodoCanvas {
    const guard = this.pendingNodeMoveGuards.get(node.id);
    if (!guard) {
      return node;
    }

    if (
      typeof node.version === 'number' &&
      typeof guard.version === 'number' &&
      node.version > guard.version
    ) {
      this.pendingNodeMoveGuards.delete(node.id);
      return node;
    }

    const samePosition =
      Math.abs(node.x - guard.x) < 0.5 && Math.abs(node.y - guard.y) < 0.5;
    if (samePosition) {
      this.pendingNodeMoveGuards.delete(node.id);
      return node;
    }

    if (Date.now() <= guard.expiresAt) {
      return { ...node, x: guard.x, y: guard.y };
    }

    this.pendingNodeMoveGuards.delete(node.id);
    return node;
  }

  // ── Hydrate from backend ──────────────────────────────────────
  private hydrateCanvas(p: PoliticaNegocio): void {
    this.restoreUiPreferences(p.id);

    const backendPayload: FlujoPayload = {
      nodos: [...(p.nodos ?? [])],
      conexiones: [...(p.conexiones ?? [])],
      laneOrientation:
        p.laneOrientation === 'HORIZONTAL' || p.laneOrientation === 'VERTICAL'
          ? p.laneOrientation
          : this.laneOrientation(),
      laneWidth: typeof p.laneWidth === 'number' ? p.laneWidth : this.laneWidth(),
      laneHeight: typeof p.laneHeight === 'number' ? p.laneHeight : this.laneHeight(),
    };

    // In collaborative mode we must prioritize server snapshot to avoid stale
    // local drafts reordering the canvas when users reconnect.
    const flowToHydrate = backendPayload;

    const nodes = (flowToHydrate.nodos ?? []).map((n, i) =>
      this.toCanvasNode(n as ColaboracionNodo, i)
    );
    this.nodos.set(nodes);
    this.reconcileDecisionConditionDrafts(nodes);
    const connections = this.withResolvedConnectionPorts(
      flowToHydrate.conexiones ?? []
    );
    this.conexiones.set(connections);
    this.initializeConnectionPorts(nodes, connections);
    this.lastSavedDraftSignature = JSON.stringify(backendPayload);
  }

  private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private getPendingFlowStorageKey(policyId: string): string {
    return `${this.pendingFlowStorageKeyPrefix}${policyId}`;
  }

  private getUiPrefsStorageKey(policyId: string): string {
    return `${this.uiPrefsStorageKeyPrefix}${policyId}`;
  }

  private persistUiPreferencesForCurrentPolicy(): void {
    const policyId = this.politica()?.id;
    if (!policyId) {
      return;
    }

    this.persistUiPreferences(policyId);
  }

  private handleUiPrefsStorageSync(event: StorageEvent): void {
    const policyId = this.politica()?.id;
    if (!policyId || event.key !== this.getUiPrefsStorageKey(policyId) || !event.newValue) {
      return;
    }

    try {
      const backup = JSON.parse(event.newValue) as Partial<CanvasUiPrefsBackup>;
      const incomingSourcePorts = this.normalizeConnectionPortMap(
        backup.connectionSourcePorts
      );
      const incomingTargetPorts = this.normalizeConnectionPortMap(
        backup.connectionTargetPorts
      );

      if (
        !Object.keys(incomingSourcePorts).length &&
        !Object.keys(incomingTargetPorts).length
      ) {
        return;
      }

      this.connectionSourcePorts.update((map) => ({
        ...map,
        ...incomingSourcePorts,
      }));
      this.connectionTargetPorts.update((map) => ({
        ...map,
        ...incomingTargetPorts,
      }));

      this.conexiones.set(this.withResolvedConnectionPorts(this.conexiones()));
    } catch {
      // Ignore malformed cross-tab payloads.
    }
  }

  private normalizeConnectionPort(value: unknown): ConnectionPort | null {
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

  private normalizeConnectionPortMap(
    rawMap: unknown
  ): Record<string, ConnectionPort> {
    if (!rawMap || typeof rawMap !== 'object') {
      return {};
    }

    const next: Record<string, ConnectionPort> = {};

    for (const [key, value] of Object.entries(rawMap)) {
      if (!key.includes('->')) {
        continue;
      }

      const normalizedPort = this.normalizeConnectionPort(value);
      if (normalizedPort) {
        next[key] = normalizedPort;
      }
    }

    return next;
  }

  private withResolvedConnectionPorts(connections: Conexion[]): Conexion[] {
    const sourceMap = this.connectionSourcePorts();
    const targetMap = this.connectionTargetPorts();
    const nodeById = new Map(this.nodos().map((node) => [node.id, node]));

    return connections.map((connection) => {
      const key = this.connectionKey(connection.origen, connection.destino);
      const sourcePort =
        this.normalizeConnectionPort(connection.puertoOrigen) ?? sourceMap[key];
      const targetPort =
        this.normalizeConnectionPort(connection.puertoDestino) ?? targetMap[key];

      const fromNode = nodeById.get(connection.origen);
      const toNode = nodeById.get(connection.destino);

      let resolvedSourcePort = sourcePort;
      let resolvedTargetPort = targetPort;

      if (fromNode?.tipo === 'FORK') {
        if (!resolvedSourcePort || resolvedSourcePort === 'TOP' || resolvedSourcePort === 'BOTTOM') {
          resolvedSourcePort = 'RIGHT';
        }
      }

      if (toNode?.tipo === 'FORK') {
        resolvedTargetPort = 'TOP';
      }

      if (fromNode?.tipo === 'JOIN') {
        resolvedSourcePort = 'BOTTOM';
      }

      if (toNode?.tipo === 'JOIN') {
        const preferredJoinInput =
          fromNode && toNode
            ? this.autoTargetPort(fromNode, toNode)
            : 'LEFT';
        resolvedTargetPort =
          resolvedTargetPort === 'LEFT' || resolvedTargetPort === 'RIGHT'
            ? resolvedTargetPort
            : preferredJoinInput === 'RIGHT'
              ? 'RIGHT'
              : 'LEFT';
      }

      const normalized: Conexion = {
        origen: connection.origen,
        destino: connection.destino,
      };

      if (resolvedSourcePort) {
        normalized.puertoOrigen = resolvedSourcePort;
      }

      if (resolvedTargetPort) {
        normalized.puertoDestino = resolvedTargetPort;
      }

      return normalized;
    });
  }

  private persistPendingFlowBackup(policyId: string, payload: FlujoPayload): void {
    if (!this.hasLocalStorage()) {
      return;
    }

    const backup: PendingFlowBackup = {
      savedAt: new Date().toISOString(),
      payload,
    };

    try {
      window.localStorage.setItem(
        this.getPendingFlowStorageKey(policyId),
        JSON.stringify(backup)
      );
    } catch {
      // Ignore quota/storage access failures.
    }
  }

  private clearPendingFlowBackup(policyId: string): void {
    if (!this.hasLocalStorage()) {
      return;
    }

    try {
      window.localStorage.removeItem(this.getPendingFlowStorageKey(policyId));
    } catch {
      // Ignore storage access failures.
    }
  }

  private readPendingFlowBackup(
    policyId: string,
    backendUpdatedAt: string
  ): FlujoPayload | null {
    if (!this.hasLocalStorage()) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(this.getPendingFlowStorageKey(policyId));
      if (!raw) {
        return null;
      }

      const backup = JSON.parse(raw) as Partial<PendingFlowBackup>;
      const payload = backup.payload;
      if (!payload || !Array.isArray(payload.nodos) || !Array.isArray(payload.conexiones)) {
        this.clearPendingFlowBackup(policyId);
        return null;
      }

      const savedAt = Date.parse(backup.savedAt ?? '');
      const backendAt = Date.parse(backendUpdatedAt ?? '');
      if (Number.isFinite(savedAt) && Number.isFinite(backendAt) && savedAt <= backendAt) {
        this.clearPendingFlowBackup(policyId);
        return null;
      }

      return {
        nodos: [...payload.nodos],
        conexiones: [...payload.conexiones],
      };
    } catch {
      this.clearPendingFlowBackup(policyId);
      return null;
    }
  }

  private persistUiPreferences(policyId: string): void {
    if (!this.hasLocalStorage()) {
      return;
    }

    const resolvedConnections = this.withResolvedConnectionPorts(this.conexiones());
    const connectionSourcePorts: Record<string, ConnectionPort> = {};
    const connectionTargetPorts: Record<string, ConnectionTargetPort> = {};

    for (const connection of resolvedConnections) {
      const key = this.connectionKey(connection.origen, connection.destino);

      const sourcePort = this.normalizeConnectionPort(connection.puertoOrigen);
      if (sourcePort) {
        connectionSourcePorts[key] = sourcePort;
      }

      const targetPort = this.normalizeConnectionPort(connection.puertoDestino);
      if (targetPort) {
        connectionTargetPorts[key] = targetPort;
      }
    }

    const backup: CanvasUiPrefsBackup = {
      connectionSourcePorts,
      connectionTargetPorts,
    };

    try {
      window.localStorage.setItem(
        this.getUiPrefsStorageKey(policyId),
        JSON.stringify(backup)
      );
    } catch {
      // Ignore quota/storage access failures.
    }
  }

  private restoreUiPreferences(policyId: string): void {
    this.connectionSourcePorts.set({});
    this.connectionTargetPorts.set({});

    if (!this.hasLocalStorage()) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(this.getUiPrefsStorageKey(policyId));
      if (!raw) {
        return;
      }

      const backup = JSON.parse(raw) as Partial<CanvasUiPrefsBackup>;

      this.connectionSourcePorts.set(
        this.normalizeConnectionPortMap(backup.connectionSourcePorts)
      );
      this.connectionTargetPorts.set(
        this.normalizeConnectionPortMap(backup.connectionTargetPorts)
      );
    } catch {
      // Ignore malformed payload and keep defaults.
    }
  }

  private buildFlujoPayload(): FlujoPayload {
    return {
      nodos: this.nodos().map((n) => ({
        id: n.id,
        tipo: n.tipo,
        nombre: n.nombre,
        posX: this.toPersistedCoordinate(n.x, this.CANVAS_ORIGIN_X),
        posY: this.toPersistedCoordinate(n.y, this.CANVAS_ORIGIN_Y),
        posicionX: this.toPersistedCoordinate(n.x, this.CANVAS_ORIGIN_X),
        posicionY: this.toPersistedCoordinate(n.y, this.CANVAS_ORIGIN_Y),
        version: n.version,
        departamentoId: n.departamentoId,
        responsableTipo: n.tipo === 'ACTIVIDAD' ? (n.responsableTipo || null) : null,
        responsableId: n.tipo === 'ACTIVIDAD' ? (n.responsableId || null) : null,
        formulario: n.formulario ?? [],
        condiciones: n.condiciones ?? [],
      })),
      conexiones: this.withResolvedConnectionPorts(this.conexiones()),
      laneOrientation: this.laneOrientation(),
      laneWidth: this.laneWidth(),
      laneHeight: this.laneHeight(),
    };
  }

  private buildDraftSignature(): string {
    return JSON.stringify(this.buildFlujoPayload());
  }

  private scheduleAutoSave(immediate = false): void {
    if (this.isCanvasEditBlocked()) {
      return;
    }

    const currentPolicy = this.politica();
    if (!currentPolicy) {
      return;
    }

    this.autoSaveQueued = true;
    this.lastAutoSaveQueuedAt = Date.now();
    this.persistPendingFlowBackup(currentPolicy.id, this.buildFlujoPayload());

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (immediate) {
      this.flushAutoSave();
      return;
    }

    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.flushAutoSave();
    }, 200);
  }

  private flushAutoSave(): void {
    const p = this.politica();
    if (!p) {
      return;
    }

    if (!this.autoSaveQueued) {
      this.tryApplyDeferredCollaborativeFlow();
      return;
    }

    if (this.saving()) {
      return;
    }

    // Avoid sending transient invalid responsible states while the user is
    // still selecting values in the sidebar.
    if (this.hasPendingResponsableSelection()) {
      return;
    }

    const payload = this.buildFlujoPayload();
    const signature = JSON.stringify(payload);

    if (signature === this.lastSavedDraftSignature) {
      this.autoSaveQueued = false;
      this.tryApplyDeferredCollaborativeFlow();
      return;
    }

    this.autoSaveQueued = false;
    this.saving.set(true);

    this.svc.saveFlujo(p.id, payload).subscribe({
      next: (updated) => {
        this.setPoliticaState(updated);
        this.lastSavedDraftSignature = signature;
        this.saving.set(false);
        this.clearPendingFlowBackup(p.id);
        this.persistUiPreferences(p.id);

        if (this.autoSaveQueued) {
          this.scheduleAutoSave(true);
          return;
        }

        this.tryApplyDeferredCollaborativeFlow();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'No se pudo guardar el borrador automáticamente';
        this.toast.error('Error', msg);

        const status = Number(err?.status);
        const isRecoverableSyncError =
          status === 404 || status === 409 || status === 410 || status === 412;
        if (isRecoverableSyncError) {
          this.autoSaveQueued = false;
          this.toast.info(
            'Colaboración',
            'Se detectó un conflicto de sincronización. Re-sincronizando pizarra...'
          );
          this.collabFacade.requestResync(
            'Conflicto detectado durante autosave',
            true
          );
          this.tryApplyDeferredCollaborativeFlow();
          return;
        }

        const isValidationError = Number.isFinite(status) && status >= 400 && status < 500;
        if (isValidationError) {
          // Validation/business errors require user action, not background retries.
          this.autoSaveQueued = false;
          this.tryApplyDeferredCollaborativeFlow();
          return;
        }

        // Keep draft queued and retry automatically to avoid data loss.
        this.autoSaveQueued = true;
        this.scheduleAutoSave();
      },
    });
  }

  // ── Save to backend ───────────────────────────────────────────
  save(): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.scheduleAutoSave(true);
  }

  changeEstado(estado: EstadoPolitica): void {
    const p = this.politica();
    if (!p) return;

    // Validación frontend antes de activar
    if (estado === 'ACTIVA') {
      const tieneInicio = this.nodos().some((n) => n.tipo === 'INICIO');
      const tieneFin = this.nodos().some((n) => n.tipo === 'FIN');

      if (!tieneInicio || !tieneFin) {
        this.toast.error('No se puede activar', 'Debe existir al menos un nodo INICIO y un nodo FIN.');
        return;
      }

      const actividadesIncompletas = this.nodos().filter(
        n => n.tipo === 'ACTIVIDAD' && (!n.responsableTipo || !n.responsableId)
      );

      if (actividadesIncompletas.length > 0) {
        this.toast.error('No se puede activar', 'Hay actividades sin responsable real asignado.');
        this.selectNode(actividadesIncompletas[0].id);
        return;
      }

      const parallelGatewayValidation = this.validateParallelGatewayTopology();
      if (parallelGatewayValidation) {
        this.toast.error('No se puede activar', parallelGatewayValidation.message);
        this.selectNode(parallelGatewayValidation.nodeId);
        return;
      }

      // Backend valida contra el flujo persistido: guardamos antes de activar.
      this.svc.saveFlujo(p.id, this.buildFlujoPayload()).subscribe({
        next: (updated) => {
          this.setPoliticaState(updated);
          this.changeEstadoPersistido(p.id, estado);
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'No se pudo guardar el flujo antes de activar';
          this.toast.error('Error', msg);
        },
      });
      return;
    }

    this.changeEstadoPersistido(p.id, estado);
  }

  private changeEstadoPersistido(policyId: string, estado: EstadoPolitica): void {
    this.svc.changeEstado(policyId, estado).subscribe({
      next: (updated) => {
        this.setPoliticaState(updated);
        this.toast.success('Estado actualizado', `Política ahora en estado ${estado}`);
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'No se pudo cambiar el estado';
        this.toast.error('Error', msg);
      },
    });
  }

  goBack(): void {
    this.collabFacade.stopSession(true);
    this.router.navigate(['/admin/politicas']);
  }

  // ── IA Flujo Generation ────────────────────────────────────
  /**
   * Abre el modal para generar un workflow con IA
   */
  openIaFlujoModal(): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }
    this.showIaFlujoModal.set(true);
  }

  /**
   * Cierra el modal de generación de workflow con IA
   */
  closeIaFlujoModal(): void {
    this.showIaFlujoModal.set(false);
  }

  /**
   * Maneja el workflow generado por IA y lo aplica al canvas
   *
   * @param event Evento que contiene los nodos, conexiones y análisis generados
   */
  onIaFlujoGenerated(event: {
    nodos: Nodo[];
    conexiones: Conexion[];
    analysis: any;
    iaResponse: IaFlujoResponse;
  }): void {
    void this.applyIaFlujo(event);
  }

  private async applyIaFlujo(event: {
    nodos: Nodo[];
    conexiones: Conexion[];
    analysis: any;
    iaResponse: IaFlujoResponse;
  }): Promise<void> {
    if (this.isApplyingIaFlujo()) {
      return;
    }

    this.isApplyingIaFlujo.set(true);
    try {
      const departments = await this.ensureDepartmentsForIaFlujo(event.iaResponse);
      this.departamentos.set(departments);

      this.fitLaneSizeForIaFlujo(event.iaResponse, departments);

      const { nodos, conexiones } = this.iaMapperService.mapIaResponseToFlujo(
        event.iaResponse,
        {
          departamentos: departments.map((departamento) => ({
            id: departamento.id,
            nombre: departamento.nombre,
          })),
          defaultDepartamentoId: this.resolveRequiredDepartmentId(null),
          responsableIniciadorId: this.RESPONSABLE_INICIADOR_TRAMITE_ID,
        }
      );

      const positionedNodos = this.layoutIaNodos(nodos, conexiones);

      this.nodos.set(positionedNodos);
      this.conexiones.set(this.withResolvedConnectionPorts(conexiones));
      this.initializeConnectionPorts(positionedNodos, this.conexiones());
      this.enforceActivitiesAssignedToLane();

      this.selectedNodeId.set(null);
      this.scheduleAutoSave(true);
      const summary = event.analysis?.summary || 'Flujo generado correctamente';
      this.toast.success('Flujo generado', summary);
      this.closeIaFlujoModal();
    } catch (error) {
      console.error('Error applying IA workflow:', error);
      this.toast.error(
        'Error al aplicar',
        'No se pudo aplicar el workflow generado'
      );
    } finally {
      this.isApplyingIaFlujo.set(false);
    }
  }

  private fitLaneSizeForIaFlujo(
    response: IaFlujoResponse,
    departments: AdministradorDepartamento[]
  ): void {
    const nodes = response.nodes ?? [];
    const activityNodes = nodes.filter((node) => node.type === 'task');
    const longestTitle = nodes.reduce(
      (max, node) => Math.max(max, (node.name ?? '').trim().length),
      0
    );
    const departmentCount = Math.max(1, departments.length);

    if (this.isVerticalLaneOrientation()) {
      const estimatedWidth = Math.max(
        320,
        180 + longestTitle * 8,
        220 + Math.ceil(activityNodes.length / departmentCount) * 70
      );
      this.laneWidth.set(this.normalizeLaneWidth(estimatedWidth));
      return;
    }

    const estimatedHeight = Math.max(
      220,
      160 + longestTitle * 5,
      220 + Math.ceil(activityNodes.length / departmentCount) * 60
    );
    this.laneHeight.set(this.normalizeLaneHeight(estimatedHeight));
  }

  private async ensureDepartmentsForIaFlujo(
    response: IaFlujoResponse
  ): Promise<AdministradorDepartamento[]> {
    const existingDepartments = [...this.departamentos()];
    const detectedDepartments = this.detectIaDepartamentos(response);
    const createdDepartments: AdministradorDepartamento[] = [];

    for (const department of detectedDepartments) {
      if (this.findSimilarDepartment(department.name, existingDepartments)) {
        continue;
      }

      const created = await firstValueFrom(
        this.deptSvc.createDepartment({
          nombre: department.name,
          descripcion:
            department.description ?? 'Departamento sugerido automáticamente por IA',
        })
      );

      existingDepartments.push(created);
      createdDepartments.push(created);
    }

    if (!createdDepartments.length) {
      return existingDepartments;
    }

    return existingDepartments;
  }

  private detectIaDepartamentos(
    response: IaFlujoResponse
  ): Array<{ name: string; description?: string | null }> {
    const suggested = (response.departments ?? [])
      .map((department) => ({
        name: department.name,
        description: department.description ?? null,
      }))
      .filter((department) => department.name.trim().length > 1);

    if (suggested.length) {
      return this.uniqueDepartmentsByName(suggested);
    }

    const rolesById = new Map(
      (response.roles ?? []).map((role) => [role.id, role])
    );

    const inferred = response.nodes
      .filter((node) => node.type === 'task' && node.responsibleType === 'department')
      .map((node) => {
        const roleName = node.responsibleRoleId
          ? rolesById.get(node.responsibleRoleId)?.name
          : null;

        return {
          name: node.departmentHint?.trim() || roleName?.trim() || node.name.trim(),
          description: node.description?.trim() || null,
        };
      })
      .filter((department) => department.name.length > 1);

    return this.uniqueDepartmentsByName(inferred);
  }

  private uniqueDepartmentsByName(
    departments: Array<{ name: string; description?: string | null }>
  ): Array<{ name: string; description?: string | null }> {
    const seen = new Set<string>();
    const unique: Array<{ name: string; description?: string | null }> = [];

    for (const department of departments) {
      const key = this.normalizeDepartmentName(department.name);
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(department);
    }

    return unique;
  }

  private findSimilarDepartment(
    name: string,
    departments: AdministradorDepartamento[]
  ): AdministradorDepartamento | null {
    const normalizedName = this.normalizeDepartmentName(name);
    if (!normalizedName) {
      return null;
    }

    for (const department of departments) {
      const normalizedDepartmentName = this.normalizeDepartmentName(department.nombre);
      if (!normalizedDepartmentName) {
        continue;
      }

      if (
        normalizedDepartmentName === normalizedName ||
        normalizedDepartmentName.includes(normalizedName) ||
        normalizedName.includes(normalizedDepartmentName)
      ) {
        return department;
      }

      const departmentTokens = new Set(
        normalizedDepartmentName.split(' ').filter((token) => token.length > 2)
      );
      const nameTokens = normalizedName.split(' ').filter((token) => token.length > 2);
      const matchingTokens = nameTokens.filter((token) => departmentTokens.has(token));

      if (
        nameTokens.length > 0 &&
        matchingTokens.length / nameTokens.length >= 0.5
      ) {
        return department;
      }
    }

    return null;
  }

  private normalizeDepartmentName(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private layoutIaNodos(nodos: Nodo[], conexiones: Conexion[]): NodoCanvas[] {
    const outgoing = new Map<string, string[]>();
    const incomingCount = new Map<string, number>();

    for (const node of nodos) {
      outgoing.set(node.id, []);
      incomingCount.set(node.id, 0);
    }

    for (const connection of conexiones) {
      const fromBucket = outgoing.get(connection.origen);
      if (fromBucket) {
        fromBucket.push(connection.destino);
      }

      incomingCount.set(
        connection.destino,
        (incomingCount.get(connection.destino) ?? 0) + 1
      );
    }

    const layerByNode = new Map<string, number>();
    const queue: string[] = [];
    const startNodes = nodos.filter((node) => node.tipo === 'INICIO');
    const roots = startNodes.length
      ? startNodes.map((node) => node.id)
      : nodos
          .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
          .map((node) => node.id);

    for (const root of roots) {
      layerByNode.set(root, 0);
      queue.push(root);
    }

    while (queue.length) {
      const currentId = queue.shift()!;
      const currentLayer = layerByNode.get(currentId) ?? 0;
      const nextNodes = outgoing.get(currentId) ?? [];

      for (const nextId of nextNodes) {
        if (layerByNode.has(nextId)) {
          continue;
        }

        layerByNode.set(nextId, currentLayer + 1);
        queue.push(nextId);
      }
    }

    let maxLayer = 0;
    for (const node of nodos) {
      if (!layerByNode.has(node.id)) {
        maxLayer += 1;
        layerByNode.set(node.id, maxLayer);
      } else {
        maxLayer = Math.max(maxLayer, layerByNode.get(node.id) ?? 0);
      }
    }

    const layers = new Map<number, Nodo[]>();
    for (const node of nodos) {
      const layer = layerByNode.get(node.id) ?? 0;
      const bucket = layers.get(layer) ?? [];
      bucket.push(node);
      layers.set(layer, bucket);
    }

    const laneIds = this.departamentos().map((departamento) => departamento.id);
    const positioned = new Map<string, NodoCanvas>();
    const occupancy = new Set<string>();

    const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
    for (const layer of sortedLayers) {
      const layerNodes = layers.get(layer) ?? [];
      const baseY = this.CANVAS_ORIGIN_Y + 140 + layer * 220;

      for (let index = 0; index < layerNodes.length; index += 1) {
        const node = layerNodes[index];
        const nodeWidth = this.getNodeWidth(node.tipo);
        const laneIndex =
          node.tipo === 'ACTIVIDAD' && node.departamentoId
            ? laneIds.indexOf(node.departamentoId)
            : -1;

        const preferredX =
          laneIndex >= 0
            ? this.CANVAS_ORIGIN_X + laneIndex * this.laneWidth() + (this.laneWidth() - nodeWidth) / 2
            : this.CANVAS_ORIGIN_X + 260 + index * 240;

        let nextX = preferredX;
        let nextY = baseY;
        let safety = 0;
        let key = `${Math.round(nextX)}:${Math.round(nextY)}`;

        while (occupancy.has(key) && safety < 12) {
          nextY += 70;
          safety += 1;
          key = `${Math.round(nextX)}:${Math.round(nextY)}`;
        }

        occupancy.add(key);

        const clamped = this.clampNodePositionForNode(
          {
            ...node,
            x: nextX,
            y: nextY,
          } as NodoCanvas,
          nextX,
          nextY
        );

        const positionedNode: NodoCanvas = {
          ...node,
          x: clamped.x,
          y: clamped.y,
        };

        positioned.set(node.id, positionedNode);
      }
    }

    return nodos.map((node) => positioned.get(node.id) ?? {
      ...node,
      x: this.CANVAS_ORIGIN_X + 260,
      y: this.CANVAS_ORIGIN_Y + 140,
    });
  }

  // ── Node generation ───────────────────────────────────────────
  private genId(): string {
    return `n${Date.now()}_${++this.idCounter}`;
  }

  addNodeFromPalette(tipo: TipoNodo): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    let cx = 300;
    let cy = 200;

    if (this.canvasWrap?.nativeElement) {
      const rect = this.canvasWrap.nativeElement.getBoundingClientRect();
      cx = (rect.width / 2 - this.panX()) / this.zoom();
      cy = (rect.height / 2 - this.panY()) / this.zoom();
    }

    this.pendingNodeFromPalette = { tipo, x: cx, y: cy };
    this.creatingNewDept.set(false);

    if (tipo === 'ACTIVIDAD') {
      this.showDeptModal.set(true);
      return;
    }

    this.selectDeptForPending(null);
  }

  toggleLaneOrientation(): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.laneOrientation.update((orientation) =>
      orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'
    );
    this.realignActivityNodesToLaneOrientation();
    this.emitLaneConfigSync(true);
    this.scheduleAutoSave(true);
  }

  get laneOrientationLabel(): string {
    return this.isVerticalLaneOrientation() ? 'Vertical' : 'Horizontal';
  }

  getLaneX(index: number): number {
    return this.isVerticalLaneOrientation()
      ? this.CANVAS_ORIGIN_X + index * this.laneWidth()
      : this.CANVAS_ORIGIN_X;
  }

  getLaneY(index: number): number {
    return this.isVerticalLaneOrientation()
      ? this.CANVAS_ORIGIN_Y
      : this.CANVAS_ORIGIN_Y + index * this.laneHeight();
  }

  getLaneWidth(): number {
    return this.isVerticalLaneOrientation()
      ? this.laneWidth()
      : this.CANVAS_WIDTH - this.CANVAS_ORIGIN_X;
  }

  getLaneHeight(): number {
    return this.isVerticalLaneOrientation()
      ? this.CANVAS_HEIGHT - this.CANVAS_ORIGIN_Y
      : this.laneHeight();
  }

  startLaneResize(event: MouseEvent): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    const initialActivityPositions: Record<string, { x: number; y: number }> = {};
    for (const node of this.nodos()) {
      if (node.tipo !== 'ACTIVIDAD') {
        continue;
      }

      initialActivityPositions[node.id] = { x: node.x, y: node.y };
    }

    this.dragState = null;
    this.isPanning = false;
    this.panMoved = false;
    this.pendingLaneConfigGuard = null;

    this.laneResizeState = {
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startLaneWidth: this.laneWidth(),
      startLaneHeight: this.laneHeight(),
      initialActivityPositions,
    };
  }

  private randomOffset(spread: number): number {
    return Math.random() * spread - spread / 2;
  }

  private getLaneIdsForPlacement(targetDeptId: string): string[] {
    const laneIds = this.swimlanes().map((lane) => lane.id);
    if (!laneIds.includes(targetDeptId)) {
      laneIds.push(targetDeptId);
    }
    return laneIds;
  }

  private getNodePlacementForLane(
    deptId: string,
    baseX: number,
    baseY: number
  ): { x: number; y: number } {
    const laneIds = this.getLaneIdsForPlacement(deptId);
    const laneIndex = laneIds.indexOf(deptId);

    if (laneIndex < 0) {
      return this.clampNodePosition(baseX + this.randomOffset(40), baseY + this.randomOffset(40));
    }

    if (this.isVerticalLaneOrientation()) {
      const laneWidth = this.laneWidth();
      const laneX = this.CANVAS_ORIGIN_X + laneIndex * laneWidth;
      const centeredX = laneX + (laneWidth - this.getNodeWidth('ACTIVIDAD')) / 2;
      return this.clampActivityPositionToLane(
        deptId,
        centeredX + this.randomOffset(26),
        baseY + this.randomOffset(36)
      );
    }

    const laneHeight = this.laneHeight();
    const laneY = this.CANVAS_ORIGIN_Y + laneIndex * laneHeight;
    const centeredY = laneY + (laneHeight - this.getNodeHeight('ACTIVIDAD')) / 2;
    return this.clampActivityPositionToLane(
      deptId,
      baseX + this.randomOffset(36),
      centeredY + this.randomOffset(24)
    );
  }

  private getInitialNodePosition(
    tipo: TipoNodo,
    deptId: string | null,
    baseX: number,
    baseY: number
  ): { x: number; y: number } {
    if (tipo === 'ACTIVIDAD' && deptId) {
      return this.getNodePlacementForLane(deptId, baseX, baseY);
    }

    return this.clampNodePosition(
      baseX + this.randomOffset(40),
      baseY + this.randomOffset(40)
    );
  }

  private realignActivityNodesToLaneOrientation(): void {
    const laneIds = this.swimlanes().map((lane) => lane.id);
    if (!laneIds.length) {
      return;
    }

    const movedNodes: NodoCanvas[] = [];

    this.nodos.update((nodes) =>
      nodes.map((node) => {
        if (node.tipo !== 'ACTIVIDAD' || !node.departamentoId) {
          return node;
        }

        const laneIndex = laneIds.indexOf(node.departamentoId);
        if (laneIndex < 0) {
          return node;
        }

        if (this.isVerticalLaneOrientation()) {
          const laneWidth = this.laneWidth();
          const laneX = this.CANVAS_ORIGIN_X + laneIndex * laneWidth;
          const centeredX = laneX + (laneWidth - this.getNodeWidth(node.tipo)) / 2;
          const clamped = this.clampActivityPositionToLane(node.departamentoId, centeredX, node.y);
          const nextNode = { ...node, x: clamped.x, y: clamped.y };
          if (nextNode.x !== node.x || nextNode.y !== node.y) {
            movedNodes.push(nextNode);
          }
          return nextNode;
        }

        const laneHeight = this.laneHeight();
        const laneY = this.CANVAS_ORIGIN_Y + laneIndex * laneHeight;
        const centeredY = laneY + (laneHeight - this.getNodeHeight(node.tipo)) / 2;
        const clamped = this.clampActivityPositionToLane(node.departamentoId, node.x, centeredY);
        const nextNode = { ...node, x: clamped.x, y: clamped.y };
        if (nextNode.x !== node.x || nextNode.y !== node.y) {
          movedNodes.push(nextNode);
        }
        return nextNode;
      })
    );

    for (const movedNode of movedNodes) {
      this.setPendingMoveGuard(movedNode.id, movedNode.x, movedNode.y);
      this.collabFacade.emitMoveNode(
        movedNode.id,
        this.toPersistedCoordinate(movedNode.x, this.CANVAS_ORIGIN_X),
        this.toPersistedCoordinate(movedNode.y, this.CANVAS_ORIGIN_Y)
      );
    }

    if (movedNodes.length) {
      this.scheduleAutoSave(true);
    }
  }

  selectDeptForPending(deptId: string | null): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (!this.pendingNodeFromPalette) return;
    const { tipo, x, y } = this.pendingNodeFromPalette;
    const resolvedDeptId =
      tipo === 'ACTIVIDAD' ? this.resolveRequiredDepartmentId(deptId) : deptId;

    if (tipo === 'ACTIVIDAD' && !resolvedDeptId) {
      return;
    }

    const initialPos = this.getInitialNodePosition(tipo, resolvedDeptId, x, y);
    const newNode: NodoCanvas = {
      id: this.genId(),
      tipo,
      nombre: this.defaultName(tipo),
      departamentoId: resolvedDeptId,
      responsableTipo: null,
      responsableId: null,
      formulario: [],
      condiciones: [],
      x: initialPos.x,
      y: initialPos.y,
    };
    this.nodos.update((ns) => [...ns, newNode]);
    this.collabFacade.emitCreateNode(this.toCollaborativeNode(newNode));
    this.scheduleAutoSave(true);
    this.pendingNodeFromPalette = null;
    this.showDeptModal.set(false);
    this.selectNode(newNode.id);
  }

  selectDeptFromModal(deptId: string | null): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (!deptId) {
      return;
    }

    this.selectDeptForPending(deptId);
  }

  private defaultName(tipo: TipoNodo): string {
    const names: Record<TipoNodo, string> = {
      INICIO: 'Inicio del trámite',
      ACTIVIDAD: 'Nueva actividad',
      DECISION: '¿Condición?',
      FORK: 'Bifurcación paralela',
      JOIN: 'Unión paralela',
      FIN: 'Fin del trámite',
    };
    return names[tipo];
  }

  deleteNode(id: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    const nodeToDelete = this.nodos().find((n) => n.id === id);
    const removedConnections = this.conexiones().filter(
      (c) => c.origen === id || c.destino === id
    );

    this.nodos.update((ns) => ns.filter((n) => n.id !== id));
    this.conexiones.update((cs) => cs.filter((c) => c.origen !== id && c.destino !== id));
    this.clearDecisionConditionPreviewForNode(id);
    this.removeDecisionConditionDraft(id);

    if (removedConnections.length) {
      this.connectionTargetPorts.update((map) => {
        const next = { ...map };
        for (const c of removedConnections) {
          delete next[this.connectionKey(c.origen, c.destino)];
        }
        return next;
      });

      this.connectionSourcePorts.update((map) => {
        const next = { ...map };
        for (const c of removedConnections) {
          delete next[this.connectionKey(c.origen, c.destino)];
        }
        return next;
      });
    }

    if (this.selectedNodeId() === id) {
      this.selectedNodeId.set(null);
      this.showSidebar.set(false);
      this.collabFacade.setEditingNode(null);
    }

    this.collabFacade.emitDeleteNode(id, nodeToDelete?.version);
    this.scheduleAutoSave(true);
  }

  // ── Selection ─────────────────────────────────────────────────
  selectNode(id: string): void {
    const previousNodeId = this.selectedNodeId();
    if (previousNodeId && previousNodeId !== id) {
      this.flushNodeNameSync(previousNodeId);
    }

    this.selectedNodeId.set(id);
    this.showSidebar.set(true);
    this.collabFacade.setEditingNode(id);
  }

  onNodeClick(event: MouseEvent, id: string): void {
    event.stopPropagation();

    if (this.connectState()) {
      this.finishConnect(id, null);
      return;
    }

    this.selectNode(id);
  }

  deselectAll(): void {
    const selectedNodeId = this.selectedNodeId();
    if (selectedNodeId) {
      this.flushNodeNameSync(selectedNodeId);
    }

    this.selectedNodeId.set(null);
    this.showSidebar.set(false);
    this.connectState.set(null);
    this.collabFacade.setEditingNode(null);
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  onNodeMouseDown(event: MouseEvent, nodeId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (this.connectState()) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    const node = this.nodos().find((n) => n.id === nodeId);
    if (!node) return;
    this.dragState = {
      nodeId,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    };
    this.selectNode(nodeId);
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isCanvasReadOnly()) {
      if (this.isPanning) {
        const dx = event.clientX - this.panStart.x;
        const dy = event.clientY - this.panStart.y;
        if (!this.panMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          this.panMoved = true;
        }
        this.setPan(this.panStart.px + dx, this.panStart.py + dy);
      }
      return;
    }

    if (this.laneResizeState) {
      const dx = (event.clientX - this.laneResizeState.startMouseX) / this.zoom();
      const dy = (event.clientY - this.laneResizeState.startMouseY) / this.zoom();

      let laneSizeChanged = false;
      if (this.isVerticalLaneOrientation()) {
        const nextLaneWidth = this.normalizeLaneWidth(
          this.laneResizeState.startLaneWidth + dx
        );
        if (nextLaneWidth !== this.laneWidth()) {
          this.laneWidth.set(nextLaneWidth);
          laneSizeChanged = true;
        }
      } else {
        const nextLaneHeight = this.normalizeLaneHeight(
          this.laneResizeState.startLaneHeight + dy
        );
        if (nextLaneHeight !== this.laneHeight()) {
          this.laneHeight.set(nextLaneHeight);
          laneSizeChanged = true;
        }
      }

      if (laneSizeChanged) {
        this.enforceActivitiesAssignedToLane();
      }

      return;
    }

    if (this.dragState) {
      const dx = (event.clientX - this.dragState.startMouseX) / this.zoom();
      const dy = (event.clientY - this.dragState.startMouseY) / this.zoom();
      const id = this.dragState.nodeId;
      const draggedNode = this.nodos().find((n) => n.id === id);
      if (!draggedNode) {
        return;
      }

      const clampedPos = this.clampNodePositionForNode(
        draggedNode,
        this.dragState.startNodeX + dx,
        this.dragState.startNodeY + dy
      );
      this.nodos.update((ns) =>
        ns.map((n) =>
          n.id === id
            ? { ...n, x: clampedPos.x, y: clampedPos.y }
            : n
        )
      );
      if (this.connectState()?.fromNodeId) {
        this.connectState.update((cs) =>
          cs ? { ...cs, currentX: event.clientX, currentY: event.clientY } : null
        );
      }
      return;
    }
    if (this.isPanning) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      if (!this.panMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        this.panMoved = true;
      }
      this.setPan(this.panStart.px + dx, this.panStart.py + dy);
    }
    if (this.connectState()) {
      this.connectState.update((cs) =>
        cs ? { ...cs, currentX: event.clientX, currentY: event.clientY } : null
      );
    }
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    if (this.isCanvasReadOnly()) {
      this.laneResizeState = null;
      const wasPanning = this.isPanning;
      const didPan = this.panMoved;

      this.isPanning = false;
      this.panMoved = false;

      if (wasPanning && !didPan) {
        this.deselectAll();
      }
      return;
    }

    const laneResizeSnapshot = this.laneResizeState;
    if (laneResizeSnapshot) {
      this.laneResizeState = null;

      const laneWidthChanged =
        Math.abs(this.laneWidth() - laneResizeSnapshot.startLaneWidth) > 0.5;
      const laneHeightChanged =
        Math.abs(this.laneHeight() - laneResizeSnapshot.startLaneHeight) > 0.5;
      const laneConfigChanged = laneWidthChanged || laneHeightChanged;

      // Publish final lane config first so subsequent MOVE_NODE optimistic
      // updates do not reuse stale lane dimensions and rollback locally.
      if (laneConfigChanged) {
        this.emitLaneConfigSync(true);
      }

      const movedNodes: NodoCanvas[] = this.nodos().filter((node) => {
        if (node.tipo !== 'ACTIVIDAD') {
          return false;
        }

        const initialPos = laneResizeSnapshot.initialActivityPositions[node.id];
        if (!initialPos) {
          return false;
        }

        return (
          Math.abs(node.x - initialPos.x) > 0.5 ||
          Math.abs(node.y - initialPos.y) > 0.5
        );
      });

      for (const movedNode of movedNodes) {
        this.setPendingMoveGuard(movedNode.id, movedNode.x, movedNode.y);
        this.collabFacade.emitMoveNode(
          movedNode.id,
          this.toPersistedCoordinate(movedNode.x, this.CANVAS_ORIGIN_X),
          this.toPersistedCoordinate(movedNode.y, this.CANVAS_ORIGIN_Y)
        );
      }

      if (movedNodes.length || laneConfigChanged) {
        this.scheduleAutoSave(true);
      }

      return;
    }

    const dragSnapshot = this.dragState;
    const wasPanning = this.isPanning;
    const didPan = this.panMoved;

    this.dragState = null;
    this.isPanning = false;
    this.panMoved = false;

    if (dragSnapshot) {
      const movedNode = this.nodos().find((n) => n.id === dragSnapshot.nodeId);
      if (
        movedNode &&
        (Math.abs(movedNode.x - dragSnapshot.startNodeX) > 0.5 ||
          Math.abs(movedNode.y - dragSnapshot.startNodeY) > 0.5)
      ) {
        this.setPendingMoveGuard(movedNode.id, movedNode.x, movedNode.y);
        this.collabFacade.emitMoveNode(
          movedNode.id,
          this.toPersistedCoordinate(movedNode.x, this.CANVAS_ORIGIN_X),
          this.toPersistedCoordinate(movedNode.y, this.CANVAS_ORIGIN_Y)
        );
        this.scheduleAutoSave(true);
      }
    }

    if (wasPanning && !didPan && !this.connectState()) {
      this.deselectAll();
    }
  }

  // ── Pan ───────────────────────────────────────────────────────
  onCanvasMouseDown(event: MouseEvent): void {
    if (this.isCanvasReadOnly()) {
      if (event.button === 0 || event.button === 1 || event.altKey) {
        this.isPanning = true;
        this.panMoved = false;
        this.panStart = { x: event.clientX, y: event.clientY, px: this.panX(), py: this.panY() };
        event.preventDefault();
      }
      return;
    }

    if (this.connectState()) {
      this.connectState.set(null);
      return;
    }

    if (event.button === 0 || event.button === 1 || event.altKey) {
      this.isPanning = true;
      this.panMoved = false;
      this.panStart = { x: event.clientX, y: event.clientY, px: this.panX(), py: this.panY() };
      event.preventDefault();
    }
  }

  private clampPanX(nextPanX: number, zoomLevel = this.zoom()): number {
    const maxPanX = -this.CANVAS_ORIGIN_X * zoomLevel;
    return Math.min(nextPanX, maxPanX);
  }

  private clampPanY(nextPanY: number, zoomLevel = this.zoom()): number {
    const maxPanY = -this.CANVAS_ORIGIN_Y * zoomLevel;
    return Math.min(nextPanY, maxPanY);
  }

  private setPan(nextPanX: number, nextPanY: number, zoomLevel = this.zoom()): void {
    this.panX.set(this.clampPanX(nextPanX, zoomLevel));
    this.panY.set(this.clampPanY(nextPanY, zoomLevel));
  }

  // ── Zoom ──────────────────────────────────────────────────────
  private applyZoom(nextZoom: number, anchorClientX?: number, anchorClientY?: number): void {
    const prevZoom = this.zoom();
    const clampedZoom = Math.max(0.2, Math.min(3, nextZoom));
    if (clampedZoom === prevZoom) return;

    const wrap = this.canvasWrap?.nativeElement;
    if (!wrap) {
      this.zoom.set(clampedZoom);
      this.setPan(this.panX(), this.panY(), clampedZoom);
      return;
    }

    const rect = wrap.getBoundingClientRect();
    const anchorX = anchorClientX == null ? rect.width / 2 : anchorClientX - rect.left;
    const anchorY = anchorClientY == null ? rect.height / 2 : anchorClientY - rect.top;

    const worldX = (anchorX - this.panX()) / prevZoom;
    const worldY = (anchorY - this.panY()) / prevZoom;

    this.zoom.set(clampedZoom);
    this.setPan(anchorX - worldX * clampedZoom, anchorY - worldY * clampedZoom, clampedZoom);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    this.applyZoom(this.zoom() * delta, event.clientX, event.clientY);
  }

  zoomIn(): void { this.applyZoom(this.zoom() * 1.15); }
  zoomOut(): void { this.applyZoom(this.zoom() * 0.85); }
  resetView(): void {
    this.zoom.set(1);
    this.setPan(-this.CANVAS_ORIGIN_X, -this.CANVAS_ORIGIN_Y, 1);
  }

  // ── Connections ───────────────────────────────────────────────
  private connectionKey(origen: string, destino: string): string {
    return `${origen}->${destino}`;
  }

  private autoTargetPort(from: NodoCanvas, to: NodoCanvas): ConnectionTargetPort {
    if (to.tipo === 'FORK') {
      return 'TOP';
    }

    if (to.tipo === 'JOIN') {
      const fromCenterX = from.x + this.getNodeWidth(from.tipo) / 2;
      const toCenterX = to.x + this.getNodeWidth(to.tipo) / 2;
      return fromCenterX <= toCenterX ? 'LEFT' : 'RIGHT';
    }

    if (to.tipo === 'DECISION' && !this.canDecisionUseBranchPorts(to.id)) {
      return 'TOP';
    }

    if (to.tipo === 'ACTIVIDAD') {
      const fromCenterX = from.x + this.getNodeWidth(from.tipo) / 2;
      const fromCenterY = from.y + this.getNodeHeight(from.tipo) / 2;
      const toCenterX = to.x + this.getNodeWidth(to.tipo) / 2;
      const toCenterY = to.y + this.getNodeHeight(to.tipo) / 2;

      const dx = fromCenterX - toCenterX;
      const dy = fromCenterY - toCenterY;

      if (Math.abs(dx) > Math.abs(dy)) {
        return dx < 0 ? 'LEFT' : 'RIGHT';
      }

      return dy < 0 ? 'TOP' : 'BOTTOM';
    }

    if (!this.hasTopInputPort(to.tipo)) {
      return 'LEFT';
    }

    const fromCenterY = from.y + this.getNodeHeight(from.tipo) / 2;
    const toCenterY = to.y + this.getNodeHeight(to.tipo) / 2;
    return fromCenterY < toCenterY - 12 ? 'TOP' : 'LEFT';
  }

  private initializeConnectionPorts(nodes: NodoCanvas[], connections: Conexion[]): void {
    const previousTargetMap = this.connectionTargetPorts();
    const previousSourceMap = this.connectionSourcePorts();
    const targetMap: Record<string, ConnectionTargetPort> = {};
    const sourceMap: Record<string, ConnectionPort> = {};

    for (const c of connections) {
      const from = nodes.find((n) => n.id === c.origen);
      const to = nodes.find((n) => n.id === c.destino);
      if (!from || !to) continue;
      const key = this.connectionKey(c.origen, c.destino);
      targetMap[key] =
        this.normalizeConnectionPort(c.puertoDestino) ??
        previousTargetMap[key] ??
        this.autoTargetPort(from, to);
      sourceMap[key] =
        this.normalizeConnectionPort(c.puertoOrigen) ??
        previousSourceMap[key] ??
        'RIGHT';
    }

    this.connectionTargetPorts.set(targetMap);
    this.connectionSourcePorts.set(sourceMap);
  }

  private setConnectionTargetPort(origen: string, destino: string, port: ConnectionTargetPort): void {
    const key = this.connectionKey(origen, destino);
    this.connectionTargetPorts.update((map) => ({ ...map, [key]: port }));
    this.persistUiPreferencesForCurrentPolicy();
  }

  private setConnectionSourcePort(origen: string, destino: string, port: ConnectionPort): void {
    const key = this.connectionKey(origen, destino);
    this.connectionSourcePorts.update((map) => ({ ...map, [key]: port }));
    this.persistUiPreferencesForCurrentPolicy();
  }

  private getConnectionTargetPort(c: Conexion): ConnectionTargetPort {
    const persistedPort = this.normalizeConnectionPort(c.puertoDestino);
    if (persistedPort) {
      return persistedPort;
    }

    const key = this.connectionKey(c.origen, c.destino);
    const fixedPort = this.connectionTargetPorts()[key];
    if (fixedPort) {
      return fixedPort;
    }

    const from = this.nodos().find((n) => n.id === c.origen);
    const to = this.nodos().find((n) => n.id === c.destino);
    if (!from || !to) {
      return 'LEFT';
    }

    return this.autoTargetPort(from, to);
  }

  private getConnectionSourcePort(c: Conexion): ConnectionPort {
    const persistedPort = this.normalizeConnectionPort(c.puertoOrigen);
    if (persistedPort) {
      return persistedPort;
    }
    const key = this.connectionKey(c.origen, c.destino);
    return this.connectionSourcePorts()[key] ?? 'RIGHT';
  }

  startConnect(
    event: MouseEvent,
    fromId: string,
    fromPort: ConnectionPort = 'RIGHT'
  ): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const current = this.connectState();
    if (current?.fromNodeId === fromId && current.fromPort === fromPort) {
      this.connectState.set(null);
      return;
    }

    this.selectNode(fromId);
    this.connectState.set({
      fromNodeId: fromId,
      fromPort,
      currentX: event.clientX,
      currentY: event.clientY,
    });
  }

  onNodePortMouseDown(
    event: MouseEvent,
    nodeId: string,
    port: ConnectionPort
  ): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    const node = this.nodos().find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    if (this.connectState()) {
      if (!this.isNodePortInput(node, port)) {
        this.toast.error(
          'Conexión inválida',
          'Ese puerto es de salida. Termina la conexión en un puerto de entrada.'
        );
        return;
      }

      this.finishConnect(nodeId, port, event);
      return;
    }

    if (!this.isNodePortOutput(node, port)) {
      this.toast.info(
        'Puerto de entrada',
        'Inicia la conexión desde un puerto de salida.'
      );
      return;
    }

    this.startConnect(event, nodeId, port);
  }

  finishConnect(
    toId: string,
    targetPort: ConnectionTargetPort | null = null,
    event?: MouseEvent
  ): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    event?.preventDefault();
    event?.stopPropagation();

    const cs = this.connectState();
    if (!cs) return;

    if (cs.fromNodeId === toId) {
      return;
    }

    const fromNode = this.nodos().find((n) => n.id === cs.fromNodeId);
    const toNode = this.nodos().find((n) => n.id === toId);
    let resolvedPort: ConnectionTargetPort =
      targetPort ?? (fromNode && toNode ? this.autoTargetPort(fromNode, toNode) : 'LEFT');

    if (toNode?.tipo === 'DECISION' && !this.canDecisionUseBranchPorts(toId)) {
      resolvedPort = 'TOP';
    }

    const resolvedSourcePort: ConnectionPort = cs.fromPort;

    if (fromNode && !this.isNodePortOutput(fromNode, resolvedSourcePort)) {
      this.toast.error(
        'Conexión inválida',
        'El puerto de origen seleccionado no permite salida.'
      );
      return;
    }

    if (toNode && !this.isNodePortInput(toNode, resolvedPort)) {
      this.toast.error(
        'Conexión inválida',
        'El puerto de destino seleccionado no permite entrada.'
      );
      return;
    }

    const limitToSingleDecisionBranch =
      fromNode?.tipo === 'DECISION' &&
      (resolvedSourcePort === 'LEFT' || resolvedSourcePort === 'RIGHT');

    const previousConnections = this.conexiones();
    const parallelGatewayConnectionError = this.validateParallelGatewayConnectionRules(
      fromNode,
      toNode,
      cs.fromNodeId,
      toId,
      resolvedSourcePort,
      resolvedPort,
      previousConnections
    );
    if (parallelGatewayConnectionError) {
      this.toast.error('Conexión inválida', parallelGatewayConnectionError);
      return;
    }

    const removedBranchConnections = limitToSingleDecisionBranch
      ? previousConnections.filter(
          (connection) =>
            connection.origen === cs.fromNodeId &&
            this.getConnectionSourcePort(connection) === resolvedSourcePort &&
            connection.destino !== toId
        )
      : [];

    const baseConnections = limitToSingleDecisionBranch
      ? previousConnections.filter(
          (connection) =>
            !(
              connection.origen === cs.fromNodeId &&
              this.getConnectionSourcePort(connection) === resolvedSourcePort &&
              connection.destino !== toId
            )
        )
      : previousConnections;

    const exists = baseConnections.some(
      (connection) => connection.origen === cs.fromNodeId && connection.destino === toId
    );
    const newConexion: Conexion = {
      origen: cs.fromNodeId,
      destino: toId,
      puertoOrigen: resolvedSourcePort,
      puertoDestino: resolvedPort
    };

    const nextConnections = !exists
      ? [...baseConnections, newConexion]
      : baseConnections.map((connection) =>
          connection.origen === cs.fromNodeId && connection.destino === toId
            ? newConexion
            : connection
        );

    this.conexiones.set(nextConnections);

    for (const removedConnection of removedBranchConnections) {
      this.deleteConnectionPortMetadata(removedConnection.origen, removedConnection.destino);
      this.collabFacade.emitDeleteEdge({
        origen: removedConnection.origen,
        destino: removedConnection.destino,
      });
    }

    this.collabFacade.emitCreateEdge(newConexion);

    this.setConnectionTargetPort(cs.fromNodeId, toId, resolvedPort);
    this.setConnectionSourcePort(cs.fromNodeId, toId, resolvedSourcePort);

    const resolvedConnections = this.withResolvedConnectionPorts(this.conexiones());
    this.conexiones.set(resolvedConnections);

    if (fromNode?.tipo === 'DECISION') {
      this.syncDecisionConditionDestinations(fromNode.id);
    }

    this.scheduleAutoSave(true);

    this.connectState.set(null);
    this.selectNode(toId);
  }

  getLiveConnectPoint(cs: ConnectState): { x: number; y: number } {
    const wrap = this.canvasWrap?.nativeElement;
    if (!wrap) {
      return {
        x: (cs.currentX - this.panX()) / this.zoom(),
        y: (cs.currentY - this.panY()) / this.zoom(),
      };
    }

    const rect = wrap.getBoundingClientRect();
    return {
      x: (cs.currentX - rect.left - this.panX()) / this.zoom(),
      y: (cs.currentY - rect.top - this.panY()) / this.zoom(),
    };
  }

  isConnectSource(nodeId: string): boolean {
    return this.connectState()?.fromNodeId === nodeId;
  }

  isConnectSourcePort(nodeId: string, port: ConnectionPort): boolean {
    const cs = this.connectState();
    return !!cs && cs.fromNodeId === nodeId && cs.fromPort === port;
  }

  canConnectToNode(nodeId: string): boolean {
    const cs = this.connectState();
    return !!cs && cs.fromNodeId !== nodeId;
  }

  canConnectToPort(node: NodoCanvas, port: ConnectionPort): boolean {
    const cs = this.connectState();
    return !!cs && cs.fromNodeId !== node.id && this.isNodePortInput(node, port);
  }

  isDirectionalGateway(node: NodoCanvas): boolean {
    return node.tipo === 'FORK' || node.tipo === 'JOIN';
  }

  hasNodePort(node: NodoCanvas, port: ConnectionPort): boolean {
    return this.isNodePortInput(node, port) || this.isNodePortOutput(node, port);
  }

  isNodePortInput(node: NodoCanvas, port: ConnectionPort): boolean {
    switch (node.tipo) {
      case 'INICIO':
        return false;
      case 'FIN':
        return port === 'LEFT';
      case 'ACTIVIDAD':
        return (
          port === 'LEFT' ||
          port === 'RIGHT' ||
          port === 'TOP' ||
          port === 'BOTTOM'
        );
      case 'DECISION':
        if (!this.canDecisionUseBranchPorts(node.id)) {
          return port === 'TOP';
        }
        return port === 'LEFT' || port === 'RIGHT' || port === 'TOP';
      case 'FORK':
        return port === 'TOP';
      case 'JOIN':
        return port === 'LEFT' || port === 'RIGHT';
      default:
        return false;
    }
  }

  isNodePortOutput(node: NodoCanvas, port: ConnectionPort): boolean {
    switch (node.tipo) {
      case 'INICIO':
        return port === 'RIGHT';
      case 'FIN':
        return false;
      case 'ACTIVIDAD':
        return (
          port === 'LEFT' ||
          port === 'RIGHT' ||
          port === 'TOP' ||
          port === 'BOTTOM'
        );
      case 'DECISION':
        if (!this.canDecisionUseBranchPorts(node.id)) {
          return port === 'TOP';
        }
        return port === 'LEFT' || port === 'RIGHT' || port === 'TOP';
      case 'FORK':
        return port === 'LEFT' || port === 'RIGHT';
      case 'JOIN':
        return port === 'BOTTOM';
      default:
        return false;
    }
  }

  canDecisionUseBranchPorts(nodeId: string): boolean {
    const node = this.nodos().find((n) => n.id === nodeId);
    if (!node || node.tipo !== 'DECISION') {
      return true;
    }

    return this.hasDecisionIncomingConnection(nodeId);
  }

  hasDecisionBranchConnection(nodeId: string, sourcePort: 'LEFT' | 'RIGHT'): boolean {
    return this.conexiones().some(
      (connection) =>
        connection.origen === nodeId &&
        this.getConnectionSourcePort(connection) === sourcePort
    );
  }

  private hasDecisionIncomingConnection(nodeId: string): boolean {
    return this.conexiones().some((connection) => connection.destino === nodeId);
  }

  private validateParallelGatewayConnectionRules(
    fromNode: NodoCanvas | undefined,
    toNode: NodoCanvas | undefined,
    fromId: string,
    toId: string,
    sourcePort: ConnectionPort,
    targetPort: ConnectionTargetPort,
    connections: ReadonlyArray<Conexion>
  ): string | null {
    if (!fromNode || !toNode) {
      return null;
    }

    if (fromNode.tipo === 'FORK' && sourcePort !== 'LEFT' && sourcePort !== 'RIGHT') {
      return 'El nodo FORK debe salir por los puertos laterales (izquierda/derecha).';
    }

    if (toNode.tipo === 'FORK' && targetPort !== 'TOP') {
      return 'El nodo FORK recibe su entrada por el puerto superior.';
    }

    if (toNode.tipo === 'JOIN' && targetPort !== 'LEFT' && targetPort !== 'RIGHT') {
      return 'El nodo JOIN recibe entradas por los puertos laterales (izquierda/derecha).';
    }

    if (fromNode.tipo === 'JOIN' && sourcePort !== 'BOTTOM') {
      return 'El nodo JOIN sale por el puerto inferior.';
    }

    if (toNode.tipo === 'FORK') {
      const hasIncomingFromAnotherNode = connections.some(
        (connection) => connection.destino === toId && connection.origen !== fromId
      );
      if (hasIncomingFromAnotherNode) {
        return 'El nodo FORK solo permite una entrada.';
      }
    }

    if (fromNode.tipo === 'JOIN') {
      const hasOutgoingToAnotherNode = connections.some(
        (connection) => connection.origen === fromId && connection.destino !== toId
      );
      if (hasOutgoingToAnotherNode) {
        return 'El nodo JOIN solo permite una salida.';
      }
    }

    return null;
  }

  private validateParallelGatewayTopology(
    nodes: ReadonlyArray<NodoCanvas> = this.nodos(),
    connections: ReadonlyArray<Conexion> = this.conexiones()
  ): { nodeId: string; message: string } | null {
    for (const node of nodes) {
      if (node.tipo !== 'FORK' && node.tipo !== 'JOIN') {
        continue;
      }

      const incoming = connections.filter(
        (connection) => connection.destino === node.id
      ).length;
      const outgoing = connections.filter(
        (connection) => connection.origen === node.id
      ).length;
      const nodeLabel = this.getNodeValidationLabel(node);

      if (node.tipo === 'FORK') {
        if (incoming !== 1) {
          return {
            nodeId: node.id,
            message: `${nodeLabel} debe tener exactamente 1 entrada.`,
          };
        }

        if (outgoing < 2) {
          return {
            nodeId: node.id,
            message: `${nodeLabel} debe tener 2 o más salidas.`,
          };
        }

        continue;
      }

      if (incoming < 2) {
        return {
          nodeId: node.id,
          message: `${nodeLabel} debe tener 2 o más entradas.`,
        };
      }

      if (outgoing !== 1) {
        return {
          nodeId: node.id,
          message: `${nodeLabel} debe tener exactamente 1 salida.`,
        };
      }
    }

    return null;
  }

  private getNodeValidationLabel(node: Pick<NodoCanvas, 'id' | 'nombre'>): string {
    const name = node.nombre?.trim();
    if (!name) {
      return `El nodo ${node.id}`;
    }

    return `El nodo "${name}" (${node.id})`;
  }

  deleteConexion(origen: string, destino: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.conexiones.update((cs) => cs.filter((c) => !(c.origen === origen && c.destino === destino)));
    this.deleteConnectionPortMetadata(origen, destino);
    this.persistUiPreferencesForCurrentPolicy();

    this.collabFacade.emitDeleteEdge({ origen, destino });

    const originNode = this.nodos().find((node) => node.id === origen);
    if (originNode?.tipo === 'DECISION') {
      this.syncDecisionConditionDestinations(origen);
    }

    this.scheduleAutoSave(true);
  }

  private deleteConnectionPortMetadata(origen: string, destino: string): void {
    const key = this.connectionKey(origen, destino);

    this.connectionTargetPorts.update((map) => {
      if (!(key in map)) return map;
      const next = { ...map };
      delete next[key];
      return next;
    });

    this.connectionSourcePorts.update((map) => {
      if (!(key in map)) return map;
      const next = { ...map };
      delete next[key];
      return next;
    });
  }

  private syncDecisionConditionDestinations(nodeId: string): void {
    const decisionNode = this.nodos().find(
      (node) => node.id === nodeId && node.tipo === 'DECISION'
    );

    if (!decisionNode?.condiciones?.length) {
      return;
    }

    const trueTarget = this.getDecisionBranchTargetNodeId(nodeId, 'RIGHT');
    const falseTarget = this.getDecisionBranchTargetNodeId(nodeId, 'LEFT');

    const nextCondiciones = decisionNode.condiciones.map((condicion) => {
      const normalizedResult = (condicion.resultado ?? '').trim().toUpperCase();
      const isTrueBranchCondition =
        !!condicion.grupo ||
        normalizedResult === 'TRUE' ||
        normalizedResult === 'SI' ||
        normalizedResult === 'YES';
      const isFalseBranchCondition =
        normalizedResult === 'FALSE' ||
        normalizedResult === 'NO' ||
        normalizedResult === '*' ||
        normalizedResult === 'DEFAULT' ||
        normalizedResult === 'ELSE';

      if (isTrueBranchCondition && trueTarget && condicion.siguiente !== trueTarget) {
        return { ...condicion, siguiente: trueTarget };
      }

      if (isFalseBranchCondition && falseTarget && condicion.siguiente !== falseTarget) {
        return { ...condicion, siguiente: falseTarget };
      }

      return condicion;
    });

    const changed =
      JSON.stringify(nextCondiciones) !== JSON.stringify(decisionNode.condiciones);
    if (!changed) {
      return;
    }

    this.nodos.update((nodes) =>
      nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              condiciones: nextCondiciones,
            }
          : node
      )
    );

    const updatedNode = this.nodos().find((node) => node.id === nodeId);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { condiciones: updatedNode?.condiciones ?? [] },
      updatedNode?.version
    );
  }

  // ── Node geometry helpers ─────────────────────────────────────
  getNodeWidth(tipo: TipoNodo): number {
    if (tipo === 'FORK' || tipo === 'JOIN') return 160;
    if (tipo === 'INICIO' || tipo === 'FIN') return 120;
    if (tipo === 'DECISION') return 130;
    return 160;
  }

  getNodeHeight(tipo: TipoNodo): number {
    if (tipo === 'FORK' || tipo === 'JOIN') return 30;
    if (tipo === 'INICIO' || tipo === 'FIN') return 50;
    if (tipo === 'DECISION') return 80;
    return 80; // Incremented for ACTIVIDAD to accommodate responsible badge
  }

  getNodeCenter(n: NodoCanvas): { x: number; y: number } {
    return { x: n.x + this.getNodeWidth(n.tipo) / 2, y: n.y + this.getNodeHeight(n.tipo) / 2 };
  }

  getNodePortPoint(n: NodoCanvas, port: ConnectionPort): { x: number; y: number } {
    if (port === 'RIGHT') {
      return {
        x: n.x + this.getNodeWidth(n.tipo),
        y: n.y + this.getNodeHeight(n.tipo) / 2,
      };
    }

    if (port === 'LEFT') {
      return {
        x: n.x,
        y: n.y + this.getNodeHeight(n.tipo) / 2,
      };
    }

    if (port === 'TOP' && this.hasTopInputPort(n.tipo)) {
      return this.getNodeTopInputPoint(n);
    }

    if (port === 'BOTTOM' && this.hasBottomPort(n.tipo)) {
      return this.getNodeBottomInputPoint(n);
    }

    return {
      x: n.x,
      y: n.y + this.getNodeHeight(n.tipo) / 2,
    };
  }

  getNodeOutputPoint(n: NodoCanvas): { x: number; y: number } {
    return this.getNodePortPoint(n, 'RIGHT');
  }

  hasTopInputPort(tipo: TipoNodo): boolean {
    return tipo === 'ACTIVIDAD' || tipo === 'DECISION' || tipo === 'FORK';
  }

  hasBottomPort(tipo: TipoNodo): boolean {
    return tipo === 'ACTIVIDAD' || tipo === 'JOIN';
  }

  getNodeTopInputLocalY(tipo: TipoNodo): number {
    if (tipo === 'ACTIVIDAD') return 0;
    if (tipo === 'DECISION') return 2;
    if (tipo === 'FORK' || tipo === 'JOIN') return 10;
    return 0;
  }

  getNodeBottomInputLocalY(tipo: TipoNodo): number {
    if (tipo === 'JOIN') return 20;
    return this.getNodeHeight(tipo);
  }

  getNodeTopInputPoint(n: NodoCanvas): { x: number; y: number } {
    return {
      x: n.x + this.getNodeWidth(n.tipo) / 2,
      y: n.y + this.getNodeTopInputLocalY(n.tipo),
    };
  }

  getNodeBottomInputPoint(n: NodoCanvas): { x: number; y: number } {
    return {
      x: n.x + this.getNodeWidth(n.tipo) / 2,
      y: n.y + this.getNodeBottomInputLocalY(n.tipo),
    };
  }

  getNodeInputPoint(n: NodoCanvas, port: ConnectionTargetPort = 'LEFT'): { x: number; y: number } {
    return this.getNodePortPoint(n, port);
  }

  private portTangent(port: ConnectionPort): { x: number; y: number } {
    if (port === 'RIGHT') return { x: 1, y: 0 };
    if (port === 'LEFT') return { x: -1, y: 0 };
    if (port === 'TOP') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }

  private resolveConnectionCurve(c: Conexion): {
    fromPoint: { x: number; y: number };
    toPoint: { x: number; y: number };
    c1: { x: number; y: number };
    c2: { x: number; y: number };
  } | null {
    const from = this.nodos().find((n) => n.id === c.origen);
    const to = this.nodos().find((n) => n.id === c.destino);
    if (!from || !to) return null;

    const sourcePort = this.getConnectionSourcePort(c);
    const fromPoint = this.getNodePortPoint(from, sourcePort);
    const targetPort = this.getConnectionTargetPort(c);
    const toPoint = this.getNodeInputPoint(to, targetPort);

    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const distance = Math.hypot(dx, dy);
    const handle = Math.max(38, Math.min(140, distance * 0.35));

    const sourceTangent = this.portTangent(sourcePort);
    const targetTangent = this.portTangent(targetPort);

    return {
      fromPoint,
      toPoint,
      c1: {
        x: fromPoint.x + sourceTangent.x * handle,
        y: fromPoint.y + sourceTangent.y * handle,
      },
      c2: {
        x: toPoint.x + targetTangent.x * handle,
        y: toPoint.y + targetTangent.y * handle,
      },
    };
  }

  // ── SVG path for arrow ────────────────────────────────────────
  getArrowPath(c: Conexion): string {
    const curve = this.resolveConnectionCurve(c);
    if (!curve) return '';

    return `M ${curve.fromPoint.x} ${curve.fromPoint.y} C ${curve.c1.x} ${curve.c1.y}, ${curve.c2.x} ${curve.c2.y}, ${curve.toPoint.x} ${curve.toPoint.y}`;
  }

  getArrowMid(c: Conexion): { x: number; y: number } | null {
    const curve = this.resolveConnectionCurve(c);
    if (!curve) return null;

    const t = 0.5;
    const mt = 1 - t;

    const x =
      mt * mt * mt * curve.fromPoint.x +
      3 * mt * mt * t * curve.c1.x +
      3 * mt * t * t * curve.c2.x +
      t * t * t * curve.toPoint.x;

    const y =
      mt * mt * mt * curve.fromPoint.y +
      3 * mt * mt * t * curve.c1.y +
      3 * mt * t * t * curve.c2.y +
      t * t * t * curve.toPoint.y;

    return { x, y };
  }

  // ── Node color ────────────────────────────────────────────────
  nodeColor(tipo: TipoNodo): string {
    const colors: Record<TipoNodo, string> = {
      INICIO: '#4ade80',
      ACTIVIDAD: '#6366f1',
      DECISION: '#f59e0b',
      FORK: '#06b6d4',
      JOIN: '#06b6d4',
      FIN: '#f43f5e',
    };
    return colors[tipo];
  }

  nodeBg(tipo: TipoNodo): string {
    const colors: Record<TipoNodo, string> = {
      INICIO: '#052e16',
      ACTIVIDAD: '#1e1b4b',
      DECISION: '#431407',
      FORK: '#083344',
      JOIN: '#083344',
      FIN: '#4c0519',
    };
    return colors[tipo];
  }

  deptColor(deptId: string): string {
    const palette = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899'];
    let hash = 0;
    for (const c of deptId) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  getDeptName(id: string | null): string {
    if (!id) return 'Departamento no asignado';
    return this.departamentos().find((d) => d.id === id)?.nombre ?? id;
  }

  getResponsableNombre(node: NodoCanvas): string {
    if (node.tipo !== 'ACTIVIDAD' || !node.responsableId || !node.responsableTipo) return 'Sin asignar';
    if (node.responsableTipo === 'USUARIO') {
      if (
        node.responsableId === this.RESPONSABLE_USUARIO_FINAL_ID ||
        node.responsableId === this.RESPONSABLE_INICIADOR_TRAMITE_ID
      ) {
        return 'Quien inicio el tramite';
      }

      const u = this.usuarios().find(x => x.id === node.responsableId);
      return u ? u.nombre : 'Usuario no encontrado';
    } else {
      const d = this.departamentos().find(x => x.id === node.responsableId);
      return d ? d.nombre : 'Depto no encontrado';
    }
  }

  getResponsableTipoSelectValue(node: NodoCanvas | null | undefined): string {
    if (!node || node.tipo !== 'ACTIVIDAD' || !node.responsableTipo) {
      return '';
    }

    if (node.responsableTipo === 'DEPARTAMENTO') {
      return 'DEPARTAMENTO';
    }

    if (
      node.responsableId === this.RESPONSABLE_USUARIO_FINAL_ID ||
      node.responsableId === this.RESPONSABLE_INICIADOR_TRAMITE_ID
    ) {
      return 'INICIADOR_TRAMITE';
    }

    return 'USUARIO';
  }

  isResponsableUsuarioEspecifico(node: NodoCanvas | null | undefined): boolean {
    return this.getResponsableTipoSelectValue(node) === 'USUARIO';
  }

  isResponsableNodeInvalid(node: NodoCanvas | null | undefined): boolean {
    if (!node || node.tipo !== 'ACTIVIDAD') {
      return false;
    }

    const selection = this.getResponsableTipoSelectValue(node);
    if (!selection) {
      return true;
    }

    if (selection === 'USUARIO') {
      return !node.responsableId;
    }

    if (selection === 'DEPARTAMENTO') {
      return !node.departamentoId;
    }

    return false;
  }

  private getNodeVersion(nodeId: string): number | undefined {
    return this.nodos().find((node) => node.id === nodeId)?.version;
  }

  isCurrentUser(userId: string): boolean {
    return this.currentUserId() === userId;
  }

  getNodeLock(nodeId: string): ColaboracionNodoBloqueadoPayload | null {
    return this.nodeSoftLocks()[nodeId] ?? null;
  }

  hasNodeEditors(nodeId: string): boolean {
    return (this.getNodeLock(nodeId)?.editores?.length ?? 0) > 0;
  }

  hasNodeEditorsFromOthers(nodeId: string): boolean {
    const myUserId = this.currentUserId();
    if (!myUserId) {
      return this.hasNodeEditors(nodeId);
    }

    const lock = this.getNodeLock(nodeId);
    if (!lock) {
      return false;
    }

    return lock.editores.some((editor) => editor.userId !== myUserId);
  }

  hasNodeCollision(nodeId: string): boolean {
    const lock = this.getNodeLock(nodeId);
    if (!lock) {
      return false;
    }

    if (lock.advertenciaColision) {
      return true;
    }

    const uniqueEditors = new Set(lock.editores.map((editor) => editor.userId));
    return uniqueEditors.size > 1;
  }

  getNodeEditorLabel(nodeId: string): string {
    const lock = this.getNodeLock(nodeId);
    if (!lock?.editores?.length) {
      return '';
    }

    const myUserId = this.currentUserId();
    const editors = lock.editores;
    const otherEditors = myUserId
      ? editors.filter((editor) => editor.userId !== myUserId)
      : editors;

    if (!otherEditors.length && editors.length === 1) {
      return 'Editando ahora';
    }

    if (this.hasNodeCollision(nodeId)) {
      return lock.aviso || 'Edición concurrente';
    }

    if (otherEditors.length === 1) {
      return `${otherEditors[0].nombre} está editando`;
    }

    return `${otherEditors.length} usuarios editando`;
  }

  private isResponsableSelectionComplete(node: NodoCanvas | null | undefined): boolean {
    if (!node || node.tipo !== 'ACTIVIDAD') {
      return true;
    }

    if (node.responsableTipo === 'USUARIO') {
      return !!node.responsableId;
    }

    if (node.responsableTipo === 'DEPARTAMENTO') {
      return !!node.responsableId;
    }

    return true;
  }

  private hasPendingResponsableSelection(): boolean {
    return this.nodos().some((node) => !this.isResponsableSelectionComplete(node));
  }

  // ── Sidebar / Form editing ────────────────────────────────────
  updateNodeName(id: string, name: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.setPendingNodeNameGuard(id, name);
    this.nodos.update((ns) => ns.map((n) => (n.id === id ? { ...n, nombre: name } : n)));
    this.scheduleNodeNameSync(id);
    this.scheduleAutoSave();
  }

  updateNodeTipo(id: string, newTipoStr: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    const newTipo = newTipoStr as TipoNodo;

    const previousNode = this.nodos().find((node) => node.id === id);
    this.nodos.update((ns) => ns.map((n) => {
      if (n.id === id) {
        if (newTipo === 'ACTIVIDAD') {
          const requiredDeptId = this.resolveRequiredDepartmentId(n.departamentoId);
          if (!requiredDeptId) {
            return n;
          }

          const nextPos = this.clampActivityPositionToLane(requiredDeptId, n.x, n.y);
          return {
            ...n,
            tipo: newTipo,
            departamentoId: requiredDeptId,
            responsableTipo: n.responsableTipo,
            responsableId: n.responsableTipo === 'DEPARTAMENTO' ? requiredDeptId : n.responsableId,
            x: nextPos.x,
            y: nextPos.y,
          };
        }

        return {
          ...n,
          tipo: newTipo,
          departamentoId: null,
          // Si deja de ser ACTIVIDAD, limpiamos los responsables
          responsableTipo: null,
          responsableId: null,
        };
      }
      return n;
    }));
    const updatedNode = this.nodos().find((node) => node.id === id);
    this.collabFacade.emitUpdateNode(
      id,
      {
        tipo: newTipo,
        departamentoId: updatedNode?.departamentoId ?? null,
        responsableTipo: updatedNode?.responsableTipo ?? null,
        responsableId: updatedNode?.responsableId ?? null,
      },
      updatedNode?.version
    );

    if (
      updatedNode?.tipo === 'ACTIVIDAD' &&
      previousNode &&
      (Math.abs(updatedNode.x - previousNode.x) > 0.5 ||
        Math.abs(updatedNode.y - previousNode.y) > 0.5)
    ) {
      this.setPendingMoveGuard(updatedNode.id, updatedNode.x, updatedNode.y);
      this.collabFacade.emitMoveNode(
        updatedNode.id,
        this.toPersistedCoordinate(updatedNode.x, this.CANVAS_ORIGIN_X),
        this.toPersistedCoordinate(updatedNode.y, this.CANVAS_ORIGIN_Y)
      );
    }

    this.scheduleAutoSave();
  }

  updateNodeDept(id: string, deptId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (deptId === 'CREATE_NEW') {
      this.pendingNodeFromPalette = null;
      this.creatingNewDept.set(true);
      this.showDeptModal.set(true);
      return;
    }

    const previousNode = this.nodos().find((node) => node.id === id);

    this.nodos.update((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;

        if (n.tipo === 'ACTIVIDAD') {
          const nextDeptId = this.resolveRequiredDepartmentId(deptId);
          if (!nextDeptId) {
            return n;
          }

          const nextPos = this.clampActivityPositionToLane(nextDeptId, n.x, n.y);
          return {
            ...n,
            departamentoId: nextDeptId,
            responsableId: n.responsableTipo === 'DEPARTAMENTO' ? nextDeptId : n.responsableId,
            x: nextPos.x,
            y: nextPos.y,
          };
        }

        const nextDeptId = deptId || null;
        return {
          ...n,
          departamentoId: nextDeptId,
          // Si el responsable es por departamento, queda sincronizado con el carril.
          responsableId: n.responsableTipo === 'DEPARTAMENTO' ? nextDeptId : n.responsableId,
        };
      })
    );

    const updatedNode = this.nodos().find((node) => node.id === id);
    if (!this.isResponsableSelectionComplete(updatedNode)) {
      return;
    }

    this.collabFacade.emitUpdateNode(
      id,
      {
        departamentoId: updatedNode?.departamentoId ?? null,
        responsableTipo: updatedNode?.responsableTipo ?? null,
        responsableId: updatedNode?.responsableId ?? null,
      },
      updatedNode?.version
    );

    if (
      updatedNode?.tipo === 'ACTIVIDAD' &&
      previousNode &&
      (Math.abs(updatedNode.x - previousNode.x) > 0.5 ||
        Math.abs(updatedNode.y - previousNode.y) > 0.5)
    ) {
      this.setPendingMoveGuard(updatedNode.id, updatedNode.x, updatedNode.y);
      this.collabFacade.emitMoveNode(
        updatedNode.id,
        this.toPersistedCoordinate(updatedNode.x, this.CANVAS_ORIGIN_X),
        this.toPersistedCoordinate(updatedNode.y, this.CANVAS_ORIGIN_Y)
      );
    }

    this.scheduleAutoSave();
  }

  updateNodeResponsableTipo(id: string, tipo: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    const selection = (tipo || '').trim();

    this.nodos.update((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;

        const nextResponsableTipo: ResponsableTipo | null =
          selection === 'DEPARTAMENTO' ||
          selection === 'USUARIO' ||
          selection === 'INICIADOR_TRAMITE'
            ? (selection === 'DEPARTAMENTO' ? 'DEPARTAMENTO' : 'USUARIO')
            : null;

        const nextResponsableId =
          selection === 'DEPARTAMENTO'
            ? n.departamentoId
            : selection === 'USUARIO'
              ? n.responsableId === this.RESPONSABLE_USUARIO_FINAL_ID ||
                n.responsableId === this.RESPONSABLE_INICIADOR_TRAMITE_ID
                ? null
                : n.responsableId
              : selection === 'INICIADOR_TRAMITE'
                  ? this.RESPONSABLE_INICIADOR_TRAMITE_ID
                  : null;

        if (
          n.responsableTipo === nextResponsableTipo &&
          n.responsableId === nextResponsableId
        ) {
          return n;
        }

        if (!nextResponsableTipo) {
          return {
            ...n,
            responsableTipo: null,
            responsableId: null,
          };
        }

        if (nextResponsableTipo === 'DEPARTAMENTO') {
          return {
            ...n,
            responsableTipo: nextResponsableTipo,
            // Para DEPARTAMENTO no se selecciona usuario; se usa el depto del carril.
            responsableId: nextResponsableId,
          };
        }

        return {
          ...n,
          responsableTipo: nextResponsableTipo,
          responsableId: nextResponsableId,
        };
      })
    );

    const updatedNode = this.nodos().find((node) => node.id === id);
    if (!this.isResponsableSelectionComplete(updatedNode)) {
      return;
    }

    this.collabFacade.emitUpdateNode(
      id,
      {
        responsableTipo: updatedNode?.responsableTipo ?? null,
        responsableId: updatedNode?.responsableId ?? null,
      },
      updatedNode?.version
    );
    this.scheduleAutoSave();
  }

  updateNodeResponsableId(id: string, responsableId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.nodos.update((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;

        if (n.responsableTipo !== 'USUARIO') {
          return n;
        }

        const nextResponsableId = responsableId || null;
        if (nextResponsableId === n.responsableId) {
          return n;
        }

        return { ...n, responsableId: nextResponsableId };
      })
    );

    const updatedNode = this.nodos().find((node) => node.id === id);
    if (!this.isResponsableSelectionComplete(updatedNode)) {
      return;
    }

    this.collabFacade.emitUpdateNode(
      id,
      {
        responsableTipo: updatedNode?.responsableTipo ?? null,
        responsableId: updatedNode?.responsableId ?? null,
      },
      this.getNodeVersion(id)
    );
    this.scheduleAutoSave();
  }

  startCreateDept(): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.creatingNewDept.set(true);
    this.newDeptName.set('');
  }

  closeDeptModal(): void {
    this.creatingNewDept.set(false);
    this.newDeptName.set('');
    this.editingDeptId.set(null);
    this.editDeptName.set('');
    this.pendingNodeFromPalette = null;
    this.showDeptModal.set(false);
  }

  cancelCreateDept(): void {
    this.creatingNewDept.set(false);
    this.newDeptName.set('');
  }

  confirmCreateDept(): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    const name = this.newDeptName().trim();
    if (!name) return;
    this.savingDept.set(true);
    this.deptSvc.createDepartment({ nombre: name, descripcion: '' }).subscribe({
      next: (d) => {
        this.departamentos.update(depts => [...depts, d]);
        this.savingDept.set(false);
        this.creatingNewDept.set(false);
        this.toast.success('Éxito', 'Departamento creado');

        if (this.pendingNodeFromPalette) {
          this.selectDeptForPending(d.id);
        } else if (this.selectedNodeId()) {
          this.updateNodeDept(this.selectedNodeId()!, d.id);
          this.closeDeptModal();
        } else {
          this.closeDeptModal();
        }
      },
      error: () => {
        this.savingDept.set(false);
        this.toast.error('Error', 'No se pudo crear el departamento');
      }
    });
  }

  startEditDept(event: Event, dept: AdministradorDepartamento): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    event.stopPropagation();
    this.editingDeptId.set(dept.id);
    this.editDeptName.set(dept.nombre);
  }

  cancelEditDept(event: Event): void {
    event.stopPropagation();
    this.editingDeptId.set(null);
    this.editDeptName.set('');
  }

  saveEditDept(event: Event, id: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    event.stopPropagation();
    const name = this.editDeptName().trim();
    if (!name) return;
    this.savingDept.set(true);
    this.deptSvc.updateDepartment(id, { nombre: name, descripcion: '' }).subscribe({
      next: (d) => {
        this.departamentos.update(depts => depts.map(x => x.id === id ? { ...x, nombre: d.nombre } : x));
        this.savingDept.set(false);
        this.editingDeptId.set(null);
        this.toast.success('Éxito', 'Departamento actualizado');
      },
      error: () => {
        this.savingDept.set(false);
        this.toast.error('Error', 'No se pudo actualizar el departamento');
      }
    });
  }

  deleteDept(event: Event, id: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    event.stopPropagation();

    const remainingDepartments = this.departamentos().filter((d) => d.id !== id);
    const fallbackDepartment = remainingDepartments[0] ?? null;
    const affectedActivities = this.nodos().filter(
      (n) => n.tipo === 'ACTIVIDAD' && n.departamentoId === id
    );

    if (affectedActivities.length && !fallbackDepartment) {
      this.toast.error(
        'Departamentos',
        'No puedes eliminar el único departamento cuando existen actividades en el flujo.'
      );
      return;
    }

    const confirmMessage =
      affectedActivities.length && fallbackDepartment
        ? `¿Seguro que deseas eliminar este departamento? Las actividades asignadas se moverán al carril ${fallbackDepartment.nombre}.`
        : '¿Seguro que deseas eliminar este departamento?';

    if (!confirm(confirmMessage)) return;

    this.savingDept.set(true);
    this.deptSvc.deleteDepartment(id).subscribe({
      next: () => {
        const reassignedActivityNodes: NodoCanvas[] = [];

        this.departamentos.update(depts => depts.filter(d => d.id !== id));
        this.nodos.update((ns) =>
          ns.map((n) => {
            if (n.departamentoId !== id) {
              return n;
            }

            if (n.tipo === 'ACTIVIDAD' && fallbackDepartment) {
              const nextPos = this.clampActivityPositionToLane(
                fallbackDepartment.id,
                n.x,
                n.y
              );
              const updatedNode: NodoCanvas = {
                ...n,
                departamentoId: fallbackDepartment.id,
                responsableId:
                  n.responsableTipo === 'DEPARTAMENTO'
                    ? fallbackDepartment.id
                    : n.responsableId,
                x: nextPos.x,
                y: nextPos.y,
              };
              reassignedActivityNodes.push(updatedNode);
              return updatedNode;
            }

            return { ...n, departamentoId: null };
          })
        );

        for (const reassignedNode of reassignedActivityNodes) {
          this.collabFacade.emitUpdateNode(
            reassignedNode.id,
            {
              departamentoId: reassignedNode.departamentoId,
              responsableTipo: reassignedNode.responsableTipo ?? null,
              responsableId: reassignedNode.responsableId ?? null,
            },
            reassignedNode.version
          );
          this.setPendingMoveGuard(reassignedNode.id, reassignedNode.x, reassignedNode.y);
          this.collabFacade.emitMoveNode(
            reassignedNode.id,
            this.toPersistedCoordinate(reassignedNode.x, this.CANVAS_ORIGIN_X),
            this.toPersistedCoordinate(reassignedNode.y, this.CANVAS_ORIGIN_Y)
          );
        }
        this.savingDept.set(false);
        this.scheduleAutoSave(true);
        this.toast.success('Éxito', 'Departamento eliminado');
      },
      error: (err) => {
        this.savingDept.set(false);
        this.toast.error('Error', err.error?.message || 'No se pudo eliminar el departamento');
      }
    });
  }

  addCampo(nodeId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (!this.newCampo.campo.trim()) return;
    const campo: CampoFormulario = { campo: this.newCampo.campo.trim(), tipo: this.newCampo.tipo };
    this.nodos.update((ns) =>
      ns.map((n) => (n.id === nodeId ? { ...n, formulario: [...(n.formulario ?? []), campo] } : n))
    );
    const updatedNode = this.nodos().find((node) => node.id === nodeId);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { formulario: updatedNode?.formulario ?? [] },
      updatedNode?.version
    );
    this.scheduleAutoSave();
    this.newCampo = { campo: '', tipo: 'TEXTO' };
  }

  removeCampo(nodeId: string, idx: number): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.nodos.update((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, formulario: n.formulario.filter((_, i) => i !== idx) } : n
      )
    );
    const updatedNode = this.nodos().find((node) => node.id === nodeId);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { formulario: updatedNode?.formulario ?? [] },
      updatedNode?.version
    );
    this.scheduleAutoSave();
  }

  getNodeNameById(nodeId: string | null | undefined): string {
    if (!nodeId) {
      return '-';
    }

    const node = this.nodos().find((item) => item.id === nodeId);
    return node?.nombre ?? nodeId;
  }

  getDecisionBranchTargetNodeId(
    nodeId: string,
    sourcePort: 'LEFT' | 'RIGHT'
  ): string | null {
    const connection = this.conexiones().find(
      (item) =>
        item.origen === nodeId &&
        this.getConnectionSourcePort(item) === sourcePort
    );

    return connection?.destino ?? null;
  }

  getDecisionBranchNodeName(nodeId: string, sourcePort: 'LEFT' | 'RIGHT'): string {
    const targetNodeId = this.getDecisionBranchTargetNodeId(nodeId, sourcePort);
    if (!targetNodeId) {
      return 'Sin conexion';
    }

    return this.getNodeNameById(targetNodeId);
  }

  hasDecisionBranchesReady(nodeId: string): boolean {
    return (
      !!this.getDecisionBranchTargetNodeId(nodeId, 'RIGHT') &&
      !!this.getDecisionBranchTargetNodeId(nodeId, 'LEFT')
    );
  }

  getDecisionConditionLabel(nodeId: string, condicion: CondicionDecision): string {
    if (this.getDecisionConditionGroupPreview(nodeId, condicion)) {
      return 'Condicion dinamica';
    }

    const normalized = (condicion?.resultado ?? '').trim();
    if (!normalized) {
      return 'Condicion sin resultado';
    }

    return normalized;
  }

  hasDecisionConditionGroup(nodeId: string, condicion: CondicionDecision): boolean {
    return !!this.getDecisionConditionGroupPreview(nodeId, condicion);
  }

  getDecisionConditionGroupPreview(
    nodeId: string,
    condicion: CondicionDecision
  ): GrupoCondicionDecision | null {
    const embeddedGroup = condicion?.grupo ?? null;
    if (embeddedGroup) {
      return embeddedGroup;
    }

    if (!this.isDecisionTrueBranchResult(condicion?.resultado)) {
      return null;
    }

    return this.decisionConditionDraftState()[nodeId]?.grupo ?? null;
  }

  isDecisionConditionPreviewOpen(nodeId: string, index: number): boolean {
    const key = this.getDecisionConditionPreviewKey(nodeId, index);
    return !!this.decisionConditionPreviewState()[key];
  }

  toggleDecisionConditionPreview(nodeId: string, index: number): void {
    const key = this.getDecisionConditionPreviewKey(nodeId, index);
    this.decisionConditionPreviewState.update((state) => ({
      ...state,
      [key]: !state[key],
    }));
  }

  getDecisionLogicalOperatorLabel(
    operador: OperadorLogicoDecision | string | null | undefined
  ): string {
    return String(operador ?? '').toUpperCase() === 'OR'
      ? 'Cumple alguna (OR)'
      : 'Cumplen todas (AND)';
  }

  getDecisionOperatorDisplayLabel(
    operador: OperadorCondicionDecision | string | null | undefined
  ): string {
    const option = this.getDecisionOperatorOptionByValue(operador);
    return option?.label ?? String(operador ?? 'Operador');
  }

  decisionRulePreviewNeedsValue(rule: ReglaCondicionDecision): boolean {
    const option = this.getDecisionOperatorOptionByValue(rule?.operador);
    if (option) {
      return option.requiresValue;
    }

    return (
      rule?.valor !== null &&
      rule?.valor !== undefined &&
      String(rule.valor).trim().length > 0
    );
  }

  formatDecisionRulePreviewValue(
    value: ReglaCondicionDecision['valor']
  ): string {
    if (value === null || value === undefined) {
      return '(sin valor)';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    const normalized = String(value).trim();
    return normalized.length ? normalized : '(sin valor)';
  }

  private getDecisionConditionPreviewKey(nodeId: string, index: number): string {
    return `${nodeId}:${index}`;
  }

  private isDecisionTrueBranchResult(resultado: string | null | undefined): boolean {
    const normalized = this.normalizeDecisionResultValue(resultado);
    return normalized === 'TRUE' || normalized === 'SI' || normalized === 'YES';
  }

  private normalizeDecisionResultValue(resultado: string | null | undefined): string {
    return String(resultado ?? '').trim().toUpperCase();
  }

  private decisionHasTrueAndFalseRoutes(condiciones: CondicionDecision[]): boolean {
    const values = new Set(
      (condiciones ?? []).map((item) =>
        this.normalizeDecisionResultValue(item?.resultado)
      )
    );

    const hasTrueRoute = values.has('TRUE') || values.has('SI') || values.has('YES');
    const hasFalseRoute =
      values.has('*') ||
      values.has('FALSE') ||
      values.has('NO') ||
      values.has('DEFAULT') ||
      values.has('ELSE');

    return hasTrueRoute && hasFalseRoute;
  }

  private removeDecisionConditionDraft(nodeId: string): void {
    this.decisionConditionDraftState.update((state) => {
      if (!(nodeId in state)) {
        return state;
      }

      const next = { ...state };
      delete next[nodeId];
      return next;
    });
  }

  private syncDecisionConditionDraftForNode(nodeId: string): void {
    const decisionNode = this.nodos().find(
      (node) => node.id === nodeId && node.tipo === 'DECISION'
    );
    if (!decisionNode) {
      this.removeDecisionConditionDraft(nodeId);
      return;
    }

    const embeddedDynamic = decisionNode.condiciones.find(
      (condicion) => !!condicion?.grupo
    );
    const embeddedGroup = embeddedDynamic?.grupo;
    if (embeddedGroup) {
      this.decisionConditionDraftState.update((state) => ({
        ...state,
        [nodeId]: {
          origenActividadId: embeddedDynamic.origenActividadId ?? null,
          grupo: embeddedGroup,
        },
      }));
      return;
    }

    if (!this.decisionHasTrueAndFalseRoutes(decisionNode.condiciones ?? [])) {
      this.removeDecisionConditionDraft(nodeId);
    }
  }

  private reconcileDecisionConditionDrafts(nodes: NodoCanvas[]): void {
    const previous = this.decisionConditionDraftState();
    const next: Record<string, DecisionConditionDraft> = {};

    for (const node of nodes) {
      if (node.tipo !== 'DECISION') {
        continue;
      }

      const embeddedDynamic = node.condiciones.find((condicion) => !!condicion?.grupo);
      const embeddedGroup = embeddedDynamic?.grupo;
      if (embeddedGroup) {
        next[node.id] = {
          origenActividadId: embeddedDynamic.origenActividadId ?? null,
          grupo: embeddedGroup,
        };
        continue;
      }

      const existingDraft = previous[node.id];
      if (existingDraft && this.decisionHasTrueAndFalseRoutes(node.condiciones ?? [])) {
        next[node.id] = existingDraft;
      }
    }

    this.decisionConditionDraftState.set(next);
  }

  private clearDecisionConditionPreviewForNode(nodeId: string): void {
    const prefix = `${nodeId}:`;
    this.decisionConditionPreviewState.update((state) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      for (const [key, value] of Object.entries(state)) {
        if (key.startsWith(prefix)) {
          changed = true;
          continue;
        }

        next[key] = value;
      }

      return changed ? next : state;
    });
  }

  private getDecisionOperatorOptionByValue(
    operador: OperadorCondicionDecision | string | null | undefined
  ): DecisionOperatorOption | null {
    if (!operador) {
      return null;
    }

    for (const tipo of this.tipoCampoOptions) {
      const option = this.decisionOperatorCatalog[tipo].find(
        (item) => item.value === operador
      );
      if (option) {
        return option;
      }
    }

    return null;
  }

  getDecisionIncomingActivities(nodeId: string): NodoCanvas[] {
    const incomingOriginIds = new Set<string>();

    for (const connection of this.conexiones()) {
      if (connection.destino !== nodeId) {
        continue;
      }

      const fromNode = this.nodos().find((item) => item.id === connection.origen);
      if (fromNode?.tipo === 'ACTIVIDAD') {
        incomingOriginIds.add(fromNode.id);
      }
    }

    return this.nodos().filter((node) => incomingOriginIds.has(node.id));
  }

  getDecisionBuilderFields(nodeId: string): CampoFormulario[] {
    if (!this.decisionBuilderState?.sourceActivityId) {
      return [];
    }

    const sourceNode = this.getDecisionIncomingActivities(nodeId).find(
      (node) => node.id === this.decisionBuilderState?.sourceActivityId
    );

    return sourceNode?.formulario ?? [];
  }

  openDecisionConditionBuilder(nodeId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    const decisionNode = this.nodos().find(
      (node) => node.id === nodeId && node.tipo === 'DECISION'
    );
    if (!decisionNode) {
      return;
    }

    const incomingActivities = this.getDecisionIncomingActivities(nodeId);
    if (!incomingActivities.length) {
      this.toast.info(
        'Decision',
        'Conecta primero una actividad al nodo de decision para habilitar condiciones.'
      );
      return;
    }

    const existingDynamicCondition = decisionNode.condiciones.find(
      (condicion) => !!condicion?.grupo
    );
    const existingDraft = this.decisionConditionDraftState()[nodeId] ?? null;
    const existingGroup = existingDynamicCondition?.grupo ?? existingDraft?.grupo ?? null;

    const sourceActivityId =
      existingDynamicCondition?.origenActividadId ??
      existingDraft?.origenActividadId ??
      this.resolveDefaultDecisionSourceActivity(nodeId);
    const preferredField = this.resolvePreferredDecisionField(nodeId, sourceActivityId);

    this.decisionBuilderState = {
      sourceActivityId,
      group: existingGroup
        ? this.toDecisionBuilderGroup(existingGroup, preferredField)
        : this.createDecisionGroup(preferredField),
    };
    this.decisionBuilderNodeId = nodeId;
    this.decisionBuilderVisible = true;
    this.normalizeDecisionBuilderForSelectedSource(nodeId);
  }

  closeDecisionConditionBuilder(): void {
    this.decisionBuilderVisible = false;
    this.decisionBuilderNodeId = null;
    this.decisionBuilderState = null;
  }

  updateDecisionBuilderSourceActivity(activityId: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    this.decisionBuilderState = {
      ...this.decisionBuilderState,
      sourceActivityId: activityId || null,
    };

    if (this.decisionBuilderNodeId) {
      this.normalizeDecisionBuilderForSelectedSource(this.decisionBuilderNodeId);
    }
  }

  updateDecisionGroupOperator(groupId: string, operator: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    const nextOperator: OperadorLogicoDecision =
      operator === 'OR' ? 'OR' : 'AND';

    this.updateDecisionGroup(groupId, (group) => ({
      ...group,
      operadorLogico: nextOperator,
    }));
  }

  addDecisionRule(groupId: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    const preferredField = this.resolvePreferredDecisionField(
      this.decisionBuilderNodeId,
      this.decisionBuilderState.sourceActivityId
    );

    this.updateDecisionGroup(groupId, (group) => ({
      ...group,
      reglas: [...group.reglas, this.createDecisionRule(preferredField)],
    }));
  }

  removeDecisionRule(groupId: string, ruleId: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    this.updateDecisionGroup(groupId, (group) => ({
      ...group,
      reglas: group.reglas.filter((rule) => rule.id !== ruleId),
    }));
  }

  addDecisionSubGroup(groupId: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    const preferredField = this.resolvePreferredDecisionField(
      this.decisionBuilderNodeId,
      this.decisionBuilderState.sourceActivityId
    );

    this.updateDecisionGroup(groupId, (group) => ({
      ...group,
      grupos: [...group.grupos, this.createDecisionGroup(preferredField)],
    }));
  }

  removeDecisionGroup(groupId: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    const rootGroupId = this.decisionBuilderState.group.id;
    if (groupId === rootGroupId) {
      return;
    }

    this.decisionBuilderState = {
      ...this.decisionBuilderState,
      group: this.removeDecisionGroupById(this.decisionBuilderState.group, groupId),
    };
  }

  updateDecisionRuleField(groupId: string, ruleId: string, campo: string): void {
    if (!this.decisionBuilderState || !this.decisionBuilderNodeId) {
      return;
    }

    const fieldType = this.getDecisionFieldType(this.decisionBuilderNodeId, campo);
    const operatorOptions = this.getDecisionOperatorOptionsByType(fieldType);
    const fallbackOperator = operatorOptions[0]?.value ?? 'IGUAL';

    this.updateDecisionRule(groupId, ruleId, (rule) => ({
      ...rule,
      campo,
      operador: fallbackOperator,
      valor: '',
    }));
  }

  updateDecisionRuleOperator(
    groupId: string,
    ruleId: string,
    operador: OperadorCondicionDecision
  ): void {
    if (!this.decisionBuilderState || !this.decisionBuilderNodeId) {
      return;
    }

    const rule = this.findDecisionRule(this.decisionBuilderState.group, groupId, ruleId);
    if (!rule) {
      return;
    }

    const fieldType = this.getDecisionFieldType(this.decisionBuilderNodeId, rule.campo);
    const requiresValue = this.decisionOperatorRequiresValue(fieldType, operador);

    this.updateDecisionRule(groupId, ruleId, (current) => ({
      ...current,
      operador,
      valor: requiresValue ? current.valor : '',
    }));
  }

  updateDecisionRuleValue(groupId: string, ruleId: string, valor: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    this.updateDecisionRule(groupId, ruleId, (rule) => ({
      ...rule,
      valor,
    }));
  }

  getDecisionRuleOperatorOptions(campo: string): DecisionOperatorOption[] {
    if (!this.decisionBuilderNodeId) {
      return [];
    }

    const fieldType = this.getDecisionFieldType(this.decisionBuilderNodeId, campo);
    return this.getDecisionOperatorOptionsByType(fieldType);
  }

  decisionRuleNeedsValue(campo: string, operador: OperadorCondicionDecision): boolean {
    if (!this.decisionBuilderNodeId) {
      return false;
    }

    const fieldType = this.getDecisionFieldType(this.decisionBuilderNodeId, campo);
    return this.decisionOperatorRequiresValue(fieldType, operador);
  }

  getDecisionRuleInputType(campo: string): 'text' | 'number' | 'date' | 'boolean' {
    if (!this.decisionBuilderNodeId) {
      return 'text';
    }

    const fieldType = this.getDecisionFieldType(this.decisionBuilderNodeId, campo);
    if (fieldType === 'NUMERO') {
      return 'number';
    }

    if (fieldType === 'FECHA') {
      return 'date';
    }

    if (fieldType === 'BOOLEANO') {
      return 'boolean';
    }

    return 'text';
  }

  saveDecisionConditionBuilder(nodeId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (!this.decisionBuilderState) {
      this.toast.error('Decision', 'Debes seleccionar una condicion primero.');
      return;
    }

    const validationError = this.validateDecisionBuilder(nodeId);
    if (validationError) {
      this.toast.error('Decision', validationError);
      return;
    }

    const trueTarget = this.getDecisionBranchTargetNodeId(nodeId, 'RIGHT');
    const falseTarget = this.getDecisionBranchTargetNodeId(nodeId, 'LEFT');
    if (!trueTarget || !falseTarget) {
      this.toast.error(
        'Decision',
        'Conecta las dos salidas del rombo: derecha para SI e izquierda para NO.'
      );
      return;
    }

    const fieldIndex = new Map<string, CampoFormulario>(
      this.getDecisionBuilderFields(nodeId).map((field) => [field.campo, field])
    );

    const payloadGroup = this.toDecisionPayloadGroup(
      this.decisionBuilderState.group,
      fieldIndex
    );

    if (!payloadGroup) {
      this.toast.error('Decision', 'La condicion no contiene reglas validas.');
      return;
    }

    const condiciones: CondicionDecision[] = [
      {
        resultado: 'true',
        siguiente: trueTarget,
        origenActividadId: this.decisionBuilderState.sourceActivityId,
        grupo: payloadGroup,
      },
      {
        resultado: '*',
        siguiente: falseTarget,
      },
    ];

    this.nodos.update((nodes) =>
      nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              condiciones,
            }
          : node
      )
    );
    this.decisionConditionDraftState.update((state) => ({
      ...state,
      [nodeId]: {
        origenActividadId: this.decisionBuilderState?.sourceActivityId ?? null,
        grupo: payloadGroup,
      },
    }));
    this.clearDecisionConditionPreviewForNode(nodeId);

    const updatedNode = this.nodos().find((node) => node.id === nodeId);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { condiciones: updatedNode?.condiciones ?? [] },
      updatedNode?.version
    );
    this.scheduleAutoSave();
    this.closeDecisionConditionBuilder();
    this.toast.success('Decision', 'Condicion guardada correctamente.');
  }

  private resolveDefaultDecisionSourceActivity(nodeId: string): string | null {
    const incomingActivities = this.getDecisionIncomingActivities(nodeId);
    const firstWithFields = incomingActivities.find(
      (activity) => (activity.formulario?.length ?? 0) > 0
    );

    return firstWithFields?.id ?? incomingActivities[0]?.id ?? null;
  }

  private resolvePreferredDecisionField(
    nodeId: string | null,
    sourceActivityId: string | null
  ): CampoFormulario | null {
    if (!nodeId || !sourceActivityId) {
      return null;
    }

    const sourceNode = this.getDecisionIncomingActivities(nodeId).find(
      (activity) => activity.id === sourceActivityId
    );

    return sourceNode?.formulario?.[0] ?? null;
  }

  private createDecisionGroup(preferredField: CampoFormulario | null): DecisionGroupBuilder {
    return {
      id: this.genId(),
      operadorLogico: 'AND',
      reglas: [this.createDecisionRule(preferredField)],
      grupos: [],
    };
  }

  private createDecisionRule(preferredField: CampoFormulario | null): DecisionRuleBuilderRow {
    const fieldType = preferredField?.tipo ?? null;
    const operator = this.getDecisionOperatorOptionsByType(fieldType)[0]?.value ?? 'IGUAL';

    return {
      id: this.genId(),
      campo: preferredField?.campo ?? '',
      operador: operator,
      valor: '',
    };
  }

  private toDecisionBuilderGroup(
    group: GrupoCondicionDecision,
    preferredField: CampoFormulario | null
  ): DecisionGroupBuilder {
    const normalizedOperator: OperadorLogicoDecision =
      group?.operadorLogico === 'OR' ? 'OR' : 'AND';

    const reglas = (group?.reglas ?? []).map((rule) => {
      const ruleType = rule?.tipo ?? preferredField?.tipo ?? null;
      const operatorOptions = this.getDecisionOperatorOptionsByType(ruleType);
      const fallbackOperator = operatorOptions[0]?.value ?? 'IGUAL';

      const selectedOperator = operatorOptions.some(
        (option) => option.value === rule.operador
      )
        ? rule.operador
        : fallbackOperator;

      return {
        id: this.genId(),
        campo: rule?.campo ?? preferredField?.campo ?? '',
        operador: selectedOperator,
        valor:
          rule?.valor === null || rule?.valor === undefined
            ? ''
            : String(rule.valor),
      } as DecisionRuleBuilderRow;
    });

    return {
      id: this.genId(),
      operadorLogico: normalizedOperator,
      reglas: reglas.length ? reglas : [this.createDecisionRule(preferredField)],
      grupos: (group?.grupos ?? []).map((child) =>
        this.toDecisionBuilderGroup(child, preferredField)
      ),
    };
  }

  private normalizeDecisionBuilderForSelectedSource(nodeId: string): void {
    if (!this.decisionBuilderState) {
      return;
    }

    const fieldsByName = new Map<string, CampoFormulario>(
      this.getDecisionBuilderFields(nodeId).map((field) => [field.campo, field])
    );
    const preferredField = this.resolvePreferredDecisionField(
      nodeId,
      this.decisionBuilderState.sourceActivityId
    );

    const normalizeGroup = (group: DecisionGroupBuilder): DecisionGroupBuilder => ({
      ...group,
      reglas: group.reglas.map((rule) => {
        const currentField = fieldsByName.get(rule.campo);
        const fallbackField = preferredField;
        const nextField = currentField ?? fallbackField ?? null;
        const options = this.getDecisionOperatorOptionsByType(nextField?.tipo ?? null);
        const nextOperator = options.some((option) => option.value === rule.operador)
          ? rule.operador
          : options[0]?.value ?? 'IGUAL';

        return {
          ...rule,
          campo: nextField?.campo ?? '',
          operador: nextOperator,
          valor: this.decisionOperatorRequiresValue(nextField?.tipo ?? null, nextOperator)
            ? rule.valor
            : '',
        };
      }),
      grupos: group.grupos.map((child) => normalizeGroup(child)),
    });

    this.decisionBuilderState = {
      ...this.decisionBuilderState,
      group: normalizeGroup(this.decisionBuilderState.group),
    };
  }

  private updateDecisionBuilder(
    updater: (state: DecisionBuilderState) => DecisionBuilderState
  ): void {
    if (!this.decisionBuilderState) {
      return;
    }

    this.decisionBuilderState = updater(this.decisionBuilderState);
  }

  private updateDecisionGroup(
    groupId: string,
    updater: (group: DecisionGroupBuilder) => DecisionGroupBuilder
  ): void {
    this.updateDecisionBuilder((state) => ({
      ...state,
      group: this.mapDecisionGroupById(state.group, groupId, updater),
    }));
  }

  private updateDecisionRule(
    groupId: string,
    ruleId: string,
    updater: (rule: DecisionRuleBuilderRow) => DecisionRuleBuilderRow
  ): void {
    this.updateDecisionGroup(groupId, (group) => ({
      ...group,
      reglas: group.reglas.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }));
  }

  private mapDecisionGroupById(
    group: DecisionGroupBuilder,
    groupId: string,
    updater: (group: DecisionGroupBuilder) => DecisionGroupBuilder
  ): DecisionGroupBuilder {
    if (group.id === groupId) {
      return updater(group);
    }

    return {
      ...group,
      grupos: group.grupos.map((child) =>
        this.mapDecisionGroupById(child, groupId, updater)
      ),
    };
  }

  private removeDecisionGroupById(
    group: DecisionGroupBuilder,
    groupId: string
  ): DecisionGroupBuilder {
    return {
      ...group,
      grupos: group.grupos
        .filter((child) => child.id !== groupId)
        .map((child) => this.removeDecisionGroupById(child, groupId)),
    };
  }

  private findDecisionRule(
    group: DecisionGroupBuilder,
    groupId: string,
    ruleId: string
  ): DecisionRuleBuilderRow | null {
    if (group.id === groupId) {
      return group.reglas.find((rule) => rule.id === ruleId) ?? null;
    }

    for (const child of group.grupos) {
      const found = this.findDecisionRule(child, groupId, ruleId);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private getDecisionFieldType(nodeId: string, campo: string): TipoCampo | null {
    if (!campo) {
      return null;
    }

    const field = this.getDecisionBuilderFields(nodeId).find(
      (item) => item.campo === campo
    );

    return field?.tipo ?? null;
  }

  private getDecisionOperatorOptionsByType(
    tipo: TipoCampo | null
  ): DecisionOperatorOption[] {
    if (!tipo) {
      return [];
    }

    return this.decisionOperatorCatalog[tipo] ?? [];
  }

  private decisionOperatorRequiresValue(
    tipo: TipoCampo | null,
    operador: OperadorCondicionDecision
  ): boolean {
    const operatorOption = this.getDecisionOperatorOptionsByType(tipo).find(
      (option) => option.value === operador
    );

    return operatorOption?.requiresValue ?? true;
  }

  private validateDecisionBuilder(nodeId: string): string | null {
    if (!this.decisionBuilderState) {
      return 'Abre el constructor de condicion para continuar.';
    }

    if (!this.hasDecisionBranchesReady(nodeId)) {
      return 'Debes conectar salida derecha (SI) y salida izquierda (NO).';
    }

    const sourceActivityId = this.decisionBuilderState.sourceActivityId;
    if (!sourceActivityId) {
      return 'Selecciona la actividad origen de la condicion.';
    }

    const fields = this.getDecisionBuilderFields(nodeId);
    if (!fields.length) {
      return 'La actividad origen no tiene campos en su formulario dinamico.';
    }

    const fieldIndex = new Map(fields.map((field) => [field.campo, field]));
    const totalRules = this.countDecisionRules(this.decisionBuilderState.group);
    if (!totalRules) {
      return 'Agrega al menos una regla para evaluar la decision.';
    }

    return this.validateDecisionGroup(this.decisionBuilderState.group, fieldIndex, 'grupo principal');
  }

  private countDecisionRules(group: DecisionGroupBuilder): number {
    return (
      group.reglas.length +
      group.grupos.reduce(
        (total, child) => total + this.countDecisionRules(child),
        0
      )
    );
  }

  private validateDecisionGroup(
    group: DecisionGroupBuilder,
    fieldsByName: Map<string, CampoFormulario>,
    scopeLabel: string
  ): string | null {
    for (const rule of group.reglas) {
      const field = fieldsByName.get(rule.campo);
      if (!field) {
        return `Hay una regla en ${scopeLabel} con campo invalido.`;
      }

      const validOperators = this.getDecisionOperatorOptionsByType(field.tipo);
      const selectedOperator = validOperators.find(
        (option) => option.value === rule.operador
      );

      if (!selectedOperator) {
        return `La regla del campo ${field.campo} tiene un operador invalido.`;
      }

      if (selectedOperator.requiresValue) {
        const rawValue = rule.valor?.trim();
        if (!rawValue) {
          return `La regla del campo ${field.campo} requiere un valor.`;
        }

        if (field.tipo === 'NUMERO' && !Number.isFinite(Number(rawValue))) {
          return `El valor del campo ${field.campo} debe ser numerico.`;
        }

        if (
          field.tipo === 'BOOLEANO' &&
          rawValue.toLowerCase() !== 'true' &&
          rawValue.toLowerCase() !== 'false'
        ) {
          return `El valor del campo ${field.campo} debe ser true o false.`;
        }
      }
    }

    for (const [index, child] of group.grupos.entries()) {
      const nestedValidation = this.validateDecisionGroup(
        child,
        fieldsByName,
        `subgrupo ${index + 1}`
      );
      if (nestedValidation) {
        return nestedValidation;
      }
    }

    return null;
  }

  private toDecisionPayloadGroup(
    group: DecisionGroupBuilder,
    fieldsByName: Map<string, CampoFormulario>
  ): GrupoCondicionDecision | null {
    const reglas: ReglaCondicionDecision[] = [];

    for (const rule of group.reglas) {
      const field = fieldsByName.get(rule.campo);
      if (!field) {
        continue;
      }

      const operatorOption = this.getDecisionOperatorOptionsByType(field.tipo).find(
        (option) => option.value === rule.operador
      );
      if (!operatorOption) {
        continue;
      }

      const payloadRule: ReglaCondicionDecision = {
        campo: field.campo,
        tipo: field.tipo,
        operador: rule.operador,
      };

      if (operatorOption.requiresValue) {
        payloadRule.valor = this.parseDecisionRuleValue(field.tipo, rule.valor);
      }

      reglas.push(payloadRule);
    }

    const grupos = group.grupos
      .map((child) => this.toDecisionPayloadGroup(child, fieldsByName))
      .filter((child): child is GrupoCondicionDecision => !!child);

    if (!reglas.length && !grupos.length) {
      return null;
    }

    return {
      operadorLogico: group.operadorLogico,
      reglas,
      grupos,
    };
  }

  private parseDecisionRuleValue(tipo: TipoCampo, rawValue: string): string | number | boolean {
    const normalizedValue = rawValue.trim();

    if (tipo === 'NUMERO') {
      return Number(normalizedValue);
    }

    if (tipo === 'BOOLEANO') {
      return normalizedValue.toLowerCase() === 'true';
    }

    return normalizedValue;
  }

  addCondicion(nodeId: string): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    if (!this.newCondicion.resultado.trim() || !this.newCondicion.siguiente.trim()) return;
    const cond: CondicionDecision = { resultado: this.newCondicion.resultado.trim(), siguiente: this.newCondicion.siguiente.trim() };
    this.nodos.update((ns) =>
      ns.map((n) => (n.id === nodeId ? { ...n, condiciones: [...(n.condiciones ?? []), cond] } : n))
    );
    const updatedNode = this.nodos().find((node) => node.id === nodeId);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { condiciones: updatedNode?.condiciones ?? [] },
      updatedNode?.version
    );
    this.scheduleAutoSave();
    this.newCondicion = { resultado: '', siguiente: '' };
  }

  removeCondicion(nodeId: string, idx: number): void {
    if (this.isCanvasEditBlocked(true)) {
      return;
    }

    this.clearDecisionConditionPreviewForNode(nodeId);

    this.nodos.update((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, condiciones: n.condiciones.filter((_, i) => i !== idx) } : n
      )
    );
    this.syncDecisionConditionDraftForNode(nodeId);
    const updatedNode = this.nodos().find((node) => node.id === nodeId);
    this.collabFacade.emitUpdateNode(
      nodeId,
      { condiciones: updatedNode?.condiciones ?? [] },
      updatedNode?.version
    );
    this.scheduleAutoSave();
  }

  // ── Computed transform string ─────────────────────────────────
  get canvasTransform(): string {
    return `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`;
  }

  get politicaEstado(): EstadoPolitica {
    return this.politica()?.estado ?? 'BORRADOR';
  }

  trackById(_: number, n: Nodo): string { return n.id; }
  trackByConn(_: number, c: Conexion): string { return `${c.origen}-${c.destino}`; }

  private buildGuideAvailableActions(): string[] {
    const actions = new Set<string>();
    const selectedNode = this.sidebarNode();

    actions.add('ADD_ACTIVITY');
    actions.add('ADD_DECISION');
    actions.add('CONNECT_NODES');
    actions.add('SAVE_POLICY');

    if (this.politicaEstado !== 'ACTIVA') {
      actions.add('ACTIVATE_POLICY');
      actions.add('PAUSE_DESIGN');
    } else {
      actions.add('PAUSE_POLICY');
      actions.add('DEACTIVATE_POLICY');
    }

    if (!this.nodos().some((node) => node.tipo === 'INICIO')) {
      actions.add('ADD_START_NODE');
    }

    if (!this.nodos().some((node) => node.tipo === 'FIN')) {
      actions.add('ADD_END_NODE');
    }

    if (selectedNode?.tipo === 'ACTIVIDAD') {
      actions.add('ASSIGN_RESPONSIBLE');
      actions.add('ADD_FORM_FIELD');
    }

    if (selectedNode?.tipo === 'DECISION') {
      actions.add('CONFIGURE_DECISION');
    }

    return [...actions];
  }
}
