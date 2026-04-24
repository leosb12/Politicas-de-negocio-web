import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  PolicyComparisonApiResponse,
  PolicyComparisonRequest,
  SimulationRunApiResponse,
  SimulationRunRequest,
} from '../models/simulation.model';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  private readonly http = inject(HttpClient);
  private readonly simulationsUrl = API_ENDPOINTS.simulations;

  runPolicySimulation(
    policyId: string,
    request: SimulationRunRequest
  ): Observable<SimulationRunApiResponse> {
    return this.http.post<SimulationRunApiResponse>(
      `${this.simulationsUrl}/policies/${policyId}/run`,
      request
    );
  }

  getSimulationById(simulationId: string): Observable<SimulationRunApiResponse> {
    return this.http.get<SimulationRunApiResponse>(
      `${this.simulationsUrl}/${simulationId}`
    );
  }

  getPolicySimulations(policyId: string): Observable<SimulationRunApiResponse[]> {
    return this.http.get<SimulationRunApiResponse[]>(
      `${this.simulationsUrl}/policies/${policyId}`
    );
  }

  comparePolicies(
    request: PolicyComparisonRequest
  ): Observable<PolicyComparisonApiResponse> {
    return this.http.post<PolicyComparisonApiResponse>(
      `${this.simulationsUrl}/compare`,
      request
    );
  }
}
