import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';

@Component({
  selector: 'app-funcionario-workflow-layout',
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './funcionario-workflow-layout.html',
  styleUrl: './funcionario-workflow-layout.css',
})
export class FuncionarioWorkflowLayoutComponent {}
