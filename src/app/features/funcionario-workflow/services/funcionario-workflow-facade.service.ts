import { inject, Injectable, computed, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  defaultIfEmpty,
  exhaustMap,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import {
  CompletarTareaPayload,
  InstanciaDetalle,
  TareaDetalle,
  TareaResumen,
  WorkflowUiError,
} from '../models/funcionario-workflow.model';
import {
  classifyWorkflowConflict,
  mapWorkflowUiError,
} from './funcionario-workflow-error.util';
import {
  mapInstanciaDetalleDto,
  mapTareaDetalleDto,
  mapTareaMiaDto,
} from './funcionario-workflow.mapper';
import {
  isTareaCompletable,
  isTareaTomable,
  normalizeEstado,
} from './funcionario-workflow-status.util';
import { FuncionarioWorkflowApiService } from './funcionario-workflow-api.service';

@Injectable({
  providedIn: 'root',
})
export class FuncionarioWorkflowFacadeService {
  private readonly api = inject(FuncionarioWorkflowApiService);
  private readonly toast = inject(ToastService);

  readonly tareas = signal<TareaResumen[]>([]);
  readonly bandejaLoading = signal(false);
  readonly bandejaSyncing = signal(false);
  readonly bandejaActionTareaId = signal<string | null>(null);
  readonly bandejaError = signal<WorkflowUiError | null>(null);
  readonly bandejaLastRefreshAt = signal<Date | null>(null);

  readonly tareaDetalle = signal<TareaDetalle | null>(null);
  readonly instanciaDetalle = signal<InstanciaDetalle | null>(null);
  readonly detalleLoading = signal(false);
  readonly detalleSyncing = signal(false);
  readonly detalleAction = signal<'tomar' | 'completar' | null>(null);
  readonly detalleError = signal<WorkflowUiError | null>(null);
  readonly detalleConflictMessage = signal<string | null>(null);
  readonly detalleCompleteBlocked = signal(false);
  readonly instanciaPausedWarning = signal<string | null>(null);
  readonly detalleLastRefreshAt = signal<Date | null>(null);

  readonly instanciaPageDetalle = signal<InstanciaDetalle | null>(null);
  readonly instanciaPageTareas = signal<TareaResumen[]>([]);
  readonly instanciaPageLoading = signal(false);
  readonly instanciaPageSyncing = signal(false);
  readonly instanciaPageError = signal<WorkflowUiError | null>(null);
  readonly instanciaPageLastRefreshAt = signal<Date | null>(null);

  readonly tareasTomables = computed(() =>
    this.tareas().filter((item) => isTareaTomable(item.estadoTarea)).length
  );

  readonly tareasEnProceso = computed(() =>
    this.tareas().filter((item) => isTareaCompletable(item.estadoTarea)).length
  );

  private inboxPollingSubscription: Subscription | null = null;
  private detailPollingSubscription: Subscription | null = null;
  private detailRequestSequence = 0;

  startInboxPolling(intervalMs = 12000): void {
    this.stopInboxPolling();

    this.inboxPollingSubscription = timer(0, intervalMs)
      .pipe(exhaustMap((tick) => this.loadInboxRequest$(tick > 0)))
      .subscribe();
  }

  stopInboxPolling(): void {
    this.inboxPollingSubscription?.unsubscribe();
    this.inboxPollingSubscription = null;
  }

  refreshInbox(): void {
    this.loadInboxRequest$(false).subscribe();
  }

  tomarTareaDesdeBandeja(tareaId: string): void {
    if (this.bandejaActionTareaId()) {
      return;
    }

    this.bandejaActionTareaId.set(tareaId);

    this.api
      .tomarTarea(tareaId)
      .pipe(
        switchMap(() => this.safeParallelRefresh$(this.loadInboxRequest$(true))),
        tap(() => {
          this.toast.success('Tarea tomada', 'La tarea fue tomada correctamente.');
        }),
        catchError((error: unknown) => {
          const mappedError = mapWorkflowUiError(
            error,
            'No fue posible tomar la tarea seleccionada.'
          );
          this.bandejaError.set(mappedError);
          this.toast.error(mappedError.title, mappedError.message);
          return EMPTY;
        }),
        finalize(() => this.bandejaActionTareaId.set(null))
      )
      .subscribe();
  }

  startDetallePolling(tareaId: string, intervalMs = 12000): void {
    this.stopDetallePolling();

    this.detailPollingSubscription = timer(0, intervalMs)
      .pipe(
        exhaustMap((tick) => {
          if (this.detalleAction()) {
            return EMPTY;
          }

          return this.loadDetalleContextRequest$(tareaId, tick > 0);
        })
      )
      .subscribe();
  }

  stopDetallePolling(): void {
    this.detailPollingSubscription?.unsubscribe();
    this.detailPollingSubscription = null;
  }

  refreshDetalle(tareaId: string): void {
    this.loadDetalleContextRequest$(tareaId, false).subscribe();
  }

  tomarTareaEnDetalle(tareaId: string): void {
    if (this.detalleAction()) {
      return;
    }

    this.detalleAction.set('tomar');
    this.detalleError.set(null);

    this.api
      .tomarTarea(tareaId)
      .pipe(
        tap(() => this.aplicarEstadoTomadaEnDetalle(tareaId)),
        switchMap(() =>
          this.safeParallelRefresh$(
            this.loadDetalleContextRequest$(tareaId, true),
            this.loadInboxRequest$(true)
          )
        ),
        switchMap(() => this.forceReloadDetalleAfterTake$(tareaId)),
        tap(() => {
          this.toast.success('Tarea tomada', 'La tarea ahora esta en proceso.');
        }),
        catchError((error: unknown) =>
          this.handleTaskActionError$(
            error,
            tareaId,
            'No fue posible tomar la tarea.'
          )
        ),
        finalize(() => this.detalleAction.set(null))
      )
      .subscribe();
  }

  private forceReloadDetalleAfterTake$(tareaId: string): Observable<void> {
    return this.loadDetalleContextRequest$(tareaId, false).pipe(
      defaultIfEmpty(void 0),
      switchMap(() => {
        const detalle = this.tareaDetalle();

        if (
          detalle &&
          detalle.id === tareaId &&
          !isTareaTomable(detalle.estadoTarea)
        ) {
          return of(void 0);
        }

        return this.loadDetalleContextRequest$(tareaId, false).pipe(
          defaultIfEmpty(void 0)
        );
      }),
      map(() => void 0)
    );
  }

  completarTarea(tareaId: string, payload: CompletarTareaPayload): void {
    if (this.detalleAction()) {
      return;
    }

    this.detalleAction.set('completar');
    this.detalleError.set(null);

    this.api
      .completarTarea(tareaId, payload)
      .pipe(
        switchMap(() =>
          this.safeParallelRefresh$(
            this.loadDetalleContextRequest$(tareaId, true),
            this.loadInboxRequest$(true)
          )
        ),
        tap(() => {
          this.detalleConflictMessage.set(null);
          this.detalleCompleteBlocked.set(false);
          this.instanciaPausedWarning.set(null);
          this.toast.success(
            'Tarea completada',
            'La tarea se completó y el flujo avanzó correctamente.'
          );
        }),
        catchError((error: unknown) =>
          this.handleTaskActionError$(
            error,
            tareaId,
            'No fue posible completar la tarea.'
          )
        ),
        finalize(() => this.detalleAction.set(null))
      )
      .subscribe();
  }

  refreshInstanciaPage(instanciaId: string): void {
    this.loadInstanciaPageRequest$(instanciaId, false).subscribe();
  }

  loadInstanciaPage(instanciaId: string): void {
    this.loadInstanciaPageRequest$(instanciaId, false).subscribe();
  }

  clearDetalleState(): void {
    this.detailRequestSequence += 1;
    this.tareaDetalle.set(null);
    this.instanciaDetalle.set(null);
    this.detalleError.set(null);
    this.detalleConflictMessage.set(null);
    this.detalleCompleteBlocked.set(false);
    this.instanciaPausedWarning.set(null);
    this.detalleLastRefreshAt.set(null);
  }

  private loadInboxRequest$(silent: boolean): Observable<void> {
    if (silent) {
      this.bandejaSyncing.set(true);
    } else {
      this.bandejaLoading.set(true);
      this.bandejaError.set(null);
    }

    return this.api.getMisTareas().pipe(
      map((items) => items.map(mapTareaMiaDto)),
      tap((items) => {
        this.tareas.set(items);
        this.bandejaLastRefreshAt.set(new Date());
        this.bandejaError.set(null);
      }),
      map(() => void 0),
      catchError((error: unknown) => {
        const mappedError = mapWorkflowUiError(
          error,
          'No fue posible cargar tu bandeja de tareas.'
        );
        this.bandejaError.set(mappedError);
        return EMPTY;
      }),
      finalize(() => {
        this.bandejaLoading.set(false);
        this.bandejaSyncing.set(false);
      })
    );
  }

  private loadDetalleContextRequest$(
    tareaId: string,
    silent: boolean
  ): Observable<void> {
    const requestId = ++this.detailRequestSequence;

    if (silent) {
      this.detalleSyncing.set(true);
    } else {
      this.detalleLoading.set(true);
      this.detalleError.set(null);
    }

    return this.api.getTareaDetalle(tareaId).pipe(
      map(mapTareaDetalleDto),
      switchMap((mappedDetail) => {
        if (!mappedDetail.instanciaId) {
          return of({
            detalle: mappedDetail,
            instancia: mappedDetail.instancia,
          });
        }

        return forkJoin({
          detalle: of(mappedDetail),
          instancia: this.api.getInstanciaDetalle(mappedDetail.instanciaId).pipe(
            map(mapInstanciaDetalleDto),
            catchError(() => of(mappedDetail.instancia))
          ),
        });
      }),
      tap(({ detalle, instancia }) => {
        if (!this.esDetalleRequestActual(requestId)) {
          return;
        }

        const detalleReconciliado = this.reconciliarDetalleDuranteTomar(detalle);

        this.tareaDetalle.set(detalleReconciliado);
        this.instanciaDetalle.set(instancia ?? null);
        this.detalleLastRefreshAt.set(new Date());
        this.detalleError.set(null);

        if (normalizeEstado(instancia?.estadoInstancia) !== 'PAUSADA') {
          this.instanciaPausedWarning.set(null);
        }

        this.detalleCompleteBlocked.set(
          !isTareaCompletable(detalleReconciliado.estadoTarea)
        );
      }),
      map(() => void 0),
      catchError((error: unknown) => {
        if (!this.esDetalleRequestActual(requestId)) {
          return EMPTY;
        }

        const mappedError = mapWorkflowUiError(
          error,
          'No fue posible cargar el detalle de la tarea.'
        );
        this.detalleError.set(mappedError);
        return EMPTY;
      }),
      finalize(() => {
        if (!this.esDetalleRequestActual(requestId)) {
          return;
        }

        this.detalleLoading.set(false);
        this.detalleSyncing.set(false);
      })
    );
  }

  private esDetalleRequestActual(requestId: number): boolean {
    return requestId === this.detailRequestSequence;
  }

  private aplicarEstadoTomadaEnDetalle(tareaId: string): void {
    const detalleActual = this.tareaDetalle();
    if (!detalleActual || detalleActual.id !== tareaId) {
      return;
    }

    this.tareaDetalle.set({
      ...detalleActual,
      estadoTarea: 'EN_PROCESO',
      fechaInicio: detalleActual.fechaInicio ?? new Date().toISOString(),
    });

    this.detalleConflictMessage.set(null);
    this.detalleCompleteBlocked.set(false);
    this.detalleLastRefreshAt.set(new Date());
  }

  private reconciliarDetalleDuranteTomar(detalle: TareaDetalle): TareaDetalle {
    const detalleActual = this.tareaDetalle();

    if (
      this.detalleAction() !== 'tomar' ||
      !detalleActual ||
      detalleActual.id !== detalle.id
    ) {
      return detalle;
    }

    const actualEsCompletable = isTareaCompletable(detalleActual.estadoTarea);
    const recibidoEsTomable = isTareaTomable(detalle.estadoTarea);

    if (!actualEsCompletable || !recibidoEsTomable) {
      return detalle;
    }

    return {
      ...detalle,
      estadoTarea: detalleActual.estadoTarea,
      fechaInicio: detalle.fechaInicio ?? detalleActual.fechaInicio,
      asignadoA: detalle.asignadoA ?? detalleActual.asignadoA,
      asignadoANombre: detalle.asignadoANombre ?? detalleActual.asignadoANombre,
    };
  }

  private loadInstanciaPageRequest$(
    instanciaId: string,
    silent: boolean
  ): Observable<void> {
    if (silent) {
      this.instanciaPageSyncing.set(true);
    } else {
      this.instanciaPageLoading.set(true);
      this.instanciaPageError.set(null);
    }

    return forkJoin({
      instancia: this.api.getInstanciaDetalle(instanciaId).pipe(map(mapInstanciaDetalleDto)),
      tareas: this.api.getTareasPorInstancia(instanciaId).pipe(
        map((items) => items.map(mapTareaMiaDto)),
        catchError(() => of([] as TareaResumen[]))
      ),
    }).pipe(
      tap(({ instancia, tareas }) => {
        this.instanciaPageDetalle.set(instancia);
        this.instanciaPageTareas.set(tareas);
        this.instanciaPageLastRefreshAt.set(new Date());
        this.instanciaPageError.set(null);
      }),
      map(() => void 0),
      catchError((error: unknown) => {
        const mappedError = mapWorkflowUiError(
          error,
          'No fue posible cargar la instancia solicitada.'
        );
        this.instanciaPageError.set(mappedError);
        return EMPTY;
      }),
      finalize(() => {
        this.instanciaPageLoading.set(false);
        this.instanciaPageSyncing.set(false);
      })
    );
  }

  private handleTaskActionError$(
    error: unknown,
    tareaId: string,
    fallbackMessage: string
  ): Observable<void> {
    const mappedError = mapWorkflowUiError(error, fallbackMessage);
    this.detalleError.set(mappedError);

    if (mappedError.status === 409) {
      this.applyConflictRules(mappedError.rawMessage, mappedError.message);
      this.toast.error('Conflicto de negocio', this.detalleConflictMessage() ?? mappedError.message);

      return this.safeParallelRefresh$(
        this.loadDetalleContextRequest$(tareaId, true),
        this.loadInboxRequest$(true)
      );
    }

    this.toast.error(mappedError.title, mappedError.message);
    return EMPTY;
  }

  private applyConflictRules(rawMessage: string | null, fallbackMessage: string): void {
    const conflictType = classifyWorkflowConflict(rawMessage);
    const backendMessage = rawMessage ?? fallbackMessage;

    if (conflictType === 'double-completed') {
      this.detalleConflictMessage.set(
        'La tarea ya fue completada por otro actor. Se recargo el estado real y se bloqueo la accion de completar.'
      );
      this.detalleCompleteBlocked.set(true);
      return;
    }

    if (conflictType === 'invalid-decision') {
      this.detalleConflictMessage.set(
        'La decision seleccionada no tiene una salida valida. Revisa el formulario y vuelve a intentar.'
      );
      this.detalleCompleteBlocked.set(false);
      return;
    }

    if (conflictType === 'join-blocked') {
      this.detalleConflictMessage.set(
        'El flujo esta bloqueado por una sincronizacion JOIN pendiente. El backend mantiene la instancia en pausa.'
      );
      this.instanciaPausedWarning.set(
        'Instancia en estado PAUSADA por bloqueo de JOIN. Espera a que se completen las ramas pendientes.'
      );
      this.detalleCompleteBlocked.set(false);
      return;
    }

    if (conflictType === 'policy-version') {
      this.detalleConflictMessage.set(
        'La instancia detecto un conflicto por cambio de version de politica. Se actualizo el detalle automaticamente.'
      );
      this.detalleCompleteBlocked.set(false);
      return;
    }

    this.detalleConflictMessage.set(backendMessage);
    this.detalleCompleteBlocked.set(false);
  }

  private safeParallelRefresh$(...requests: Observable<void>[]): Observable<void> {
    return forkJoin(requests.map((request) => this.wrapRefreshRequest(request))).pipe(
      map(() => void 0)
    );
  }

  private wrapRefreshRequest(request$: Observable<void>): Observable<void> {
    return request$.pipe(
      defaultIfEmpty(void 0),
      catchError(() => of(void 0))
    );
  }
}
