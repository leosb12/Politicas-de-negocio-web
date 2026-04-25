import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdministradorDepartamento } from '../../models/administrador-departamento.model';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import { AppModalComponent } from '../../../../shared/ui/modal/modal';
import { AppTextareaComponent } from '../../../../shared/ui/textarea/textarea';

export interface AdministradorDepartamentoFormularioValue {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

@Component({
  selector: 'app-administrador-departamento-formulario',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppModalComponent,
    AppButtonComponent,
    AppInputComponent,
    AppTextareaComponent,
    AppAlertComponent,
  ],
  templateUrl: './administrador-departamento-formulario.html',
  styleUrl: './administrador-departamento-formulario.css',
})
export class AdministradorDepartamentoFormularioComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValue = input<AdministradorDepartamento | null>(null);
  readonly pending = input(false);
  readonly serverError = input<string | null>(null);

  readonly save = output<AdministradorDepartamentoFormularioValue>();
  readonly close = output<void>();

  readonly form = this.formBuilder.nonNullable.group({
    nombre: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(80)],
    ],
    descripcion: ['', [Validators.maxLength(240)]],
    activo: [true],
  });

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      const currentValue = this.initialValue();

      if (currentMode === 'create') {
        this.form.reset(
          {
            nombre: '',
            descripcion: '',
            activo: true,
          },
          { emitEvent: false }
        );
        return;
      }

      if (currentValue) {
        this.form.reset(
          {
            nombre: currentValue.nombre,
            descripcion: currentValue.descripcion ?? '',
            activo: currentValue.activo,
          },
          { emitEvent: false }
        );
      }
    });
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.save.emit({
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion.trim(),
      activo: raw.activo,
    });
  }

  closeModal(): void {
    this.close.emit();
  }
}
