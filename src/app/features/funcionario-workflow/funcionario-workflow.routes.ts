import { Routes } from '@angular/router';
import { funcionarioWorkflowGuard } from '../../core/guards/funcionario-workflow.guard';

export const FUNCIONARIO_WORKFLOW_ROUTES: Routes = [
  {
    path: '',
    canActivate: [funcionarioWorkflowGuard],
    loadComponent: () =>
      import('./pages/funcionario-workflow-layout/funcionario-workflow-layout').then(
        (module) => module.FuncionarioWorkflowLayoutComponent
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tareas',
      },
      {
        path: 'tareas',
        loadComponent: () =>
          import('./pages/funcionario-tareas/funcionario-tareas').then(
            (module) => module.FuncionarioTareasPageComponent
          ),
      },
      {
        path: 'tareas/:id',
        loadComponent: () =>
          import('./pages/funcionario-tarea-detalle/funcionario-tarea-detalle').then(
            (module) => module.FuncionarioTareaDetallePageComponent
          ),
      },
      {
        path: 'instancias/:id',
        loadComponent: () =>
          import('./pages/funcionario-instancia-detalle/funcionario-instancia-detalle').then(
            (module) => module.FuncionarioInstanciaDetallePageComponent
          ),
      },
    ],
  },
];
