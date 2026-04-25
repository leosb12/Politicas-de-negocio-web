import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppTableComponent } from '../../../../shared/ui/table/table';
import { PoliticaNegocio } from '../../../administrador/models/politica.model';
import { PoliticaService } from '../../../administrador/services/politica.service';
import {
  SimulationResult,
  normalizeSimulationRunResponse,
} from '../../models/simulacion.model';
import { SimulacionService } from '../../services/simulacion.service';

@Component({
  selector: 'app-simulaciones-lista-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    LoaderComponent,
    EmptyStateComponent,
    AppAlertComponent,
    AppBadgeComponent,
    AppCardComponent,
    AppTableComponent,
  ],
  templateUrl: './simulaciones-lista.html',
  styleUrl: './simulaciones-lista.css',
})
export class SimulacionesListaPageComponent implements OnInit {
  private readonly politicaService = inject(PoliticaService);
  private readonly simulationService = inject(SimulacionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly policies = signal<PoliticaNegocio[]>([]);
  readonly simulations = signal<SimulationResult[]>([]);
  readonly selectedPolicyId = signal('');
  readonly loadingPolicies = signal(false);
  readonly loadingSimulations = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedPolicy = computed(
    () =>
      this.policies().find((policy) => policy.id === this.selectedPolicyId()) ?? null
  );
  readonly averageTime = computed(() => {
    const items = this.simulations();
    if (items.length === 0) {
      return null;
    }

    const total = items.reduce(
      (sum, item) => sum + (item.averageEstimatedTimeHours ?? 0),
      0
    );

    return total / items.length;
  });
  readonly totalWarnings = computed(() =>
    this.simulations().reduce((sum, item) => sum + item.warnings.length, 0)
  );
  readonly latestSimulation = computed(() => this.simulations()[0] ?? null);
  readonly latestSimulationName = computed(
    () => this.latestSimulation()?.scenarioName ?? 'Sin ejecuciones'
  );
  readonly latestSimulationDate = computed(
    () => this.formatDate(this.latestSimulation()?.createdAt ?? null)
  );

  ngOnInit(): void {
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.loadingPolicies.set(true);
    this.error.set(null);

    this.politicaService
      .getAll()
      .pipe(finalize(() => this.loadingPolicies.set(false)))
      .subscribe({
        next: (policies) => {
          this.policies.set(policies);

          const routePolicyId = this.route.snapshot.queryParamMap.get('policyId');
          const fallbackPolicyId = policies[0]?.id ?? '';
          const policyId =
            routePolicyId && policies.some((policy) => policy.id === routePolicyId)
              ? routePolicyId
              : fallbackPolicyId;

          if (policyId) {
            this.selectPolicy(policyId, false);
          }
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No se pudieron cargar las politicas disponibles.')
          );
        },
      });
  }

  selectPolicy(policyId: string, syncQueryParam = true): void {
    this.selectedPolicyId.set(policyId);

    if (syncQueryParam) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { policyId },
        queryParamsHandling: 'merge',
      });
    }

    this.loadSimulations(policyId);
  }

  loadSimulations(policyId: string): void {
    this.loadingSimulations.set(true);
    this.error.set(null);

    this.simulationService
      .getPolicySimulations(policyId)
      .pipe(finalize(() => this.loadingSimulations.set(false)))
      .subscribe({
        next: (response) => {
          const simulations = Array.isArray(response)
            ? response
                .map((item) => normalizeSimulationRunResponse(item).result)
                .filter((item): item is SimulationResult => item !== null)
            : [];

          simulations.sort((left, right) => {
            const leftDate = new Date(left.createdAt ?? 0).getTime();
            const rightDate = new Date(right.createdAt ?? 0).getTime();
            return rightDate - leftDate;
          });

          this.simulations.set(simulations);
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(
              error,
              'No se pudo recuperar el historial de simulaciones de esta politica.'
            )
          );
          this.simulations.set([]);
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

  simulationStatusVariant(status: string | null | undefined) {
    if (status === 'FAILED' || status === 'ERROR') {
      return 'danger' as const;
    }

    if (status === 'PENDING' || status === 'RUNNING') {
      return 'warning' as const;
    }

    return 'success' as const;
  }

  simulationStatusLabel(status: string | null | undefined): string {
    if (!status) {
      return 'Completada';
    }

    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      RUNNING: 'En curso',
      COMPLETED: 'Completada',
      FAILED: 'Fallida',
      ERROR: 'Con errores',
    };

    return labels[status] ?? status;
  }
}
