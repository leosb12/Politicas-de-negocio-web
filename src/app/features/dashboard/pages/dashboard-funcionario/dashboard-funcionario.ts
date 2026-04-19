import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { FuncionarioTareasPageComponent } from '../../../funcionario-workflow/pages/funcionario-tareas/funcionario-tareas';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header';

@Component({
  selector: 'app-dashboard-funcionario',
  imports: [CommonModule, AppHeaderComponent, FuncionarioTareasPageComponent],
  templateUrl: './dashboard-funcionario.html',
  styleUrl: './dashboard-funcionario.css'
})
export class DashboardFuncionario {
  private authService = inject(AuthService);

  usuario = this.authService.obtenerSesion();
}