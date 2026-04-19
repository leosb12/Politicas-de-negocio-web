import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  output,
} from '@angular/core';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppTableComponent } from '../../../../shared/ui/table/table';
import { TareaResumen } from '../../models/funcionario-workflow.model';
import {
  getEstadoBadgeVariant,
  getPrioridadBadgeVariant,
  isTareaCompletable,
  isTareaFinalizada,
  isTareaTomable,
  normalizeEstado,
} from '../../services/funcionario-workflow-status.util';

@Component({
  selector: 'app-funcionario-tareas-table',
  imports: [
    CommonModule,
    AppCardComponent,
    AppTableComponent,
    AppBadgeComponent,
    AppButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './funcionario-tareas-table.html',
  styleUrl: './funcionario-tareas-table.css',
})
export class FuncionarioTareasTableComponent {
  readonly tareas = input.required<TareaResumen[]>();
  readonly actionTareaId = input<string | null>(null);
  readonly mostrarAccionTomar = input(true, { transform: booleanAttribute });

  readonly verDetalle = output<string>();
  readonly tomar = output<string>();

  onVerDetalle(tareaId: string): void {
    this.verDetalle.emit(tareaId);
  }

  onTomar(tareaId: string): void {
    this.tomar.emit(tareaId);
  }

  canTake(tarea: TareaResumen): boolean {
    return this.mostrarAccionTomar() && isTareaTomable(tarea.estadoTarea);
  }

  isPending(tareaId: string): boolean {
    return this.actionTareaId() === tareaId;
  }

  estadoVariant(estado: string | null): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    return getEstadoBadgeVariant(estado);
  }

  prioridadVariant(
    prioridad: string | null
  ): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    return getPrioridadBadgeVariant(prioridad);
  }

  resumenContexto(tarea: TareaResumen): string | null {
    const contexto = tarea.contextoResumen;
    if (!contexto) {
      return null;
    }

    const entries = Object.entries(contexto);
    if (entries.length === 0) {
      return null;
    }

    return entries
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${this.formatearValor(value)}`)
      .join(' | ');
  }

  private formatearValor(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  detalleVariant(
    tarea: TareaResumen
  ):
    | 'secondary'
    | 'warning'
    | 'success'
    | 'danger'
    | 'workflow-pending'
    | 'workflow-in-progress'
    | 'workflow-completed' {
    if (isTareaFinalizada(tarea.estadoTarea)) {
      return 'workflow-completed';
    }

    if (isTareaCompletable(tarea.estadoTarea)) {
      return 'workflow-in-progress';
    }

    const estado = normalizeEstado(tarea.estadoTarea);
    if (estado === 'PENDIENTE' || estado === 'ABIERTA' || estado === 'ASIGNADA') {
      return 'workflow-pending';
    }

    return 'secondary';
  }
}
