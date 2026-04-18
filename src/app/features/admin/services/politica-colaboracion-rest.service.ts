import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  ColaboracionEstadoSnapshot,
  ColaboracionHistorialItem,
  ColaboracionNodoBloqueadoPayload,
  ColaboracionPresenciaPayload,
} from '../models/politica-colaboracion.model';

@Injectable({ providedIn: 'root' })
export class PoliticaColaboracionRestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = API_ENDPOINTS.politicas;

  getEstado(politicaId: string): Observable<ColaboracionEstadoSnapshot> {
    return this.http.get<ColaboracionEstadoSnapshot>(
      `${this.baseUrl}/${politicaId}/colaboracion/estado`
    );
  }

  getHistorial(politicaId: string): Observable<ColaboracionHistorialItem[]> {
    return this.http.get<ColaboracionHistorialItem[]>(
      `${this.baseUrl}/${politicaId}/colaboracion/historial`
    );
  }

  getPresencia(politicaId: string): Observable<ColaboracionPresenciaPayload> {
    return this.http.get<ColaboracionPresenciaPayload>(
      `${this.baseUrl}/${politicaId}/colaboracion/presencia`
    );
  }

  getNodosBloqueados(
    politicaId: string
  ): Observable<ColaboracionNodoBloqueadoPayload[] | ColaboracionNodoBloqueadoPayload> {
    return this.http.get<
      ColaboracionNodoBloqueadoPayload[] | ColaboracionNodoBloqueadoPayload
    >(`${this.baseUrl}/${politicaId}/colaboracion/nodos-bloqueados`);
  }
}
