import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BloqueReporte } from '../../../../../services/reportes-dinamicos.service';

@Component({
  selector: 'app-tabla-dinamica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabla-dinamica.component.html',
  styleUrls: ['./tabla-dinamica.component.css']
})
export class TablaDinamicaComponent {
  @Input() bloque!: BloqueReporte;

  getColumns(): string[] {
    const dataset = this.bloque?.datos || this.bloque?.dataset;
    return dataset?.columns || [];
  }

  getRows(): any[][] {
    const dataset = this.bloque?.datos || this.bloque?.dataset;
    return dataset?.rows || [];
  }

  formatearValor(valor: any, colName: string): string {
    if (valor === null || valor === undefined) return '-';
    
    // Si la columna es un monto, dinero o similar
    const lowCol = colName.toLowerCase();
    if (lowCol.includes('monto') || lowCol.includes('pago') || lowCol.includes('recauda') || lowCol.includes('valor')) {
      if (typeof valor === 'number') {
        return '$' + valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    if (typeof valor === 'number') {
      return valor.toLocaleString('es-ES');
    }

    return String(valor);
  }
}
