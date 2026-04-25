import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';

@Component({
  selector: 'app-funcionario-flujo-layout',
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './funcionario-flujo-layout.html',
  styleUrl: './funcionario-flujo-layout.css',
})
export class FuncionarioFlujoLayoutComponent {}
