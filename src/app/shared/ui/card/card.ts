import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type AppCardTone = 'default' | 'muted' | 'outline' | 'info' | 'danger';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="cardClasses()">
      <ng-content />
    </section>
  `,
})
export class AppCardComponent {
  readonly tone = input<AppCardTone>('default');
  readonly className = input('');

  readonly cardClasses = computed(() => {
    const toneClasses: Record<AppCardTone, string> = {
      default: 'border border-slate-200 bg-white shadow-sm',
      muted: 'border border-slate-200 bg-slate-50',
      outline: 'border border-slate-300 bg-white',
      info: 'border border-sky-200 bg-sky-50',
      danger: 'border border-red-200 bg-red-50',
    };

    return ['rounded-2xl', toneClasses[this.tone()], this.className()]
      .filter(Boolean)
      .join(' ');
  });
}
