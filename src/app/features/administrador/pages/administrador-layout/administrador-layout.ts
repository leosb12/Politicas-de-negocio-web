import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';
import { OfflineStatusBannerComponent } from '../../../../shared/components/offline-status-banner/offline-status-banner';

@Component({
  selector: 'app-administrador-layout',
  imports: [AppHeaderComponent, RouterOutlet, OfflineStatusBannerComponent],
  templateUrl: './administrador-layout.html',
  styleUrl: './administrador-layout.css',
})
export class AdministradorLayoutComponent {}
