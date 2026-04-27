import { Routes } from '@angular/router';
import {
  adminOnlyChildGuard,
  adminOnlyGuard,
} from '../../core/guards/admin-only.guard';

export const ADMINISTRADOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminOnlyGuard],
    canActivateChild: [adminOnlyChildGuard],
    loadComponent: () =>
      import('./pages/administrador-layout/administrador-layout').then(
        (module) => module.AdministradorLayoutComponent
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'usuarios',
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/administrador-usuarios/administrador-usuarios').then(
            (module) => module.AdministradorUsuariosPageComponent
          ),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./pages/administrador-roles/administrador-roles').then(
            (module) => module.AdministradorRolesPageComponent
          ),
      },
      {
        path: 'departamentos',
        loadComponent: () =>
          import('./pages/administrador-departamentos/administrador-departamentos').then(
            (module) => module.AdministradorDepartamentosPageComponent
          ),
      },
      {
        path: 'politicas',
        loadComponent: () =>
          import('./pages/administrador-politicas/administrador-politicas').then(
            (module) => module.AdministradorPoliticasPageComponent
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/administrador-analiticas/administrador-analiticas').then(
            (module) => module.AdministradorAnaliticasPageComponent
          ),
      },
      {
        path: 'analisis-ia',
        loadComponent: () =>
          import('./pages/administrador-analisis-ia/administrador-analisis-ia').then(
            (module) => module.AdministradorAnalisisIaPageComponent
          ),
      },
      {
        path: 'servicios-ia',
        loadComponent: () =>
          import('./pages/administrador-servicios-ia/administrador-servicios-ia').then(
            (module) => module.AdministradorServiciosIaPageComponent
          ),
      },
      {
        path: 'simulations',
        loadComponent: () =>
          import('../simulaciones/pages/simulaciones-lista/simulaciones-lista').then(
            (module) => module.SimulacionesListaPageComponent
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
        path: 'simulations/:simulationId',
        loadComponent: () =>
          import('../simulaciones/pages/simulacion-detalle/simulacion-detalle').then(
            (module) => module.SimulacionDetallePageComponent
          ),
      },
      {
        path: 'policies/compare',
        loadComponent: () =>
          import('../simulaciones/pages/politica-comparacion/politica-comparacion').then(
            (module) => module.PoliticaComparacionPageComponent
          ),
      },
      {
        path: 'policies/simulate',
        loadComponent: () =>
          import('../simulaciones/pages/politica-simulacion-formulario/politica-simulacion-formulario').then(
            (module) => module.PoliticaSimulacionFormularioPageComponent
          ),
      },
      {
        path: 'policies/:policyId/simulate',
        loadComponent: () =>
          import('../simulaciones/pages/politica-simulacion-formulario/politica-simulacion-formulario').then(
            (module) => module.PoliticaSimulacionFormularioPageComponent
          ),
      },
    ],
  },
  // Canvas designer — full-screen, outside the admin layout shell
  {
    path: 'politicas/:id/canvas',
    canActivate: [adminOnlyGuard],
    loadComponent: () =>
      import('./pages/canvas-designer/canvas-designer').then(
        (module) => module.CanvasDesignerComponent
      ),
  },
];

