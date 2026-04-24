import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppTableComponent } from '../../../../shared/ui/table/table';
import {
  SimulationResult,
  normalizeSimulationRunResponse,
} from '../../models/simulation.model';
import { SimulationService } from '../../services/simulation.service';

@Component({
  selector: 'app-simulation-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    LoaderComponent,
    EmptyStateComponent,
    AppAlertComponent,
    AppBadgeComponent,
    AppCardComponent,
    AppTableComponent,
  ],
  templateUrl: './simulation-detail.html',
  styleUrl: './simulation-detail.css',
})
export class SimulationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly simulationService = inject(SimulationService);

  readonly simulation = signal<SimulationResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly summaryCards = computed(() => {
    const simulation = this.simulation();
    if (!simulation) {
      return [];
    }

    return [
      {
        label: 'Tiempo promedio estimado',
        value: this.formatHours(simulation.averageEstimatedTimeHours),
      },
      {
        label: 'Instancias simuladas',
        value: `${simulation.totalSimulatedInstances ?? 0}`,
      },
      {
        label: 'Nodo con mayor carga',
        value: simulation.maxLoadNodeName || 'Sin dato',
      },
      {
        label: 'Porcentaje de carga',
        value: this.formatPercent(simulation.maxLoadPercentage),
      },
    ];
  });

  ngOnInit(): void {
    const simulationId = this.route.snapshot.paramMap.get('simulationId') ?? '';
    if (!simulationId) {
      this.error.set('La ruta no incluye un identificador de simulacion.');
      return;
    }

    this.loadSimulation(simulationId);
  }

  loadSimulation(simulationId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.simulationService
      .getSimulationById(simulationId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.simulation.set(normalizeSimulationRunResponse(response).result ?? null);
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No se pudieron recuperar los resultados.')
          );
        },
      });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Date(value).toLocaleString('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatHours(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'Sin datos';
    }

    return `${value.toLocaleString('es-BO', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} h`;
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'Sin datos';
    }

    return `${value.toLocaleString('es-BO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}%`;
  }

  nodeVariant(isBottleneck: boolean | undefined) {
    return isBottleneck ? ('warning' as const) : ('neutral' as const);
  }
}
