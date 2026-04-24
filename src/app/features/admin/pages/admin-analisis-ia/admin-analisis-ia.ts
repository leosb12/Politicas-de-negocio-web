import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import {
  BottlenecksResponse,
  TaskRedistributionResponse,
} from '../../models/admin-analytics.model';
import { AdminAnalyticsService } from '../../services/admin-analytics.service';

type InsightState = 'data' | 'empty' | 'unavailable' | 'missing';
type InsightPriority = 'LOW' | 'MEDIUM' | 'HIGH';
type UiTaskRecommendationItem = {
  fromOfficial: string;
  toOfficial: string;
  reason: string;
  expectedImpact: string;
  priority: InsightPriority;
};

@Component({
  selector: 'app-admin-analisis-ia-page',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    LoaderComponent,
    EmptyStateComponent,
    AppButtonComponent,
  ],
  templateUrl: './admin-analisis-ia.html',
  styleUrl: './admin-analisis-ia.css',
})
export class AdminAnalisisIaPageComponent implements OnInit {
  private readonly analyticsService = inject(AdminAnalyticsService);

  readonly loading = signal(false);
  readonly bottleneckRequestFailed = signal(false);
  readonly recommendationRequestFailed = signal(false);
  readonly bottlenecks = signal<BottlenecksResponse | null>(null);
  readonly taskRecommendations = signal<TaskRedistributionResponse | null>(null);

  readonly bottleneckState = computed(() =>
    this.getResponseState(this.bottlenecks(), 'bottlenecks')
  );
  readonly recommendationState = computed(() =>
    this.getResponseState(this.taskRecommendations(), 'recommendations')
  );

  readonly hasAnyResponse = computed(
    () => this.bottlenecks() !== null || this.taskRecommendations() !== null
  );
  readonly showHardError = computed(
    () =>
      !this.loading() &&
      !this.hasAnyResponse() &&
      this.bottleneckRequestFailed() &&
      this.recommendationRequestFailed()
  );
  readonly showPartialWarning = computed(
    () =>
      !this.showHardError() &&
      (this.bottleneckRequestFailed() || this.recommendationRequestFailed())
  );

  readonly bottleneckItems = computed(() => {
    const response = this.bottlenecks();
    if (!response?.available) {
      return [];
    }

    return [...response.bottlenecks].sort(
      (left, right) => this.priorityWeight(left.severity) - this.priorityWeight(right.severity)
    );
  });

  readonly recommendationItems = computed(() => {
    const response = this.taskRecommendations();
    if (!response?.available) {
      return [];
    }

    return response.recommendations
      .map((item) => this.normalizeRecommendation(item))
      .sort((left, right) => this.priorityWeight(left.priority) - this.priorityWeight(right.priority));
  });

  readonly highRiskCount = computed(() => this.countBottlenecksBySeverity('HIGH'));
  readonly mediumRiskCount = computed(() => this.countBottlenecksBySeverity('MEDIUM'));
  readonly lowRiskCount = computed(() => this.countBottlenecksBySeverity('LOW'));
  readonly highPriorityMoves = computed(() => this.countRecommendationsByPriority('HIGH'));
  readonly totalRecommendations = computed(() => this.recommendationItems().length);
  readonly activeSourceCount = computed(() => {
    let total = 0;

    if (this.sourceHasUsableData(this.bottleneckState())) {
      total += 1;
    }

    if (this.sourceHasUsableData(this.recommendationState())) {
      total += 1;
    }

    return total;
  });

  readonly focusHeadline = computed(() => {
    const criticalBottleneck = this.bottleneckItems().find(
      (item) => item.severity === 'HIGH'
    );

    if (criticalBottleneck) {
      return `Foco inmediato en ${criticalBottleneck.name}`;
    }

    const urgentRecommendation = this.recommendationItems().find(
      (item) => item.priority === 'HIGH'
    );

    if (urgentRecommendation) {
      return `Redistribucion urgente de ${urgentRecommendation.fromOfficial} hacia ${urgentRecommendation.toOfficial}`;
    }

    if (this.bottleneckItems().length > 0 || this.recommendationItems().length > 0) {
      return 'La IA detecto oportunidades concretas para estabilizar el flujo';
    }

    return 'Operacion estable sin alertas prioritarias en este momento';
  });

  readonly headlineCards = computed(() => [
    {
      label: 'Riesgo alto',
      value: this.formatCount(this.highRiskCount()),
      note:
        this.highRiskCount() > 0
          ? 'Cuellos que merecen intervencion inmediata.'
          : 'Sin bloqueos criticos detectados.',
      icon: 'alert-triangle',
      toneClass: 'ia-hero-stat--high',
    },
    {
      label: 'Riesgo medio',
      value: this.formatCount(this.mediumRiskCount()),
      note:
        this.mediumRiskCount() > 0
          ? 'Hallazgos que conviene corregir hoy.'
          : 'No hay fricciones medias activas.',
      icon: 'activity',
      toneClass: 'ia-hero-stat--medium',
    },
    {
      label: 'Redistribuciones',
      value: this.formatCount(this.totalRecommendations()),
      note:
        this.highPriorityMoves() > 0
          ? `${this.formatCount(this.highPriorityMoves())} movimientos con prioridad alta.`
          : 'Sin movimientos urgentes sugeridos.',
      icon: 'arrow-left-right',
      toneClass: 'ia-hero-stat--sky',
    },
    {
      label: 'Cobertura IA',
      value: `${this.activeSourceCount()}/2`,
      note: this.coverageCaption(),
      icon: 'sparkles',
      toneClass: 'ia-hero-stat--emerald',
    },
  ]);

  readonly summaryPanels = computed(() => [
    {
      title: 'Lectura de cuellos de botella',
      copy:
        this.bottlenecks()?.summary ??
        'Todavia no existe una lectura utilizable de cuellos de botella para esta vista.',
      eyebrow:
        this.bottleneckState() === 'data'
          ? `${this.formatCount(this.bottleneckItems().length)} hallazgos detectados`
          : this.stateCaption(this.bottleneckState()),
      toneClass: 'ia-brief-card--high',
      chipClass: 'ia-chip ia-chip--rose',
      chipLabel: 'Friccion',
    },
    {
      title: 'Lectura de redistribucion sugerida',
      copy:
        this.taskRecommendations()?.summary ??
        'Todavia no existe una lectura utilizable de redistribucion sugerida para esta vista.',
      eyebrow:
        this.recommendationState() === 'data'
          ? `${this.formatCount(this.totalRecommendations())} propuestas de balance`
          : this.stateCaption(this.recommendationState()),
      toneClass: 'ia-brief-card--sky',
      chipClass: 'ia-chip ia-chip--sky',
      chipLabel: 'Balance',
    },
  ]);

  readonly riskDistribution = computed(() => {
    const total = this.bottleneckItems().length;

    return [
      {
        label: 'Alta',
        count: this.highRiskCount(),
        width: this.toPercent(this.highRiskCount(), total),
        barClass: 'ia-risk-bar__segment--high',
        dotClass: 'ia-risk-legend__dot--high',
      },
      {
        label: 'Media',
        count: this.mediumRiskCount(),
        width: this.toPercent(this.mediumRiskCount(), total),
        barClass: 'ia-risk-bar__segment--medium',
        dotClass: 'ia-risk-legend__dot--medium',
      },
      {
        label: 'Baja',
        count: this.lowRiskCount(),
        width: this.toPercent(this.lowRiskCount(), total),
        barClass: 'ia-risk-bar__segment--low',
        dotClass: 'ia-risk-legend__dot--low',
      },
    ].filter((segment) => segment.count > 0);
  });

  readonly sourcePills = computed(() => [
    {
      label: 'Cuellos',
      value: this.bottlenecks()?.source ?? 'Fuente no disponible',
      chipClass: 'ia-source-pill ia-source-pill--rose',
      state: this.bottleneckState(),
    },
    {
      label: 'Redistribucion',
      value: this.taskRecommendations()?.source ?? 'Fuente no disponible',
      chipClass: 'ia-source-pill ia-source-pill--sky',
      state: this.recommendationState(),
    },
  ]);

  ngOnInit(): void {
    this.loadInsights();
  }

  loadInsights(): void {
    this.loading.set(true);
    this.bottleneckRequestFailed.set(false);
    this.recommendationRequestFailed.set(false);

    forkJoin({
      bottlenecks: this.analyticsService.getBottlenecks().pipe(
        catchError(() => {
          this.bottleneckRequestFailed.set(true);
          return of(null);
        })
      ),
      recommendations: this.analyticsService.getTaskRecommendations().pipe(
        catchError(() => {
          this.recommendationRequestFailed.set(true);
          return of(null);
        })
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ bottlenecks, recommendations }) => {
        this.bottlenecks.set(bottlenecks);
        this.taskRecommendations.set(recommendations);
      });
  }

  priorityLabel(priority: InsightPriority): string {
    const labels = {
      HIGH: 'Alta',
      MEDIUM: 'Media',
      LOW: 'Baja',
    };

    return labels[priority];
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

  priorityBadgeClass(priority: InsightPriority): string {
    const classes = {
      HIGH: 'ia-badge ia-badge--high',
      MEDIUM: 'ia-badge ia-badge--medium',
      LOW: 'ia-badge ia-badge--low',
    };

    return classes[priority];
  }

  findingCardClass(priority: InsightPriority): string {
    const classes = {
      HIGH: 'ia-finding-card ia-finding-card--high',
      MEDIUM: 'ia-finding-card ia-finding-card--medium',
      LOW: 'ia-finding-card ia-finding-card--low',
    };

    return classes[priority];
  }

  movementCardClass(priority: InsightPriority): string {
    const classes = {
      HIGH: 'ia-move-card ia-move-card--high',
      MEDIUM: 'ia-move-card ia-move-card--medium',
      LOW: 'ia-move-card ia-move-card--low',
    };

    return classes[priority];
  }

  hasVisibleRiskDistribution(): boolean {
    return this.riskDistribution().length > 0;
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
      return (response as BottlenecksResponse).bottlenecks.length > 0 ? 'data' : 'empty';
    }

    return (response as TaskRedistributionResponse).recommendations.length > 0
      ? 'data'
      : 'empty';
  }

  sourceHasUsableData(state: InsightState): boolean {
    return state === 'data' || state === 'empty';
  }

  stateCaption(state: InsightState): string {
    const labels = {
      data: 'Datos listos',
      empty: 'Sin hallazgos por ahora',
      unavailable: 'Backend sin analisis disponible',
      missing: 'Sin respuesta del servicio',
    };

    return labels[state];
  }

  private coverageCaption(): string {
    if (this.activeSourceCount() === 2) {
      return 'Las dos fuentes IA estan activas.';
    }

    if (this.activeSourceCount() === 1) {
      return 'Solo una fuente IA devolvio datos usables.';
    }

    return 'No hay fuentes IA utilizables en esta carga.';
  }

  private countBottlenecksBySeverity(priority: InsightPriority): number {
    return this.bottleneckItems().filter((item) => item.severity === priority).length;
  }

  private countRecommendationsByPriority(priority: InsightPriority): number {
    return this.recommendationItems().filter((item) => item.priority === priority).length;
  }

  private normalizeRecommendation(item: TaskRedistributionResponse['recommendations'][number]): UiTaskRecommendationItem {
    const record = item as unknown as Record<string, unknown>;

    const fromOfficial =
      this.pickText(record, [
        'fromOfficial',
        'fromOfficialName',
        'sourceOfficial',
        'sourceOfficialName',
        'officialFrom',
        'fromUser',
        'funcionarioOrigen',
        'origen',
      ]) ?? 'Origen no especificado';

    const toOfficial =
      this.pickText(record, [
        'toOfficial',
        'toOfficialName',
        'targetOfficial',
        'targetOfficialName',
        'officialTo',
        'toUser',
        'funcionarioDestino',
        'destino',
      ]) ?? 'Destino no especificado';

    const reason =
      this.pickText(record, [
        'reason',
        'motivo',
        'justification',
        'justificacion',
        'explanation',
        'detalle',
      ]) ?? 'El servicio IA no detallo el motivo de este movimiento.';

    const expectedImpact =
      this.pickText(record, [
        'expectedImpact',
        'impact',
        'impactoEsperado',
        'impacto',
        'benefit',
        'resultadoEsperado',
      ]) ?? 'El servicio IA no detallo el impacto esperado para este movimiento.';

    return {
      fromOfficial,
      toOfficial,
      reason,
      expectedImpact,
      priority: this.pickPriority(record),
    };
  }

  private priorityWeight(priority: InsightPriority): number {
    const weights = {
      HIGH: 0,
      MEDIUM: 1,
      LOW: 2,
    };

    return weights[priority];
  }

  private toPercent(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }

  private formatCount(value: number): string {
    return value.toLocaleString('es-BO');
  }

  private pickPriority(record: Record<string, unknown>): InsightPriority {
    const value = this.pickText(record, ['priority', 'severity', 'prioridad'])?.toUpperCase();

    if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
      return value;
    }

    if (value === 'ALTA') {
      return 'HIGH';
    }

    if (value === 'MEDIA') {
      return 'MEDIUM';
    }

    if (value === 'BAJA') {
      return 'LOW';
    }

    return 'LOW';
  }

  private pickText(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      const normalized = this.normalizeUnknownText(value);

      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private normalizeUnknownText(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const nestedKeys = ['name', 'nombre', 'fullName', 'displayName', 'label'];

      for (const nestedKey of nestedKeys) {
        const nestedValue = record[nestedKey];
        if (typeof nestedValue === 'string') {
          const trimmed = nestedValue.trim();
          if (trimmed.length > 0) {
            return trimmed;
          }
        }
      }
    }

    return null;
  }
}
