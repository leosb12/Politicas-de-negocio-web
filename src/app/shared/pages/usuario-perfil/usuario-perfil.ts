import { Component, computed, effect, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import {
  AuthService,
  FuncionarioDepartamentoResponse,
} from '../../../core/auth/services/auth.service';
import { isFuncionarioRole } from '../../../core/auth/utils/role.util';
import { ProfilePageComponent } from '../../components/profile-page/profile-page';
import {
  ProfilePageConfig,
  ProfileSummaryItem,
} from '../../components/profile-page/profile-page.model';

@Component({
  selector: 'app-usuario-perfil-page',
  standalone: true,
  imports: [ProfilePageComponent],
  templateUrl: './usuario-perfil.html',
  styleUrl: './usuario-perfil.css',
})
export class UsuarioPerfilPageComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = computed(() => this.authService.session());
  readonly esFuncionario = computed(() => isFuncionarioRole(this.usuario()?.rol));
  readonly estadoDepartamento = signal('Sin departamento asignado');

  constructor() {
    effect((onCleanup) => {
      const usuario = this.usuario();

      if (!isFuncionarioRole(usuario?.rol)) {
        this.estadoDepartamento.set('Sin departamento asignado');
        return;
      }

      const departamentoNombre = usuario?.departamentoNombre?.trim();
      if (departamentoNombre) {
        this.estadoDepartamento.set(departamentoNombre);
        return;
      }

      const funcionarioId = usuario?.id?.trim();
      if (!funcionarioId) {
        this.estadoDepartamento.set('Sin departamento asignado');
        return;
      }

      this.estadoDepartamento.set('Cargando departamento...');

      const subscription = this.authService
        .obtenerDepartamentoFuncionario(funcionarioId)
        .pipe(
          catchError(() => {
            this.estadoDepartamento.set('Departamento no disponible');
            return of<FuncionarioDepartamentoResponse | null>(null);
          })
        )
        .subscribe((response) => {
          if (!response) {
            return;
          }

          const nombre = response.nombre?.trim() || 'Sin departamento asignado';
          this.estadoDepartamento.set(nombre);

          const sesionActual = this.authService.obtenerSesion();
          if (!sesionActual || sesionActual.id !== funcionarioId) {
            return;
          }

          if (sesionActual.departamentoNombre === response.nombre) {
            return;
          }

          this.authService.actualizarSesion({
            ...sesionActual,
            departamentoNombre: response.nombre,
            departamentoId: response.id ?? sesionActual.departamentoId,
          });
        });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  readonly nombreDepartamento = computed(() => {
    const usuario = this.usuario();
    const nombre = usuario?.departamentoNombre?.trim();

    if (nombre) {
      return nombre;
    }

    return this.estadoDepartamento();
  });

  readonly summaryItems = computed<ProfileSummaryItem[]>(() => {
    const usuario = this.usuario();

    if (this.esFuncionario()) {
      return [
        { label: 'Correo', value: usuario?.correo ?? '-' },
        {
          label: 'Departamento',
          value: this.nombreDepartamento(),
        },
      ];
    }

    return [
      { label: 'Correo', value: usuario?.correo ?? '-' },
      { label: 'Rol', value: usuario?.rol ?? '-' },
    ];
  });

  readonly config = computed<ProfilePageConfig>(() => {
    const usuario = this.usuario();

    if (this.esFuncionario()) {
      return {
        theme: 'funcionario',
        badgeLabel: 'Funcionario',
        heroTitle: 'Tu perfil de trabajo',
        heroDescription:
          'Revisa la informacion de tu cuenta y protege el acceso con el que gestionas tus tareas y formularios dentro del flujo.',
        securityDescription:
          'Actualiza tu contrase\u00f1a si usaste un equipo compartido o si quieres reforzar tu acceso.',
        note:
          'Mantener esta cuenta segura evita accesos no deseados a tus bandejas, aprobaciones y registros del flujo operativo.',
        actionHint: 'Tu sesion actual se mantiene activa.',
        user: usuario,
        summaryItems: this.summaryItems(),
      };
    }

    return {
      theme: 'admin',
      badgeLabel: 'Administrador',
      heroTitle: 'Tu cuenta de administracion',
      heroDescription:
        'Administra tus datos de acceso y manten segura la cuenta con la que gestionas usuarios, politicas y configuraciones del sistema.',
      securityDescription:
        'Usa una contrase\u00f1a nueva de al menos 6 caracteres y evita reutilizar la actual.',
      note:
        'Este acceso tiene permisos sensibles. Cambia tu contrase\u00f1a si compartiste el equipo o si sospechas de actividad no autorizada.',
      actionHint: 'El cambio se aplica inmediatamente.',
      user: usuario,
      summaryItems: this.summaryItems(),
    };
  });
}
