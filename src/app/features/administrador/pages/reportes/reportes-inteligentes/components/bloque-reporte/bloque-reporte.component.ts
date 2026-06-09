import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BloqueReporte } from '../../../../../services/reportes-dinamicos.service';
import { KpiCardComponent } from '../kpi-card/kpi-card.component';
import { TablaDinamicaComponent } from '../tabla-dinamica/tabla-dinamica.component';
import { GraficoDinamicoComponent } from '../grafico-dinamico/grafico-dinamico.component';

@Component({
  selector: 'app-bloque-reporte',
  standalone: true,
  imports: [CommonModule, KpiCardComponent, TablaDinamicaComponent, GraficoDinamicoComponent],
  templateUrl: './bloque-reporte.component.html',
  styleUrls: ['./bloque-reporte.component.css']
})
export class BloqueReporteComponent {
  @Input() bloque!: BloqueReporte;

  isChart(): boolean {
    return ['bar', 'pie', 'doughnut', 'line', 'area'].includes(this.bloque?.tipo);
  }

  isTable(): boolean {
    return ['table', 'matrix'].includes(this.bloque?.tipo);
  }

  isKpi(): boolean {
    return this.bloque?.tipo === 'kpi';
  }

  isError(): boolean {
    return this.bloque?.tipo === 'error';
  }
}
