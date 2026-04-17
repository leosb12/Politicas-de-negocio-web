import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyStateComponent {
  readonly title = input('Sin resultados');
  readonly message = input('No hay informacion para mostrar.');
  readonly actionLabel = input<string | null>(null);

  readonly action = output<void>();

  onAction(): void {
    this.action.emit();
  }
}
