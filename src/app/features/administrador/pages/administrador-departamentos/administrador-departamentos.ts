import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table';
import { ToastService } from '../../../../shared/services/toast.service';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppModalComponent } from '../../../../shared/ui/modal/modal';
import { AppSelectComponent } from '../../../../shared/ui/select/select';
import { AppTableComponent } from '../../../../shared/ui/table/table';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import {
  AdministradorDepartamentoFormularioComponent,
  AdministradorDepartamentoFormularioValue,
} from '../../components/administrador-departamento-formulario/administrador-departamento-formulario';
import {
  AdministradorDepartamento,
  CreateAdministradorDepartamentoRequest,
  ReasignarUsuariosDepartamentoRequest,
  UpdateAdministradorDepartamentoRequest,
} from '../../models/administrador-departamento.model';
import { AdministradorUsuario } from '../../models/administrador-usuario.model';
import { AdministradorDepartamentosService } from '../../services/administrador-departamentos.service';

type DepartmentStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

@Component({
  selector: 'app-administrador-departamentos-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DataTableComponent,
    AdministradorDepartamentoFormularioComponent,
    ConfirmDialogComponent,
    AppButtonComponent,
    AppInputComponent,
    AppSelectComponent,
    AppAlertComponent,
    AppBadgeComponent,
    AppModalComponent,
    AppTableComponent,
  ],
  templateUrl: './administrador-departamentos.html',
  styleUrl: './administrador-departamentos.css',
})
export class AdministradorDepartamentosPageComponent {
  private readonly adminDepartmentsService = inject(AdministradorDepartamentosService);
  private readonly toastService = inject(ToastService);

  readonly tableColumns = [
    'Nombre',
    'Descripcion',
    'Estado',
    'Total usuarios',
    'Acciones',
  ];

  readonly departments = signal<AdministradorDepartamento[]>([]);
  readonly loading = signal(false);
  readonly actionLoadingDepartmentId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<DepartmentStatusFilter>('ALL', {
    nonNullable: true,
  });

  readonly departmentFormOpen = signal(false);
  readonly departmentFormMode = signal<'create' | 'edit'>('create');
  readonly selectedDepartment = signal<AdministradorDepartamento | null>(null);
  readonly departmentFormPending = signal(false);
  readonly departmentFormError = signal<string | null>(null);

  readonly confirmState = signal<ConfirmState | null>(null);
  readonly confirmPending = signal(false);

  readonly usersModalOpen = signal(false);
  readonly usersModalDepartment = signal<AdministradorDepartamento | null>(null);
  readonly usersByDepartment = signal<AdministradorUsuario[]>([]);
  readonly usersByDepartmentLoading = signal(false);
  readonly usersByDepartmentError = signal<string | null>(null);
  readonly reassignControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly reassignPending = signal(false);
  readonly reassignError = signal<string | null>(null);

  private readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      map((value) => value.trim().toLowerCase())
    ),
    { initialValue: '' }
  );

  private readonly statusFilter = toSignal(
    this.statusControl.valueChanges.pipe(startWith(this.statusControl.value)),
    { initialValue: 'ALL' as DepartmentStatusFilter }
  );

  readonly filteredDepartments = computed(() => {
    const term = this.searchTerm();
    const status = this.statusFilter();

    return this.departments().filter((department) => {
      const description = department.descripcion ?? '';
      const matchesSearch =
        term.length === 0 ||
        department.nombre.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term);

      const matchesStatus =
        status === 'ALL' ||
        (status === 'ACTIVE' && department.activo) ||
        (status === 'INACTIVE' && !department.activo);

      return matchesSearch && matchesStatus;
    });
  });

  readonly emptyTitle = computed(() =>
    this.departments().length === 0
      ? 'No hay departamentos registrados'
      : 'No hay resultados'
  );

  readonly emptyMessage = computed(() =>
    this.departments().length === 0
      ? 'Crea un departamento para empezar.'
      : 'No se encontraron departamentos con los filtros aplicados.'
  );

  readonly activeDepartmentsForReassign = computed(() => {
    const currentDepartment = this.usersModalDepartment();
    if (!currentDepartment) {
      return [];
    }

    return this.departments().filter(
      (department) =>
        department.activo && department.id !== currentDepartment.id
    );
  });

  constructor() {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminDepartmentsService
      .getDepartments()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (departments) => this.departments.set(departments),
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No fue posible cargar departamentos.')
          );
        },
      });
  }

  openCreateDepartment(): void {
    this.departmentFormMode.set('create');
    this.selectedDepartment.set(null);
    this.departmentFormError.set(null);
    this.departmentFormOpen.set(true);
  }

  openEditDepartment(department: AdministradorDepartamento): void {
    this.departmentFormMode.set('edit');
    this.selectedDepartment.set(department);
    this.departmentFormError.set(null);
    this.departmentFormOpen.set(true);
  }

  closeDepartmentForm(): void {
    this.departmentFormOpen.set(false);
    this.departmentFormPending.set(false);
    this.departmentFormError.set(null);
  }

  saveDepartment(formValue: AdministradorDepartamentoFormularioValue): void {
    this.departmentFormPending.set(true);
    this.departmentFormError.set(null);

    if (this.departmentFormMode() === 'create') {
      const payload: CreateAdministradorDepartamentoRequest = {
        nombre: formValue.nombre,
        descripcion: formValue.descripcion.length > 0 ? formValue.descripcion : null,
      };

      this.adminDepartmentsService
        .createDepartment(payload)
        .pipe(finalize(() => this.departmentFormPending.set(false)))
        .subscribe({
          next: () => {
            this.departmentFormOpen.set(false);
            this.toastService.success(
              'Departamento creado',
              'El departamento se registro correctamente.'
            );
            this.loadDepartments();
          },
          error: (error: unknown) => {
            this.departmentFormError.set(
              getApiErrorMessage(error, 'No fue posible crear el departamento.')
            );
          },
        });
      return;
    }

    const department = this.selectedDepartment();
    if (!department) {
      this.departmentFormPending.set(false);
      this.departmentFormError.set('No se encontro el departamento a editar.');
      return;
    }

    const payload: UpdateAdministradorDepartamentoRequest = {
      nombre: formValue.nombre,
      descripcion: formValue.descripcion.length > 0 ? formValue.descripcion : null,
      activo: formValue.activo,
    };

    this.adminDepartmentsService
      .updateDepartment(department.id, payload)
      .pipe(finalize(() => this.departmentFormPending.set(false)))
      .subscribe({
        next: () => {
          this.departmentFormOpen.set(false);
          this.toastService.success(
            'Departamento actualizado',
            'Los cambios se guardaron correctamente.'
          );
          this.loadDepartments();
        },
        error: (error: unknown) => {
          this.departmentFormError.set(
            getApiErrorMessage(error, 'No fue posible actualizar el departamento.')
          );
        },
      });
  }

  requestToggleStatus(department: AdministradorDepartamento): void {
    const shouldDeactivate = department.activo;

    this.confirmState.set({
      title: shouldDeactivate ? 'Desactivar departamento' : 'Activar departamento',
      message: shouldDeactivate
        ? `Se desactivara ${department.nombre}. Los usuarios pueden quedar sin asignacion operativa.`
        : `Se activara ${department.nombre}.`,
      confirmLabel: shouldDeactivate ? 'Desactivar' : 'Activar',
      danger: shouldDeactivate,
      action: () => this.toggleStatus(department),
    });
  }

  requestDeleteDepartment(department: AdministradorDepartamento): void {
    this.confirmState.set({
      title: 'Eliminar departamento',
      message: `Esta accion eliminara ${department.nombre}. Solo continua si estas seguro.`,
      confirmLabel: 'Eliminar',
      danger: true,
      action: () => this.deleteDepartment(department),
    });
  }

  closeConfirmDialog(): void {
    if (this.confirmPending()) {
      return;
    }

    this.confirmState.set(null);
  }

  confirmDialogAction(): void {
    const confirmState = this.confirmState();
    if (!confirmState) {
      return;
    }

    confirmState.action();
  }

  openDepartmentUsers(department: AdministradorDepartamento): void {
    this.usersModalDepartment.set(department);
    this.usersByDepartment.set([]);
    this.usersByDepartmentError.set(null);
    this.reassignError.set(null);
    this.reassignControl.setValue('');
    this.usersModalOpen.set(true);
    this.loadDepartmentUsers(department.id);
  }

  closeDepartmentUsers(): void {
    if (this.reassignPending()) {
      return;
    }

    this.usersModalOpen.set(false);
    this.usersByDepartment.set([]);
    this.usersByDepartmentError.set(null);
    this.reassignError.set(null);
    this.reassignControl.setValue('');
  }

  requestReassignUsers(): void {
    if (this.reassignControl.invalid) {
      this.reassignControl.markAsTouched();
      return;
    }

    const department = this.usersModalDepartment();
    if (!department) {
      return;
    }

    this.confirmState.set({
      title: 'Reasignar usuarios',
      message:
        'Los usuarios del departamento actual se moveran al departamento destino seleccionado.',
      confirmLabel: 'Reasignar',
      danger: false,
      action: () => this.reassignUsers(department.id),
    });
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue('ALL');
  }

  isDepartmentActionBusy(departmentId: string): boolean {
    return this.actionLoadingDepartmentId() === departmentId;
  }

  private toggleStatus(department: AdministradorDepartamento): void {
    const shouldDeactivate = department.activo;

    this.confirmPending.set(true);
    this.actionLoadingDepartmentId.set(department.id);

    const request$ = shouldDeactivate
      ? this.adminDepartmentsService.deactivateDepartment(department.id)
      : this.adminDepartmentsService.activateDepartment(department.id);

    request$
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.actionLoadingDepartmentId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.toastService.success(
            shouldDeactivate ? 'Departamento desactivado' : 'Departamento activado',
            shouldDeactivate
              ? 'El departamento se desactivo correctamente.'
              : 'El departamento se activo correctamente.'
          );
          this.loadDepartments();
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(
              error,
              shouldDeactivate
                ? 'No fue posible desactivar el departamento.'
                : 'No fue posible activar el departamento.'
            )
          );
        },
      });
  }

  private deleteDepartment(department: AdministradorDepartamento): void {
    this.confirmPending.set(true);
    this.actionLoadingDepartmentId.set(department.id);

    this.adminDepartmentsService
      .deleteDepartment(department.id)
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.actionLoadingDepartmentId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.toastService.success(
            'Departamento eliminado',
            'El departamento se elimino correctamente.'
          );
          this.loadDepartments();
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No fue posible eliminar el departamento.')
          );
        },
      });
  }

  private loadDepartmentUsers(departamentoId: string): void {
    this.usersByDepartmentLoading.set(true);
    this.usersByDepartmentError.set(null);

    this.adminDepartmentsService
      .getDepartmentUsers(departamentoId)
      .pipe(finalize(() => this.usersByDepartmentLoading.set(false)))
      .subscribe({
        next: (users) => this.usersByDepartment.set(users),
        error: (error: unknown) => {
          this.usersByDepartmentError.set(
            getApiErrorMessage(
              error,
              'No fue posible cargar los usuarios del departamento.'
            )
          );
        },
      });
  }

  private reassignUsers(departamentoId: string): void {
    const payload: ReasignarUsuariosDepartamentoRequest = {
      departamentoDestinoId: this.reassignControl.value,
    };

    this.confirmPending.set(false);
    this.confirmState.set(null);
    this.reassignPending.set(true);

    this.adminDepartmentsService
      .reassignUsers(departamentoId, payload)
      .pipe(finalize(() => this.reassignPending.set(false)))
      .subscribe({
        next: () => {
          this.toastService.success(
            'Usuarios reasignados',
            'La reasignacion se ejecuto correctamente.'
          );
          this.closeDepartmentUsers();
          this.loadDepartments();
        },
        error: (error: unknown) => {
          this.reassignError.set(
            getApiErrorMessage(error, 'No fue posible reasignar los usuarios.')
          );
        },
      });
  }
}
