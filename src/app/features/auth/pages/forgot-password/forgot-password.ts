import { Component, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TimeoutError } from 'rxjs';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPasswordComponent {
  private readonly formBuilder = new FormBuilder();

  readonly emailForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly exito = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  solicitarRecuperacion(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.cargando.set(true);
    const formValue = this.emailForm.getRawValue();

    this.authService.solicitarRecuperacionContrasena(formValue.email).subscribe({
      next: () => {
        this.cargando.set(false);
        this.exito.set(true);
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        if (error instanceof TimeoutError) {
          this.error.set(
            'El servidor tarda demasiado en responder. Intenta nuevamente.'
          );
          return;
        }

        this.error.set(
          getApiErrorMessage(
            error,
            'No pudimos procesar tu solicitud. Intenta nuevamente.'
          )
        );
      }
    });
  }

  volver(): void {
    this.router.navigate(['/login']);
  }
}
