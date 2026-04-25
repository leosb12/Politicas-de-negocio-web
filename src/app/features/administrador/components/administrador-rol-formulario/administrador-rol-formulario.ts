import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdministradorRol } from '../../models/administrador-rol.model';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import { AppModalComponent } from '../../../../shared/ui/modal/modal';
import { AppTextareaComponent } from '../../../../shared/ui/textarea/textarea';

export interface AdministradorRolFormularioValue {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

@Component({
  selector: 'app-administrador-rol-formulario',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppModalComponent,
    AppButtonComponent,
    AppInputComponent,
    AppTextareaComponent,
    AppAlertComponent,
  ],
  templateUrl: './administrador-rol-formulario.html',
  styleUrl: './administrador-rol-formulario.css',
})
export class AdministradorRolFormularioComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly roleNamePattern = /^[A-Z0-9_]{3,30}$/;

  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValue = input<AdministradorRol | null>(null);
  readonly pending = input(false);
  readonly serverError = input<string | null>(null);

  readonly save = output<AdministradorRolFormularioValue>();
  readonly close = output<void>();

  readonly form = this.formBuilder.nonNullable.group({
    nombre: [
      '',
      [Validators.required, Validators.pattern(this.roleNamePattern)],
    ],
    descripcion: ['', [Validators.maxLength(240)]],
    activo: [true],
  });

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      const currentValue = this.initialValue();

      if (currentMode === 'create') {
        this.form.controls.nombre.enable({ emitEvent: false });
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

      this.form.controls.nombre.disable({ emitEvent: false });
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
      nombre: raw.nombre.trim().toUpperCase(),
      descripcion: raw.descripcion.trim(),
      activo: raw.activo,
    });
  }

  closeModal(): void {
    this.close.emit();
  }
}
