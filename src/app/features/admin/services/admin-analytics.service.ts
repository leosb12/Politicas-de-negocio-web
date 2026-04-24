import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  AdminAnalyticsDashboardSummary,
  BottlenecksResponse,
  TaskRedistributionResponse,
} from '../models/admin-analytics.model';

@Injectable({
  providedIn: 'root',
})
export class AdminAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly analyticsUrl = API_ENDPOINTS.analytics;

  getDashboardSummary(): Observable<AdminAnalyticsDashboardSummary> {
    return this.http.get<AdminAnalyticsDashboardSummary>(
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
