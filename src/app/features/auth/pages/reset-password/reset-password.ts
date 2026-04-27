import { Component, signal, inject, effect } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { TimeoutError } from 'rxjs';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent {
  private readonly formBuilder = new FormBuilder();
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly resetForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  }, { validators: this.passwordMatchValidator });

  readonly token = signal<string>('');
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly exito = signal(false);
  readonly tokenInvalido = signal(false);

  constructor() {
    effect(() => {
      this.route.queryParams.subscribe(params => {
        const token = params['token'];
        if (!token) {
          this.tokenInvalido.set(true);
        } else {
          this.token.set(token);
        }
      });
    });
  }

  restablecerContrasena(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.cargando.set(true);
    const formValue = this.resetForm.getRawValue();

    this.authService.restablecerContrasena(this.token(), formValue.password).subscribe({
      next: () => {
        this.cargando.set(false);
        this.exito.set(true);
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        if (error instanceof HttpErrorResponse && error.status === 400) {
          const message = (error.error as any)?.message;
          if (message?.includes('expirado') || message?.includes('Expirado')) {
            this.error.set('El enlace ha expirado. Solicita uno nuevo.');
            this.tokenInvalido.set(true);
            return;
          }
          if (message?.includes('usado') || message?.includes('Usado')) {
            this.error.set('Este enlace ya fue utilizado.');
            this.tokenInvalido.set(true);
            return;
          }
          this.error.set('El enlace es inválido.');
          this.tokenInvalido.set(true);
          return;
        }

        if (error instanceof TimeoutError) {
          this.error.set(
            'El servidor tarda demasiado en responder. Intenta nuevamente.'
          );
          return;
        }

        this.error.set(
          getApiErrorMessage(
            error,
            'No pudimos restablecer tu contraseña. Intenta nuevamente.'
          )
        );
      }
    });
  }

  volver(): void {
    this.router.navigate(['/login']);
  }

  private passwordMatchValidator(group: any) {
    const password = group.get('password');
    const confirmPassword = group.get('confirmPassword');
    
    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }
}
