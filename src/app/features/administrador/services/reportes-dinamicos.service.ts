import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';

// ============================================================
// INTERFACES - REPORTES INTELIGENTES
// ============================================================

export interface ReporteRequest {
  texto: string;
  iaPlus?: boolean;
}

export interface Metrica {
  operacion: string;
  campo: string;
  alias: string;
}

export interface Filtro {
  campo: string;
  operador: string;
  valor: any;
}

export interface Ordenamiento {
  campo: string;
  direccion: string;
}

export interface ReporteResponse {
  titulo: string;
  descripcion: string;
  intencionDetectada: string;
  entidadPrincipal: string;
  campos: string[];
  metricas: Metrica[];
  filtros: Filtro[];
  agrupaciones: string[];
  ordenamiento: Ordenamiento[];
  limite: number;
  formatoSalida: string;
  visualizacion: string;
  requiereAclaracion: boolean;
  preguntaAclaratoria: string | null;
  opcionesSugeridas: string[];
  confianza: number;
  motor: string;
  respuestaNatural: string | null;
}

export interface PreviewResponse {
  interpretacion: ReporteResponse;
  filas: any[];
  columnas: string[];
  total: number;
  mensaje: string | null;
  respuestaNatural?: string;
  sugerencias?: string[];
  reporteCompuesto?: any;
  asistido?: boolean;
  diagnostico?: {
    coleccionTieneDatos: boolean;
    campoExiste: boolean;
    valorSolicitado: string;
    valoresDisponibles: string[];
  };
}

// ============================================================
// INTERFACES - ASISTENTE DE DATOS
// ============================================================

export interface AsistenteDatosRequest {
  texto: string;
  contextoAdicional?: string;
}

export interface PlanConsulta {
  requiereDatos: boolean;
  tipoConsulta: string;
  fuentesNecesarias: string[];
  entidadPrincipal: string;
  operacion: string;
  camposSolicitados: string[];
  filtros: Filtro[];
  agrupaciones: string[];
  ordenamiento: Ordenamiento[];
  limite: number;
  requiereBusquedaSemantica: boolean;
  requiereAclaracion: boolean;
  preguntaAclaratoria: string | null;
}

export interface AsistenteDatosResponse {
  respuesta: string;
  resumen: string;
  datos: any[];
  columnas: string[];
  visualizacionSugerida: string;
  accionesSugeridas: string[];
  fuentesConsultadas: string[];
  advertencias: string[];
  plan: PlanConsulta | null;
  motor: string;
  confianza: number;
}

export interface HistorialItem {
  id: string;
  textoOriginal: string;
  intencionDetectada: string;
  entidadPrincipal: string;
  formatoSalida: string;
  visualizacion: string;
  fechaGeneracion: string;
  estado: string;
  cantidadResultados: number;
  confianzaModelo: number;
  motorUsado: string;
  tipoConsulta: string;
}

// ============================================================
// SERVICIO
// ============================================================

@Injectable({
  providedIn: 'root'
})
export class ReportesDinamicosService {
  private http = inject(HttpClient);
  private readonly reportesUrl = API_ENDPOINTS.adminReportes;
  private readonly asistenteDatosUrl = `${API_ENDPOINTS.adminReportes}`.replace('/reportes', '/asistente-datos');

  // ===== REPORTES =====

  interpretar(request: ReporteRequest): Observable<ReporteResponse> {
    return this.http.post<ReporteResponse>(`${this.reportesUrl}/interpretar`, request);
  }

  generarPreview(definicion: ReporteResponse, textoOriginal: string = '', iaPlus: boolean = false): Observable<PreviewResponse> {
    const body = {
      interpretacion: definicion,
      iaPlus: iaPlus
    };
    return this.http.post<PreviewResponse>(`${this.reportesUrl}/preview?textoOriginal=${encodeURIComponent(textoOriginal)}`, body);
  }

  exportar(definicion: PreviewResponse, formato: string): Observable<Blob> {
    return this.http.post(`${this.reportesUrl}/exportar?formato=${formato}`, definicion, {
      responseType: 'blob'
    });
  }

  getHistorial(): Observable<HistorialItem[]> {
    return this.http.get<HistorialItem[]>(`${this.reportesUrl}/historial`);
  }

  getCatalogo(): Observable<any> {
    return this.http.get(`${this.reportesUrl}/catalogo`);
  }

  // ===== ASISTENTE DE DATOS =====

  preguntarAsistente(request: AsistenteDatosRequest): Observable<AsistenteDatosResponse> {
    return this.http.post<AsistenteDatosResponse>(`${this.asistenteDatosUrl}/preguntar`, request);
  }

  planificar(request: AsistenteDatosRequest): Observable<any> {
    return this.http.post(`${this.asistenteDatosUrl}/planificar`, request);
  }

  ejecutarPlan(plan: any, textoOriginal: string = ''): Observable<AsistenteDatosResponse> {
    return this.http.post<AsistenteDatosResponse>(`${this.asistenteDatosUrl}/ejecutar-plan`, {
      plan,
      textoOriginal
    });
  }

  getCatalogoAsistente(): Observable<any> {
    return this.http.get(`${this.asistenteDatosUrl}/catalogo`);
  }

  exportarAsistente(previewData: PreviewResponse, formato: string): Observable<Blob> {
    return this.http.post(`${this.asistenteDatosUrl}/exportar?formato=${formato}`, previewData, {
      responseType: 'blob'
    });
  }

  // ===== REPORTES VISUALES INTELIGENTES =====

  generarReporteVisual(request: { prompt: string; usuarioId?: string; iaPlus?: boolean }): Observable<ReporteVisualResponse> {
    const visualUrl = `${this.reportesUrl.replace('/reportes', '/reportes-visuales')}/generar`;
    return this.http.post<ReporteVisualResponse>(visualUrl, request);
  }

  generarReporteVisualOffline(request: { prompt: string; usuarioId?: string; iaPlus?: boolean }): Observable<ReporteVisualResponse> {
    const visualUrl = `${this.reportesUrl.replace('/reportes', '/reportes-visuales')}/generar-offline`;
    return this.http.post<ReporteVisualResponse>(visualUrl, request);
  }
}

// ============================================================
// INTERFACES - REPORTES VISUALES INTELIGENTES
// ============================================================

export interface ResultadoBloqueReporte {
  labels: string[];
  values: number[];
  columns: string[];
  rows: any[][];
}

export interface ConfiguracionGrafico {
  xKey: string;
  yKey: string;
  descripcion: string;
}

export interface BloqueReporte {
  id: string;
  tipo: 'bar' | 'pie' | 'doughnut' | 'line' | 'area' | 'table' | 'matrix' | 'kpi' | 'error';
  titulo: string;
  orden: number;
  posicion?: number;
  datos?: ResultadoBloqueReporte;
  dataset?: ResultadoBloqueReporte;
  configuracion?: ConfiguracionGrafico;
  mensajeError?: string;
}

export interface ReporteVisualResponse {
  titulo: string;
  descripcion: string;
  promptOriginal: string;
  fechaGeneracion: string;
  bloques: BloqueReporte[];
  asistido?: boolean;
  offlineMessage?: string;
}
