import { CommonModule } from '@angular/common';
import { DestroyRef, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter, fromEvent } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { Usuario } from '../../../core/auth/models/usuario.model';
import { AuthService } from '../../../core/auth/services/auth.service';
import { isFuncionarioRole, isAdminRole } from '../../../core/auth/utils/role.util';

interface HeaderMenuItem {
  label: string;
  routerLink: string;
}

interface HeaderMenuGroup {
  key: string;
  label: string;
  items: HeaderMenuItem[];
}

const ADMIN_MENU_GROUPS: HeaderMenuGroup[] = [
  {
    key: 'administracion',
    label: 'Administracion',
    items: [
      { label: 'Panel administrador', routerLink: '/dashboard-admin/administracion' },
      { label: 'Gestionar Usuarios', routerLink: '/admin/usuarios' },
      { label: 'Gestionar Roles', routerLink: '/admin/roles' },
      { label: 'Gestionar Departamentos', routerLink: '/admin/departamentos' },
    ],
  },
  {
    key: 'politicas',
    label: 'Politicas',
    items: [
      { label: 'Menu de politicas', routerLink: '/dashboard-admin/politicas-negocio' },
      {
        label: 'Simulaciones IA',
        routerLink: '/dashboard-admin/politicas-negocio/simulaciones-ia',
      },
      { label: 'Comparar politicas', routerLink: '/admin/policies/compare' },
    ],
  },
  {
    key: 'analitica',
    label: 'Analitica',
    items: [
      { label: 'Menu de analitica', routerLink: '/dashboard-admin/analitica' },
      { label: 'Analiticas generales', routerLink: '/admin/analytics' },
      { label: 'Analisis con IA', routerLink: '/admin/analisis-ia' },
    ],
  },
];

const FUNCIONARIO_MENU_GROUPS: HeaderMenuGroup[] = [
  {
    key: 'funcionario',
    label: 'Funcionario',
    items: [
      { label: 'Dashboard funcionario', routerLink: '/dashboard-funcionario' },
      { label: 'Mis tareas', routerLink: '/funcionario/tareas' },
    ],
  },
];

const GUEST_MENU_GROUPS: HeaderMenuGroup[] = [
  {
    key: 'acceso',
    label: 'Acceso',
    items: [{ label: 'Login', routerLink: '/login' }],
  },
];

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  readonly session = signal<Usuario | null>(this.authService.obtenerSesion());
  readonly mobileMenuOpen = signal(false);
  readonly openGroupKey = signal<string | null>(null);
  readonly isFuncionarioSession = computed(() => isFuncionarioRole(this.session()?.rol));
  readonly profileRoute = computed(() =>
    this.isFuncionarioSession() ? '/funcionario/perfil' : '/admin/perfil'
  );

  readonly menuGroups = computed(() => {
    const role = this.session()?.rol;

    if (isAdminRole(role)) {
      return ADMIN_MENU_GROUPS;
    }

    if (isFuncionarioRole(role)) {
      return FUNCIONARIO_MENU_GROUPS;
    }

    return GUEST_MENU_GROUPS;
  });

  readonly titleRouterLink = computed(() => {
    const role = this.session()?.rol;

    if (isFuncionarioRole(role)) {
      return '/dashboard-funcionario';
    }

    return '/dashboard-admin';
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.session.set(this.authService.obtenerSesion());
        this.closeMenus();
      });

    fromEvent<MouseEvent>(document, 'click')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const target = event.target;
        if (target instanceof Node && this.hostElement.nativeElement.contains(target)) {
          return;
        }

        this.closeMenus();
      });

    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key === 'Escape') {
          this.closeMenus();
        }
      });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
    if (!this.mobileMenuOpen()) {
      this.openGroupKey.set(null);
    }
  }

  toggleGroup(key: string): void {
    this.openGroupKey.update((current) => (current === key ? null : key));
  }

  closeMenus(): void {
    this.mobileMenuOpen.set(false);
    this.openGroupKey.set(null);
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
    this.session.set(null);
    this.closeMenus();
    void this.router.navigate(['/login']);
  }
}
