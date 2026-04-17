import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDepartment } from '../../models/admin-department.model';
import { AdminRole } from '../../models/admin-role.model';
import { AdminUser } from '../../models/admin-user.model';

export interface AdminUserFormValue {
  nombre: string;
  correo: string;
  password: string;
  rol: string;
  departamentoId: string;
  activo: boolean;
}

@Component({
  selector: 'app-admin-user-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-user-form.html',
  styleUrl: './admin-user-form.css',
})
export class AdminUserFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly mode = input<'create' | 'edit'>('create');
  readonly roles = input<AdminRole[]>([]);
  readonly departments = input<AdminDepartment[]>([]);
  readonly initialValue = input<AdminUser | null>(null);
  readonly pending = input(false);
  readonly serverError = input<string | null>(null);

  readonly save = output<AdminUserFormValue>();
  readonly close = output<void>();

  readonly activeRoles = computed(() =>
    this.roles().filter((role) => role.activo)
  );

  readonly availableDepartments = computed(() => {
    const selectedDepartmentId = this.initialValue()?.departamentoId ?? null;

    return this.departments()
      .filter(
        (department) => department.activo || department.id === selectedDepartmentId
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    password: [''],
    rol: ['USUARIO', [Validators.required]],
    departamentoId: [''],
    activo: [true],
  });

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      const currentValue = this.initialValue();
      const currentRoles = this.activeRoles();
      const passwordControl = this.form.controls.password;

      if (currentMode === 'create') {
        passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
        passwordControl.updateValueAndValidity({ emitEvent: false });
        this.form.controls.rol.enable({ emitEvent: false });

        const defaultRole = this.resolveDefaultRole(currentRoles);
        this.form.reset(
          {
            nombre: '',
            correo: '',
            password: '',
            rol: defaultRole,
            departamentoId: '',
            activo: true,
          },
          { emitEvent: false }
        );

        return;
      }

      passwordControl.setValidators([Validators.minLength(6)]);
      passwordControl.updateValueAndValidity({ emitEvent: false });
      this.form.controls.rol.disable({ emitEvent: false });

      if (currentValue) {
        this.form.reset(
          {
            nombre: currentValue.nombre,
            correo: currentValue.correo,
            password: '',
            rol: currentValue.rol,
            departamentoId: currentValue.departamentoId ?? '',
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
      correo: raw.correo.trim().toLowerCase(),
      password: raw.password.trim(),
      rol: raw.rol,
      departamentoId: raw.departamentoId.trim(),
      activo: raw.activo,
    });
  }

  closeModal(): void {
    this.close.emit();
  }

  private resolveDefaultRole(roles: AdminRole[]): string {
    const userRole = roles.find((role) => role.nombre === 'USUARIO');
    if (userRole) {
      return userRole.nombre;
    }

    if (roles.length > 0) {
      return roles[0].nombre;
    }

    return 'USUARIO';
  }
}
