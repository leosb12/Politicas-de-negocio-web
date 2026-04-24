import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppCardComponent } from '../../../../shared/ui/card/card';

type IaServiceKey = 'simulate' | 'history' | 'compare';

@Component({
  selector: 'app-admin-servicios-ia-page',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AppBadgeComponent,
    AppCardComponent,
  ],
  templateUrl: './admin-servicios-ia.html',
  styleUrl: './admin-servicios-ia.css',
})
export class AdminServiciosIaPageComponent {
  private readonly router = inject(Router);

  readonly serviceCards = computed(() => {
    return [
      {
        key: 'simulate' as const,
        title: 'Simular politica',
        icon: 'play-circle',
        tone: 'border-sky-200 bg-sky-50/70',
        description:
          'Ejecuta una simulacion de una politica para estimar tiempos, carga, cuellos de botella y analisis IA opcional.',
        helper:
          'Primero entraras al formulario y alli podras elegir la politica que quieres simular.',
        badge: 'Disponible',
        enabled: true,
      },
      {
        key: 'history' as const,
        title: 'Historial de simulaciones',
        icon: 'clipboard-list',
        tone: 'border-emerald-200 bg-emerald-50/70',
        description:
          'Consulta simulaciones anteriores de una politica, compara ejecuciones y entra al detalle de cada resultado.',
        helper:
          'Al entrar podras elegir la politica desde la misma pantalla del historial.',
        badge: 'Disponible',
        enabled: true,
      },
      {
        key: 'compare' as const,
        title: 'Comparar politicas',
        icon: 'arrow-left-right',
        tone: 'border-violet-200 bg-violet-50/70',
        description:
          'Corre una comparacion entre dos politicas usando la misma configuracion para determinar cual es mas eficiente.',
        helper:
          'Podras elegir politica A, politica B y la configuracion comun de simulacion.',
        badge: 'Disponible',
        enabled: true,
      },
    ];
  });

  openService(service: IaServiceKey): void {
    if (service === 'simulate') {
      void this.router.navigate(['/admin/policies/simulate']);
      return;
    }

    if (service === 'history') {
      void this.router.navigate(['/admin/simulations']);
      return;
    }

    void this.router.navigate(['/admin/policies/compare']);
  }
}
