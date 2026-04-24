import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

type AnalyticsKpiTone =
  | 'slate'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'violet';

@Component({
  selector: 'app-analytics-kpi-card',
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics-kpi-card.html',
  styleUrl: './analytics-kpi-card.css',
})
export class AnalyticsKpiCardComponent {
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly icon = input<string>('circle-dot');
  readonly tone = input<AnalyticsKpiTone>('slate');
  readonly chip = input<string | null>(null);
  readonly progress = input<number | null>(null);

  readonly toneClasses = computed(() => {
    const classes: Record<AnalyticsKpiTone, string> = {
      slate: 'analytics-kpi-card--slate',
      emerald: 'analytics-kpi-card--emerald',
      sky: 'analytics-kpi-card--sky',
      amber: 'analytics-kpi-card--amber',
      rose: 'analytics-kpi-card--rose',
      violet: 'analytics-kpi-card--violet',
    };

    return classes[this.tone()];
  });
}
