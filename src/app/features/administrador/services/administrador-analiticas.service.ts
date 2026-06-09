import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import { IndexedDbService } from '../../../core/offline/indexeddb.service';
import {
  AdministradorAnaliticasDashboardSummary,
  BottlenecksResponse,
  TaskRedistributionResponse,
  SystemAuditResponse,
} from '../models/administrador-analiticas.model';

@Injectable({
  providedIn: 'root',
})
export class AdministradorAnaliticasService {
  private readonly http = inject(HttpClient);
  private readonly db = inject(IndexedDbService);
  private readonly analyticsUrl = API_ENDPOINTS.analytics;

  // ===== MÉTODOS OFFLINE EXPLÍCITOS =====

  async getAnaliticaOffline(): Promise<any> {
    const data = await this.db.get<any>('analiticaSistema', 'dashboard');
    if (!data) throw new Error('No hay analíticas guardadas en caché');
    return data;
  }

  async getAuditoriaSistemaOffline(): Promise<SystemAuditResponse[]> {
    const data = await this.db.get<any>('auditoriaSistema', 'general');
    return data?.logs || [];
  }

  // =======================================

  getDashboardSummary(): Observable<AdministradorAnaliticasDashboardSummary> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getAnaliticaOffline().then(d => d.summary));
    }
    return this.http.get<AdministradorAnaliticasDashboardSummary>(
      `${this.analyticsUrl}/dashboard-summary`
    ).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getAnaliticaOffline().then(d => d.summary));
        return throwError(() => err);
      })
    );
  }

  getBottlenecks(): Observable<BottlenecksResponse> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getAnaliticaOffline().then(d => d.bottlenecks));
    }
    return this.http.get<BottlenecksResponse>(`${this.analyticsUrl}/bottlenecks`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getAnaliticaOffline().then(d => d.bottlenecks));
        return throwError(() => err);
      })
    );
  }

  getTaskRecommendations(): Observable<TaskRedistributionResponse> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getAnaliticaOffline().then(d => d.redistribution));
    }
    return this.http.get<TaskRedistributionResponse>(`${this.analyticsUrl}/task-redistribution`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getAnaliticaOffline().then(d => d.redistribution));
        return throwError(() => err);
      })
    );
  }

  getSystemAuditLogs(): Observable<SystemAuditResponse[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return from(this.getAuditoriaSistemaOffline());
    }
    return this.http.get<SystemAuditResponse[]>(`${this.analyticsUrl}/system-audit`).pipe(
      catchError((err) => {
        if (err.status === 0) return from(this.getAuditoriaSistemaOffline());
        return throwError(() => err);
      })
    );
  }

  logSystemAudit(accion: string, detalle: string): Observable<any> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('No se puede registrar auditoría del sistema estando offline');
      return of(null);
    }
    const body = { accion, detalle };
    return this.http.post(`${this.analyticsUrl}/system-audit`, body).pipe(
      catchError((err) => {
        console.error('Error al registrar auditoría del sistema:', err);
        return of(null);
      })
    );
  }
}
