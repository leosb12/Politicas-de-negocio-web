import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, finalize, map, startWith } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table';
import { ToastService } from '../../../../shared/services/toast.service';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import {
  AdminRoleFormComponent,
  AdminRoleFormValue,
} from '../../components/admin-role-form/admin-role-form';
import {
  AdminRole,
  CreateAdminRoleRequest,
  UpdateAdminRoleRequest,
} from '../../models/admin-role.model';
import { AdminRolesService } from '../../services/admin-roles.service';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

@Component({
  selector: 'app-admin-roles-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DataTableComponent,
    AdminRoleFormComponent,
    ConfirmDialogComponent,
    AppButtonComponent,
    AppInputComponent,
    AppAlertComponent,
    AppBadgeComponent,
  ],
  templateUrl: './admin-roles.html',
  styleUrl: './admin-roles.css',
})
export class AdminRolesPageComponent {
  private readonly adminRolesService = inject(AdminRolesService);
  private readonly toastService = inject(ToastService);

  readonly tableColumns = [
    'Nombre',
    'Descripcion',
    'Estado',
    'Sistema',
    'Acciones',
  ];

  readonly roles = signal<AdminRole[]>([]);
  readonly loading = signal(false);
  readonly actionLoadingRoleId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly roleFormOpen = signal(false);
  readonly roleFormMode = signal<'create' | 'edit'>('create');
  readonly selectedRole = signal<AdminRole | null>(null);
  readonly roleFormPending = signal(false);
  readonly roleFormError = signal<string | null>(null);

  readonly confirmState = signal<ConfirmState | null>(null);
  readonly confirmPending = signal(false);

  readonly searchControl = new FormControl('', { nonNullable: true });

  private readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      map((value) => value.trim().toLowerCase())
    ),
    { initialValue: '' }
  );

  readonly filteredRoles = computed(() => {
    const term = this.searchTerm();

    return this.roles().filter((role) => {
      if (term.length === 0) {
        return true;
      }

      const description = role.descripcion ?? '';
      return (
        role.nombre.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term)
      );
    });
  });

  readonly emptyTitle = computed(() =>
    this.roles().length === 0 ? 'No hay roles registrados' : 'Sin resultados'
  );

  readonly emptyMessage = computed(() =>
    this.roles().length === 0
      ? 'Crea un rol para comenzar la administracion.'
      : 'No se encontraron roles con los filtros aplicados.'
  );

  constructor() {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminRolesService
      .getRoles()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (roles) => this.roles.set(roles),
        error: (error: unknown) => {
          this.error.set(getApiErrorMessage(error, 'No fue posible cargar los roles.'));
        },
      });
  }

  openCreateRole(): void {
    this.roleFormMode.set('create');
    this.selectedRole.set(null);
    this.roleFormError.set(null);
    this.roleFormOpen.set(true);
  }

  openEditRole(role: AdminRole): void {
    this.roleFormMode.set('edit');
    this.selectedRole.set(role);
    this.roleFormError.set(null);
    this.roleFormOpen.set(true);
  }

  closeRoleForm(): void {
    this.roleFormOpen.set(false);
    this.roleFormPending.set(false);
    this.roleFormError.set(null);
  }

  saveRole(formValue: AdminRoleFormValue): void {
    this.roleFormPending.set(true);
    this.roleFormError.set(null);

    let request$: Observable<AdminRole>;
    let successMessage = '';

    if (this.roleFormMode() === 'create') {
      const payload: CreateAdminRoleRequest = {
        nombre: formValue.nombre,
        descripcion: formValue.descripcion.length > 0 ? formValue.descripcion : null,
      };
      request$ = this.adminRolesService.createRole(payload);
      successMessage = 'Rol creado correctamente.';
    } else {
      const role = this.selectedRole();
      if (!role) {
        this.roleFormPending.set(false);
        this.roleFormError.set('No se encontro el rol para editar.');
        return;
      }

      const payload: UpdateAdminRoleRequest = {
        descripcion: formValue.descripcion.length > 0 ? formValue.descripcion : null,
        activo: formValue.activo,
      };
      request$ = this.adminRolesService.updateRole(role.id, payload);
      successMessage = 'Rol actualizado correctamente.';
    }

    request$
      .pipe(finalize(() => this.roleFormPending.set(false)))
      .subscribe({
        next: () => {
          this.roleFormOpen.set(false);
          this.toastService.success('Operacion exitosa', successMessage);
          this.loadRoles();
        },
        error: (error: unknown) => {
          this.roleFormError.set(
            getApiErrorMessage(error, 'No fue posible guardar el rol.')
          );
        },
      });
  }

  requestToggleRoleStatus(role: AdminRole): void {
    if (role.nombre === 'ADMIN' && role.activo) {
      this.error.set('El rol ADMIN no se puede desactivar.');
      return;
    }

    const shouldDeactivate = role.activo;

    this.confirmState.set({
      title: shouldDeactivate ? 'Desactivar rol' : 'Activar rol',
      message: shouldDeactivate
        ? `Se desactivara el rol ${role.nombre}.`
        : `Se activara el rol ${role.nombre}.`,
      confirmLabel: shouldDeactivate ? 'Desactivar' : 'Activar',
      danger: shouldDeactivate,
      action: () => this.toggleRoleStatus(role),
    });
  }

  requestDeleteRole(role: AdminRole): void {
    if (role.sistema) {
      return;
    }

    this.confirmState.set({
      title: 'Eliminar rol',
      message: `Se eliminara el rol ${role.nombre}. Esta accion no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
      action: () => this.deleteRole(role),
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

  isRoleActionBusy(roleId: string): boolean {
    return this.actionLoadingRoleId() === roleId;
  }

  private toggleRoleStatus(role: AdminRole): void {
    const shouldDeactivate = role.activo;

    this.confirmPending.set(true);
    this.actionLoadingRoleId.set(role.id);

    const request$ = shouldDeactivate
      ? this.adminRolesService.deactivateRole(role.id)
      : this.adminRolesService.activateRole(role.id);

    request$
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.actionLoadingRoleId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.toastService.success(
            shouldDeactivate ? 'Rol desactivado' : 'Rol activado',
            shouldDeactivate
              ? 'El rol se desactivo correctamente.'
              : 'El rol se activo correctamente.'
          );
          this.loadRoles();
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(
              error,
              shouldDeactivate
                ? 'No fue posible desactivar el rol.'
                : 'No fue posible activar el rol.'
            )
          );
        },
      });
  }

  private deleteRole(role: AdminRole): void {
    this.confirmPending.set(true);
    this.actionLoadingRoleId.set(role.id);

    this.adminRolesService
      .deleteRole(role.id)
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.actionLoadingRoleId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.toastService.success(
            'Rol eliminado',
            'El rol se elimino correctamente.'
          );
          this.loadRoles();
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No fue posible eliminar el rol.')
          );
        },
      });
  }
}
