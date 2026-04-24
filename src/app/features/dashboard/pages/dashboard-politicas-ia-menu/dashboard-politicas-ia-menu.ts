import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';
import { DashboardNavigationCardComponent } from '../../../../shared/components/dashboard-navigation-card/dashboard-navigation-card';

@Component({
  selector: 'app-dashboard-politicas-ia-menu-page',
  standalone: true,
  imports: [CommonModule, AppHeaderComponent, DashboardNavigationCardComponent],
  templateUrl: './dashboard-politicas-ia-menu.html',
  styleUrl: './dashboard-politicas-ia-menu.css',
})
export class DashboardPoliticasIaMenuPageComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = this.authService.obtenerSesion();
}
