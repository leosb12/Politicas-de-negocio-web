import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import { AdminGuideRequest, AdminGuideResponse } from '../models/admin-guide.model';

@Injectable({ providedIn: 'root' })
export class AdminGuideService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.guideAdmin;

  ask(request: AdminGuideRequest): Observable<AdminGuideResponse> {
    return this.http.post<AdminGuideResponse>(this.url, request);
  }
}
