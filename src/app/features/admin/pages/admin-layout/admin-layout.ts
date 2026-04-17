import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';

@Component({
  selector: 'app-admin-layout',
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayoutComponent {}
