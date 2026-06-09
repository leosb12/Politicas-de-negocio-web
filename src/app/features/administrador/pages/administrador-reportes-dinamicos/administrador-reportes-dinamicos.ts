import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReportesDinamicosService,
  ReporteResponse,
  PreviewResponse,
  AsistenteDatosResponse,
  HistorialItem
} from '../../services/reportes-dinamicos.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';

type TabMode = 'reportes' | 'asistente';

@Component({
  selector: 'app-administrador-reportes-dinamicos',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxChartsModule],
  templateUrl: './administrador-reportes-dinamicos.html',
  styleUrls: ['./administrador-reportes-dinamicos.css']
})
export class AdministradorReportesDinamicosPageComponent implements OnDestroy {
  private reportesService = inject(ReportesDinamicosService);

  // Estado general
  activeTab = signal<TabMode>('reportes');
  textoQuery = signal('');
  isProcessing = signal(false);
  isDictating = signal(false);
  showPlanAvanzado = signal(false);
  iaPlus = signal(false);

  // Reportes
  interpretacionActual = signal<ReporteResponse | null>(null);
  previewData = signal<PreviewResponse | null>(null);

  // Asistente de Datos
  asistentResponse = signal<AsistenteDatosResponse | null>(null);

  // Historial
  historial = signal<HistorialItem[]>([]);

  // Charts
  view: [number, number] = [700, 400];
  chartData = signal<any[]>([]);

  // Speech recognition
  private recognition: any = null;

  constructor() {
    this.cargarHistorial();

    effect(() => {
      const data = this.previewData();
      if (data && data.filas && data.filas.length > 0 && data.interpretacion.visualizacion !== 'tabla') {
        this.prepareChartData(data);
      } else {
        this.chartData.set([]);
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    if (this.recognition) {
      this.recognition.abort();
    }
  }

  // ===== TABS =====

  setTab(tab: TabMode) {
    this.activeTab.set(tab);
    this.limpiar();
  }

  // ===== HISTORIAL =====

  cargarHistorial() {
    this.reportesService.getHistorial().subscribe({
      next: (res) => this.historial.set(res),
      error: (err) => console.error(err)
    });
  }

  // ===== PROCESAMIENTO PRINCIPAL =====

  procesarConsulta() {
    if (!this.textoQuery().trim()) return;

    if (this.activeTab() === 'reportes') {
      this.analizarReporte();
    } else {
      this.preguntarAsistente();
    }
  }

  // ===== REPORTES =====

  analizarReporte() {
    this.isProcessing.set(true);
    this.interpretacionActual.set(null);
    this.previewData.set(null);

    this.reportesService.interpretar({ texto: this.textoQuery(), iaPlus: this.iaPlus() }).subscribe({
      next: (res) => {
        this.interpretacionActual.set(res);
        this.isProcessing.set(false);

        // Auto-generar preview si no requiere aclaración y formato es pantalla
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
    const definicion = this.interpretacionActual();
    if (!definicion || definicion.requiereAclaracion) return;

    this.isProcessing.set(true);
    this.reportesService.generarPreview(definicion, this.textoQuery(), this.iaPlus()).subscribe({
      next: (res) => {
        // Auto-fallback a tabla si tiene arrays o multiples agrupaciones no aptas para graficos
        if (res.interpretacion && res.interpretacion.visualizacion === 'grafico_barras' && res.filas && res.filas.length > 0) {
          const firstRow = res.filas[0];
          let hasArray = Object.values(firstRow).some(v => Array.isArray(v));
          if (hasArray || !res.interpretacion.agrupaciones || res.interpretacion.agrupaciones.length !== 1) {
            res.interpretacion.visualizacion = 'tabla';
          }
        }
        
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

  // ===== ASISTENTE DE DATOS =====

  preguntarAsistente() {
    this.isProcessing.set(true);
    this.asistentResponse.set(null);

    this.reportesService.preguntarAsistente({ texto: this.textoQuery() }).subscribe({
      next: (res) => {
        this.asistentResponse.set(res);
        this.isProcessing.set(false);
        this.cargarHistorial();
      },
      error: (err) => {
        console.error(err);
        this.isProcessing.set(false);
      }
    });
  }

  // ===== EXPORTACIÓN =====

  exportar(formato: string) {
    const data = this.previewData();
    if (!data) return;

    this.isProcessing.set(true);
    this.reportesService.exportar(data, formato).subscribe({
      next: (blob) => {
        this.descargarArchivo(blob, formato, 'reporte_inteligente');
        this.isProcessing.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isProcessing.set(false);
      }
    });
  }

  exportarAsistente(formato: string) {
    const resp = this.asistentResponse();
    if (!resp || !resp.datos || resp.datos.length === 0) return;

    // Convertir datos del asistente a PreviewResponse para el exportador
    const preview: PreviewResponse = {
      interpretacion: {
        titulo: 'Consulta: ' + this.textoQuery(),
        descripcion: resp.resumen || '',
        intencionDetectada: 'asistente_datos',
        entidadPrincipal: resp.plan?.entidadPrincipal || '',
        campos: resp.columnas || [],
        metricas: [],
        filtros: [],
        agrupaciones: [],
        ordenamiento: [],
        limite: 500,
        formatoSalida: formato,
        visualizacion: 'tabla',
        requiereAclaracion: false,
        preguntaAclaratoria: null,
        opcionesSugeridas: [],
        confianza: resp.confianza || 0,
        motor: resp.motor || '',
        respuestaNatural: resp.respuesta
      },
      filas: resp.datos,
      columnas: resp.columnas || [],
      total: resp.datos.length,
      mensaje: null
    };

    this.isProcessing.set(true);
    this.reportesService.exportarAsistente(preview, formato).subscribe({
      next: (blob) => {
        this.descargarArchivo(blob, formato, 'asistente_datos');
        this.isProcessing.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isProcessing.set(false);
      }
    });
  }

  private descargarArchivo(blob: Blob, formato: string, prefix: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    let ext = 'xlsx';
    if (formato === 'pdf') ext = 'pdf';
    if (formato === 'word') ext = 'docx';

    a.download = `${prefix}_${new Date().getTime()}.${ext}`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // ===== CHARTS =====

  prepareChartData(data: PreviewResponse) {
    const definicion = data.interpretacion;
    if (!definicion.agrupaciones || definicion.agrupaciones.length === 0) return;

    const agrupacionKey = definicion.agrupaciones[0];
    let metricaKey = '';

    if (definicion.metricas && definicion.metricas.length > 0) {
      metricaKey = definicion.metricas[0].alias;
    } else {
      const keys = Object.keys(data.filas[0]).filter(k => k !== agrupacionKey);
      if (keys.length > 0) metricaKey = keys[0];
    }

    if (!metricaKey) return;

    const ngxData = data.filas.map(r => ({
      name: String(r[agrupacionKey] || 'N/A'),
      value: Number(r[metricaKey] || 0)
    }));

    this.chartData.set(ngxData);
  }

  // ===== VOZ =====

  toggleDictado() {
    if (this.isDictating()) {
      this.detenerDictado();
    } else {
      this.iniciarDictado();
    }
  }

  private iniciarDictado() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = true;

    this.isDictating.set(true);

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this.textoQuery.set(transcript);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Error de reconocimiento de voz:', event.error);
      this.isDictating.set(false);
    };

    this.recognition.onend = () => {
      this.isDictating.set(false);
      if (this.textoQuery().trim()) {
        this.procesarConsulta();
      }
    };

    this.recognition.start();
  }

  private detenerDictado() {
    if (this.recognition) {
      this.recognition.stop();
    }
    this.isDictating.set(false);
  }

  // ===== OPCIONES SUGERIDAS =====

  seleccionarSugerencia(opcion: string) {
    this.textoQuery.set(opcion);
    this.procesarConsulta();
  }

  // ===== UTILIDADES =====

  getKeys(obj: any): string[] {
    if (!obj) return [];
    const keys = Object.keys(obj);
    
    // Ocultar IDs técnicos si existe su versión enriquecida (Nombre o Correo)
    return keys.filter(key => {
      if (key === 'tokensJoin' || key === 'datosContexto' || key === '_modo' || key === '_origen' || key === '_camposEstimados') {
        return false;
      }
      if (key.endsWith('Id') || key === 'creadaPor' || key === 'subidoPor' || key === 'funcionarioAsignado') {
        const enrichedName = key + 'Nombre';
        const enrichedNombres = key + 'Nombres';
        const enrichedCorreo = key + 'Correo';
        
        // Si el objeto ya trae la columna enriquecida, ocultamos el ID crudo
        if (keys.includes(enrichedName) || keys.includes(enrichedNombres) || keys.includes(enrichedCorreo)) {
          return false;
        }
      }
      return true;
    });
  }

  formatearValor(valor: any): string {
    if (valor === null || valor === undefined) return '-';
    
    if (Array.isArray(valor)) {
      return valor.join(', ');
    }
    
    if (typeof valor === 'object') {
      if (valor.nombre) return valor.nombre;
      try {
        return JSON.stringify(valor);
      } catch {
        return '[Objeto Complejo]';
      }
    }
    
    return String(valor);
  }

  limpiar() {
    this.textoQuery.set('');
    this.interpretacionActual.set(null);
    this.previewData.set(null);
    this.asistentResponse.set(null);
    this.showPlanAvanzado.set(false);
  }

  cargarHistorialItem(item: HistorialItem) {
    this.textoQuery.set(item.textoOriginal);
    this.procesarConsulta();
  }

  getMotorLabel(motor: string): string {
    switch (motor) {
      case 'MOTOR_IA_AVANZADO': return 'Motor IA Avanzado';
      case 'MOTOR_INTERNO': return 'Motor Deep Learning';
      case 'MOTOR_FALLBACK': return 'Motor Básico';
      default: return motor || 'N/A';
    }
  }

  getMotorClass(motor: string): string {
    switch (motor) {
      case 'MOTOR_IA_AVANZADO': return 'motor-avanzado';
      case 'MOTOR_INTERNO': return 'motor-interno';
      case 'MOTOR_FALLBACK': return 'motor-fallback';
      default: return '';
    }
  }

  getConfianzaClass(confianza: number): string {
    if (confianza >= 0.8) return 'confianza-alta';
    if (confianza >= 0.5) return 'confianza-media';
    return 'confianza-baja';
  }

  togglePlanAvanzado() {
    this.showPlanAvanzado.set(!this.showPlanAvanzado());
  }

  formatJson(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return '{}';
    }
  }
}
