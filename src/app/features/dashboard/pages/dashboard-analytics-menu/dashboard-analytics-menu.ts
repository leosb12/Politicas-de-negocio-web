import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';
import { DashboardNavigationCardComponent } from '../../../../shared/components/dashboard-navigation-card/dashboard-navigation-card';

@Component({
  selector: 'app-dashboard-analytics-menu-page',
  standalone: true,
  imports: [CommonModule, AppHeaderComponent, DashboardNavigationCardComponent],
  templateUrl: './dashboard-analytics-menu.html',
  styleUrl: './dashboard-analytics-menu.css',
})
export class DashboardAnalyticsMenuPageComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = this.authService.obtenerSesion();
}
