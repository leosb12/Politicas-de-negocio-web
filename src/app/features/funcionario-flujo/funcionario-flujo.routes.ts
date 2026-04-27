import { Routes } from '@angular/router';
import { funcionarioFlujoGuard } from '../../core/guards/funcionario-flujo.guard';

export const FUNCIONARIO_FLUJO_ROUTES: Routes = [
  {
    path: '',
    canActivate: [funcionarioFlujoGuard],
    loadComponent: () =>
      import('./pages/funcionario-flujo-layout/funcionario-flujo-layout').then(
        (module) => module.FuncionarioFlujoLayoutComponent
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
        path: 'perfil',
        loadComponent: () =>
          import('../../shared/pages/usuario-perfil/usuario-perfil').then(
            (module) => module.UsuarioPerfilPageComponent
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
