import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { ToastService } from '../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { PoliticaNegocio } from '../../../administrador/models/politica.model';
import { PoliticaService } from '../../../administrador/services/politica.service';
import {
  SimulationResult,
  SimulationRunRequest,
  normalizeSimulationRunResponse,
} from '../../models/simulacion.model';
import { SimulacionService } from '../../services/simulacion.service';

@Component({
  selector: 'app-politica-simulacion-formulario-page',
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
    AppButtonComponent,
    AppCardComponent,
  ],
  templateUrl: './politica-simulacion-formulario.html',
  styleUrl: './politica-simulacion-formulario.css',
})
export class PoliticaSimulacionFormularioPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly politicaService = inject(PoliticaService);
  private readonly simulationService = inject(SimulacionService);
  private readonly toast = inject(ToastService);

  readonly policy = signal<PoliticaNegocio | null>(null);
  readonly policies = signal<PoliticaNegocio[]>([]);
  readonly recentSimulations = signal<SimulationResult[]>([]);
  readonly loadingPolicies = signal(false);
  readonly loadingPolicy = signal(false);
  readonly loadingHistory = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly policyId = signal('');

  readonly form = {
    instances: 250,
    scenarioName: '',
    baseNodeDurationHours: 8,
    variabilityPercent: 15,
    includeAiAnalysis: true,
    randomSeed: null as number | null,
  };

  ngOnInit(): void {
    const policyId = this.route.snapshot.paramMap.get('policyId') ?? '';
    this.policyId.set(policyId);

    this.form.scenarioName = `Escenario ${new Date().toLocaleDateString('es-BO')}`;
    this.loadPolicies(policyId);
  }

  loadPolicies(initialPolicyId?: string): void {
    this.loadingPolicies.set(true);
    this.error.set(null);

    this.politicaService
      .getAll()
      .pipe(finalize(() => this.loadingPolicies.set(false)))
      .subscribe({
        next: (policies) => {
          this.policies.set(policies);

          const selectedPolicyId =
            initialPolicyId && policies.some((policy) => policy.id === initialPolicyId)
              ? initialPolicyId
              : policies[0]?.id ?? '';

          if (!selectedPolicyId) {
            this.policy.set(null);
            this.recentSimulations.set([]);
            this.error.set('No hay politicas disponibles para simular.');
            return;
          }

          this.onPolicyChange(selectedPolicyId, false);
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No se pudieron cargar las politicas disponibles.')
          );
        },
      });
  }

  loadPolicy(policyId: string): void {
    this.loadingPolicy.set(true);
    this.error.set(null);

    this.politicaService
      .getById(policyId)
      .pipe(finalize(() => this.loadingPolicy.set(false)))
      .subscribe({
        next: (policy) => {
          this.policy.set(policy);
          if (!this.form.scenarioName.trim()) {
            this.form.scenarioName = `Simulacion ${policy.nombre}`;
          }
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No se pudo cargar la politica a simular.')
          );
        },
      });
  }

  onPolicyChange(policyId: string, syncUrl = true): void {
    this.policyId.set(policyId);
    this.loadPolicy(policyId);
    this.loadRecentSimulations(policyId);

    if (syncUrl) {
      void this.router.navigate(['/admin/policies', policyId, 'simulate']);
    }
  }

  loadRecentSimulations(policyId: string): void {
    this.loadingHistory.set(true);

    this.simulationService
      .getPolicySimulations(policyId)
      .pipe(finalize(() => this.loadingHistory.set(false)))
      .subscribe({
        next: (response) => {
          const simulations = Array.isArray(response)
            ? response
                .map((item) => normalizeSimulationRunResponse(item).result)
                .filter((item): item is SimulationResult => item !== null)
            : [];
          this.recentSimulations.set(simulations.slice(0, 5));
        },
        error: () => {
          this.recentSimulations.set([]);
        },
      });
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.toast.error(
        'Validacion',
        'Completa el escenario y usa valores numericos mayores que cero.'
      );
      return;
    }

    const request: SimulationRunRequest = {
      instances: Number(this.form.instances),
      scenarioName: this.form.scenarioName.trim(),
      baseNodeDurationHours: Number(this.form.baseNodeDurationHours),
      variabilityPercent: Number(this.form.variabilityPercent),
      includeAiAnalysis: this.form.includeAiAnalysis,
      randomSeed:
        this.form.randomSeed === null || this.form.randomSeed === undefined
          ? null
          : Number(this.form.randomSeed),
    };

    this.submitting.set(true);
    this.simulationService
      .runPolicySimulation(this.policyId(), request)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          const normalized = normalizeSimulationRunResponse(response);
          const simulationId = normalized.simulationId ?? normalized.result?.id ?? null;

          this.toast.success(
            'Simulacion enviada',
            normalized.message ?? 'La simulacion se ejecuto correctamente.'
          );

          if (simulationId) {
            void this.router.navigate(['/admin/simulations', simulationId]);
            return;
          }

          this.loadRecentSimulations(this.policyId());
        },
        error: (error: unknown) => {
          this.toast.error(
            'Error',
            getApiErrorMessage(error, 'No se pudo ejecutar la simulacion.')
          );
        },
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

  canSubmit(): boolean {
    return (
      !!this.policyId() &&
      this.form.instances > 0 &&
      this.form.scenarioName.trim().length > 0 &&
      this.form.baseNodeDurationHours > 0 &&
      this.form.variabilityPercent >= 0
    );
  }
}
