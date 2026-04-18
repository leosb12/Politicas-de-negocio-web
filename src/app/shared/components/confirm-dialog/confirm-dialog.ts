import { Component, input, output } from '@angular/core';
import { AppButtonComponent } from '../../ui/button/button';
import { AppModalComponent } from '../../ui/modal/modal';

@Component({
  selector: 'app-confirm-dialog',
  imports: [AppModalComponent, AppButtonComponent],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialogComponent {
  readonly title = input('Confirmar accion');
  readonly message = input('Estas seguro de continuar?');
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');
  readonly danger = input(false);
  readonly pending = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
