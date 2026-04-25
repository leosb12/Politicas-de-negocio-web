import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppTableComponent } from '../../../../shared/ui/table/table';
import { AnaliticasIaSeccionComponent } from '../../components/analiticas-ia-seccion/analiticas-ia-seccion';
import { AnaliticasKpiTarjetaComponent } from '../../components/analiticas-kpi-tarjeta/analiticas-kpi-tarjeta';
import {
  AdministradorAnaliticasDashboardSummary,
  BottlenecksResponse,
  TaskRedistributionResponse,
} from '../../models/administrador-analiticas.model';
import { AdministradorAnaliticasService } from '../../services/administrador-analiticas.service';

@Component({
  selector: 'app-administrador-analiticas-page',
  imports: [
    CommonModule,
    LoaderComponent,
    EmptyStateComponent,
    LucideAngularModule,
    AppAlertComponent,
    AppButtonComponent,
    AppCardComponent,
    AppTableComponent,
    AnaliticasKpiTarjetaComponent,
    AnaliticasIaSeccionComponent,
  ],
  templateUrl: './administrador-analiticas.html',
  styleUrl: './administrador-analiticas.css',
})
export class AdministradorAnaliticasPageComponent implements OnInit {
  private readonly analyticsService = inject(AdministradorAnaliticasService);

  readonly summary = signal<AdministradorAnaliticasDashboardSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadingAI = signal(false);
  readonly aiError = signal(false);
  readonly bottlenecks = signal<BottlenecksResponse | null>(null);
  readonly taskRecommendations = signal<TaskRedistributionResponse | null>(null);

  readonly hasSummary = computed(() => this.summary() !== null);
  readonly general = computed(() => this.summary()?.general ?? null);
  readonly attentionTimes = computed(() => this.summary()?.attentionTimes ?? null);
  readonly taskAccumulation = computed(() => this.summary()?.taskAccumulation ?? null);
  readonly instanceDistribution = computed(() => {
    const general = this.general();
    if (!general || general.totalInstances <= 0) {
      return [];
    }

    return [
      {
        label: 'En curso',
        value: general.inProgressInstances,
        width: this.toPercent(general.inProgressInstances, general.totalInstances),
        tone: 'bg-amber-400',
      },
      {
        label: 'Completadas',
        value: general.completedInstances,
        width: this.toPercent(general.completedInstances, general.totalInstances),
        tone: 'bg-emerald-400',
      },
      {
        label: 'Rechazadas',
        value: general.rejectedInstances,
        width: this.toPercent(general.rejectedInstances, general.totalInstances),
        tone: 'bg-rose-400',
      },
    ];
  });
  readonly taskCompletionRate = computed(() => {
    const general = this.general();
    if (!general) {
      return 0;
    }

    const total = general.pendingTasks + general.completedTasks;
    if (total <= 0) {
      return 0;
    }

    return this.toPercent(general.completedTasks, total);
  });
  readonly maxPolicyAverage = computed(() =>
    this.maxValue(this.attentionTimes()?.averageByPolicy.map((item) => item.averageHours) ?? [])
  );
  readonly maxNodeAverage = computed(() =>
    this.maxValue(this.attentionTimes()?.averageByNode.map((item) => item.averageHours) ?? [])
  );
  readonly maxDepartmentAverage = computed(() =>
    this.maxValue(this.attentionTimes()?.averageByDepartment.map((item) => item.averageHours) ?? [])
  );
  readonly maxOfficialAverage = computed(() =>
    this.maxValue(this.attentionTimes()?.averageByOfficial.map((item) => item.averageHours) ?? [])
  );
  readonly maxPendingByOfficial = computed(() =>
    this.maxValue(this.taskAccumulation()?.pendingByOfficial.map((item) => item.pendingTasks) ?? [])
  );
  readonly maxPendingByDepartment = computed(() =>
    this.maxValue(this.taskAccumulation()?.pendingByDepartment.map((item) => item.pendingTasks) ?? [])
  );
  readonly maxPendingByPolicy = computed(() =>
    this.maxValue(this.taskAccumulation()?.pendingByPolicy.map((item) => item.pendingTasks) ?? [])
  );
  readonly maxPendingByNode = computed(() =>
    this.maxValue(this.taskAccumulation()?.pendingByNode.map((item) => item.pendingTasks) ?? [])
  );
  readonly operationalSignals = computed(() => {
    const general = this.general();
    const attention = this.attentionTimes();
    const accumulation = this.taskAccumulation();

    if (!general || !attention || !accumulation) {
      return [];
    }

    const signals: Array<{
      title: string;
      value: string;
      description: string;
      tone: 'emerald' | 'amber' | 'rose' | 'sky';
      icon: string;
    }> = [];

    if (attention.slowestActivity) {
      signals.push({
        title: 'Mayor friccion',
        value: attention.slowestActivity.nodeName,
        description: `${this.formatHours(attention.slowestActivity.averageHours)} promedio por ejecucion.`,
        tone: 'rose',
        icon: 'alert-triangle',
      });
    }

    if (attention.fastestActivity) {
      signals.push({
        title: 'Mejor ritmo',
        value: attention.fastestActivity.nodeName,
        description: `${this.formatHours(attention.fastestActivity.averageHours)} promedio por ejecucion.`,
        tone: 'emerald',
        icon: 'check-circle-2',
      });
    }

    const oldestPending = accumulation.oldestPendingTasks[0];
    if (oldestPending) {
      signals.push({
        title: 'Pendiente critico',
        value: oldestPending.policyName,
        description: `${this.formatHours(oldestPending.ageHours)} en ${oldestPending.nodeName}.`,
        tone: 'amber',
        icon: 'clipboard-list',
      });
    }

    signals.push({
      title: 'Capacidad actual',
      value: `${this.formatCount(general.pendingTasks)} pendientes`,
      description: `${this.taskCompletionRate()}% del volumen total ya fue completado.`,
      tone: 'sky',
      icon: 'arrow-up-down',
    });

    return signals.slice(0, 4);
  });

  ngOnInit(): void {
    this.loadDashboardSummary();
    this.loadAI();
  }

  loadDashboardSummary(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsService
      .getDashboardSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No fue posible cargar la analitica del sistema.')
          );
          this.summary.set(null);
        },
      });
  }

  loadAI(): void {
    this.loadingAI.set(true);
    this.aiError.set(false);

    forkJoin({
      bottlenecks: this.analyticsService.getBottlenecks(),
      recommendations: this.analyticsService.getTaskRecommendations(),
    })
      .pipe(finalize(() => this.loadingAI.set(false)))
      .subscribe({
        next: (response) => {
          this.bottlenecks.set(response.bottlenecks);
          this.taskRecommendations.set(response.recommendations);
        },
        error: () => {
          this.bottlenecks.set(null);
          this.taskRecommendations.set(null);
          this.aiError.set(true);
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

  formatCount(value: number | null | undefined): string {
    return (value ?? 0).toLocaleString('es-BO');
  }

  barWidth(value: number | null | undefined, max: number): number {
    if (!value || max <= 0) {
      return 0;
    }

    return Math.max(6, Math.round((value / max) * 100));
  }

  toneClass(tone: 'emerald' | 'amber' | 'rose' | 'sky'): string {
    const classes = {
      emerald: 'analytics-signal--emerald',
      amber: 'analytics-signal--amber',
      rose: 'analytics-signal--rose',
      sky: 'analytics-signal--sky',
    };

    return classes[tone];
  }

  private maxValue(values: number[]): number {
    return values.length > 0 ? Math.max(...values) : 0;
  }

  private toPercent(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }
}
