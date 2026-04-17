import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-ui-toast',
  imports: [CommonModule],
  templateUrl: './ui-toast.html',
  styleUrl: './ui-toast.css',
})
export class UiToastComponent {
  readonly toastService = inject(ToastService);
}
