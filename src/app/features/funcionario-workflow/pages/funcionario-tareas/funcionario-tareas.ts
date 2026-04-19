import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import { AppSelectComponent } from '../../../../shared/ui/select/select';
import { FuncionarioTareasTableComponent } from '../../components/funcionario-tareas-table/funcionario-tareas-table';
import { FuncionarioWorkflowFacadeService } from '../../services/funcionario-workflow-facade.service';
import { normalizeEstado } from '../../services/funcionario-workflow-status.util';

@Component({
  selector: 'app-funcionario-tareas-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppCardComponent,
    AppAlertComponent,
    AppButtonComponent,
    AppInputComponent,
    AppSelectComponent,
    LoaderComponent,
    EmptyStateComponent,
    FuncionarioTareasTableComponent,
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

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly estadoControl = new FormControl('TODAS', { nonNullable: true });

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

  readonly tareasFiltradas = computed(() => {
    const search = this.searchTerm();
    const estado = normalizeEstado(this.estadoFiltro());

    return this.facade.tareas().filter((task) => {
      const matchesSearch =
        search.length === 0 ||
        task.nombreActividad.toLowerCase().includes(search) ||
        (task.codigoTramite ?? '').toLowerCase().includes(search);

      const matchesState =
        estado === 'TODAS' || normalizeEstado(task.estadoTarea) === estado;

      return matchesSearch && matchesState;
    });
  });

  readonly totalPendientes = computed(() =>
    this.facade
      .tareas()
      .filter((task) => {
        const estado = normalizeEstado(task.estadoTarea);
        return (
          estado === 'PENDIENTE' || estado === 'ABIERTA' || estado === 'ASIGNADA'
        );
      }).length
  );

  readonly totalEnProceso = computed(() =>
    this.facade
      .tareas()
      .filter((task) => {
        const estado = normalizeEstado(task.estadoTarea);
        return estado === 'EN_PROCESO' || estado === 'TOMADA';
      }).length
  );

  readonly totalCompletadas = computed(() =>
    this.facade
      .tareas()
      .filter((task) => {
        const estado = normalizeEstado(task.estadoTarea);
        return estado === 'COMPLETADA' || estado === 'FINALIZADA';
      }).length
  );

  ngOnInit(): void {
    this.facade.startInboxPolling(12000);
  }

  ngOnDestroy(): void {
    this.facade.stopInboxPolling();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.estadoControl.setValue('TODAS');
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
}
