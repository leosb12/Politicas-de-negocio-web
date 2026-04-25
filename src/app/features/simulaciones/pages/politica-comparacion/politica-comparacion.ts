import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { ToastService } from '../../../../shared/services/toast.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { PoliticaNegocio } from '../../../administrador/models/politica.model';
import { PoliticaService } from '../../../administrador/services/politica.service';
import {
  PolicyComparisonResponse,
  normalizeComparisonResponse,
} from '../../models/simulacion.model';
import { SimulacionService } from '../../services/simulacion.service';

@Component({
  selector: 'app-politica-comparacion-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    LoaderComponent,
    AppAlertComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppCardComponent,
  ],
  templateUrl: './politica-comparacion.html',
  styleUrl: './politica-comparacion.css',
})
export class PoliticaComparacionPageComponent implements OnInit {
  private readonly politicaService = inject(PoliticaService);
  private readonly simulationService = inject(SimulacionService);
  private readonly toast = inject(ToastService);

  readonly policies = signal<PoliticaNegocio[]>([]);
  readonly loadingPolicies = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly comparison = signal<PolicyComparisonResponse | null>(null);

  readonly form = {
    policyAId: '',
    policyBId: '',
    instances: 250,
    scenarioName: 'Comparacion base',
    baseNodeDurationHours: 8,
    variabilityPercent: 15,
    includeAiAnalysis: true,
    randomSeed: null as number | null,
  };

  readonly winnerLabel = computed(() => {
    const comparison = this.comparison();
    if (!comparison) {
      return null;
    }

    return (
      comparison.moreEfficientPolicyName ??
      comparison.policyAResult.policyName ??
      comparison.policyBResult.policyName
    );
  });

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
          this.form.policyAId = policies[0]?.id ?? '';
          this.form.policyBId = policies[1]?.id ?? policies[0]?.id ?? '';
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No se pudieron cargar las politicas para comparar.')
          );
        },
      });
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.toast.error(
        'Validacion',
        'Selecciona dos politicas distintas y completa la configuracion base.'
      );
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.simulationService
      .comparePolicies({
        firstPolicyId: this.form.policyAId,
        secondPolicyId: this.form.policyBId,
        instances: Number(this.form.instances),
        scenarioName: this.form.scenarioName.trim(),
        baseNodeDurationHours: Number(this.form.baseNodeDurationHours),
        variabilityPercent: Number(this.form.variabilityPercent),
        includeAiAnalysis: this.form.includeAiAnalysis,
        randomSeed:
          this.form.randomSeed === null || this.form.randomSeed === undefined
            ? null
            : Number(this.form.randomSeed),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.comparison.set(normalizeComparisonResponse(response));
        },
        error: (error: unknown) => {
          this.comparison.set(null);
          this.error.set(
            getApiErrorMessage(error, 'No se pudo ejecutar la comparacion de politicas.')
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
      !!this.form.policyAId &&
      !!this.form.policyBId &&
      this.form.policyAId !== this.form.policyBId &&
      this.form.instances > 0 &&
      this.form.scenarioName.trim().length > 0 &&
      this.form.baseNodeDurationHours > 0
    );
  }

  getPolicyName(policyId: string): string | null {
    return this.policies().find((policy) => policy.id === policyId)?.nombre ?? null;
  }
}
