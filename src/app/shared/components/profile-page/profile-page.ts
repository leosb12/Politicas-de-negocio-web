import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Usuario } from '../../../core/auth/models/usuario.model';
import { AuthService } from '../../../core/auth/services/auth.service';
import { ToastService } from '../../services/toast.service';
import { AppAlertComponent } from '../../ui/alert/alert';
import { AppBadgeComponent } from '../../ui/badge/badge';
import { AppButtonComponent } from '../../ui/button/button';
import { AppCardComponent } from '../../ui/card/card';
import { AppInputComponent } from '../../ui/input/input';
import { ProfileSummaryItem } from './profile-page.model';

type ProfileTheme = 'admin' | 'funcionario';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppInputComponent,
    AppButtonComponent,
    AppAlertComponent,
    AppCardComponent,
    AppBadgeComponent,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly user = input<Usuario | null>(null);
  readonly theme = input<ProfileTheme>('admin');
  readonly badgeLabel = input('Perfil');
  readonly heroTitle = input('Tu perfil');
  readonly heroDescription = input('Revisa tu informacion y gestiona la seguridad de tu cuenta.');
  readonly securityTitle = input('Cambiar contraseña');
  readonly securityDescription = input(
    'Usa una contraseña nueva de al menos 6 caracteres y evita reutilizar la actual.'
  );
  readonly note = input('Mantener esta cuenta protegida ayuda a evitar accesos no autorizados.');
  readonly actionHint = input('El cambio se aplica inmediatamente.');
  readonly accountStatusLabel = input('Cuenta activa');
  readonly securityBadgeLabel = input('Proteccion');
  readonly summaryItems = input<ProfileSummaryItem[]>([]);

  readonly pageClasses = computed(() => `perfil-page perfil-page--${this.theme()}`);

  readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  private readonly loadingState = new FormControl(false, { nonNullable: true });
  private readonly errorState = new FormControl<string | null>(null);

  readonly currentPasswordControl = this.passwordForm.controls.currentPassword;
  readonly newPasswordControl = this.passwordForm.controls.newPassword;
  readonly confirmPasswordControl = this.passwordForm.controls.confirmPassword;

  readonly pending = computed(() => this.loadingState.value);
  readonly error = computed(() => this.errorState.value);

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const current = this.currentPasswordControl.value.trim();
    const nuevo = this.newPasswordControl.value.trim();
    const confirm = this.confirmPasswordControl.value.trim();

    if (nuevo !== confirm) {
      this.errorState.setValue('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    const usuario = this.user() ?? this.authService.obtenerSesion();
    if (!usuario) {
      this.errorState.setValue('No hay usuario autenticado.');
      return;
    }

    this.loadingState.setValue(true);
    this.errorState.setValue(null);

    this.authService
      .cambiarContrasena(usuario.correo, current, nuevo, confirm)
      .pipe(finalize(() => this.loadingState.setValue(false)))
      .subscribe({
        next: () => {
          this.toast.success('Contraseña cambiada', 'La contraseña se actualizó correctamente.');
          this.passwordForm.reset({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
          this.passwordForm.markAsPristine();
          this.passwordForm.markAsUntouched();
        },
        error: (err) => {
          const message =
            (err && err.error && err.error.message) ||
            'No fue posible cambiar la contraseña.';
          this.errorState.setValue(message);
          this.toast.error('No se pudo cambiar la contraseña', message);
        },
      });
  }
}
