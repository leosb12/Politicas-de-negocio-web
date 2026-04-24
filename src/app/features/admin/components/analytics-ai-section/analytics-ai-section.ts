import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import {
  BottlenecksResponse,
  TaskRedistributionResponse,
} from '../../models/admin-analytics.model';

type InsightState = 'data' | 'empty' | 'unavailable' | 'missing';

@Component({
  selector: 'app-admin-analytics-ai-section',
  imports: [CommonModule, AppCardComponent, EmptyStateComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics-ai-section.html',
  styleUrl: './analytics-ai-section.css',
})
export class AdminAnalyticsAiSectionComponent {
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
