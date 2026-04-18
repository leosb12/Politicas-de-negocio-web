import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  booleanAttribute,
} from '@angular/core';

@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="containerClasses()">
      <table [class]="tableClasses()">
        <ng-content />
      </table>
    </div>
  `,
})
export class AppTableComponent {
  readonly compact = input(false, { transform: booleanAttribute });
  readonly striped = input(false, { transform: booleanAttribute });
  readonly containerClass = input('');
  readonly className = input('');

  readonly containerClasses = computed(() =>
    ['overflow-x-auto', this.containerClass()].filter(Boolean).join(' ')
  );

  readonly tableClasses = computed(() => {
    const densityClass = this.compact() ? 'text-xs' : 'text-sm';
    const stripedClass = this.striped()
      ? '[&_tbody_tr:nth-child(even)]:bg-slate-50'
      : '';

    return ['min-w-full', densityClass, stripedClass, this.className()]
      .filter(Boolean)
      .join(' ');
  });
}
