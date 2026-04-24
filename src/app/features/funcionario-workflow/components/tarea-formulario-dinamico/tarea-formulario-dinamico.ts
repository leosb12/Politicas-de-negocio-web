import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormRecord,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import { AppSelectComponent } from '../../../../shared/ui/select/select';
import { AppTextareaComponent } from '../../../../shared/ui/textarea/textarea';
import { FormularioInteligenteComponent } from '../formulario-inteligente/formulario-inteligente';
import {
  CompletarTareaPayload,
  WorkflowArchivoMetadata,
  WorkflowFormularioCampo,
  WorkflowFormularioDefinicion,
} from '../../models/funcionario-workflow.model';
import {
  FormularioInteligenteFieldSchema,
  FormularioInteligenteRequestContext,
  FormularioInteligenteResult,
} from '../../models/formulario-inteligente.model';

type DynamicControlValue = string | WorkflowArchivoMetadata | File | null;

@Component({
  selector: 'app-tarea-formulario-dinamico',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppInputComponent,
    AppSelectComponent,
    AppTextareaComponent,
    AppButtonComponent,
    FormularioInteligenteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tarea-formulario-dinamico.html',
  styleUrl: './tarea-formulario-dinamico.css',
})
export class TareaFormularioDinamicoComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly tareaId = input<string | null>(null);
  readonly definicion = input<WorkflowFormularioDefinicion | null>(null);
  readonly respuestaInicial = input<Record<string, unknown> | null>(null);
  readonly observacionesInicial = input<string | null>(null);
  readonly activityId = input<string | null>(null);
  readonly activityName = input<string | null>(null);
  readonly policyName = input<string | null>(null);
  readonly intelligentContext = input<FormularioInteligenteRequestContext | null>(
    null
  );
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly pending = input(false, { transform: booleanAttribute });
  readonly submitLabel = input('Completar tarea');

  readonly submitted = output<CompletarTareaPayload>();

  readonly formulario = new FormRecord<FormControl<DynamicControlValue>>({});
  readonly observacionesControl = new FormControl('', { nonNullable: true });
  readonly intentoEnvio = signal(false);
  readonly iaUpdatedFieldKeys = signal<string[]>([]);
  private formBindingTaskId: string | null = null;
  private formBindingSignature: string | null = null;
  private hasLocalChanges = false;

  readonly campos = computed(() => this.definicion()?.campos ?? []);
  readonly intelligentFormSchema = computed<FormularioInteligenteFieldSchema[]>(() =>
    this.campos().map((campo) => ({
      id: campo.clave,
      label: campo.etiqueta,
      type: this.mapFieldTypeForIa(campo),
      required: campo.requerido,
    }))
  );
  readonly intelligentCurrentValues = computed<Record<string, unknown>>(() =>
    Object.fromEntries(
      this.campos().map((campo) => [
        campo.clave,
        this.toIntelligentCurrentValue(campo, this.control(campo).value),
      ])
    )
  );

  constructor() {
    effect(
      () => {
        const taskId = this.tareaId();
        const definition = this.definicion();
        const initialResponse = this.respuestaInicial();
        const initialObservations = this.observacionesInicial();
        const signature = this.buildDefinitionSignature(definition);

        const shouldRebuild =
          taskId !== this.formBindingTaskId ||
          signature !== this.formBindingSignature;

        if (shouldRebuild) {
          this.rebuildForm(definition, initialResponse, initialObservations);
          this.formBindingTaskId = taskId;
          this.formBindingSignature = signature;
          return;
        }

        if (
          this.hasLocalChanges ||
          this.formulario.dirty ||
          this.observacionesControl.dirty
        ) {
          return;
        }

        this.patchFormValues(definition, initialResponse, initialObservations);
      }
    );

    effect(
      () => {
        const shouldDisable = this.disabled() || this.pending();

        if (shouldDisable) {
          this.formulario.disable({ emitEvent: false });
          this.observacionesControl.disable({ emitEvent: false });
          return;
        }

        this.formulario.enable({ emitEvent: false });
        this.observacionesControl.enable({ emitEvent: false });
      }
    );

    this.formulario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasLocalChanges = true;
      });

    this.observacionesControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasLocalChanges = true;
      });
  }

  control(campo: WorkflowFormularioCampo): FormControl<DynamicControlValue> {
    const found = this.formulario.controls[campo.clave];
    if (found) {
      return found;
    }

    const fallback = new FormControl<DynamicControlValue>(null, {
      validators: this.getValidators(campo),
    });
    this.formulario.addControl(campo.clave, fallback);
    return fallback;
  }

  onSubmit(): void {
    this.intentoEnvio.set(true);
    this.formulario.markAllAsTouched();
    this.observacionesControl.markAsTouched();

    if (this.formulario.invalid || this.observacionesControl.invalid) {
      return;
    }

    const formularioRespuesta: Record<string, unknown> = {};

    for (const campo of this.campos()) {
      const rawValue = this.control(campo).value;
      formularioRespuesta[campo.clave] = this.toPayloadValue(campo, rawValue);
    }

    const observaciones = this.normalizeText(this.observacionesControl.value);

    this.submitted.emit({
      formularioRespuesta,
      observaciones,
    });
  }

  onFileSelected(campo: WorkflowFormularioCampo, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedFile = inputElement.files?.[0] ?? null;

    this.control(campo).setValue(selectedFile);
    this.control(campo).markAsTouched();
  }

  clearFile(campo: WorkflowFormularioCampo): void {
    this.control(campo).setValue(null);
    this.control(campo).markAsTouched();
  }

  selectedFile(campo: WorkflowFormularioCampo): WorkflowArchivoMetadata | null {
    const value = this.control(campo).value;
    if (value instanceof File) {
      return this.toLocalFileMetadata(value);
    }

    return this.isArchivoMetadata(value) ? value : null;
  }

  isPendingUpload(campo: WorkflowFormularioCampo): boolean {
    return this.control(campo).value instanceof File;
  }

  fieldError(campo: WorkflowFormularioCampo): string | null {
    const control = this.control(campo);

    // During submit we temporarily disable controls. Disabled controls report
    // status DISABLED (not VALID), so we must hide validation messages.
    if (this.pending() || control.disabled) {
      return null;
    }

    const shouldShowError = control.touched || this.intentoEnvio();

    if (!shouldShowError || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('invalidNumber')) {
      return 'Debes ingresar un numero valido.';
    }

    if (control.hasError('invalidDate')) {
      return 'Debes ingresar una fecha valida en formato ISO (YYYY-MM-DD).';
    }

    return 'Valor invalido.';
  }

  onIntelligentFormApplied(result: FormularioInteligenteResult): void {
    const appliedKeys: string[] = [];

    for (const campo of this.campos()) {
      if (!Object.prototype.hasOwnProperty.call(result.updatedValues, campo.clave)) {
        continue;
      }

      const nextValue = this.toFormInitialValue(
        campo,
        result.updatedValues[campo.clave]
      );
      const control = this.control(campo);

      if (this.areControlValuesEqual(control.value, nextValue)) {
        continue;
      }

      control.setValue(nextValue);
      control.markAsDirty();
      control.markAsTouched();
      control.updateValueAndValidity();
      appliedKeys.push(campo.clave);
    }

    this.iaUpdatedFieldKeys.set(appliedKeys);
    this.hasLocalChanges = true;
  }

  isUpdatedByIa(campo: WorkflowFormularioCampo): boolean {
    return this.iaUpdatedFieldKeys().includes(campo.clave);
  }

  private rebuildForm(
    definition: WorkflowFormularioDefinicion | null,
    initialResponse: Record<string, unknown> | null,
    initialObservations: string | null
  ): void {
    const fields = definition?.campos ?? [];

    for (const key of Object.keys(this.formulario.controls)) {
      this.formulario.removeControl(key);
    }

    for (const field of fields) {
      const initialValue = this.toFormInitialValue(
        field,
        initialResponse?.[field.clave]
      );

      this.formulario.addControl(
        field.clave,
        new FormControl<DynamicControlValue>(initialValue, {
          validators: this.getValidators(field),
        })
      );
    }

    this.observacionesControl.setValue(initialObservations?.trim() ?? '', {
      emitEvent: false,
    });
    this.intentoEnvio.set(false);
    this.iaUpdatedFieldKeys.set([]);
    this.hasLocalChanges = false;
  }

  private getValidators(campo: WorkflowFormularioCampo): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    validators.push(Validators.required);

    if (campo.tipo === 'NUMERO') {
      validators.push(numberValidator());
    }

    if (campo.tipo === 'FECHA') {
      validators.push(isoDateValidator());
    }

    return validators;
  }

  private patchFormValues(
    definition: WorkflowFormularioDefinicion | null,
    initialResponse: Record<string, unknown> | null,
    initialObservations: string | null
  ): void {
    const fields = definition?.campos ?? [];

    for (const field of fields) {
      const control = this.formulario.controls[field.clave];
      if (!control) {
        continue;
      }

      const nextValue = this.toFormInitialValue(field, initialResponse?.[field.clave]);
      if (!this.areControlValuesEqual(control.value, nextValue)) {
        control.setValue(nextValue, { emitEvent: false });
      }

      control.markAsPristine();
    }

    const nextObservations = initialObservations?.trim() ?? '';
    if (this.observacionesControl.value !== nextObservations) {
      this.observacionesControl.setValue(nextObservations, { emitEvent: false });
    }

    this.observacionesControl.markAsPristine();
    this.formulario.markAsPristine();
    this.intentoEnvio.set(false);
    this.iaUpdatedFieldKeys.set([]);
    this.hasLocalChanges = false;
  }

  private buildDefinitionSignature(
    definition: WorkflowFormularioDefinicion | null
  ): string {
    const fields = definition?.campos ?? [];

    return JSON.stringify(
      fields
        .map((field) => ({
          clave: field.clave,
          tipo: field.tipo,
          orden: field.orden,
        }))
        .sort((a, b) => a.orden - b.orden)
    );
  }

  private areControlValuesEqual(
    current: DynamicControlValue,
    next: DynamicControlValue
  ): boolean {
    if (current === next) {
      return true;
    }

    return JSON.stringify(current) === JSON.stringify(next);
  }

  private toFormInitialValue(
    campo: WorkflowFormularioCampo,
    rawValue: unknown
  ): DynamicControlValue {
    if (campo.tipo === 'ARCHIVO') {
      return this.isArchivoMetadata(rawValue) ? rawValue : null;
    }

    if (campo.tipo === 'BOOLEANO') {
      if (rawValue === true || rawValue === 'true') {
        return 'true';
      }

      if (rawValue === false || rawValue === 'false') {
        return 'false';
      }

      return '';
    }

    if (campo.tipo === 'NUMERO') {
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return String(rawValue);
      }

      if (typeof rawValue === 'string') {
        return rawValue;
      }

      return '';
    }

    if (campo.tipo === 'FECHA') {
      if (typeof rawValue === 'string') {
        const dateOnly = rawValue.includes('T') ? rawValue.slice(0, 10) : rawValue;
        return dateOnly;
      }

      return '';
    }

    if (typeof rawValue === 'string') {
      return rawValue;
    }

    return '';
  }

  private toPayloadValue(
    campo: WorkflowFormularioCampo,
    rawValue: DynamicControlValue
  ): unknown {
    if (campo.tipo === 'ARCHIVO') {
      if (rawValue instanceof File) {
        return rawValue;
      }

      return this.isArchivoMetadata(rawValue) ? rawValue : null;
    }

    if (campo.tipo === 'BOOLEANO') {
      if (rawValue === 'true') {
        return true;
      }

      if (rawValue === 'false') {
        return false;
      }

      return null;
    }

    if (campo.tipo === 'NUMERO') {
      if (typeof rawValue !== 'string') {
        return null;
      }

      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (campo.tipo === 'FECHA') {
      if (typeof rawValue !== 'string') {
        return null;
      }

      const normalized = this.normalizeText(rawValue);
      return normalized;
    }

    if (typeof rawValue !== 'string') {
      return null;
    }

    return this.normalizeText(rawValue);
  }

  private normalizeText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  private mapFieldTypeForIa(
    campo: WorkflowFormularioCampo
  ): FormularioInteligenteFieldSchema['type'] {
    if (campo.tipo === 'TEXTO') {
      return 'text';
    }

    if (campo.tipo === 'NUMERO') {
      return 'number';
    }

    if (campo.tipo === 'BOOLEANO') {
      return 'boolean';
    }

    if (campo.tipo === 'FECHA') {
      return 'date';
    }

    return 'file';
  }

  private toIntelligentCurrentValue(
    campo: WorkflowFormularioCampo,
    rawValue: DynamicControlValue
  ): unknown {
    if (campo.tipo === 'ARCHIVO') {
      if (rawValue instanceof File) {
        return this.toLocalFileMetadata(rawValue);
      }

      return this.isArchivoMetadata(rawValue) ? rawValue : null;
    }

    return this.toPayloadValue(campo, rawValue);
  }

  private toLocalFileMetadata(file: File): WorkflowArchivoMetadata {
    return {
      archivoId: null,
      nombre: file.name,
      nombreOriginal: file.name,
      tipoMime: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      fechaCarga: new Date(file.lastModified || Date.now()).toISOString(),
      rutaOKey: null,
      storageType: null,
      urlAcceso: null,
      bucket: null,
    };
  }

  private isArchivoMetadata(value: unknown): value is WorkflowArchivoMetadata {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<WorkflowArchivoMetadata>;
    return (
      typeof candidate.nombre === 'string' &&
      typeof candidate.tipoMime === 'string' &&
      typeof candidate.sizeBytes === 'number' &&
      typeof candidate.fechaCarga === 'string'
    );
  }
}

function numberValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      return { invalidNumber: true };
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? null : { invalidNumber: true };
  };
}

function isoDateValidator(): ValidatorFn {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;

  return (control: AbstractControl) => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      return { invalidDate: true };
    }

    return pattern.test(value) ? null : { invalidDate: true };
  };
}
