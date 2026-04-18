import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  booleanAttribute,
} from '@angular/core';

type AppAlertVariant = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="alertClasses()">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          @if (title()) {
            <h4 class="text-sm font-semibold">{{ title() }}</h4>
          }

          @if (message()) {
            <p class="text-sm">{{ message() }}</p>
          }

          <ng-content />
        </div>

        @if (dismissible()) {
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/5"
            (click)="dismissed.emit()"
          >
            Cerrar
          </button>
        }
      </div>
    </div>
  `,
})
export class AppAlertComponent {
  readonly variant = input<AppAlertVariant>('info');
  readonly title = input<string | null>(null);
  readonly message = input<string | null>(null);
  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly className = input('');

  readonly dismissed = output<void>();

  readonly alertClasses = computed(() => {
    const variantClasses: Record<AppAlertVariant, string> = {
      info: 'border-sky-200 bg-sky-50 text-sky-800',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      warning: 'border-amber-200 bg-amber-50 text-amber-800',
      danger: 'border-red-200 bg-red-50 text-red-700',
    };

    return [
      'rounded-xl border px-4 py-3',
      variantClasses[this.variant()],
      this.className(),
    ]
      .filter(Boolean)
      .join(' ');
  });
}
