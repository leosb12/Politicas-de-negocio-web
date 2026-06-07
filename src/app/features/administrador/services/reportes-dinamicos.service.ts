import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';

export interface ReporteRequest {
  texto: string;
}

export interface ReporteResponse {
  titulo: string;
  descripcion: string;
  intencionDetectada: string;
  entidadPrincipal: string;
  campos: string[];
  metricas: any[];
  filtros: any[];
  agrupaciones: string[];
  ordenamiento: any[];
  limite: number;
  formatoSalida: string;
  visualizacion: string;
  requiereAclaracion: boolean;
  preguntaAclaratoria: string | null;
  confianza: number;
}

export interface PreviewResponse {
  interpretacion: ReporteResponse;
  resultados: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportesDinamicosService {
  private http = inject(HttpClient);
  private readonly baseUrl = API_ENDPOINTS.adminReportes;

  interpretar(request: ReporteRequest): Observable<ReporteResponse> {
    return this.http.post<ReporteResponse>(`${this.baseUrl}/interpretar`, request);
  }

  generarPreview(definicion: ReporteResponse, textoOriginal: string = ''): Observable<PreviewResponse> {
    return this.http.post<PreviewResponse>(`${this.baseUrl}/preview?textoOriginal=${encodeURIComponent(textoOriginal)}`, definicion);
  }

  exportar(definicion: PreviewResponse, formato: string): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/exportar?formato=${formato}`, definicion, {
      responseType: 'blob'
    });
  }

  getHistorial(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/historial`);
  }
}
