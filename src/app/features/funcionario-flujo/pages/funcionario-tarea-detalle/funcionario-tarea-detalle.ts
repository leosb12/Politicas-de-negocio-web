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
} from '../../models/funcionario-flujo.model';
import {
  ArchivoMetadataResponseDto,
  InstanciaDetalleResponseDto,
  FlujoFormularioCampoDefinicionDto,
} from '../../models/funcionario-flujo.dto';
import { FuncionarioGuiaContextService } from '../../services/funcionario-guia-context.service';
import { FuncionarioFlujoApiService } from '../../services/funcionario-flujo-api.service';
import { mapTareaDetalleDto, mapTareaMiaDto } from '../../services/funcionario-flujo.mapper';
import { FuncionarioFlujoFacadeService } from '../../services/funcionario-flujo-facade.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { DocumentoColaborativoService, DocumentoColaborativoMetadata } from '../../services/documento-colaborativo.service';
import {
  getEstadoBadgeVariant,
  isTareaCompletable,
  isTareaTomable,
  normalizeEstado,
} from '../../services/funcionario-flujo-status.util';

interface FlujoTraceField {
  etiqueta: string;
  valor: string;
}

interface FlujoTraceStep {
  tareaId: string;
  nombreActividad: string;
  departamento: string;
  responsable: string;
  estadoTarea: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  observaciones: string | null;
  camposFormulario: FlujoTraceField[];
  documentos: ArchivoMetadataResponseDto[];
  documentosColaborativos: DocumentoColaborativoMetadata[];
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
  private readonly api = inject(FuncionarioFlujoApiService);
  private readonly guideContext = inject(FuncionarioGuiaContextService);
  private readonly auth = inject(AuthService);
  private readonly collabDocService = inject(DocumentoColaborativoService);
  private readonly toastService = inject(ToastService);

  readonly documentosColaborativos = signal<DocumentoColaborativoMetadata[]>([]);
  readonly documentosColaborativosLoading = signal<boolean>(false);
  readonly documentosColaborativosError = signal<string | null>(null);

  readonly facade = inject(FuncionarioFlujoFacadeService);

  readonly workflowModalOpen = signal(false);
  readonly workflowModalLoading = signal(false);
  readonly workflowModalError = signal<string | null>(null);
  readonly workflowModalSteps = signal<FlujoTraceStep[]>([]);

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

  readonly esParticipante = computed(() => {
    const task = this.tareaDetalleVisible();
    const session = this.auth.obtenerSesion();
    if (!task || !session) {
      return false;
    }
    const esAsignado = task.asignadoA === session.id;
    const estaEnLista = task.participantesIds?.includes(session.id) ?? false;
    return esAsignado || estaEnLista;
  });

  readonly puedeTomar = computed(() => {
    const task = this.tareaDetalleVisible();
    return Boolean(task && isTareaTomable(task.estadoTarea));
  });

  readonly puedeTrabajar = computed(() => {
    const task = this.tareaDetalleVisible();
    if (!task) {
      return false;
    }
    return task.estadoTarea === 'EN_PROCESO' && !this.esParticipante();
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
    if (!task) return false;
    return isTareaTomable(task.estadoTarea) || (task.estadoTarea === 'EN_PROCESO' && !this.esParticipante());
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

  readonly currentInstanciaId = computed(() => {
    const task = this.tareaDetalleVisible();
    return (
      task?.instanciaId ??
      task?.tramiteId ??
      task?.processInstanceId ??
      task?.instanciaPoliticaId ??
      null
    );
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
      const instId = this.currentInstanciaId();
      const task = this.tareaDetalleVisible();
      if (task) {
        console.log('Tarea para metadata colaborativa:', task);
        console.log('IDs tarea documentos colaborativos:', {
          instanciaId: task.instanciaId,
          tramiteId: task.tramiteId,
          processInstanceId: task.processInstanceId,
          instanciaPoliticaId: task.instanciaPoliticaId,
        });
      }
      if (instId) {
        this.cargarDocumentosColaborativos(instId);
      } else {
        this.documentosColaborativos.set([]);
      }
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
        instanceId: this.currentInstanciaId(),
        availableActions: this.buildGuideActions(task),
      });
    });
  }

  cargarDocumentosColaborativos(instanciaId: string): void {
    this.documentosColaborativosLoading.set(true);
    this.documentosColaborativosError.set(null);
    console.log('Consultando documentos colaborativos con instanciaId:', instanciaId);

    this.collabDocService.listarPorTramite(instanciaId).subscribe({
      next: (docs) => {
        console.log('Documentos colaborativos recibidos:', docs || []);
        this.documentosColaborativos.set(docs || []);
        this.documentosColaborativosLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar documentos colaborativos:', err);
        this.documentosColaborativosError.set('No se pudieron cargar los documentos colaborativos de este trámite.');
        this.documentosColaborativosLoading.set(false);
      }
    });
  }

  abrirDocumentoColaborativo(doc: DocumentoColaborativoMetadata): void {
    if (!this.puedeAbrirDocumentoColaborativo(doc)) {
      return;
    }
    void this.router.navigate(['/funcionario/documentos-colaborativos', doc.documentoId, 'editar']);
  }

  puedeAbrirDocumentoColaborativo(doc: DocumentoColaborativoMetadata): boolean {
    return Boolean(doc.permisosUsuario?.puedeLeer || doc.permisosUsuario?.puedeEditar);
  }

  etiquetaAccionDocumentoColaborativo(doc: DocumentoColaborativoMetadata): string {
    return doc.permisosUsuario?.puedeEditar ? 'Editar' : 'Ver';
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

  abrirFlujoModal(): void {
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
    this.traceSubscription = this.loadFlujoTrace$(instanciaId, task.id).subscribe({
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

  cerrarFlujoModal(): void {
    this.workflowModalOpen.set(false);
    this.workflowModalLoading.set(false);
    this.traceSubscription?.unsubscribe();
    this.traceSubscription = null;
  }

  esUltimoPaso(index: number): boolean {
    return index === this.workflowModalSteps().length - 1;
  }

  private loadFlujoTrace$(
    instanciaId: string,
    tareaActualId: string
  ): Observable<FlujoTraceStep[]> {
    return forkJoin({
      instancia: this.api.getInstanciaDetalle(instanciaId).pipe(catchError(() => of(null))),
      tasks: this.api.getTareasPorInstancia(instanciaId).pipe(map((items) => items.map(mapTareaMiaDto))),
      documentos: this.api.getArchivosPorInstancia(instanciaId).pipe(catchError(() => of([] as ArchivoMetadataResponseDto[]))),
      documentosColaborativos: this.collabDocService.listarPorTramite(instanciaId).pipe(catchError(() => of([] as DocumentoColaborativoMetadata[]))),
    }).pipe(
      switchMap(({ instancia, tasks, documentos, documentosColaborativos }) => {
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
          const emptyResult: FlujoTraceStep[] = [];
          if (instancia && instancia.requisitosInicialesDefinicion && instancia.requisitosInicialesDefinicion.length > 0) {
            const answers = instancia.respuestasRequisitosIniciales ?? {};
            const requirementsFields = this.formatRequisitosInicialesFields(
              instancia.requisitosInicialesDefinicion,
              answers
            );
            const initialDocs = documentos.filter(doc => !doc.tareaId);
            emptyResult.push({
              tareaId: 'requisitos-iniciales',
              nombreActividad: 'Requisitos iniciales',
              departamento: 'Cliente',
              responsable: instancia.creadaPorNombre || instancia.creadaPor || '-',
              estadoTarea: 'COMPLETADA',
              fechaInicio: instancia.fechaCreacion,
              fechaFin: instancia.fechaCreacion,
              observaciones: null,
              camposFormulario: requirementsFields,
              documentos: initialDocs,
              documentosColaborativos: [],
            });
          }
          return of(emptyResult);
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
          map((items) => this.buildTraceSteps(items, documentos, documentosColaborativos, instancia))
        );
      }),
      catchError(() => {
        this.workflowModalLoading.set(false);
        this.workflowModalError.set(
          'No fue posible consultar tareas de la instancia.'
        );
        return of([] as FlujoTraceStep[]);
      })
    );
  }

  private buildTraceSteps(
    items: Array<{
      summary: TareaResumen;
      detail: TareaDetalle | null;
    }>,
    documentos: ArchivoMetadataResponseDto[],
    documentosColaborativos: DocumentoColaborativoMetadata[],
    instancia: InstanciaDetalleResponseDto | null
  ): FlujoTraceStep[] {
    const steps = items
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
        documentos: this.documentosPorTarea(documentos, summary.id),
        documentosColaborativos: this.documentosColaborativosPorTarea(documentosColaborativos, detail),
      }))
      .filter((step) => this.isFlujoStepVisible(step));

    if (instancia && instancia.requisitosInicialesDefinicion && instancia.requisitosInicialesDefinicion.length > 0) {
      const answers = instancia.respuestasRequisitosIniciales ?? {};
      const requirementsFields = this.formatRequisitosInicialesFields(
        instancia.requisitosInicialesDefinicion,
        answers
      );
      const initialDocs = documentos.filter(doc => !doc.tareaId);
      steps.push({
        tareaId: 'requisitos-iniciales',
        nombreActividad: 'Requisitos iniciales',
        departamento: 'Cliente',
        responsable: instancia.creadaPorNombre || instancia.creadaPor || '-',
        estadoTarea: 'COMPLETADA',
        fechaInicio: instancia.fechaCreacion,
        fechaFin: instancia.fechaCreacion,
        observaciones: null,
        camposFormulario: requirementsFields,
        documentos: initialDocs,
        documentosColaborativos: [],
      });
    }

    return steps.sort((left, right) => this.stepSortWeight(left) - this.stepSortWeight(right));
  }

  private isFlujoStepVisible(step: FlujoTraceStep): boolean {
    if (step.tareaId === 'requisitos-iniciales') {
      return true;
    }
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
      step.camposFormulario.length > 0 ||
      step.documentos.length > 0 ||
      step.documentosColaborativos.length > 0
    );
  }

  descargarDocumento(documento: ArchivoMetadataResponseDto): void {
    if (!documento.puedeDescargar) {
      return;
    }
    this.api.descargarArchivo(documento.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = documento.nombreOriginal || 'documento';
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.workflowModalError.set('No se pudo descargar el documento.'),
    });
  }

  verDocumento(documento: ArchivoMetadataResponseDto): void {
    if (!documento.puedeVer) {
      return;
    }
    this.api.verArchivo(documento.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      },
      error: () => this.workflowModalError.set('No se pudo visualizar el documento.'),
    });
  }

  editarDocumento(documento: ArchivoMetadataResponseDto): void {
    if (!documento.puedeEditar) {
      return;
    }
    const nombreOriginal = window.prompt('Nombre del archivo', documento.nombreOriginal ?? '');
    if (nombreOriginal === null) {
      return;
    }
    const descripcion = window.prompt('Descripcion', documento.descripcion ?? '');
    if (descripcion === null) {
      return;
    }
    this.api.editarArchivo(documento.id, {
      nombreOriginal: nombreOriginal.trim() || documento.nombreOriginal,
      descripcion: descripcion.trim() || null,
    }).subscribe({
      next: (updated) => this.reemplazarDocumentoEnTrazabilidad(documento.id, {
        ...documento,
        ...updated,
        puedeVer: documento.puedeVer,
        puedeDescargar: documento.puedeDescargar,
        puedeEditar: documento.puedeEditar,
        puedeReemplazar: documento.puedeReemplazar,
        puedeEliminar: documento.puedeEliminar,
      }),
      error: () => this.workflowModalError.set('No se pudo editar el documento.'),
    });
  }

  reemplazarDocumento(documento: ArchivoMetadataResponseDto): void {
    if (!documento.puedeReemplazar) {
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      this.api.reemplazarArchivo(documento.id, file).subscribe({
        next: (updated) => this.reemplazarDocumentoEnTrazabilidad(documento.id, {
          ...documento,
          ...updated,
          puedeVer: documento.puedeVer,
          puedeDescargar: documento.puedeDescargar,
          puedeEditar: documento.puedeEditar,
          puedeReemplazar: documento.puedeReemplazar,
          puedeEliminar: documento.puedeEliminar,
        }),
        error: () => this.workflowModalError.set('No se pudo reemplazar el documento.'),
      });
    };
    input.click();
  }

  eliminarDocumento(documento: ArchivoMetadataResponseDto): void {
    if (!documento.puedeEliminar) {
      return;
    }
    this.api.eliminarArchivo(documento.id).subscribe({
      next: () => {
        this.workflowModalSteps.update((steps) =>
          steps.map((step) => ({
            ...step,
            documentos: step.documentos.filter((item) => item.id !== documento.id),
          }))
        );
      },
      error: () => this.workflowModalError.set('No se pudo eliminar el documento.'),
    });
  }

  private reemplazarDocumentoEnTrazabilidad(
    documentoId: string,
    updated: ArchivoMetadataResponseDto
  ): void {
    this.workflowModalSteps.update((steps) =>
      steps.map((step) => ({
        ...step,
        documentos: step.documentos.map((item) => item.id === documentoId ? updated : item),
      }))
    );
  }

  private documentosPorTarea(
    documentos: ArchivoMetadataResponseDto[],
    tareaId: string
  ): ArchivoMetadataResponseDto[] {
    return documentos.filter((documento) => documento.tareaId === tareaId);
  }

  private documentosColaborativosPorTarea(
    documentos: DocumentoColaborativoMetadata[],
    detail: TareaDetalle | null
  ): DocumentoColaborativoMetadata[] {
    const campos = detail?.actividad.formularioDefinicion.campos ?? [];
    if (documentos.length === 0 || campos.length === 0) {
      return [];
    }

    const exactos = new Set<string>();
    const normalizados = new Set<string>();
    const agregar = (value: string | null | undefined) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return;
      }
      exactos.add(trimmed);
      normalizados.add(this.normalizarDocumentoColaborativoTexto(trimmed));
    };

    for (const campo of campos) {
      agregar(campo.id);
      agregar(campo.clave);
      agregar(campo.nombre);
      agregar(campo.etiqueta);
    }

    const vistos = new Set<string>();
    return documentos.filter((documento) => {
      const coincide =
        this.coincideDocumentoColaborativo(documento.campoFormularioId, exactos, normalizados) ||
        this.coincideDocumentoColaborativo(documento.nombreDocumento, exactos, normalizados);
      if (!coincide || vistos.has(documento.documentoId)) {
        return false;
      }
      vistos.add(documento.documentoId);
      return true;
    });
  }

  private coincideDocumentoColaborativo(
    value: string | null | undefined,
    exactos: Set<string>,
    normalizados: Set<string>
  ): boolean {
    const trimmed = value?.trim();
    if (!trimmed) {
      return false;
    }
    return exactos.has(trimmed) || normalizados.has(this.normalizarDocumentoColaborativoTexto(trimmed));
  }

  private normalizarDocumentoColaborativoTexto(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\s-]+/g, '_');
  }

  private stepSortWeight(step: FlujoTraceStep): number {
    if (step.tareaId === 'requisitos-iniciales') {
      return Number.MIN_SAFE_INTEGER;
    }
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

  private formatFormularioFields(detail: TareaDetalle | null): FlujoTraceField[] {
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

  private formatRequisitosInicialesFields(
    definicion: FlujoFormularioCampoDefinicionDto[] | null | undefined,
    respuestas: Record<string, unknown> | null | undefined
  ): FlujoTraceField[] {
    if (!definicion || !respuestas) {
      return [];
    }

    const definitionByKey = new Map<string, string>();
    for (const field of definicion) {
      const key = field.clave || field.campo || field.id;
      const label = field.etiqueta || field.nombre || field.label;
      if (key && label) {
        definitionByKey.set(key, label);
      }
    }

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
