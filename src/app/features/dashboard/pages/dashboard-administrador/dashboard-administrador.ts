import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';
import { DashboardNavigationCardComponent } from '../../../../shared/components/dashboard-navigation-card/dashboard-navigation-card';

@Component({
  selector: 'app-dashboard-administrador',
  standalone: true,
  imports: [CommonModule, AppHeaderComponent, DashboardNavigationCardComponent],
  templateUrl: './dashboard-administrador.html',
  styleUrl: './dashboard-administrador.css'
})
export class DashboardAdministrador {
  private authService = inject(AuthService);

  usuario = this.authService.obtenerSesion();
}
