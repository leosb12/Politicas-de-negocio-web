import {
  Component,
  EventEmitter,
  Output,
  Input,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../../../shared/services/toast.service';
import { IaWorkflowService } from '../../services/ia-workflow.service';
import { IaWorkflowMapperService } from '../../services/ia-workflow-mapper.service';
import {
  IaWorkflowResponse,
  IaGenerationState,
  IaWorkflowRequestContext,
} from '../../models/ia-workflow.model';
import { Nodo, Conexion } from '../../models/politica.model';
import { AdminDepartment } from '../../models/admin-department.model';

/**
 * Componente para generar workflows automáticamente usando IA
 * Consume el microservicio POST /api/ia/texto-a-flujo
 */
@Component({
  selector: 'app-ia-workflow-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './ia-workflow-generator.html',
  styleUrl: './ia-workflow-generator.css',
})
export class IaWorkflowGeneratorComponent {
  @Input() isOpen = signal(false);
  @Input() departamentos: AdminDepartment[] = [];
  @Output() workflowGenerated = new EventEmitter<{
    nodos: Nodo[];
    conexiones: Conexion[];
    analysis: IaWorkflowResponse['analysis'];
    iaResponse: IaWorkflowResponse;
  }>();
  @Output() closeRequested = new EventEmitter<void>();

  private readonly iaService = inject(IaWorkflowService);
  private readonly mapperService = inject(IaWorkflowMapperService);
  private readonly toast = inject(ToastService);

  // Estado del componente
  descripcion = signal('');
  generationState = signal<IaGenerationState>({
    isLoading: false,
    error: null,
    data: null,
  });
  showPreview = signal(false);
  recognition: any;
  isListening = false;

  /**
   * Genera el workflow llamando al microservicio de IA
   */
  generarWorkflow(): void {
    const desc = this.descripcion().trim();

    // Validaciones
    if (!desc) {
      this.toast.info(
        'Descripción vacía',
        'Por favor escribe una descripción del flujo'
      );
      return;
    }

    if (desc.length < 10) {
      this.toast.info(
        'Descripción muy corta',
        'Por favor proporciona más detalles (mínimo 10 caracteres)'
      );
      return;
    }

    // Inicia carga
    this.generationState.update((state) => ({
      ...state,
      isLoading: true,
      error: null,
    }));

    // Llama al microservicio
    const context: IaWorkflowRequestContext = {
      departamentos: this.departamentos.map((departamento) => ({
        id: departamento.id,
        nombre: departamento.nombre,
      })),
    };

    this.iaService.generarWorkflowDesdeTexto(desc, context).subscribe({
      next: (response) => {
        this.handleGenerationSuccess(response);
      },
      error: (error) => {
        this.handleGenerationError(error);
      },
    });
  }

  /**
   * Maneja la respuesta exitosa del microservicio
   */
  private handleGenerationSuccess(response: IaWorkflowResponse): void {
    try {
      // Valida que la respuesta no esté vacía
      if (
        !response.nodes ||
        response.nodes.length === 0 ||
        !response.transitions
      ) {
        this.toast.error(
          'Respuesta inválida',
          'El microservicio no retornó un flujo válido'
        );
        this.generationState.update((state) => ({
          ...state,
          isLoading: false,
          error: 'La respuesta del microservicio no contiene un flujo válido',
        }));
        return;
      }

      // Mapea la respuesta
      const { nodos, conexiones } = this.mapperService.mapIaResponseToWorkflow(
        response
      );

      // Guarda el estado
      this.generationState.update((state) => ({
        ...state,
        isLoading: false,
        data: response,
        error: null,
      }));

      // Muestra el preview
      this.showPreview.set(true);

      this.toast.success(
        'Workflow generado',
        `Se generaron ${nodos.length} nodos y ${conexiones.length} conexiones`
      );
    } catch (error) {
      this.toast.error(
        'Error al procesar',
        'Hubo un error al procesar la respuesta del microservicio'
      );
      this.generationState.update((state) => ({
        ...state,
        isLoading: false,
        error: 'Error al procesar la respuesta',
      }));
    }
  }

  /**
   * Maneja errores en la llamada al microservicio
   */
  private handleGenerationError(error: any): void {
    console.error('Error generando workflow:', error);

    let errorMessage =
      'Error al generar el workflow. Intenta nuevamente.';

    if (error.status === 0) {
      errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
    } else if (error.status === 400) {
      errorMessage =
        'La descripción no es válida. Intenta con más detalles.';
    } else if (error.status === 500) {
      errorMessage = 'Error en el servidor. Intenta más tarde.';
    } else if (error.status === 503) {
      errorMessage = 'El servicio de IA no está disponible en este momento.';
    }

    this.generationState.update((state) => ({
      ...state,
      isLoading: false,
      error: errorMessage,
    }));

    this.toast.error('Error', errorMessage);
  }

  /**
   * Acepta el workflow generado y lo emite al componente padre
   */
  aceptarWorkflow(): void {
    const data = this.generationState().data;
    if (!data) return;

    try {
      const { nodos, conexiones } = this.mapperService.mapIaResponseToWorkflow(
        data
      );

      this.workflowGenerated.emit({
        nodos,
        conexiones,
        analysis: data.analysis,
        iaResponse: data,
      });

      this.cerrar();
      this.toast.success(
        'Workflow aplicado',
        'El workflow generado ha sido aplicado al canvas'
      );
    } catch (error) {
      this.toast.error(
        'Error',
        'No se pudo aplicar el workflow al canvas'
      );
    }
  }

  /**
   * Rechaza el workflow y vuelve a la descripción
   */
  rechazarWorkflow(): void {
    this.showPreview.set(false);
    this.generationState.update((state) => ({
      ...state,
      data: null,
    }));
  }

  /**
   * Cierra el modal
   */
  cerrar(): void {
    this.descripcion.set('');
    this.showPreview.set(false);
    this.generationState.set({
      isLoading: false,
      error: null,
      data: null,
    });
    this.closeRequested.emit();
  }

    initMic() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta voz');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let textoFinal = this.descripcion(); // 🔥 lo que ya había

for (let i = event.resultIndex; i < event.results.length; i++) {
  if (event.results[i].isFinal) {
    textoFinal += ' ' + event.results[i][0].transcript;
  }
}

this.descripcion.set(textoFinal.trim());
    };
  }

  toggleMic() {
    if (!this.recognition) this.initMic();

    if (this.isListening) {
      this.stopMic();
    } else {
      this.recognition.start();
      this.isListening = true;
    }
  }

  stopMic() {
    if (this.recognition) {
      this.recognition.stop();
    }
    this.isListening = false;
  }

  /**
   * Calcula estadísticas del workflow generado
   */
  getWorkflowStats() {
    const data = this.generationState().data;
    if (!data) return null;

    return {
      nodeCount: data.nodes?.length || 0,
      transitionCount: data.transitions?.length || 0,
      roleCount: data.roles?.length || 0,
      formCount: data.forms?.length || 0,
      ruleCount: data.businessRules?.length || 0,
    };
  }
}
