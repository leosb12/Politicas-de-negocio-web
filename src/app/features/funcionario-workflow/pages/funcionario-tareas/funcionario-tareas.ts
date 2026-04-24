import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import { AppSelectComponent } from '../../../../shared/ui/select/select';
import { FuncionarioWorkflowFacadeService } from '../../services/funcionario-workflow-facade.service';
import { normalizeEstado } from '../../services/funcionario-workflow-status.util';

@Component({
  selector: 'app-funcionario-tareas-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppAlertComponent,
    AppButtonComponent,
    AppInputComponent,
    AppSelectComponent,
  ],
  templateUrl: './funcionario-tareas.html',
  styleUrl: './funcionario-tareas.css',
})
export class FuncionarioTareasPageComponent implements OnInit, OnDestroy {
  readonly facade = inject(FuncionarioWorkflowFacadeService);
  private readonly router = inject(Router);

  readonly estadoOptions = [
    'TODAS',
    'PENDIENTE',
    'ABIERTA',
    'ASIGNADA',
    'EN_PROCESO',
    'TOMADA',
    'COMPLETADA',
    'RECHAZADA',
    'CANCELADA',
    'FINALIZADA',
  ];

  readonly prioridadOptions = ['TODAS', 'BAJA', 'NORMAL', 'MEDIA', 'ALTA'];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly estadoControl = new FormControl('TODAS', { nonNullable: true });
  readonly prioridadControl = new FormControl('TODAS', { nonNullable: true });

  private readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      map((value) => value.trim().toLowerCase())
    ),
    { initialValue: '' }
  );

  private readonly estadoFiltro = toSignal(
    this.estadoControl.valueChanges.pipe(startWith(this.estadoControl.value)),
    { initialValue: 'TODAS' }
  );

  private readonly prioridadFiltro = toSignal(
    this.prioridadControl.valueChanges.pipe(startWith(this.prioridadControl.value)),
    { initialValue: 'TODAS' }
  );

  readonly tareasFiltradas = computed(() => {
    const search = this.searchTerm();
    const estado = normalizeEstado(this.estadoFiltro());
    const prioridad = this.prioridadFiltro();

    return this.facade.tareas().filter((task) => {
      const matchesSearch =
        search.length === 0 ||
        task.nombreActividad.toLowerCase().includes(search) ||
        (task.codigoTramite ?? '').toLowerCase().includes(search) ||
        (task.politicaNombre ?? '').toLowerCase().includes(search);

      const matchesState =
        estado === 'TODAS' || normalizeEstado(task.estadoTarea) === estado;

      const taskPrioridad = task.prioridad || 'NORMAL';
      const matchesPrioridad = prioridad === 'TODAS' || taskPrioridad === prioridad;

      return matchesSearch && matchesState && matchesPrioridad;
    });
  });

  readonly tareasPendientes = computed(() => {
    return this.tareasFiltradas().filter((task) => {
      const estado = normalizeEstado(task.estadoTarea);
      return estado === 'PENDIENTE' || estado === 'ABIERTA' || estado === 'ASIGNADA';
    });
  });

  readonly tareasEnProcesoList = computed(() => {
    return this.tareasFiltradas().filter((task) => {
      const estado = normalizeEstado(task.estadoTarea);
      return estado === 'EN_PROCESO' || estado === 'TOMADA';
    });
  });

  readonly tareasCompletadasList = computed(() => {
    return this.tareasFiltradas().filter((task) => {
      const estado = normalizeEstado(task.estadoTarea);
      return estado === 'COMPLETADA' || estado === 'FINALIZADA';
    });
  });

  ngOnInit(): void {
    this.facade.startInboxPolling(3000);
  }

  ngOnDestroy(): void {
    this.facade.stopInboxPolling();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.estadoControl.setValue('TODAS');
    this.prioridadControl.setValue('TODAS');
  }

  verDetalle(tareaId: string): void {
    void this.router.navigate(['/funcionario/tareas', tareaId]);
  }

  tomarTarea(tareaId: string): void {
    this.facade.tomarTareaDesdeBandeja(tareaId);
  }

  recargar(): void {
    this.facade.refreshInbox();
  }

  canTake(tarea: any): boolean {
    const estado = normalizeEstado(tarea.estadoTarea);
    return estado === 'PENDIENTE' || estado === 'ABIERTA' || estado === 'ASIGNADA';
  }

  getPrioridadClass(prioridad: string | null): string {
    if (!prioridad || prioridad === 'NORMAL' || prioridad === 'BAJA') {
      return 'bg-slate-200 text-slate-700';
    }
    if (prioridad === 'MEDIA') {
      return 'bg-amber-200 text-amber-800';
    }
    if (prioridad === 'ALTA') {
      return 'bg-red-200 text-red-800 animate-pulse';
    }
    return 'bg-slate-200 text-slate-700';
  }
}
