import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  EmployeeGuideRequest,
  EmployeeGuideResponse,
} from '../models/employee-guide.model';

@Injectable({ providedIn: 'root' })
export class EmployeeGuideService {
  private readonly http = inject(HttpClient);
  private readonly url = API_ENDPOINTS.guideEmployee;

  ask(request: EmployeeGuideRequest): Observable<EmployeeGuideResponse> {
    return this.http.post<EmployeeGuideResponse>(this.url, request);
  }
}
