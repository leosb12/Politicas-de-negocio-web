import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ProfilePageComponent } from '../../../../shared/components/profile-page/profile-page';
import { ProfileSummaryItem } from '../../../../shared/components/profile-page/profile-page.model';

@Component({
  selector: 'app-administrador-perfil-page',
  standalone: true,
  imports: [ProfilePageComponent],
  templateUrl: './administrador-perfil.html',
  styleUrl: './administrador-perfil.css',
})
export class AdministradorPerfilPageComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = signal(this.authService.obtenerSesion());
  readonly summaryItems = computed<ProfileSummaryItem[]>(() => {
    const usuario = this.usuario();
    return [
      { label: 'Correo', value: usuario?.correo ?? '-' },
      { label: 'Rol', value: usuario?.rol ?? '-' },
    ];
  });
}
