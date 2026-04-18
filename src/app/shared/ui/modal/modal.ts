import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  booleanAttribute,
} from '@angular/core';

type AppModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      (click)="onBackdropClick($event)"
    >
      <section [class]="panelClasses()" (click)="$event.stopPropagation()">
        <ng-content />
      </section>
    </div>
  `,
})
export class AppModalComponent {
  readonly size = input<AppModalSize>('md');
  readonly closeOnBackdrop = input(true, { transform: booleanAttribute });
  readonly panelClass = input('');

  readonly closed = output<void>();

  readonly panelClasses = computed(() => {
    const sizeClasses: Record<AppModalSize, string> = {
      sm: 'max-w-md',
      md: 'max-w-xl',
      lg: 'max-w-2xl',
      xl: 'max-w-3xl',
      '2xl': 'max-w-4xl',
      '3xl': 'max-w-5xl',
    };

    return [
      'w-full rounded-2xl border border-slate-200 bg-white shadow-xl',
      sizeClasses[this.size()],
      this.panelClass(),
    ]
      .filter(Boolean)
      .join(' ');
  });

  onBackdropClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop()) {
      return;
    }

    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
