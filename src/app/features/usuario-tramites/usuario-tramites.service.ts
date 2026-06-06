import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import { CampoFormulario } from '../administrador/models/politica.model';

export interface TramiteDisponible {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipoPolitica: string;
  requierePago: boolean;
  tieneRequisitosIniciales?: boolean;
  montoPago?: number | null;
  monedaPago?: string | null;
  descripcionPago?: string | null;
}

export interface InicioInstanciaResponse {
  requierePago: boolean;
  mensaje: string;
  politicaId: string;
  politicaNombre: string;
  instancia?: { id: string; codigoTramite?: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class UsuarioTramitesService {
  private readonly http = inject(HttpClient);

  listarDisponibles(): Observable<TramiteDisponible[]> {
    return this.http.get<TramiteDisponible[]>(`${API_ENDPOINTS.politicas}/movil/disponibles`);
  }

  obtenerRequisitosIniciales(politicaId: string): Observable<CampoFormulario[]> {
    return this.http.get<CampoFormulario[]>(
      `${API_ENDPOINTS.politicas}/${encodeURIComponent(politicaId)}/requisitos-iniciales`
    );
  }

  iniciarTramite(
    politicaId: string,
    respuestasRequisitosIniciales: Record<string, unknown>
  ): Observable<InicioInstanciaResponse> {
    return this.http.post<InicioInstanciaResponse>(API_ENDPOINTS.instancias, {
      politicaId,
      respuestasRequisitosIniciales,
    });
  }
}
