import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppCardComponent } from '../../../../shared/ui/card/card';
import { AppTextareaComponent } from '../../../../shared/ui/textarea/textarea';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  FormularioInteligenteChangeDto,
  FormularioInteligenteFieldSchema,
  FormularioInteligenteRequestContext,
  FormularioInteligenteResult,
  VoiceRecognitionState,
} from '../../models/formulario-inteligente.model';
import { FormularioInteligenteApiService } from '../../services/formulario-inteligente-api.service';
import { FormularioInteligenteVoiceService } from '../../services/formulario-inteligente-voice.service';

@Component({
  selector: 'app-formulario-inteligente',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppCardComponent,
    AppButtonComponent,
    AppTextareaComponent,
    AppAlertComponent,
    AppBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './formulario-inteligente.html',
  styleUrl: './formulario-inteligente.css',
})
export class FormularioInteligenteComponent {
  private readonly api = inject(FormularioInteligenteApiService);
  private readonly toast = inject(ToastService);
  private readonly voice = inject(FormularioInteligenteVoiceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activityId = input.required<string>();
  readonly activityName = input.required<string>();
  readonly policyName = input.required<string>();
  readonly formSchema = input<FormularioInteligenteFieldSchema[]>([]);
  readonly currentValues = input<Record<string, unknown>>({});
  readonly context = input<FormularioInteligenteRequestContext | null>(null);
  readonly disabled = input(false);

  readonly applied = output<FormularioInteligenteResult>();

  readonly promptControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1500)],
  });

  readonly loading = signal(false);
  readonly promptValue = signal('');
  readonly voiceState = signal<VoiceRecognitionState>(
    this.voice.getAvailability() === 'supported' ? 'idle' : 'unsupported'
  );
  readonly voiceMessage = signal<string | null>(
    this.voice.getAvailability() === 'supported'
      ? null
      : 'La entrada por voz no esta disponible en este navegador.'
  );
  readonly result = signal<FormularioInteligenteResult | null>(null);

  private voiceBasePrompt = '';
  private voiceLastTranscript = '';
  private voiceCapturedTranscript = false;

  readonly canSubmit = computed(() => {
    const prompt = this.promptValue().trim();
    return prompt.length > 0 && !this.loading();
  });

  readonly voiceButtonLabel = computed(() => {
    const state = this.voiceState();

    if (state === 'listening') {
      return 'Detener voz';
    }

    if (state === 'processing') {
      return 'Procesando voz';
    }

    return 'Usar voz';
  });

  readonly confidenceLabel = computed(() => {
    const confidence = this.result()?.confidence;
    if (confidence === null || confidence === undefined) {
      return 'Sin dato';
    }

    return `${Math.round(confidence * 100)}% de confianza`;
  });

  readonly confidenceVariant = computed<
    'neutral' | 'success' | 'warning' | 'danger' | 'info'
  >(() => {
    const confidence = this.result()?.confidence;

    if (confidence === null || confidence === undefined) {
      return 'neutral';
    }

    if (confidence >= 0.85) {
      return 'success';
    }

    if (confidence >= 0.6) {
      return 'info';
    }

    if (confidence >= 0.4) {
      return 'warning';
    }

    return 'danger';
  });

  constructor() {
    this.promptValue.set(this.promptControl.value);

    this.promptControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.promptValue.set(value ?? '');
      });
  }

  execute(): void {
    if (!this.canSubmit()) {
      this.promptControl.markAsTouched();
      return;
    }

    const prompt = this.promptControl.value.trim();
    const knownFieldIds = new Set(this.formSchema().map((field) => field.id));

    this.loading.set(true);
    this.voiceMessage.set(null);

    this.api
      .completarFormulario({
        activityId: this.activityId(),
        activityName: this.activityName(),
        policyName: this.policyName(),
        formSchema: this.formSchema(),
        currentValues: this.currentValues(),
        userPrompt: prompt,
        context: this.context(),
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (!response.success) {
            const message =
              response.message?.trim() ||
              'La IA no pudo actualizar el formulario.';
            this.toast.error('Formulario Inteligente', message);
            this.result.set({
              updatedValues: {},
              changes: [],
              warnings: response.warnings ?? [],
              confidence: response.confidence ?? null,
              message,
            });
            return;
          }

          const sanitizedValues = Object.fromEntries(
            Object.entries(response.updatedValues ?? {}).filter(([fieldId]) =>
              knownFieldIds.has(fieldId)
            )
          );

          const sanitizedChanges = (response.changes ?? []).filter((change) =>
            knownFieldIds.has(change.fieldId)
          );

          const result: FormularioInteligenteResult = {
            updatedValues: sanitizedValues,
            changes: this.ensureChangesForUpdatedValues(
              sanitizedChanges,
              sanitizedValues
            ),
            warnings: response.warnings ?? [],
            confidence: response.confidence ?? null,
            message:
              response.message?.trim() ||
              'Formulario actualizado correctamente con IA.',
          };

          this.result.set(result);
          this.applied.emit(result);
          this.toast.success('Formulario Inteligente', result.message ?? 'Cambios aplicados.');
        },
        error: () => {
          const message =
            'No fue posible consultar la IA. El formulario actual se mantuvo sin cambios.';
          this.voiceMessage.set(null);
          this.toast.error('Formulario Inteligente', message);
        },
      });
  }

  clearPrompt(): void {
    this.promptControl.setValue('');
    this.promptValue.set('');
    this.promptControl.markAsPristine();
    this.voiceMessage.set(null);
  }

  toggleVoice(): void {
    if (this.disabled() || this.loading()) {
      return;
    }

    if (this.voiceState() === 'unsupported') {
      this.voiceMessage.set(
        'La entrada por voz no esta disponible en este navegador.'
      );
      return;
    }

    if (this.voiceState() === 'listening' || this.voiceState() === 'processing') {
      this.voiceState.set('processing');
      this.voice.stopListening();
      return;
    }

    this.voiceBasePrompt = this.promptControl.value.trim();
    this.voiceLastTranscript = '';
    this.voiceCapturedTranscript = false;
    this.voiceMessage.set('Escuchando... puedes detener la grabacion cuando termines.');

    this.voice
      .startListening('es-ES')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.type === 'start') {
          this.voiceState.set('listening');
          return;
        }

        if (event.type === 'result') {
          const cleanTranscript = event.transcript.trim();
          this.voiceLastTranscript = cleanTranscript;

          if (cleanTranscript.length > 0) {
            this.voiceCapturedTranscript = true;
            const mergedPrompt = this.mergeTranscript(cleanTranscript);
            this.promptControl.setValue(mergedPrompt);
            this.promptValue.set(mergedPrompt);
            this.promptControl.markAsDirty();
          }

          this.voiceState.set(event.isFinal ? 'processing' : 'listening');
          this.voiceMessage.set(
            event.isFinal && cleanTranscript.length > 0
              ? 'Transcripcion lista. Puedes editar el texto antes de ejecutar.'
              : 'Transcribiendo voz...'
          );
          return;
        }

        if (event.type === 'error') {
          this.voiceState.set(
            event.error.code === 'unsupported' ? 'unsupported' : 'error'
          );
          this.voiceMessage.set(event.error.message);
          return;
        }

        const nextState =
          this.voice.getAvailability() === 'supported' ? 'idle' : 'unsupported';
        this.voiceState.set(nextState);

        if (!this.voiceCapturedTranscript) {
          this.voiceMessage.set(
            'No se pudo obtener texto de la grabacion. Prueba hablar mas cerca del microfono o usa el prompt escrito.'
          );
          return;
        }

        if (this.voiceLastTranscript.length > 0) {
          this.voiceMessage.set(
            'Transcripcion lista. Puedes editar el texto antes de ejecutar.'
          );
        }
      });
  }

  resultMessageVariant(): 'success' | 'info' {
    return this.result()?.warnings.length ? 'info' : 'success';
  }

  trackChange(index: number, change: FormularioInteligenteChangeDto): string {
    return `${change.fieldId}-${index}`;
  }

  formatResultValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return 'vacio';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return JSON.stringify(value);
  }

  promptError(): string | null {
    if (!this.promptControl.touched && !this.promptControl.dirty) {
      return null;
    }

    if (this.promptControl.hasError('maxlength')) {
      return 'El prompt no puede exceder 1500 caracteres.';
    }

    return null;
  }

  private ensureChangesForUpdatedValues(
    changes: FormularioInteligenteChangeDto[],
    updatedValues: Record<string, unknown>
  ): FormularioInteligenteChangeDto[] {
    if (changes.length > 0) {
      return changes;
    }

    return Object.entries(updatedValues).map(([fieldId, newValue]) => ({
      fieldId,
      oldValue: this.currentValues()[fieldId] ?? null,
      newValue,
      reason: 'Cambio sugerido por la IA.',
    }));
  }

  private mergeTranscript(transcript: string): string {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) {
      return this.voiceBasePrompt;
    }

    if (!this.voiceBasePrompt) {
      return cleanTranscript;
    }

    return `${this.voiceBasePrompt} ${cleanTranscript}`.trim();
  }
}
