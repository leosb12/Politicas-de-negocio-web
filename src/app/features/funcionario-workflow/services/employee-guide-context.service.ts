import { Injectable, signal } from '@angular/core';
import {
  EmployeeGuideRequest,
  EmployeeGuideScreen,
} from '../models/employee-guide.model';

@Injectable({ providedIn: 'root' })
export class EmployeeGuideContextService {
  readonly screen = signal<EmployeeGuideScreen>('EMPLOYEE_DASHBOARD');
  readonly taskId = signal<string | null>(null);
  readonly instanceId = signal<string | null>(null);
  readonly availableActions = signal<string[]>([]);

  setScreen(screen: EmployeeGuideScreen): void {
    this.screen.set(screen);
  }

  updateContext(payload: {
    screen?: EmployeeGuideScreen;
    taskId?: string | null;
    instanceId?: string | null;
    availableActions?: string[];
  }): void {
    if (payload.screen) {
      this.screen.set(payload.screen);
    }
    this.taskId.set(payload.taskId ?? null);
    this.instanceId.set(payload.instanceId ?? null);
    this.availableActions.set(this.unique(payload.availableActions ?? []));
  }

  clearContext(screen: EmployeeGuideScreen = 'EMPLOYEE_DASHBOARD'): void {
    this.screen.set(screen);
    this.taskId.set(null);
    this.instanceId.set(null);
    this.availableActions.set([]);
  }

  buildRequest(question: string): EmployeeGuideRequest {
    return {
      screen: this.screen(),
      question,
      context: {
        taskId: this.taskId(),
        instanceId: this.instanceId(),
        availableActions: this.availableActions(),
      },
    };
  }

  private unique(values: string[]): string[] {
    return [...new Set((values ?? []).filter(Boolean))];
  }
}
