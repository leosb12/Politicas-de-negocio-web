import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';
import { DashboardNavigationCardComponent } from '../../../../shared/components/dashboard-navigation-card/dashboard-navigation-card';

type AdministradorMenuCard = {
  chip: string;
  title: string;
  description: string;
  footerLabel: string;
  routerLink: string;
  tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'teal' | 'orange';
};

@Component({
  selector: 'app-dashboard-administrador-menu-page',
  imports: [AppHeaderComponent, DashboardNavigationCardComponent],
  templateUrl: './dashboard-administrador-menu.html',
  styleUrl: './dashboard-administrador-menu.css',
})
export class DashboardAdministradorMenuPageComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = this.authService.obtenerSesion();

  readonly cards: AdministradorMenuCard[] = [
    {
      chip: 'Gestión principal',
      title: 'Gestionar Usuarios',
      description: 'Abre la pantalla para crear, editar, activar y revisar usuarios del sistema.',
      footerLabel: 'Ir a usuarios',
      routerLink: '/admin/usuarios',
      tone: 'sky',
    },
    {
      chip: 'Control de acceso',
      title: 'Gestionar Roles',
      description: 'Entra al módulo para administrar permisos, estados y reglas de los roles.',
      footerLabel: 'Ir a roles',
      routerLink: '/admin/roles',
      tone: 'emerald',
    },
    {
      chip: 'Estructura interna',
      title: 'Gestionar Departamentos',
      description: 'Accede al mantenimiento de departamentos, reasignaciones y estado operativo.',
      footerLabel: 'Ir a departamentos',
      routerLink: '/admin/departamentos',
      tone: 'amber',
    },
  ];
}
