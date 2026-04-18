import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type AppBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClasses()">
      <ng-content />
    </span>
  `,
})
export class AppBadgeComponent {
  readonly variant = input<AppBadgeVariant>('neutral');
  readonly className = input('');

  readonly badgeClasses = computed(() => {
    const variantClasses: Record<AppBadgeVariant, string> = {
      neutral: 'bg-slate-200 text-slate-700',
      success: 'bg-emerald-100 text-emerald-700',
      warning: 'bg-amber-100 text-amber-700',
      danger: 'bg-red-100 text-red-700',
      info: 'bg-sky-100 text-sky-700',
    };

    return [
      'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
      variantClasses[this.variant()],
      this.className(),
    ]
      .filter(Boolean)
      .join(' ');
  });
}
