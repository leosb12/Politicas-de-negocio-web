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
import { TareaResumen } from '../../models/funcionario-flujo.model';
import {
  getEstadoBadgeVariant,
  getPrioridadBadgeVariant,
  isTareaCompletable,
  isTareaFinalizada,
  isTareaTomable,
  normalizeEstado,
} from '../../services/funcionario-flujo-status.util';

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
