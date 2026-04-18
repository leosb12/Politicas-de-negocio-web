import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  booleanAttribute,
} from '@angular/core';

type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'ghost'
  | 'outline';
type AppButtonSize = 'sm' | 'md' | 'lg';
type AppButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [attr.type]="type()"
      [disabled]="isDisabled()"
      [class]="buttonClasses()"
    >
      @if (pending()) {
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        ></span>
      }

      @if (pending() && pendingLabel()) {
        <span>{{ pendingLabel() }}</span>
      } @else {
        <ng-content />
      }
    </button>
  `,
})
export class AppButtonComponent {
  readonly variant = input<AppButtonVariant>('primary');
  readonly size = input<AppButtonSize>('md');
  readonly type = input<AppButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly pending = input(false, { transform: booleanAttribute });
  readonly fullWidth = input(false, { transform: booleanAttribute });
  readonly pendingLabel = input('');
  readonly className = input('');

  readonly isDisabled = computed(() => this.disabled() || this.pending());

  readonly buttonClasses = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-200';

    const variantClasses: Record<AppButtonVariant, string> = {
      primary:
        'bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-hover)]',
      secondary:
        'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      warning: 'bg-amber-500 text-white hover:bg-amber-600',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700',
      info: 'bg-sky-600 text-white hover:bg-sky-700',
      ghost: 'text-slate-700 hover:bg-slate-100',
      outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
    };

    const sizeClasses: Record<AppButtonSize, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };

    const widthClass = this.fullWidth() ? 'w-full' : '';

    return [
      base,
      variantClasses[this.variant()],
      sizeClasses[this.size()],
      widthClass,
      this.className(),
    ]
      .filter(Boolean)
      .join(' ');
  });
}
