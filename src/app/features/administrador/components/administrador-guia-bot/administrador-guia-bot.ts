import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/services/auth.service';
import {
  AdministradorGuiaResponse,
  AdministradorGuiaScreen,
} from '../../models/administrador-guia.model';
import { AdministradorGuiaContextService } from '../../services/administrador-guia-context.service';
import { AdministradorGuiaService } from '../../services/administrador-guia.service';
import {
  FuncionarioGuiaResponse,
  FuncionarioGuiaScreen,
} from '../../../funcionario-flujo/models/funcionario-guia.model';
import { FuncionarioGuiaContextService } from '../../../funcionario-flujo/services/funcionario-guia-context.service';
import { FuncionarioGuiaService } from '../../../funcionario-flujo/services/funcionario-guia.service';

type GuideBotRole = 'ADMIN' | 'FUNCIONARIO';
type GuideBotSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
type GuideBotResponse = AdministradorGuiaResponse | FuncionarioGuiaResponse;

interface GuideChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  response?: GuideBotResponse;
}

@Component({
  selector: 'app-administrador-guia-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './administrador-guia-bot.html',
  styleUrl: './administrador-guia-bot.css',
})
export class AdministradorGuiaBotComponent {
  @ViewChild('messagesContainer')
  private readonly messagesContainer?: ElementRef<HTMLDivElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly adminGuideContext = inject(AdministradorGuiaContextService);
  private readonly adminGuideService = inject(AdministradorGuiaService);
  private readonly employeeGuideContext = inject(FuncionarioGuiaContextService);
  private readonly employeeGuideService = inject(FuncionarioGuiaService);

  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly isListening = signal(false);
  readonly voiceSupported = signal(false);
  readonly draft = signal('');
  readonly messages = signal<GuideChatMessage[]>([]);
  readonly role = computed<GuideBotRole | null>(() => {
    const role = this.authService.session()?.rol?.trim().toUpperCase();
    if (role === 'ADMIN' || role === 'FUNCIONARIO') {
      return role;
    }
    return null;
  });
  readonly shouldShow = computed(() => this.role() !== null);

  private recognition: any = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopVoiceInput());
    afterNextRender(() => this.refreshVoiceSupport());

    effect(() => {
      const role = this.role();
      this.messages.set([]);
      this.draft.set('');
      this.stopVoiceInput();
      this.isOpen.set(false);
      this.syncScreenFromRoute(this.router.url, role);
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.syncScreenFromRoute(event.urlAfterRedirects, this.role());
      });
  }

  toggle(): void {
    if (!this.shouldShow()) {
      return;
    }

    if (this.isOpen()) {
      this.close();
      return;
    }

    this.refreshVoiceSupport();
    this.isOpen.set(true);
    this.scrollToBottomSoon();
  }

  close(): void {
    this.stopVoiceInput();
    this.isOpen.set(false);
  }

  sendDraft(): void {
    const question = this.draft().trim();
    if (!question || this.isLoading()) {
      return;
    }

    this.ask(question);
  }

  handleComposerEnter(event: KeyboardEvent): void {
    if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.sendDraft();
  }

  toggleVoiceInput(): void {
    this.refreshVoiceSupport();

    if (!this.voiceSupported()) {
      return;
    }

    if (!this.recognition) {
      this.initVoiceRecognition();
    }

    if (this.isListening()) {
      this.stopVoiceInput();
      return;
    }

    this.recognition.start();
    this.isListening.set(true);
  }

  ask(question: string): void {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || !this.role()) {
      return;
    }

    this.isOpen.set(true);
    this.isLoading.set(true);
    this.draft.set('');

    this.pushMessage({
      id: this.nextId(),
      sender: 'user',
      text: normalizedQuestion,
    });

    const request$: Observable<GuideBotResponse> =
      this.role() === 'FUNCIONARIO'
        ? this.employeeGuideService.ask(
            this.employeeGuideContext.buildRequest(normalizedQuestion)
          )
        : this.adminGuideService.ask(
            this.adminGuideContext.buildRequest(normalizedQuestion)
          );

    request$.subscribe({
      next: (response: GuideBotResponse) => {
        this.isLoading.set(false);
        this.pushMessage({
          id: this.nextId(),
          sender: 'assistant',
          response,
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.pushMessage({
          id: this.nextId(),
          sender: 'assistant',
          response: this.buildEmergencyFallback(normalizedQuestion),
        });
      },
    });
  }

  quickPrompts(): string[] {
    if (this.role() === 'FUNCIONARIO') {
      return this.employeeQuickPrompts();
    }

    const screen = this.adminGuideContext.screen();
    if (screen === 'POLICY_DESIGNER') {
      return [
        'Que hago aqui?',
        'Que me falta?',
        'Sugerime formulario',
        'Que responsable le pongo?',
        'Puedo activar esta politica?',
      ];
    }

    if (screen === 'POLICY_LIST') {
      return [
        'Que puedo hacer aqui?',
        'Como creo una politica?',
        'Como activo una politica?',
      ];
    }

    return ['Que puedo hacer aqui?', 'En que me puedes ayudar?'];
  }

  severityClass(severity: GuideBotSeverity | undefined): string {
    if (severity === 'SUCCESS') return 'success';
    if (severity === 'ERROR') return 'error';
    if (severity === 'WARNING') return 'warning';
    return 'info';
  }

  panelDescription(): string {
    if (this.role() === 'FUNCIONARIO') {
      return 'Responde segun tu pantalla actual y, si aplica, tambien segun la tarea, el formulario y el flujo del tramite.';
    }
    return 'Responde segun la pantalla actual y, si aplica, tambien segun la politica y el nodo.';
  }

  emptyStateText(): string {
    if (this.role() === 'FUNCIONARIO') {
      return 'Preguntame que debes hacer, que tarea conviene atender primero, que campo falta o que pasa despues de finalizar.';
    }
    return 'Preguntame que hacer aqui, que falta en la politica o que responsable conviene para una actividad.';
  }

  composerPlaceholder(): string {
    if (this.role() === 'FUNCIONARIO') {
      return 'Ej: Que hago aqui? - Que me falta para finalizar? - Que pasa despues?';
    }
    return 'Ej: Que me falta? - Sugerime formulario - Puedo activar esta politica?';
  }

  loadingText(): string {
    if (this.role() === 'FUNCIONARIO') {
      return 'Analizando tu tarea y el contexto actual...';
    }
    return 'Analizando tu contexto actual...';
  }

  adminResponse(message: GuideChatMessage): AdministradorGuiaResponse | null {
    const response = message.response;
    if (!response || !('detectedIssues' in response) || !('suggestedForm' in response)) {
      return null;
    }
    return response as AdministradorGuiaResponse;
  }

  employeeResponse(message: GuideChatMessage): FuncionarioGuiaResponse | null {
    const response = message.response;
    if (!response || !('formHelp' in response) || !('missingFields' in response)) {
      return null;
    }
    return response as FuncionarioGuiaResponse;
  }

  private employeeQuickPrompts(): string[] {
    const screen = this.employeeGuideContext.screen();
    if (screen === 'EMPLOYEE_DASHBOARD') {
      return [
        'Que hago aqui?',
        'Que tarea atiendo primero?',
        'Tengo tareas atrasadas?',
      ];
    }
    if (screen === 'TASK_FORM') {
      return [
        'Que debo hacer?',
        'Que lleno aqui?',
        'Que me falta para finalizar?',
        'Que pasa despues?',
      ];
    }
    if (screen === 'TASK_HISTORY') {
      return [
        'En que etapa esta el tramite?',
        'Que falta del tramite?',
        'Que pasa despues?',
      ];
    }
    return [
      'Que debo hacer?',
      'Por que no puedo finalizar?',
      'Que pasa despues?',
    ];
  }

  private pushMessage(message: GuideChatMessage): void {
    this.messages.update((items) => [...items, message]);
    this.scrollToBottomSoon();
  }

  private scrollToBottomSoon(): void {
    queueMicrotask(() => {
      const container = this.messagesContainer?.nativeElement;
      if (!container) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    });
  }

  private syncScreenFromRoute(
    url: string,
    role: GuideBotRole | null = this.role()
  ): void {
    if (role === 'FUNCIONARIO') {
      this.employeeGuideContext.setScreen(this.mapUrlToEmployeeScreen(url));
      return;
    }

    if (role === 'ADMIN') {
      this.adminGuideContext.setScreen(this.mapUrlToAdminScreen(url));
    }
  }

  private initVoiceRecognition(): void {
    const SpeechRecognition = this.getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let transcript = '';

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        transcript += ` ${event.results[index][0].transcript}`;
      }

      this.draft.set(transcript.trim());
    };

    this.recognition.onerror = () => {
      this.isListening.set(false);
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
    };
  }

  private stopVoiceInput(): void {
    if (!this.recognition) {
      return;
    }

    this.recognition.stop();
    this.isListening.set(false);
  }

  private refreshVoiceSupport(): void {
    this.voiceSupported.set(Boolean(this.getSpeechRecognitionConstructor()));
  }

  private getSpeechRecognitionConstructor(): any {
    if (typeof window === 'undefined') {
      return null;
    }

    return (
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null
    );
  }

  private mapUrlToAdminScreen(url: string): AdministradorGuiaScreen {
    if (url.includes('/admin/politicas/') && url.includes('/canvas')) {
      return 'POLICY_DESIGNER';
    }
    if (url.includes('/admin/politicas')) {
      return 'POLICY_LIST';
    }
    if (url.includes('/admin/usuarios')) {
      return 'ADMIN_USERS';
    }
    if (url.includes('/admin/roles')) {
      return 'ADMIN_ROLES';
    }
    if (url.includes('/admin/departamentos')) {
      return 'ADMIN_DEPARTMENTS';
    }
    if (
      url.includes('/admin/analytics') ||
      url.includes('/admin/analisis-ia')
    ) {
      return 'ADMIN_ANALYTICS';
    }
    if (url.includes('/admin/servicios-ia')) {
      return 'ADMIN_AI_SERVICES';
    }
    if (
      url.includes('/admin/simulations') ||
      url.includes('/admin/policies/simulate') ||
      url.includes('/admin/policies/compare')
    ) {
      return 'ADMIN_SIMULATIONS';
    }
    return 'GENERAL_ADMIN';
  }

  private mapUrlToEmployeeScreen(url: string): FuncionarioGuiaScreen {
    if (url.includes('/funcionario/instancias/')) {
      return 'TASK_HISTORY';
    }
    if (url.includes('/funcionario/tareas/')) {
      return 'TASK_DETAIL';
    }
    return 'EMPLOYEE_DASHBOARD';
  }

  private buildEmergencyFallback(question: string): GuideBotResponse {
    return this.role() === 'FUNCIONARIO'
      ? this.buildEmployeeEmergencyFallback(question)
      : this.buildAdminEmergencyFallback(question);
  }

  private buildAdminEmergencyFallback(question: string): AdministradorGuiaResponse {
    const screen = this.adminGuideContext.screen();
    const normalized = question.toLowerCase();

    if (screen === 'POLICY_DESIGNER' && normalized.includes('activar')) {
      return {
        answer:
          'No pude consultar el servicio guia en este momento, pero en el disenador debes revisar inicio, fin, responsables, formularios y conexiones antes de activar.',
        steps: [
          'Confirma nodo de inicio y nodo final.',
          'Revisa responsables y formularios pendientes.',
          'Guarda la politica e intenta activar nuevamente.',
        ],
        suggestedForm: [],
        detectedIssues: [],
        suggestedActions: [{ action: 'SAVE_POLICY', label: 'Guardar politica' }],
        severity: 'WARNING',
        source: 'FRONTEND_FALLBACK',
      };
    }

    if (screen === 'POLICY_DESIGNER') {
      return {
        answer:
          'Estas en el disenador de politicas. Aqui puedes construir el flujo, configurar responsables, formularios y conexiones.',
        steps: [
          'Agrega o revisa nodos clave.',
          'Configura responsables y formularios.',
          'Valida el flujo antes de activar.',
        ],
        suggestedForm: [],
        detectedIssues: [],
        suggestedActions: [],
        severity: 'INFO',
        source: 'FRONTEND_FALLBACK',
      };
    }

    return {
      answer:
        'Puedo orientarte segun la pantalla actual. Si entras al disenador de politicas te doy ayuda mas contextual sobre nodos, formularios y activacion.',
      steps: ['Abre una politica', 'Entra al disenador', 'Pregunta de nuevo'],
      suggestedForm: [],
      detectedIssues: [],
      suggestedActions: [],
      severity: 'INFO',
      source: 'FRONTEND_FALLBACK',
    };
  }

  private buildEmployeeEmergencyFallback(
    question: string
  ): FuncionarioGuiaResponse {
    const screen = this.employeeGuideContext.screen();
    const normalized = question.toLowerCase();

    if (screen === 'TASK_FORM' && normalized.includes('falta')) {
      return {
        answer:
          'No pude consultar la guia en este momento, pero antes de finalizar revisa los campos obligatorios del formulario y confirma que la tarea ya este tomada o en proceso.',
        steps: [
          'Completa los campos obligatorios.',
          'Revisa observaciones y evidencia si corresponde.',
          'Vuelve a intentar finalizar la tarea.',
        ],
        formHelp: [],
        missingFields: [],
        suggestedActions: [
          { action: 'SAVE_FORM', label: 'Guardar avance' },
          { action: 'COMPLETE_TASK', label: 'Finalizar tarea' },
        ],
        severity: 'WARNING',
        source: 'FRONTEND_FALLBACK',
      };
    }

    if (screen === 'EMPLOYEE_DASHBOARD') {
      return {
        answer:
          'Estas en tu bandeja de trabajo. Aqui puedes revisar tareas pendientes, en proceso y completadas para decidir cual atender primero.',
        steps: [
          'Revisa tareas atrasadas o con prioridad alta.',
          'Abre una tarea para ver su detalle.',
          'Completa una tarea antes de saltar a otra si ya esta en proceso.',
        ],
        formHelp: [],
        missingFields: [],
        suggestedActions: [{ action: 'START_TASK', label: 'Tomar o iniciar tarea' }],
        severity: 'INFO',
        source: 'FRONTEND_FALLBACK',
      };
    }

    if (screen === 'TASK_HISTORY') {
      return {
        answer:
          'Estas viendo el seguimiento del tramite. Aqui puedes revisar en que etapa va, que pasos ya se completaron y que falta para avanzar.',
        steps: [
          'Revisa la etapa actual.',
          'Identifica los pasos ya completados.',
          'Confirma el siguiente paso del flujo.',
        ],
        formHelp: [],
        missingFields: [],
        suggestedActions: [],
        severity: 'INFO',
        source: 'FRONTEND_FALLBACK',
      };
    }

    return {
      answer:
        'Puedo orientarte segun la tarea actual, el formulario y el flujo del tramite. Abre una tarea o formulario para recibir ayuda mas contextual.',
      steps: [
        'Abre la tarea que estas atendiendo.',
        'Revisa el formulario y su estado.',
        'Pregunta de nuevo que debes hacer o que te falta.',
      ],
      formHelp: [],
      missingFields: [],
      suggestedActions: [],
      severity: 'INFO',
      source: 'FRONTEND_FALLBACK',
    };
  }

  private nextId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
