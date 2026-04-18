import { Component, input, output } from '@angular/core';
import { AppButtonComponent } from '../../ui/button/button';

@Component({
  selector: 'app-empty-state',
  imports: [AppButtonComponent],
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
