import { Component, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TimeoutError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { getApiErrorMessage } from '../../core/utils/api-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly formBuilder = new FormBuilder();

  readonly loginForm = this.formBuilder.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly cargando = signal(false);
  readonly error = signal('');

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  iniciarSesion(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.cargando.set(true);
    const formValue = this.loginForm.getRawValue();

    this.authService.loginWeb(formValue.correo, formValue.password).subscribe({
      next: (usuario) => {
        this.cargando.set(false);

        if (usuario.rol === 'ADMIN') {
          this.router.navigate(['/dashboard-admin']);
        } else if (usuario.rol === 'FUNCIONARIO') {
          this.router.navigate(['/dashboard-funcionario']);
        } else {
          this.error.set('Acceso denegado: tu rol no tiene acceso web administrativo.');
        }
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.error.set('Credenciales incorrectas.');
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
            'No se pudo iniciar sesion. Intenta nuevamente.'
          )
        );
      }
    });
  }
}