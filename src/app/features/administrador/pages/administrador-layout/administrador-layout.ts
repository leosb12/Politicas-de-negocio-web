import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';

@Component({
  selector: 'app-administrador-layout',
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './administrador-layout.html',
  styleUrl: './administrador-layout.css',
})
export class AdministradorLayoutComponent {}
