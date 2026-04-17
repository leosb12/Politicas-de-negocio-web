import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  computed,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PoliticaService } from '../../services/politica.service';
import { AdminDepartmentsService } from '../../services/admin-departments.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { ToastService } from '../../../../shared/services/toast.service';
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
} from '../../models/politica.model';
import { AdminDepartment } from '../../models/admin-department.model';
import { AdminUser } from '../../models/admin-user.model';
import { FindNodePipe } from '../../pipes/find-node.pipe';

// ── Drag state ───────────────────────────────────────────────────
interface DragState {
  nodeId: string;
  startMouseX: number;
  startMouseY: number;
  startNodeX: number;
  startNodeY: number;
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
type DeptModalMode = 'NODE' | 'LANE';

// ── Node palette item ─────────────────────────────────────────────
interface PaletteItem {
  tipo: TipoNodo;
  label: string;
  icon: string;
  color: string;
  description: string;
}

import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-canvas-designer',
  standalone: true,
  imports: [CommonModule, FormsModule, FindNodePipe, SlicePipe, LucideAngularModule],
  templateUrl: './canvas-designer.html',
  styleUrl: './canvas-designer.css',
})
export class CanvasDesignerComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl') canvasEl!: ElementRef<SVGElement>;
  @ViewChild('canvasWrap') canvasWrap!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc = inject(PoliticaService);
  private readonly deptSvc = inject(AdminDepartmentsService);
  private readonly userSvc = inject(AdminUsersService);
  private readonly toast = inject(ToastService);

  // ── State ─────────────────────────────────────────────────────
  politica = signal<PoliticaNegocio | null>(null);
  loading = signal(true);
  saving = signal(false);
  departamentos = signal<AdminDepartment[]>([]);
  usuarios = signal<AdminUser[]>([]);

  nodos = signal<NodoCanvas[]>([]);
  conexiones = signal<Conexion[]>([]);
  connectionTargetPorts = signal<Record<string, ConnectionTargetPort>>({});
  connectionSourcePorts = signal<Record<string, ConnectionPort>>({});

  selectedNodeId = signal<string | null>(null);
  connectState = signal<ConnectState | null>(null);
  dragState: DragState | null = null;

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
  sidebarNode = computed(() =>
    this.nodos().find((n) => n.id === this.selectedNodeId()) ?? null
  );

  responsableItems = computed(() => {
    const node = this.sidebarNode();
    if (!node || node.tipo !== 'ACTIVIDAD') return [];
    if (node.responsableTipo === 'USUARIO') {
      return this.usuarios().map(u => ({ id: u.id, nombre: u.nombre }));
    }
    if (node.responsableTipo === 'DEPARTAMENTO') {
      return this.departamentos().map(d => ({ id: d.id, nombre: d.nombre }));
    }
    return [];
  });

  tiposNodoOptions: TipoNodo[] = ['INICIO', 'ACTIVIDAD', 'DECISION', 'FORK', 'JOIN', 'FIN'];

  // ── Palette ───────────────────────────────────────────────────
  palette: PaletteItem[] = [
    { tipo: 'INICIO',    label: 'Inicio',    icon: 'play',  color: '#4ade80', description: 'Punto de entrada del flujo' },
    { tipo: 'ACTIVIDAD', label: 'Actividad', icon: 'square', color: '#6366f1', description: 'Tarea asignada a un departamento' },
    { tipo: 'DECISION',  label: 'Decisión',  icon: 'diamond',  color: '#f59e0b', description: 'Bifurcación condicional del flujo' },
    { tipo: 'FORK',      label: 'Fork',      icon: 'split',  color: '#06b6d4', description: 'Divide en procesos paralelos' },
    { tipo: 'JOIN',      label: 'Join',      icon: 'merge',  color: '#06b6d4', description: 'Une procesos paralelos' },
    { tipo: 'FIN',       label: 'Fin',       icon: 'stop-circle',  color: '#f43f5e', description: 'Punto de cierre del flujo' },
  ];

  tipoCampoOptions: TipoCampo[] = ['TEXTO', 'NUMERO', 'BOOLEANO', 'ARCHIVO', 'FECHA'];

  // ── New campo form ────────────────────────────────────────────
  newCampo = { campo: '', tipo: 'TEXTO' as TipoCampo };
  newCondicion = { resultado: '', siguiente: '' };

  // ── Swimlane / Dept control ────────────────────────────────────
  showDeptModal = signal(false);
  pendingNodeFromPalette: { tipo: TipoNodo; x: number; y: number } | null = null;
  manualLaneDeptIds = signal<string[]>([]);
  deptModalMode = signal<DeptModalMode>('NODE');
  
  creatingNewDept = signal(false);
  newDeptName = signal('');
  savingDept = signal(false);
  
  editingDeptId = signal<string | null>(null);
  editDeptName = signal('');

  private idCounter = 0;
  readonly LANE_HEIGHT = 220;

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

    for (const deptId of this.manualLaneDeptIds()) {
      addLane(deptId);
    }

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
    
    // Load departments
    this.deptSvc.getDepartments().subscribe({ next: (d) => this.departamentos.set(d) });
    // Load users
    this.userSvc.getUsers().subscribe({ next: (u) => this.usuarios.set(u) });

    this.svc.getById(id).subscribe({
      next: (p) => {
        this.politica.set(p);
        this.hydrateCanvas(p);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error', 'No se pudo cargar la política');
        this.router.navigate(['/admin/politicas']);
      },
    });
  }

  ngOnDestroy(): void {}

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

  // ── Hydrate from backend ──────────────────────────────────────
  private hydrateCanvas(p: PoliticaNegocio): void {
    const nodes = (p.nodos ?? []).map((n, i) => {
      const rawX = this.toWorldCoordinate(
        (n as any).posicionX,
        100 + (i % 6) * 220,
        this.CANVAS_ORIGIN_X,
        this.CANVAS_WIDTH
      );
      const rawY = this.toWorldCoordinate(
        (n as any).posicionY,
        100 + Math.floor(i / 6) * 160,
        this.CANVAS_ORIGIN_Y,
        this.CANVAS_HEIGHT
      );
      const clamped = this.clampNodePosition(rawX, rawY);

      return {
        ...n,
        x: clamped.x,
        y: clamped.y,
      };
    });
    this.nodos.set(nodes);
    const connections = p.conexiones ?? [];
    this.conexiones.set(connections);
    this.initializeConnectionPorts(nodes, connections);
  }

  private buildFlujoPayload() {
    return {
      nodos: this.nodos().map((n) => ({
        id: n.id,
        tipo: n.tipo,
        nombre: n.nombre,
        posicionX: this.toPersistedCoordinate(n.x, this.CANVAS_ORIGIN_X),
        posicionY: this.toPersistedCoordinate(n.y, this.CANVAS_ORIGIN_Y),
        departamentoId: n.departamentoId,
        responsableTipo: n.tipo === 'ACTIVIDAD' ? (n.responsableTipo || null) : null,
        responsableId: n.tipo === 'ACTIVIDAD' ? (n.responsableId || null) : null,
        formulario: n.formulario ?? [],
        condiciones: n.condiciones ?? [],
      })),
      conexiones: this.conexiones(),
    };
  }

  // ── Save to backend ───────────────────────────────────────────
  save(): void {
    const p = this.politica();
    if (!p) return;
    this.saving.set(true);
    const payload = this.buildFlujoPayload();
    this.svc.saveFlujo(p.id, payload).subscribe({
      next: (updated) => {
        this.politica.set(updated);
        this.saving.set(false);
        this.toast.success('✅ Guardado', 'El flujo fue guardado exitosamente');
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'No se pudo guardar el flujo';
        this.toast.error('Error', msg);
      },
    });
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

      // Backend valida contra el flujo persistido: guardamos antes de activar.
      this.svc.saveFlujo(p.id, this.buildFlujoPayload()).subscribe({
        next: (updated) => {
          this.politica.set(updated);
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
        this.politica.set(updated);
        this.toast.success('Estado actualizado', `Política ahora en estado ${estado}`);
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'No se pudo cambiar el estado';
        this.toast.error('Error', msg);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/politicas']);
  }

  // ── Node generation ───────────────────────────────────────────
  private genId(): string {
    return `n${Date.now()}_${++this.idCounter}`;
  }

  addNodeFromPalette(tipo: TipoNodo): void {
    let cx = 300;
    let cy = 200;

    if (this.canvasWrap?.nativeElement) {
      const rect = this.canvasWrap.nativeElement.getBoundingClientRect();
      cx = (rect.width / 2 - this.panX()) / this.zoom();
      cy = (rect.height / 2 - this.panY()) / this.zoom();
    }

    this.pendingNodeFromPalette = { tipo, x: cx, y: cy };
    this.creatingNewDept.set(false);
    this.deptModalMode.set('NODE');

    if (tipo === 'ACTIVIDAD') {
      this.showDeptModal.set(true);
      return;
    }

    this.selectDeptForPending(null);
  }

  selectDeptForPending(deptId: string | null): void {
    if (!this.pendingNodeFromPalette) return;
    const { tipo, x, y } = this.pendingNodeFromPalette;
    const clampedPos = this.clampNodePosition(
      x + Math.random() * 40 - 20,
      y + Math.random() * 40 - 20
    );
    const newNode: NodoCanvas = {
      id: this.genId(),
      tipo,
      nombre: this.defaultName(tipo),
      departamentoId: deptId,
      responsableTipo: null,
      responsableId: null,
      formulario: [],
      condiciones: [],
      x: clampedPos.x,
      y: clampedPos.y,
    };
    this.nodos.update((ns) => [...ns, newNode]);
    this.pendingNodeFromPalette = null;
    this.showDeptModal.set(false);
    this.selectNode(newNode.id);
  }

  selectDeptFromModal(deptId: string | null): void {
    if (this.deptModalMode() === 'LANE') {
      if (!deptId) {
        this.toast.info('Carriles', 'Para añadir carril debes seleccionar un departamento.');
        return;
      }

      this.addManualLaneByDeptId(deptId);
      return;
    }

    this.selectDeptForPending(deptId);
  }

  addManualLane(): void {
    this.pendingNodeFromPalette = null;
    this.creatingNewDept.set(false);
    this.newDeptName.set('');
    this.editingDeptId.set(null);
    this.editDeptName.set('');
    this.deptModalMode.set('LANE');
    this.showDeptModal.set(true);
  }

  private addManualLaneByDeptId(deptId: string): void {
    const dept = this.departamentos().find((d) => d.id === deptId);
    if (!dept) {
      this.toast.error('Carriles', 'El departamento seleccionado no existe.');
      return;
    }

    const laneExists = this.swimlanes().some((lane) => lane.id === deptId);
    if (laneExists) {
      this.toast.info('Carriles', `El carril de ${dept.nombre} ya existe.`);
      return;
    }

    this.manualLaneDeptIds.update((laneIds) => [...laneIds, deptId]);
    this.closeDeptModal();
  }

  private defaultName(tipo: TipoNodo): string {
    const names: Record<TipoNodo, string> = {
      INICIO:    'Inicio del trámite',
      ACTIVIDAD: 'Nueva actividad',
      DECISION:  '¿Condición?',
      FORK:      'Bifurcación paralela',
      JOIN:      'Unión paralela',
      FIN:       'Fin del trámite',
    };
    return names[tipo];
  }

  deleteNode(id: string): void {
    const removedConnections = this.conexiones().filter(
      (c) => c.origen === id || c.destino === id
    );

    this.nodos.update((ns) => ns.filter((n) => n.id !== id));
    this.conexiones.update((cs) => cs.filter((c) => c.origen !== id && c.destino !== id));

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
    }
  }

  // ── Selection ─────────────────────────────────────────────────
  selectNode(id: string): void {
    this.selectedNodeId.set(id);
    this.showSidebar.set(true);
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
    this.selectedNodeId.set(null);
    this.showSidebar.set(false);
    this.connectState.set(null);
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  onNodeMouseDown(event: MouseEvent, nodeId: string): void {
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
    if (this.dragState) {
      const dx = (event.clientX - this.dragState.startMouseX) / this.zoom();
      const dy = (event.clientY - this.dragState.startMouseY) / this.zoom();
      const id = this.dragState.nodeId;
      const clampedPos = this.clampNodePosition(
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
    const wasPanning = this.isPanning;
    const didPan = this.panMoved;

    this.dragState = null;
    this.isPanning = false;
    this.panMoved = false;

    if (wasPanning && !didPan && !this.connectState()) {
      this.deselectAll();
    }
  }

  // ── Pan ───────────────────────────────────────────────────────
  onCanvasMouseDown(event: MouseEvent): void {
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

  zoomIn(): void  { this.applyZoom(this.zoom() * 1.15); }
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
    const targetMap: Record<string, ConnectionTargetPort> = {};
    const sourceMap: Record<string, ConnectionPort> = {};

    for (const c of connections) {
      const from = nodes.find((n) => n.id === c.origen);
      const to = nodes.find((n) => n.id === c.destino);
      if (!from || !to) continue;
      const key = this.connectionKey(c.origen, c.destino);
      targetMap[key] = this.autoTargetPort(from, to);
      sourceMap[key] = 'RIGHT';
    }

    this.connectionTargetPorts.set(targetMap);
    this.connectionSourcePorts.set(sourceMap);
  }

  private setConnectionTargetPort(origen: string, destino: string, port: ConnectionTargetPort): void {
    const key = this.connectionKey(origen, destino);
    this.connectionTargetPorts.update((map) => ({ ...map, [key]: port }));
  }

  private setConnectionSourcePort(origen: string, destino: string, port: ConnectionPort): void {
    const key = this.connectionKey(origen, destino);
    this.connectionSourcePorts.update((map) => ({ ...map, [key]: port }));
  }

  private getConnectionTargetPort(c: Conexion): ConnectionTargetPort {
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
    const key = this.connectionKey(c.origen, c.destino);
    return this.connectionSourcePorts()[key] ?? 'RIGHT';
  }

  startConnect(
    event: MouseEvent,
    fromId: string,
    fromPort: ConnectionPort = 'RIGHT'
  ): void {
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
    if (this.connectState()) {
      this.finishConnect(nodeId, port, event);
      return;
    }

    this.startConnect(event, nodeId, port);
  }

  finishConnect(
    toId: string,
    targetPort: ConnectionTargetPort | null = null,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();

    const cs = this.connectState();
    if (!cs) return;

    if (cs.fromNodeId === toId) {
      return;
    }

    const fromNode = this.nodos().find((n) => n.id === cs.fromNodeId);
    const toNode = this.nodos().find((n) => n.id === toId);
    const resolvedPort: ConnectionTargetPort =
      targetPort ?? (fromNode && toNode ? this.autoTargetPort(fromNode, toNode) : 'LEFT');
    const resolvedSourcePort: ConnectionPort = cs.fromPort;

    const exists = this.conexiones().some((c) => c.origen === cs.fromNodeId && c.destino === toId);
    if (!exists) {
      this.conexiones.update((cs2) => [...cs2, { origen: cs.fromNodeId, destino: toId }]);
    }
    this.setConnectionTargetPort(cs.fromNodeId, toId, resolvedPort);
    this.setConnectionSourcePort(cs.fromNodeId, toId, resolvedSourcePort);

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

  canConnectToNode(nodeId: string): boolean {
    const cs = this.connectState();
    return !!cs && cs.fromNodeId !== nodeId;
  }

  deleteConexion(origen: string, destino: string): void {
    this.conexiones.update((cs) => cs.filter((c) => !(c.origen === origen && c.destino === destino)));
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
    return tipo === 'ACTIVIDAD' || tipo === 'DECISION' || tipo === 'FORK' || tipo === 'JOIN';
  }

  hasBottomPort(tipo: TipoNodo): boolean {
    return tipo === 'ACTIVIDAD';
  }

  getNodeTopInputLocalY(tipo: TipoNodo): number {
    if (tipo === 'ACTIVIDAD') return 0;
    if (tipo === 'DECISION') return 2;
    if (tipo === 'FORK' || tipo === 'JOIN') return 10;
    return 0;
  }

  getNodeBottomInputLocalY(tipo: TipoNodo): number {
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

  // ── SVG path for arrow ────────────────────────────────────────
  getArrowPath(c: Conexion): string {
    const from = this.nodos().find((n) => n.id === c.origen);
    const to   = this.nodos().find((n) => n.id === c.destino);
    if (!from || !to) return '';

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

    const c1x = fromPoint.x + sourceTangent.x * handle;
    const c1y = fromPoint.y + sourceTangent.y * handle;
    const c2x = toPoint.x + targetTangent.x * handle;
    const c2y = toPoint.y + targetTangent.y * handle;

    return `M ${fromPoint.x} ${fromPoint.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toPoint.x} ${toPoint.y}`;
  }

  getArrowMid(c: Conexion): { x: number; y: number } | null {
    const from = this.nodos().find((n) => n.id === c.origen);
    const to   = this.nodos().find((n) => n.id === c.destino);
    if (!from || !to) return null;

    const fromPoint = this.getNodePortPoint(from, this.getConnectionSourcePort(c));
    const toPoint = this.getNodeInputPoint(to, this.getConnectionTargetPort(c));
    return { x: (fromPoint.x + toPoint.x) / 2, y: (fromPoint.y + toPoint.y) / 2 };
  }

  // ── Node color ────────────────────────────────────────────────
  nodeColor(tipo: TipoNodo): string {
    const colors: Record<TipoNodo, string> = {
      INICIO:    '#4ade80',
      ACTIVIDAD: '#6366f1',
      DECISION:  '#f59e0b',
      FORK:      '#06b6d4',
      JOIN:      '#06b6d4',
      FIN:       '#f43f5e',
    };
    return colors[tipo];
  }

  nodeBg(tipo: TipoNodo): string {
    const colors: Record<TipoNodo, string> = {
      INICIO:    '#052e16',
      ACTIVIDAD: '#1e1b4b',
      DECISION:  '#431407',
      FORK:      '#083344',
      JOIN:      '#083344',
      FIN:       '#4c0519',
    };
    return colors[tipo];
  }

  deptColor(deptId: string): string {
    const palette = ['#6366f1','#06b6d4','#f59e0b','#10b981','#f43f5e','#8b5cf6','#ec4899'];
    let hash = 0;
    for (const c of deptId) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  getDeptName(id: string | null): string {
    if (!id) return 'Sin departamento';
    return this.departamentos().find((d) => d.id === id)?.nombre ?? id;
  }

  getResponsableNombre(node: NodoCanvas): string {
    if (node.tipo !== 'ACTIVIDAD' || !node.responsableId || !node.responsableTipo) return 'Sin asignar';
    if (node.responsableTipo === 'USUARIO') {
      const u = this.usuarios().find(x => x.id === node.responsableId);
      return u ? u.nombre : 'Usuario no encontrado';
    } else {
      const d = this.departamentos().find(x => x.id === node.responsableId);
      return d ? d.nombre : 'Depto no encontrado';
    }
  }

  // ── Sidebar / Form editing ────────────────────────────────────
  updateNodeName(id: string, name: string): void {
    this.nodos.update((ns) => ns.map((n) => (n.id === id ? { ...n, nombre: name } : n)));
  }

  updateNodeTipo(id: string, newTipoStr: string): void {
    const newTipo = newTipoStr as TipoNodo;
    this.nodos.update((ns) => ns.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          tipo: newTipo,
          departamentoId: newTipo === 'ACTIVIDAD' ? n.departamentoId : null,
          // Si deja de ser ACTIVIDAD, limpiamos los responsables
          responsableTipo: newTipo === 'ACTIVIDAD' ? n.responsableTipo : null,
          responsableId: newTipo === 'ACTIVIDAD' ? n.responsableId : null,
        };
      }
      return n;
    }));
  }

  updateNodeDept(id: string, deptId: string): void {
    if (deptId === 'CREATE_NEW') {
      this.pendingNodeFromPalette = null;
      this.creatingNewDept.set(true);
      this.deptModalMode.set('NODE');
      this.showDeptModal.set(true);
      return;
    }
    this.nodos.update((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;

        const nextDeptId = deptId || null;
        return {
          ...n,
          departamentoId: nextDeptId,
          // Si el responsable es por departamento, queda sincronizado con el carril.
          responsableId: n.responsableTipo === 'DEPARTAMENTO' ? nextDeptId : n.responsableId,
        };
      })
    );
  }

  updateNodeResponsableTipo(id: string, tipo: string): void {
    const responsableTipo = (tipo === 'USUARIO' || tipo === 'DEPARTAMENTO') ? tipo as ResponsableTipo : null;
    this.nodos.update((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;

        if (n.responsableTipo === responsableTipo) {
          return n;
        }

        if (!responsableTipo) {
          return {
            ...n,
            responsableTipo: null,
            responsableId: null,
          };
        }

        if (responsableTipo === 'DEPARTAMENTO') {
          return {
            ...n,
            responsableTipo,
            // Para DEPARTAMENTO no se selecciona usuario; se usa el depto del carril.
            responsableId: n.departamentoId,
          };
        }

        return {
          ...n,
          responsableTipo,
          responsableId: null,
        };
      })
    );
  }

  updateNodeResponsableId(id: string, responsableId: string): void {
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
  }

  startCreateDept(): void {
    this.creatingNewDept.set(true);
    this.newDeptName.set('');
  }

  closeDeptModal(): void {
    this.creatingNewDept.set(false);
    this.newDeptName.set('');
    this.editingDeptId.set(null);
    this.editDeptName.set('');
    this.pendingNodeFromPalette = null;
    this.deptModalMode.set('NODE');
    this.showDeptModal.set(false);
  }

  cancelCreateDept(): void {
    this.creatingNewDept.set(false);
    this.newDeptName.set('');
  }

  confirmCreateDept(): void {
    const name = this.newDeptName().trim();
    if (!name) return;
    this.savingDept.set(true);
    this.deptSvc.createDepartment({ nombre: name, descripcion: '' }).subscribe({
      next: (d) => {
        this.departamentos.update(depts => [...depts, d]);
        this.savingDept.set(false);
        this.creatingNewDept.set(false);
        this.toast.success('Éxito', 'Departamento creado');

        if (this.deptModalMode() === 'LANE') {
          this.addManualLaneByDeptId(d.id);
          return;
        }

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

  startEditDept(event: Event, dept: AdminDepartment): void {
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
    event.stopPropagation();
    if (!confirm('¿Seguro que deseas eliminar este departamento? Los nodos asignados quedarán sin departamento.')) return;
    
    this.savingDept.set(true);
    this.deptSvc.deleteDepartment(id).subscribe({
      next: () => {
        this.departamentos.update(depts => depts.filter(d => d.id !== id));
        this.nodos.update(ns => ns.map(n => n.departamentoId === id ? { ...n, departamentoId: null } : n));
        this.manualLaneDeptIds.update((laneIds) => laneIds.filter((laneId) => laneId !== id));
        this.savingDept.set(false);
        this.toast.success('Éxito', 'Departamento eliminado');
      },
      error: (err) => {
        this.savingDept.set(false);
        this.toast.error('Error', err.error?.message || 'No se pudo eliminar el departamento');
      }
    });
  }

  addCampo(nodeId: string): void {
    if (!this.newCampo.campo.trim()) return;
    const campo: CampoFormulario = { campo: this.newCampo.campo.trim(), tipo: this.newCampo.tipo };
    this.nodos.update((ns) =>
      ns.map((n) => (n.id === nodeId ? { ...n, formulario: [...(n.formulario ?? []), campo] } : n))
    );
    this.newCampo = { campo: '', tipo: 'TEXTO' };
  }

  removeCampo(nodeId: string, idx: number): void {
    this.nodos.update((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, formulario: n.formulario.filter((_, i) => i !== idx) } : n
      )
    );
  }

  addCondicion(nodeId: string): void {
    if (!this.newCondicion.resultado.trim() || !this.newCondicion.siguiente.trim()) return;
    const cond: CondicionDecision = { resultado: this.newCondicion.resultado.trim(), siguiente: this.newCondicion.siguiente.trim() };
    this.nodos.update((ns) =>
      ns.map((n) => (n.id === nodeId ? { ...n, condiciones: [...(n.condiciones ?? []), cond] } : n))
    );
    this.newCondicion = { resultado: '', siguiente: '' };
  }

  removeCondicion(nodeId: string, idx: number): void {
    this.nodos.update((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, condiciones: n.condiciones.filter((_, i) => i !== idx) } : n
      )
    );
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
}
