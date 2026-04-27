import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ProfilePageComponent } from '../../../../shared/components/profile-page/profile-page';
import { ProfileSummaryItem } from '../../../../shared/components/profile-page/profile-page.model';

@Component({
  selector: 'app-funcionario-perfil-page',
  standalone: true,
  imports: [ProfilePageComponent],
  templateUrl: './funcionario-perfil.html',
  styleUrl: './funcionario-perfil.css',
})
export class FuncionarioPerfilPageComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = signal(this.authService.obtenerSesion());
  readonly summaryItems = computed<ProfileSummaryItem[]>(() => {
    const usuario = this.usuario();
    return [
      { label: 'Correo', value: usuario?.correo ?? '-' },
      {
        label: 'Departamento',
        value: usuario?.departamentoId ?? 'Sin departamento asignado',
      },
    ];
  });
}
