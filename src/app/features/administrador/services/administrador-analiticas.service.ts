import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  AdministradorAnaliticasDashboardSummary,
  BottlenecksResponse,
  TaskRedistributionResponse,
} from '../models/administrador-analiticas.model';

@Injectable({
  providedIn: 'root',
})
export class AdministradorAnaliticasService {
  private readonly http = inject(HttpClient);
  private readonly analyticsUrl = API_ENDPOINTS.analytics;

  getDashboardSummary(): Observable<AdministradorAnaliticasDashboardSummary> {
    return this.http.get<AdministradorAnaliticasDashboardSummary>(
      `${this.analyticsUrl}/dashboard-summary`
    );
  }

  getBottlenecks(): Observable<BottlenecksResponse> {
    return this.http.get<BottlenecksResponse>(`${this.analyticsUrl}/bottlenecks`);
  }

  getTaskRecommendations(): Observable<TaskRedistributionResponse> {
    return this.http.get<TaskRedistributionResponse>(`${this.analyticsUrl}/task-redistribution`);
  }
}
