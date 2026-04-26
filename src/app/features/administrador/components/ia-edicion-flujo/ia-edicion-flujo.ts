import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { ToastService } from '../../../../shared/services/toast.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import {
  IaWorkflowEditApplyResponse,
  IaWorkflowEditOperation,
  IaWorkflowEditPreviewResponse,
} from '../../models/ia-edicion-flujo.model';
import { IaEdicionFlujoService } from '../../services/ia-edicion-flujo.service';

type PreviewTone = 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-ia-edicion-flujo',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AppAlertComponent,
  ],
  templateUrl: './ia-edicion-flujo.html',
  styleUrl: './ia-edicion-flujo.css',
})
export class IaEdicionFlujoComponent {
  readonly policyId = input<string | null>(null);
  readonly policyName = input<string | null>(null);
  readonly workflowApplied = output<IaWorkflowEditApplyResponse>();

  private readonly iaEdicionFlujoService = inject(IaEdicionFlujoService);
  private readonly toast = inject(ToastService);

  readonly prompt = signal('');
  readonly expanded = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewResponse = signal<IaWorkflowEditPreviewResponse | null>(null);
  readonly applyLoading = signal(false);
  readonly applyError = signal<string | null>(null);
  readonly applyResultMessage = signal<string | null>(null);
  readonly confirmationAccepted = signal(false);

  readonly hasPreview = computed(() => !!this.previewResponse());
  readonly previewTone = computed<PreviewTone>(() => {
    const preview = this.previewResponse();
    if (!preview) {
      return 'info';
    }

    if (!preview.valid || preview.errors.length) {
      return 'danger';
    }

    if (preview.warnings.length) {
      return 'warning';
    }

    return 'success';
  });
  readonly previewTitle = computed(() => {
    const preview = this.previewResponse();
    if (!preview) {
      return 'Aun no hay previsualizacion';
    }

    if (!preview.valid || preview.errors.length) {
      return 'Propuesta invalida';
    }

    if (preview.warnings.length) {
      return 'Propuesta valida con advertencias';
    }

    return 'Propuesta valida';
  });
  readonly previewMessage = computed(() => {
    const preview = this.previewResponse();
    if (!preview) {
      return 'La IA analizara el workflow actual y devolvera un resumen antes de cualquier aplicacion manual.';
    }

    if (!preview.valid || preview.errors.length) {
      return 'Revisa los errores antes de intentar usar esta propuesta.';
    }

    if (preview.requiresConfirmation) {
      return 'Esta propuesta requiere una confirmacion explicita antes de cualquier aplicacion.';
    }

    if (preview.warnings.length) {
      return 'La propuesta puede usarse, pero conviene revisar los warnings antes de continuar.';
    }

    return 'La propuesta quedo lista para revision manual.';
  });
  readonly canPreview = computed(
    () => !!this.policyId() && this.prompt().trim().length >= 3 && !this.previewLoading() && !this.applyLoading()
  );
  readonly compactStatus = computed(() => {
    if (this.previewLoading() || this.applyLoading()) {
      return 'Guardando...';
    }

    const preview = this.previewResponse();
    if (!preview) {
      return null;
    }

    return preview.valid && !preview.errors.length ? 'Guardado' : 'Error';
  });

  requestPreview(): void {
    const policyId = this.policyId();
    const prompt = this.prompt().trim();

    if (!policyId) {
      this.toast.error('Edicion IA', 'No se encontro la politica que quieres editar.');
      return;
    }

    if (prompt.length < 3) {
      this.toast.info(
        'Edicion IA',
        'Escribe una instruccion mas completa para generar una previsualizacion util.'
      );
      return;
    }

    this.previewLoading.set(true);
    this.applyLoading.set(true);
    this.previewError.set(null);
    this.previewResponse.set(null);
    this.applyError.set(null);
    this.applyResultMessage.set(null);
    this.confirmationAccepted.set(false);

    this.iaEdicionFlujoService.applyChanges(policyId, { prompt }).subscribe({
      next: (response) => {
        const message = response.message?.trim() || 'Cambios aplicados y guardados en la politica.';
        const operations = response.operations ?? [];
        this.previewResponse.set({
          policyId: response.policyId ?? policyId,
          policyName: response.policyName ?? this.policyName() ?? '',
          success: response.success ?? true,
          valid: true,
          intent: 'UPDATE_WORKFLOW',
          summary: message,
          operations,
          warnings: [],
          errors: [],
          requiresConfirmation: false,
          generatedAt: response.appliedAt ?? new Date().toISOString(),
        });
        this.applyResultMessage.set(message);
        this.previewLoading.set(false);
        this.applyLoading.set(false);
        this.prompt.set('');
        this.toast.success('Edicion IA', message);
        this.workflowApplied.emit(response);
      },
      error: (error: unknown) => {
        this.previewLoading.set(false);
        this.applyLoading.set(false);
        this.previewError.set(
          getApiErrorMessage(
            error,
            'No se pudieron aplicar los cambios del workflow.'
          )
        );
      },
    });
  }

  applyPreview(): void {
    const policyId = this.policyId();
    const preview = this.previewResponse();
    const prompt = this.prompt().trim();

    if (!policyId || !preview) {
      return;
    }

    if (preview.requiresConfirmation && !this.confirmationAccepted()) {
      this.toast.info(
        'Confirmacion requerida',
        'Confirma manualmente la propuesta antes de intentar aplicar cambios.'
      );
      return;
    }

    this.applyLoading.set(true);
    this.applyError.set(null);
    this.applyResultMessage.set(null);

    this.iaEdicionFlujoService
      .applyChanges(policyId, {
        prompt,
        operations: preview.operations,
      })
      .subscribe({
        next: (response) => {
          this.handleApplySuccess(response);
        },
        error: (error: unknown) => {
          this.handleApplyError(error);
        },
      });
  }

  onPromptChange(value: string): void {
    this.prompt.set(value);
  }

  handlePromptKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (this.canPreview()) {
      this.requestPreview();
    }
  }

  setConfirmationAccepted(accepted: boolean): void {
    this.confirmationAccepted.set(accepted);
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  trackOperation(index: number, operation: IaWorkflowEditOperation): string {
    return `${operation.type}-${operation.fromNodeName ?? ''}-${operation.toNodeName ?? ''}-${index}`;
  }

  formatOperationTitle(operation: IaWorkflowEditOperation): string {
    return operation.type
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  buildOperationSummary(operation: IaWorkflowEditOperation): string {
    const segments = [
      operation.summary,
      this.buildOperationFallbackSummary(operation),
      operation.condition,
      operation.details,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return segments[0] ?? 'La IA propuso una modificacion sobre el workflow.';
  }

  private buildOperationFallbackSummary(operation: IaWorkflowEditOperation): string | null {
    switch (operation.type) {
      case 'ADD_NODE':
        return operation.nodeName ? `Nuevo nodo: ${operation.nodeName}` : null;
      case 'DELETE_NODE':
        return operation.nodeName ? `Eliminar nodo: ${operation.nodeName}` : null;
      case 'RENAME_NODE':
        return operation.nodeName && operation['newName']
          ? `Renombrar ${operation.nodeName} a ${operation['newName']}`
          : operation.nodeName ?? null;
      case 'DELETE_TRANSITION':
        return operation.fromNodeName && operation.toNodeName
          ? `Eliminar transicion: ${operation.fromNodeName} -> ${operation.toNodeName}`
          : operation.fromNodeName ?? operation.toNodeName ?? null;
      case 'ADD_TRANSITION':
      case 'CREATE_LOOP':
      case 'UPDATE_TRANSITION':
        return operation.fromNodeName && operation.toNodeName
          ? `${operation.fromNodeName} -> ${operation.toNodeName}`
          : operation.fromNodeName ?? operation.toNodeName ?? null;
      default:
        return operation.nodeName
          ?? (operation.fromNodeName && operation.toNodeName
            ? `${operation.fromNodeName} -> ${operation.toNodeName}`
            : operation.fromNodeName ?? operation.toNodeName ?? null);
    }
  }

  private handleApplySuccess(response: IaWorkflowEditApplyResponse): void {
    this.applyLoading.set(false);
    const message =
      response.message?.trim() || 'La aplicacion de cambios quedo lista para futuras iteraciones.';
    this.applyResultMessage.set(message);
    this.toast.success('Edicion IA', message);
  }

  private handleApplyError(error: unknown): void {
    this.applyLoading.set(false);

    if (error instanceof HttpErrorResponse && error.status === 501) {
      const upcomingMessage =
        'La aplicacion automatica aun no esta disponible en backend. Por ahora solo puedes previsualizar la propuesta.';
      this.applyResultMessage.set(upcomingMessage);
      this.toast.info('Proximamente', upcomingMessage);
      return;
    }

    this.applyError.set(
      getApiErrorMessage(error, 'No se pudieron aplicar los cambios sugeridos por la IA.')
    );
  }

  private resetState(): void {
    this.prompt.set('');
    this.previewLoading.set(false);
    this.previewError.set(null);
    this.previewResponse.set(null);
    this.applyLoading.set(false);
    this.applyError.set(null);
    this.applyResultMessage.set(null);
    this.confirmationAccepted.set(false);
  }
}
