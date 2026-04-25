import { Injectable, signal } from '@angular/core';
import {
  FuncionarioGuiaRequest,
  FuncionarioGuiaScreen,
} from '../models/funcionario-guia.model';

@Injectable({ providedIn: 'root' })
export class FuncionarioGuiaContextService {
  readonly screen = signal<FuncionarioGuiaScreen>('EMPLOYEE_DASHBOARD');
  readonly taskId = signal<string | null>(null);
  readonly instanceId = signal<string | null>(null);
  readonly availableActions = signal<string[]>([]);

  setScreen(screen: FuncionarioGuiaScreen): void {
    this.screen.set(screen);
  }

  updateContext(payload: {
    screen?: FuncionarioGuiaScreen;
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

  clearContext(screen: FuncionarioGuiaScreen = 'EMPLOYEE_DASHBOARD'): void {
    this.screen.set(screen);
    this.taskId.set(null);
    this.instanceId.set(null);
    this.availableActions.set([]);
  }

  buildRequest(question: string): FuncionarioGuiaRequest {
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
