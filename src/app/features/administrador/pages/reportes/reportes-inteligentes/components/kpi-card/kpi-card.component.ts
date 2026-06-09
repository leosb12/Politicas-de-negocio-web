import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BloqueReporte } from '../../../../../services/reportes-dinamicos.service';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.css']
})
export class KpiCardComponent {
  @Input() bloque!: BloqueReporte;

  getValor(): string {
    const dataset = this.bloque?.datos || this.bloque?.dataset;
    if (!dataset || !dataset.values || dataset.values.length === 0) {
      return '0';
    }
    const val = dataset.values[0];
    
    // Si es dinero, formatearlo
    if (this.bloque.titulo.toLowerCase().includes("pago") || this.bloque.titulo.toLowerCase().includes("recauda") || this.bloque.titulo.toLowerCase().includes("dinero")) {
      return '$' + Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return Number(val).toLocaleString('es-ES');
  }

  getLabel(): string {
    const dataset = this.bloque?.datos || this.bloque?.dataset;
    if (!dataset || !dataset.labels || dataset.labels.length === 0) {
      return 'Total';
    }
    return dataset.labels[0];
  }
}
