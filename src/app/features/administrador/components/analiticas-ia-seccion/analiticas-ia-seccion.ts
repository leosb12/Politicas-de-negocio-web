import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import {
  BottlenecksResponse,
  TaskRedistributionResponse,
} from '../../models/administrador-analiticas.model';

type InsightState = 'data' | 'empty' | 'unavailable' | 'missing';

@Component({
  selector: 'app-analiticas-ia-seccion',
  imports: [CommonModule, AppCardComponent, EmptyStateComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analiticas-ia-seccion.html',
  styleUrl: './analiticas-ia-seccion.css',
})
export class AnaliticasIaSeccionComponent {
  readonly loading = input<boolean>(false);
  readonly error = input<boolean>(false);
  readonly bottlenecks = input<BottlenecksResponse | null>(null);
  readonly taskRecommendations = input<TaskRedistributionResponse | null>(null);

  readonly bottleneckState = computed(() =>
    this.getResponseState(this.bottlenecks(), 'bottlenecks')
  );

  readonly taskRecommendationState = computed(() =>
    this.getResponseState(this.taskRecommendations(), 'recommendations')
  );

  readonly showGlobalUnavailable = computed(
    () =>
      this.bottleneckState() === 'unavailable' &&
      this.taskRecommendationState() === 'unavailable'
  );

  readonly showGlobalEmpty = computed(
    () => this.bottleneckState() === 'empty' && this.taskRecommendationState() === 'empty'
  );

  severityClass(severity: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    const classes = {
      HIGH: 'analytics-ai-badge--high',
      MEDIUM: 'analytics-ai-badge--medium',
      LOW: 'analytics-ai-badge--low',
    };

    return classes[severity];
  }

  severityLabel(severity: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    const labels = {
      HIGH: 'Alta',
      MEDIUM: 'Media',
      LOW: 'Baja',
    };

    return labels[severity];
  }

  insightTypeLabel(type: string): string {
    const normalized = type.trim().toUpperCase();
    const labels: Record<string, string> = {
      POLICY: 'Politica',
      POLITICA: 'Politica',
      NODE: 'Nodo',
      NODO: 'Nodo',
      DEPARTMENT: 'Departamento',
      DEPARTAMENTO: 'Departamento',
      OFFICIAL: 'Funcionario',
      FUNCIONARIO: 'Funcionario',
      TASK: 'Tarea',
      TAREA: 'Tarea',
      INSTANCE: 'Instancia',
      INSTANCIA: 'Instancia',
    };

    return labels[normalized] ?? type;
  }

  private getResponseState(
    response: BottlenecksResponse | TaskRedistributionResponse | null,
    kind: 'bottlenecks' | 'recommendations'
  ): InsightState {
    if (!response) {
      return 'missing';
    }

    if (!response.available) {
      return 'unavailable';
    }

    if (kind === 'bottlenecks') {
      const bottleneckResponse = response as BottlenecksResponse;
      return bottleneckResponse.bottlenecks.length > 0 ? 'data' : 'empty';
    }

    const recommendationResponse = response as TaskRedistributionResponse;
    return recommendationResponse.recommendations.length > 0 ? 'data' : 'empty';
  }
}
