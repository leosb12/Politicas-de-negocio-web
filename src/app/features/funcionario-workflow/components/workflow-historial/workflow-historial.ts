import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppTableComponent } from '../../../../shared/ui/table/table';
import { HistorialEvento } from '../../models/funcionario-workflow.model';
import { getEstadoBadgeVariant } from '../../services/funcionario-workflow-status.util';

@Component({
  selector: 'app-workflow-historial',
  imports: [CommonModule, AppCardComponent, AppTableComponent, AppBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflow-historial.html',
  styleUrl: './workflow-historial.css',
})
export class WorkflowHistorialComponent {
  readonly titulo = input('Historial');
  readonly eventos = input<HistorialEvento[]>([]);
  readonly emptyTitle = input('Sin eventos');
  readonly emptyMessage = input('Aun no hay eventos para mostrar.');

  readonly orderedEvents = computed(() =>
    [...this.eventos()].sort(
      (left, right) =>
        new Date(left.fecha).getTime() - new Date(right.fecha).getTime()
    )
  );

  accionVariant(accion: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    return getEstadoBadgeVariant(accion);
  }
}
