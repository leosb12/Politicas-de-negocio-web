import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppModalComponent } from '../../../../shared/ui/modal/modal';
import { TareaFormularioDinamicoComponent } from '../../components/tarea-formulario-dinamico/tarea-formulario-dinamico';
import {
  CompletarTareaPayload,
  TareaDetalle,
  TareaResumen,
} from '../../models/funcionario-workflow.model';
import { EmployeeGuideContextService } from '../../services/employee-guide-context.service';
import { FuncionarioWorkflowApiService } from '../../services/funcionario-workflow-api.service';
import { mapTareaDetalleDto, mapTareaMiaDto } from '../../services/funcionario-workflow.mapper';
import { FuncionarioWorkflowFacadeService } from '../../services/funcionario-workflow-facade.service';
import {
  getEstadoBadgeVariant,
  isTareaCompletable,
  isTareaTomable,
  normalizeEstado,
} from '../../services/funcionario-workflow-status.util';

interface WorkflowTraceField {
  etiqueta: string;
  valor: string;
}

interface WorkflowTraceStep {
  tareaId: string;
  nombreActividad: string;
  departamento: string;
  responsable: string;
  estadoTarea: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  observaciones: string | null;
  camposFormulario: WorkflowTraceField[];
}

@Component({
  selector: 'app-funcionario-tarea-detalle-page',
  imports: [
    CommonModule,
    AppCardComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppAlertComponent,
    LoaderComponent,
    EmptyStateComponent,
    TareaFormularioDinamicoComponent,
    AppModalComponent,
  ],
  templateUrl: './funcionario-tarea-detalle.html',
  styleUrl: './funcionario-tarea-detalle.css',
})
export class FuncionarioTareaDetallePageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FuncionarioWorkflowApiService);
  private readonly guideContext = inject(EmployeeGuideContextService);

  readonly facade = inject(FuncionarioWorkflowFacadeService);

  readonly workflowModalOpen = signal(false);
  readonly workflowModalLoading = signal(false);
  readonly workflowModalError = signal<string | null>(null);
  readonly workflowModalSteps = signal<WorkflowTraceStep[]>([]);

  private traceSubscription: Subscription | null = null;

  private readonly tareaIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null }
  );

  readonly tareaDetalleVisible = computed(() => {
    const taskId = this.tareaIdParam();
    const task = this.facade.tareaDetalle();

    if (!taskId || !task || task.id !== taskId) {
      return null;
    }

    return task;
  });

  readonly puedeTomar = computed(() => {
    const task = this.tareaDetalleVisible();
    return Boolean(task && isTareaTomable(task.estadoTarea));
  });

  readonly puedeCompletar = computed(() => {
    const task = this.tareaDetalleVisible();
    if (!task) {
      return false;
    }

    return (
      isTareaCompletable(task.estadoTarea) && !this.facade.detalleCompleteBlocked()
    );
  });

  readonly mostrarFormulario = computed(() => {
    const task = this.tareaDetalleVisible();
    return Boolean(
      task &&
        (isTareaTomable(task.estadoTarea) || isTareaCompletable(task.estadoTarea))
    );
  });

  readonly debeTomarAntesDeCompletar = computed(() => {
    const task = this.tareaDetalleVisible();
    return Boolean(task && isTareaTomable(task.estadoTarea));
  });

  readonly tieneResumenEnviado = computed(() => {
    const task = this.tareaDetalleVisible();
    if (!task) {
      return false;
    }

    const tieneRespuestas = Object.keys(task.formularioRespuesta ?? {}).length > 0;
    const tieneObservaciones = Boolean(task.observaciones?.trim());
    return tieneRespuestas || tieneObservaciones;
  });

  readonly tieneFormularioRespuesta = computed(() => {
    const task = this.tareaDetalleVisible();
    if (!task) {
      return false;
    }

    return Object.keys(task.formularioRespuesta ?? {}).length > 0;
  });

  readonly resumenRespuestaJson = computed(() => {
    const task = this.tareaDetalleVisible();
    if (!task) {
      return '{}';
    }

    return JSON.stringify(task.formularioRespuesta ?? {}, null, 2);
  });

  constructor() {
    effect(() => {
      const taskId = this.tareaIdParam();

      if (!taskId) {
        this.facade.stopDetallePolling();
        this.facade.clearDetalleState();
        this.guideContext.clearContext('EMPLOYEE_DASHBOARD');
        return;
      }

      const currentTask = this.facade.tareaDetalle();
      if (currentTask && currentTask.id !== taskId) {
        this.facade.stopDetallePolling();
        this.facade.clearDetalleState();
      }

      this.facade.startDetallePolling(taskId, 12000);
    });

    effect(() => {
      const task = this.tareaDetalleVisible();
      if (!task) {
        return;
      }

      const hasForm = task.actividad.formularioDefinicion.campos.length > 0;
      this.guideContext.updateContext({
        screen: hasForm ? 'TASK_FORM' : 'TASK_DETAIL',
        taskId: task.id,
        instanceId: task.instanciaId,
        availableActions: this.buildGuideActions(task),
      });
    });
  }

  ngOnDestroy(): void {
    this.guideContext.clearContext('EMPLOYEE_DASHBOARD');
    this.facade.stopDetallePolling();
    this.traceSubscription?.unsubscribe();
  }

  refresh(): void {
    const taskId = this.tareaIdParam();
    if (!taskId) {
      return;
    }

    this.facade.refreshDetalle(taskId);
  }

  volver(): void {
    void this.router.navigate(['/funcionario/tareas']);
  }

  tomarTarea(): void {
    const taskId = this.tareaIdParam();
    if (!taskId) {
      return;
    }

    this.facade.tomarTareaEnDetalle(taskId);
  }

  completarTarea(payload: CompletarTareaPayload): void {
    const taskId = this.tareaIdParam();
    if (!taskId) {
      return;
    }

    this.facade.completarTarea(taskId, payload);
  }

  abrirWorkflowModal(): void {
    const task = this.tareaDetalleVisible();
    const instanciaId = task?.instanciaId;

    if (!instanciaId) {
      this.workflowModalOpen.set(true);
      this.workflowModalLoading.set(false);
      this.workflowModalSteps.set([]);
      this.workflowModalError.set(
        'La tarea no tiene una instancia asociada para mostrar trazabilidad.'
      );
      return;
    }

    this.workflowModalOpen.set(true);
    this.workflowModalLoading.set(true);
    this.workflowModalError.set(null);
    this.workflowModalSteps.set([]);

    this.traceSubscription?.unsubscribe();
    this.traceSubscription = this.loadWorkflowTrace$(instanciaId, task.id).subscribe({
      next: (steps) => {
        this.workflowModalSteps.set(steps);
      },
      error: () => {
        this.workflowModalError.set(
          'No se pudo cargar la trazabilidad interdepartamental.'
        );
      },
      complete: () => {
        this.workflowModalLoading.set(false);
      },
    });
  }

  cerrarWorkflowModal(): void {
    this.workflowModalOpen.set(false);
    this.workflowModalLoading.set(false);
    this.traceSubscription?.unsubscribe();
    this.traceSubscription = null;
  }

  esUltimoPaso(index: number): boolean {
    return index === this.workflowModalSteps().length - 1;
  }

  private loadWorkflowTrace$(
    instanciaId: string,
    tareaActualId: string
  ): Observable<WorkflowTraceStep[]> {
    return this.api.getTareasPorInstancia(instanciaId).pipe(
      map((items) => items.map(mapTareaMiaDto)),
      switchMap((tasks) => {
        const byId = new Map<string, TareaResumen>();
        for (const task of tasks) {
          byId.set(task.id, task);
        }

        if (!byId.has(tareaActualId) && this.tareaDetalleVisible()) {
          const current = this.tareaDetalleVisible()!;
          byId.set(tareaActualId, {
            id: current.id,
            nombreActividad: current.actividad.nombreActividad,
            estadoTarea: current.estadoTarea,
            instanciaId,
            politicaId: current.politica?.id ?? '',
            politicaNombre: current.politica?.nombre ?? '',
            fechaCreacion: current.fechaCreacion,
            fechaInicio: current.fechaInicio,
            prioridad: null,
            responsableActual: current.actividad.responsableId,
            responsableTipo: current.actividad.responsableTipo,
            responsableId: current.actividad.responsableId,
            codigoTramite: this.facade.instanciaDetalle()?.codigoTramite ?? null,
            estadoInstancia: this.facade.instanciaDetalle()?.estadoInstancia ?? null,
            contextoResumen: null,
          });
        }

        const summaries = Array.from(byId.values());
        if (summaries.length === 0) {
          return of([] as WorkflowTraceStep[]);
        }

        const detailRequests = summaries.map((summary) =>
          this.api.getTareaDetalle(summary.id).pipe(
            map((dto) => ({
              summary,
              detail: mapTareaDetalleDto(dto),
            })),
            catchError(() => of({ summary, detail: null as TareaDetalle | null }))
          )
        );

        return forkJoin(detailRequests).pipe(
          map((items) => this.buildTraceSteps(items))
        );
      }),
      catchError(() => {
        this.workflowModalLoading.set(false);
        this.workflowModalError.set(
          'No fue posible consultar tareas de la instancia.'
        );
        return of([] as WorkflowTraceStep[]);
      })
    );
  }

  private buildTraceSteps(
    items: Array<{
      summary: TareaResumen;
      detail: TareaDetalle | null;
    }>
  ): WorkflowTraceStep[] {
    return items
      .map(({ summary, detail }) => ({
        tareaId: summary.id,
        nombreActividad: detail?.actividad.nombreActividad ?? summary.nombreActividad,
        departamento: this.resolveDepartamento(summary, detail),
        responsable: detail?.asignadoANombre ?? detail?.asignadoA ?? '-',
        estadoTarea: detail?.estadoTarea ?? summary.estadoTarea,
        fechaInicio: detail?.fechaInicio ?? summary.fechaInicio,
        fechaFin: detail?.fechaFin ?? null,
        observaciones: detail?.observaciones ?? null,
        camposFormulario: this.formatFormularioFields(detail),
      }))
      .filter((step) => this.isWorkflowStepVisible(step))
      .sort((left, right) => this.stepSortWeight(left) - this.stepSortWeight(right));
  }

  private isWorkflowStepVisible(step: WorkflowTraceStep): boolean {
    const normalized = normalizeEstado(step.estadoTarea);
    const wasExecuted =
      normalized === 'EN_PROCESO' ||
      normalized === 'COMPLETADA' ||
      normalized === 'RECHAZADA' ||
      normalized === 'CANCELADA';

    return (
      wasExecuted ||
      Boolean(step.fechaInicio) ||
      Boolean(step.fechaFin) ||
      Boolean(step.observaciones?.trim()) ||
      step.camposFormulario.length > 0
    );
  }

  private stepSortWeight(step: WorkflowTraceStep): number {
    const dateSource = step.fechaInicio ?? step.fechaFin;
    if (!dateSource) {
      return Number.MAX_SAFE_INTEGER;
    }

    return new Date(dateSource).getTime();
  }

  private resolveDepartamento(
    summary: TareaResumen,
    detail: TareaDetalle | null
  ): string {
    return (
      summary.responsableActual ??
      detail?.actividad.responsableId ??
      detail?.actividad.responsableTipo ??
      summary.responsableId ??
      summary.responsableTipo ??
      'Departamento no identificado'
    );
  }

  private formatFormularioFields(detail: TareaDetalle | null): WorkflowTraceField[] {
    if (!detail) {
      return [];
    }

    const respuestas = detail.formularioRespuesta ?? {};
    const definitionByKey = new Map(
      detail.actividad.formularioDefinicion.campos.map((field) => [field.clave, field.etiqueta])
    );

    return Object.entries(respuestas).map(([key, value]) => ({
      etiqueta: definitionByKey.get(key) ?? key,
      valor: this.formatFieldValue(value),
    }));
  }

  private formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'string') {
      return value.trim().length > 0 ? value : '-';
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.map((item) => this.formatFieldValue(item)).join(', ') : '-';
    }

    if (typeof value === 'object') {
      const metadataCandidate = value as { nombre?: unknown; nombreOriginal?: unknown; tipoMime?: unknown };
      if (
        (typeof metadataCandidate.nombre === 'string' && metadataCandidate.nombre.trim()) ||
        (typeof metadataCandidate.nombreOriginal === 'string' && metadataCandidate.nombreOriginal.trim())
      ) {
        const fileName =
          (typeof metadataCandidate.nombreOriginal === 'string' && metadataCandidate.nombreOriginal.trim()) ||
          (typeof metadataCandidate.nombre === 'string' && metadataCandidate.nombre.trim()) ||
          'Archivo';
        const mimeType =
          typeof metadataCandidate.tipoMime === 'string' && metadataCandidate.tipoMime.trim()
            ? ` (${metadataCandidate.tipoMime})`
            : '';
        return `${fileName}${mimeType}`;
      }

      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  estadoVariant(
    estado: string | null
  ): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    return getEstadoBadgeVariant(estado);
  }

  private buildGuideActions(task: TareaDetalle): string[] {
    const actions = ['ASK_HELP'];
    const hasForm = task.actividad.formularioDefinicion.campos.length > 0;

    if (isTareaTomable(task.estadoTarea)) {
      actions.push('START_TASK');
    }

    if (hasForm) {
      actions.push('SAVE_FORM', 'FILL_FORM_WITH_AI');
    }

    if (isTareaCompletable(task.estadoTarea) || isTareaTomable(task.estadoTarea)) {
      actions.push('COMPLETE_TASK');
    }

    return [...new Set(actions)];
  }
}
