import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
  booleanAttribute,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type AppInputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'number'
  | 'date'
  | 'url'
  | 'tel';

@Component({
  selector: 'app-input',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppInputComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="wrapperClasses()">
      @if (label()) {
        <label [for]="resolvedId()" [class]="labelClasses()">{{ label() }}</label>
      }

      <input
        [id]="resolvedId()"
        [attr.name]="name()"
        [attr.autocomplete]="autocomplete()"
        [type]="type()"
        [placeholder]="placeholder()"
        [required]="required()"
        [readonly]="readonly()"
        [disabled]="isDisabled()"
        [value]="value"
        [attr.aria-invalid]="error() ? true : null"
        [class]="controlClasses()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />

      @if (hint() && !error()) {
        <p class="mt-1 text-xs text-slate-500">{{ hint() }}</p>
      }

      @if (error()) {
        <p class="mt-1 text-xs text-red-600">{{ error() }}</p>
      }
    </div>
  `,
})
export class AppInputComponent implements ControlValueAccessor {
  private static nextId = 0;

  readonly id = input<string | null>(null);
  readonly label = input<string | null>(null);
  readonly name = input<string | null>(null);
  readonly type = input<AppInputType>('text');
  readonly placeholder = input('');
  readonly autocomplete = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly wrapperClass = input('');
  readonly labelClass = input('');
  readonly controlClass = input('');

  private readonly generatedId = `app-input-${AppInputComponent.nextId++}`;
  private readonly cvaDisabled = signal(false);

  value = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly resolvedId = computed(() => this.id() ?? this.generatedId);

  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  readonly wrapperClasses = computed(() => ['w-full', this.wrapperClass()].filter(Boolean).join(' '));

  readonly labelClasses = computed(() =>
    ['mb-1 block text-sm font-medium text-slate-700', this.labelClass()]
      .filter(Boolean)
      .join(' ')
  );

  readonly controlClasses = computed(() => {
    const colorClass = this.error()
      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200';

    return [
      'w-full rounded-xl border px-4 py-2.5 outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500',
      colorClass,
      this.controlClass(),
    ]
      .filter(Boolean)
      .join(' ');
  });

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
