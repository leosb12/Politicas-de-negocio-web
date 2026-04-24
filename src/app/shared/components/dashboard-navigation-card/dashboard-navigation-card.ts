import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

type DashboardNavigationCardTone =
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'teal'
  | 'orange';

@Component({
  selector: 'app-dashboard-navigation-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-navigation-card.html',
  styleUrl: './dashboard-navigation-card.css',
})
export class DashboardNavigationCardComponent {
  readonly chip = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly footerLabel = input.required<string>();
  readonly routerLink = input.required<string | readonly string[]>();
  readonly tone = input<DashboardNavigationCardTone>('sky');
  readonly className = input('');

  readonly cardClasses = computed(() => {
    return [
      'dashboard-navigation-card group',
      `dashboard-navigation-card--${this.tone()}`,
      this.className(),
    ]
      .filter(Boolean)
      .join(' ');
  });
}
