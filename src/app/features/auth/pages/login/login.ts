import { Component, signal, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TimeoutError } from 'rxjs';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { isAdminRole, isFuncionarioRole } from '../../../../core/auth/utils/role.util';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly formBuilder = new FormBuilder();
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly statusService = inject(OfflineStatusService);

  readonly loginForm = this.formBuilder.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly successMsg = signal('');
  readonly probandoConexion = signal(false);
  readonly showSyncModal = signal(false);
  private loggedUser: any = null;

  iniciarSesion(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.successMsg.set('');
    this.cargando.set(true);
    const formValue = this.loginForm.getRawValue();

    // Detección de conexión
    const isOnline = this.statusService.checkOnline();

    if (!isOnline) {
      // Intento de Login offline
      this.authService.loginOffline(formValue.correo).subscribe({
        next: (usuario) => {
          this.cargando.set(false);
          this.successMsg.set('Sesión iniciada en modo offline con datos sincronizados previamente.');
          setTimeout(() => {
            this.redirectByRol(usuario);
          }, 2000);
        },
        error: (err: any) => {
          this.cargando.set(false);
          this.error.set(err.message || 'Primero debes iniciar sesión con internet para activar el modo offline.');
        }
      });
      return;
    }

    // Login online normal
    this.authService.loginWeb(formValue.correo, formValue.password).subscribe({
      next: (usuario) => {
        this.cargando.set(false);
        this.redirectByRol(usuario);
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.error.set('Credenciales incorrectas.');
          return;
        }

        if (error instanceof HttpErrorResponse && error.status === 0) {
          console.warn('[Login] El servidor no responde o no hay conexión (status 0). Intentando login offline de respaldo...');
          this.intentarLoginOfflineDeRespaldo(formValue.correo);
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
            'No se pudo iniciar sesión. Intenta nuevamente o activa tu modo offline si ya has ingresado antes.'
          )
        );
      }
    });
  }

  recomprobarConectividad(): void {
    this.probandoConexion.set(true);
    this.statusService.verifyConnectionActive().then((online) => {
      this.probandoConexion.set(false);
      if (online) {
        this.error.set('');
        this.successMsg.set('Conexión con el servidor restablecida correctamente.');
        setTimeout(() => this.successMsg.set(''), 3000);
      } else {
        this.error.set('El servidor sigue sin responder. Modo offline activo.');
        setTimeout(() => this.error.set(''), 3000);
      }
    });
  }

  intentarLoginOfflineDeRespaldo(correo: string): void {
    this.cargando.set(true);
    this.authService.loginOffline(correo).subscribe({
      next: (usuario) => {
        this.cargando.set(false);
        this.successMsg.set('Servidor inaccesible. Iniciando sesión en modo offline con datos sincronizados previamente.');
        this.statusService.setOfflineForcefully();
        setTimeout(() => {
          this.redirectByRol(usuario);
        }, 2000);
      },
      error: (err: any) => {
        this.cargando.set(false);
        this.error.set('El servidor no responde y no se pudo iniciar sesión offline localmente: ' + (err.message || 'Sin perfil offline registrado.'));
      }
    });
  }

  private redirectByRol(usuario: any): void {
    if (isAdminRole(usuario.rol)) {
      this.router.navigate(['/dashboard-admin']);
    } else if (isFuncionarioRole(usuario.rol)) {
      this.router.navigate(['/dashboard-funcionario']);
    } else {
      this.error.set('Acceso denegado: tu rol no tiene acceso web administrativo.');
    }
  }
}
