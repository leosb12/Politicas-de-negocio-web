import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { InstanciaDetalle } from '../../models/funcionario-workflow.model';
import { getEstadoBadgeVariant } from '../../services/funcionario-workflow-status.util';

@Component({
  selector: 'app-instancia-resumen-card',
  imports: [CommonModule, AppCardComponent, AppBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instancia-resumen-card.html',
  styleUrl: './instancia-resumen-card.css',
})
export class InstanciaResumenCardComponent {
  readonly instancia = input<InstanciaDetalle | null>(null);

  readonly progreso = computed(() => {
    const instance = this.instancia();
    if (!instance || instance.totalTareas <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((instance.tareasCompletadas / instance.totalTareas) * 100)
    );
  });

  estadoVariant(
    estado: string | null
  ): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
    return getEstadoBadgeVariant(estado);
  }
}
