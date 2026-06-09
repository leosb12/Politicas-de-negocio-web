import { Injectable, signal } from '@angular/core';
import { AdministradorGuiaRequest, AdministradorGuiaScreen } from '../models/administrador-guia.model';

@Injectable({ providedIn: 'root' })
export class AdministradorGuiaContextService {
  readonly screen = signal<AdministradorGuiaScreen>('GENERAL_ADMIN');
  readonly policyId = signal<string | null>(null);
  readonly selectedNodeId = signal<string | null>(null);
  readonly availableActions = signal<string[]>([]);

  // Señales para contexto extendido de reportes
  readonly currentPath = signal<string | null>(null);
  readonly visibleButtons = signal<string[]>([]);
  readonly currentModule = signal<string | null>(null);
  readonly exportFormatsAvailable = signal<string[]>([]);

  setScreen(screen: AdministradorGuiaScreen): void {
    this.screen.set(screen);
  }

  updateDesignerContext(payload: {
    policyId: string | null;
    selectedNodeId: string | null;
    availableActions: string[];
  }): void {
    this.policyId.set(payload.policyId);
    this.selectedNodeId.set(payload.selectedNodeId);
    this.availableActions.set(this.unique(payload.availableActions));
  }

  clearDesignerContext(): void {
    this.policyId.set(null);
    this.selectedNodeId.set(null);
    this.availableActions.set([]);
    this.currentPath.set(null);
    this.visibleButtons.set([]);
    this.currentModule.set(null);
    this.exportFormatsAvailable.set([]);
  }

  buildRequest(question: string): AdministradorGuiaRequest {
    return {
      screen: this.screen(),
      question,
      context: {
        policyId: this.policyId(),
        selectedNodeId: this.selectedNodeId(),
        availableActions: this.availableActions(),
        currentPath: this.currentPath(),
        role: 'ADMIN',
        screenName: this.screen(),
        visibleButtons: this.visibleButtons(),
        currentModule: this.currentModule(),
        exportFormatsAvailable: this.exportFormatsAvailable(),
      },
    };
  }

  private unique(values: string[]): string[] {
    return [...new Set((values ?? []).filter(Boolean))];
  }
}

