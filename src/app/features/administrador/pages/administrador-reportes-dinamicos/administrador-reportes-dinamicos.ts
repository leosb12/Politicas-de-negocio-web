import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesDinamicosService, ReporteResponse, PreviewResponse } from '../../services/reportes-dinamicos.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';

@Component({
  selector: 'app-administrador-reportes-dinamicos',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxChartsModule],
  templateUrl: './administrador-reportes-dinamicos.html',
  styleUrls: ['./administrador-reportes-dinamicos.css']
})
export class AdministradorReportesDinamicosPageComponent {
  private reportesService = inject(ReportesDinamicosService);

  textoQuery = signal('');
  isProcessing = signal(false);
  isDictating = signal(false);

  interpretacion = signal<ReporteResponse | null>(null);
  previewData = signal<PreviewResponse | null>(null);
  historial = signal<any[]>([]);
  
  view: [number, number] = [700, 400];
  chartData = signal<any[]>([]);

  constructor() {
    this.cargarHistorial();
    
    effect(() => {
      const data = this.previewData();
      if (data && data.resultados && data.resultados.length > 0 && data.interpretacion.visualizacion !== 'tabla') {
        this.prepareChartData(data);
      } else {
        this.chartData.set([]);
      }
    }, { allowSignalWrites: true });
  }

  cargarHistorial() {
    this.reportesService.getHistorial().subscribe({
      next: (res) => this.historial.set(res),
      error: (err) => console.error(err)
    });
  }

  analizarTexto() {
    if (!this.textoQuery().trim()) return;
    
    this.isProcessing.set(true);
    this.interpretacion.set(null);
    this.previewData.set(null);

    this.reportesService.interpretar({ texto: this.textoQuery() }).subscribe({
      next: (res) => {
        this.interpretacion.set(res);
        this.isProcessing.set(false);
        if (!res.requiereAclaracion && res.formatoSalida === 'pantalla') {
          this.generarPreview();
        }
      },
      error: (err) => {
        console.error(err);
        this.isProcessing.set(false);
      }
    });
  }

  generarPreview() {
    const definicion = this.interpretacion();
    if (!definicion || definicion.requiereAclaracion) return;

    this.isProcessing.set(true);
    this.reportesService.generarPreview(definicion, this.textoQuery()).subscribe({
      next: (res) => {
        this.previewData.set(res);
        this.isProcessing.set(false);
        this.cargarHistorial();
      },
      error: (err) => {
        console.error(err);
        this.isProcessing.set(false);
      }
    });
  }

  exportar(formato: string) {
    const data = this.previewData();
    if (!data) return;

    this.isProcessing.set(true);
    this.reportesService.exportar(data, formato).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let ext = 'xlsx';
        if (formato === 'pdf') ext = 'pdf';
        if (formato === 'word') ext = 'docx';
        
        a.download = `reporte_dinamico_${new Date().getTime()}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isProcessing.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isProcessing.set(false);
      }
    });
  }

  prepareChartData(data: PreviewResponse) {
    const definicion = data.interpretacion;
    if (!definicion.agrupaciones || definicion.agrupaciones.length === 0) return;
    
    const agrupacionKey = definicion.agrupaciones[0];
    let metricaKey = '';
    
    if (definicion.metricas && definicion.metricas.length > 0) {
      metricaKey = definicion.metricas[0].alias;
    } else {
      // Si no hay metrica clara
      const keys = Object.keys(data.resultados[0]).filter(k => k !== agrupacionKey);
      if (keys.length > 0) metricaKey = keys[0];
    }

    if (!metricaKey) return;

    const ngxData = data.resultados.map(r => ({
      name: String(r[agrupacionKey] || 'N/A'),
      value: Number(r[metricaKey] || 0)
    }));

    this.chartData.set(ngxData);
  }

  dictarReporte() {
    this.isDictating.set(!this.isDictating());
    // Simulate voice dictation for now since it needs browser SpeechRecognition API
    if (this.isDictating()) {
      setTimeout(() => {
        this.textoQuery.set('quiero ver la politica mas usada este mes');
        this.isDictating.set(false);
        this.analizarTexto();
      }, 2000);
    }
  }
  
  getKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  limpiar() {
    this.textoQuery.set('');
    this.interpretacion.set(null);
    this.previewData.set(null);
  }

  cargarHistorialItem(item: any) {
    this.textoQuery.set(item.textoOriginal);
    this.analizarTexto();
  }
}
