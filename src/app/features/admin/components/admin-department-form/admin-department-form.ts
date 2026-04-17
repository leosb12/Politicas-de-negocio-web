import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDepartment } from '../../models/admin-department.model';

export interface AdminDepartmentFormValue {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

@Component({
  selector: 'app-admin-department-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-department-form.html',
  styleUrl: './admin-department-form.css',
})
export class AdminDepartmentFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValue = input<AdminDepartment | null>(null);
  readonly pending = input(false);
  readonly serverError = input<string | null>(null);

  readonly save = output<AdminDepartmentFormValue>();
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
