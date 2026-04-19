import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { LoaderComponent } from '../../../../shared/components/loader/loader';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { FuncionarioTareasTableComponent } from '../../components/funcionario-tareas-table/funcionario-tareas-table';
import { FuncionarioWorkflowFacadeService } from '../../services/funcionario-workflow-facade.service';

@Component({
  selector: 'app-funcionario-instancia-detalle-page',
  imports: [
    CommonModule,
    AppCardComponent,
    AppButtonComponent,
    AppAlertComponent,
    LoaderComponent,
    EmptyStateComponent,
    FuncionarioTareasTableComponent,
  ],
  templateUrl: './funcionario-instancia-detalle.html',
  styleUrl: './funcionario-instancia-detalle.css',
})
export class FuncionarioInstanciaDetallePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly facade = inject(FuncionarioWorkflowFacadeService);

  private readonly instanciaIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null }
  );

  readonly contextoJson = computed(() => {
    const instance = this.facade.instanciaPageDetalle();
    if (!instance) {
      return '{}';
    }

    return JSON.stringify(instance.datosContexto ?? {}, null, 2);
  });

  constructor() {
    effect(() => {
      const instanceId = this.instanciaIdParam();
      if (!instanceId) {
        return;
      }

      this.facade.loadInstanciaPage(instanceId);
    });
  }

  volverABandeja(): void {
    void this.router.navigate(['/funcionario/tareas']);
  }

  recargar(): void {
    const instanceId = this.instanciaIdParam();
    if (!instanceId) {
      return;
    }

    this.facade.refreshInstanciaPage(instanceId);
  }

  abrirDetalleTarea(tareaId: string): void {
    void this.router.navigate(['/funcionario/tareas', tareaId]);
  }
}
