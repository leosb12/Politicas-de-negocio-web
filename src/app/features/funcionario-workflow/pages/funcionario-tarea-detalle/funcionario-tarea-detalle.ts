import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { TareaFormularioDinamicoComponent } from '../../components/tarea-formulario-dinamico/tarea-formulario-dinamico';
import { CompletarTareaPayload } from '../../models/funcionario-workflow.model';
import { FuncionarioWorkflowFacadeService } from '../../services/funcionario-workflow-facade.service';
import {
  getEstadoBadgeVariant,
  isTareaCompletable,
  isTareaTomable,
} from '../../services/funcionario-workflow-status.util';

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
  ],
  templateUrl: './funcionario-tarea-detalle.html',
  styleUrl: './funcionario-tarea-detalle.css',
})
export class FuncionarioTareaDetallePageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly facade = inject(FuncionarioWorkflowFacadeService);

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
        return;
      }

      const currentTask = this.facade.tareaDetalle();
      if (currentTask && currentTask.id !== taskId) {
        this.facade.stopDetallePolling();
        this.facade.clearDetalleState();
      }

      this.facade.startDetallePolling(taskId, 12000);
    });
  }

  ngOnDestroy(): void {
    this.facade.stopDetallePolling();
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

  estadoVariant(
    estado: string | null
  ): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    return getEstadoBadgeVariant(estado);
  }
}
