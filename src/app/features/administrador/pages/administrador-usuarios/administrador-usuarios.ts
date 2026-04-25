import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, forkJoin, map, startWith } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table';
import { ToastService } from '../../../../shared/services/toast.service';
import { AppAlertComponent } from '../../../../shared/ui/alert/alert';
import { AppBadgeComponent } from '../../../../shared/ui/badge/badge';
import { AppButtonComponent } from '../../../../shared/ui/button/button';
import { AppInputComponent } from '../../../../shared/ui/input/input';
import { AppModalComponent } from '../../../../shared/ui/modal/modal';
import { AppSelectComponent } from '../../../../shared/ui/select/select';
import {
  AdministradorUsuarioFormularioComponent,
  AdministradorUsuarioFormularioValue,
} from '../../components/administrador-usuario-formulario/administrador-usuario-formulario';
import { AdministradorDepartamento } from '../../models/administrador-departamento.model';
import { AdministradorRol } from '../../models/administrador-rol.model';
import {
  AdministradorUsuario,
  CreateAdministradorUsuarioRequest,
  UpdateAdministradorUsuarioRequest,
} from '../../models/administrador-usuario.model';
import { AdministradorDepartamentosService } from '../../services/administrador-departamentos.service';
import { AdministradorRolesService } from '../../services/administrador-roles.service';
import { AdministradorUsuariosService } from '../../services/administrador-usuarios.service';

type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

@Component({
  selector: 'app-administrador-usuarios-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DataTableComponent,
    AdministradorUsuarioFormularioComponent,
    ConfirmDialogComponent,
    AppButtonComponent,
    AppInputComponent,
    AppSelectComponent,
    AppAlertComponent,
    AppBadgeComponent,
    AppModalComponent,
  ],
  templateUrl: './administrador-usuarios.html',
  styleUrl: './administrador-usuarios.css',
})
export class AdministradorUsuariosPageComponent {
  private readonly adminUsersService = inject(AdministradorUsuariosService);
  private readonly adminRolesService = inject(AdministradorRolesService);
  private readonly adminDepartmentsService = inject(AdministradorDepartamentosService);
  private readonly toastService = inject(ToastService);

  readonly tableColumns = [
    'Nombre',
    'Correo',
    'Rol',
    'DepartamentoId',
    'Estado',
    'Fecha creacion',
    'Acciones',
  ];

  readonly users = signal<AdministradorUsuario[]>([]);
  readonly roles = signal<AdministradorRol[]>([]);
  readonly departments = signal<AdministradorDepartamento[]>([]);

  readonly loading = signal(false);
  readonly actionLoadingUserId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly userFormOpen = signal(false);
  readonly userFormMode = signal<'create' | 'edit'>('create');
  readonly selectedUser = signal<AdministradorUsuario | null>(null);
  readonly userFormPending = signal(false);
  readonly userFormError = signal<string | null>(null);

  readonly viewUserOpen = signal(false);
  readonly viewUserPending = signal(false);
  readonly viewedUser = signal<AdministradorUsuario | null>(null);
  readonly viewUserError = signal<string | null>(null);

  readonly assignRoleOpen = signal(false);
  readonly assignRoleUser = signal<AdministradorUsuario | null>(null);
  readonly assignRolePending = signal(false);
  readonly assignRoleError = signal<string | null>(null);
  readonly assignRoleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly confirmState = signal<ConfirmState | null>(null);
  readonly confirmPending = signal(false);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<UserStatusFilter>('ALL', {
    nonNullable: true,
  });
  readonly roleControl = new FormControl('ALL', { nonNullable: true });

  private readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      map((value) => value.trim().toLowerCase())
    ),
    { initialValue: '' }
  );

  private readonly statusFilter = toSignal(
    this.statusControl.valueChanges.pipe(startWith(this.statusControl.value)),
    { initialValue: 'ALL' as UserStatusFilter }
  );

  private readonly roleFilter = toSignal(
    this.roleControl.valueChanges.pipe(startWith(this.roleControl.value)),
    { initialValue: 'ALL' }
  );

  readonly roleOptions = computed(() => {
    const names = new Set<string>();

    for (const role of this.roles()) {
      names.add(role.nombre);
    }

    for (const user of this.users()) {
      names.add(user.rol);
    }

    return ['ALL', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  });

  readonly activeRoleNames = computed(() =>
    this.roles()
      .filter((role) => role.activo)
      .map((role) => role.nombre)
      .sort((a, b) => a.localeCompare(b))
  );

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm();
    const status = this.statusFilter();
    const role = this.roleFilter();

    return this.users().filter((user) => {
      const matchesSearch =
        term.length === 0 ||
        user.nombre.toLowerCase().includes(term) ||
        user.correo.toLowerCase().includes(term);

      const matchesStatus =
        status === 'ALL' ||
        (status === 'ACTIVE' && user.activo) ||
        (status === 'INACTIVE' && !user.activo);

      const matchesRole = role === 'ALL' || user.rol === role;

      return matchesSearch && matchesStatus && matchesRole;
    });
  });

  readonly emptyTitle = computed(() =>
    this.users().length === 0 ? 'No hay usuarios registrados' : 'Sin resultados'
  );

  readonly emptyMessage = computed(() =>
    this.users().length === 0
      ? 'Crea un usuario para comenzar la gestion.'
      : 'No hay coincidencias para los filtros aplicados.'
  );

  constructor() {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      users: this.adminUsersService.getUsers(),
      roles: this.adminRolesService.getRoles(),
      departments: this.adminDepartmentsService.getDepartments(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ users, roles, departments }) => {
          this.users.set(users);
          this.roles.set(roles);
          this.departments.set(departments);
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(
              error,
              'No fue posible cargar usuarios, roles y departamentos.'
            )
          );
        },
      });
  }

  openCreateUser(): void {
    this.userFormMode.set('create');
    this.selectedUser.set(null);
    this.userFormError.set(null);
    this.userFormOpen.set(true);
  }

  openEditUser(user: AdministradorUsuario): void {
    this.userFormMode.set('edit');
    this.selectedUser.set(user);
    this.userFormError.set(null);
    this.userFormOpen.set(true);
  }

  closeUserForm(): void {
    this.userFormOpen.set(false);
    this.userFormPending.set(false);
    this.userFormError.set(null);
  }

  saveUser(formValue: AdministradorUsuarioFormularioValue): void {
    this.userFormPending.set(true);
    this.userFormError.set(null);

    let request$: Observable<AdministradorUsuario>;
    let successMessage = '';

    if (this.userFormMode() === 'create') {
      request$ = this.adminUsersService.createUser(this.buildCreatePayload(formValue));
      successMessage = 'Usuario creado correctamente.';
    } else {
      const user = this.selectedUser();
      if (!user) {
        this.userFormPending.set(false);
        this.userFormError.set('No se encontro el usuario para editar.');
        return;
      }

      request$ = this.adminUsersService.updateUser(
        user.id,
        this.buildUpdatePayload(formValue)
      );
      successMessage = 'Usuario actualizado correctamente.';
    }

    request$
      .pipe(finalize(() => this.userFormPending.set(false)))
      .subscribe({
        next: () => {
          this.userFormOpen.set(false);
          this.toastService.success('Operacion exitosa', successMessage);
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.userFormError.set(
            getApiErrorMessage(error, 'No fue posible guardar el usuario.')
          );
        },
      });
  }

  openViewUser(user: AdministradorUsuario): void {
    this.viewUserOpen.set(true);
    this.viewUserPending.set(true);
    this.viewUserError.set(null);
    this.viewedUser.set(null);

    this.adminUsersService
      .getUserById(user.id)
      .pipe(finalize(() => this.viewUserPending.set(false)))
      .subscribe({
        next: (fetchedUser) => this.viewedUser.set(fetchedUser),
        error: (error: unknown) => {
          this.viewUserError.set(
            getApiErrorMessage(error, 'No fue posible obtener el detalle del usuario.')
          );
        },
      });
  }

  closeViewUser(): void {
    this.viewUserOpen.set(false);
    this.viewedUser.set(null);
    this.viewUserError.set(null);
  }

  requestToggleUserStatus(user: AdministradorUsuario): void {
    const shouldDeactivate = user.activo;

    this.confirmState.set({
      title: shouldDeactivate ? 'Desactivar usuario' : 'Activar usuario',
      message: shouldDeactivate
        ? `Se desactivara la cuenta de ${user.nombre}.`
        : `Se activara la cuenta de ${user.nombre}.`,
      confirmLabel: shouldDeactivate ? 'Desactivar' : 'Activar',
      danger: shouldDeactivate,
      action: () => this.toggleUserStatus(user),
    });
  }

  openAssignRole(user: AdministradorUsuario): void {
    this.assignRoleUser.set(user);
    this.assignRolePending.set(false);
    this.assignRoleError.set(null);

    const availableRoles = this.activeRoleNames();
    const defaultRole =
      availableRoles.find((roleName) => roleName === user.rol) ??
      availableRoles[0] ??
      '';

    this.assignRoleControl.setValue(defaultRole);
    this.assignRoleOpen.set(true);
  }

  closeAssignRole(): void {
    this.assignRoleOpen.set(false);
    this.assignRolePending.set(false);
    this.assignRoleError.set(null);
  }

  requestAssignRole(): void {
    if (this.assignRoleControl.invalid) {
      this.assignRoleControl.markAsTouched();
      return;
    }

    const user = this.assignRoleUser();
    if (!user) {
      return;
    }

    this.confirmState.set({
      title: 'Asignar rol',
      message: `Se asignara el rol ${this.assignRoleControl.value} al usuario ${user.nombre}.`,
      confirmLabel: 'Asignar',
      danger: false,
      action: () => this.assignRole(user.id, this.assignRoleControl.value),
    });
  }

  requestRemoveRole(user: AdministradorUsuario): void {
    if (user.rol === 'USUARIO') {
      return;
    }

    this.confirmState.set({
      title: 'Quitar rol del usuario',
      message: `${user.nombre} quedara con rol USUARIO.`,
      confirmLabel: 'Quitar rol',
      danger: true,
      action: () => this.removeRole(user.id),
    });
  }

  closeConfirmDialog(): void {
    if (this.confirmPending()) {
      return;
    }

    this.confirmState.set(null);
  }

  confirmDialogAction(): void {
    const current = this.confirmState();
    if (!current) {
      return;
    }

    current.action();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue('ALL');
    this.roleControl.setValue('ALL');
  }

  isUserActionBusy(userId: string): boolean {
    return this.actionLoadingUserId() === userId;
  }

  getDepartmentLabel(departmentId: string | null): string {
    if (!departmentId) {
      return '-';
    }

    return departmentId;
  }

  private toggleUserStatus(user: AdministradorUsuario): void {
    const shouldDeactivate = user.activo;

    this.confirmPending.set(true);
    this.actionLoadingUserId.set(user.id);

    const request$ = shouldDeactivate
      ? this.adminUsersService.deactivateUser(user.id)
      : this.adminUsersService.activateUser(user.id);

    request$
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.actionLoadingUserId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.toastService.success(
            shouldDeactivate ? 'Usuario desactivado' : 'Usuario activado',
            shouldDeactivate
              ? 'El usuario se desactivo correctamente.'
              : 'El usuario se activo correctamente.'
          );
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(
              error,
              shouldDeactivate
                ? 'No fue posible desactivar el usuario.'
                : 'No fue posible activar el usuario.'
            )
          );
        },
      });
  }

  private assignRole(usuarioId: string, rol: string): void {
    this.confirmPending.set(true);
    this.assignRolePending.set(true);

    this.adminUsersService
      .assignRole(usuarioId, { rol })
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.assignRolePending.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.assignRoleOpen.set(false);
          this.toastService.success('Rol asignado', 'El rol se asigno correctamente.');
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.assignRoleError.set(
            getApiErrorMessage(error, 'No fue posible asignar el rol al usuario.')
          );
        },
      });
  }

  private removeRole(usuarioId: string): void {
    this.confirmPending.set(true);
    this.actionLoadingUserId.set(usuarioId);

    this.adminUsersService
      .removeRole(usuarioId)
      .pipe(
        finalize(() => {
          this.confirmPending.set(false);
          this.actionLoadingUserId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.confirmState.set(null);
          this.toastService.success(
            'Rol quitado',
            'El usuario ahora tiene rol USUARIO.'
          );
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.error.set(
            getApiErrorMessage(error, 'No fue posible quitar el rol del usuario.')
          );
        },
      });
  }

  private loadUsers(): void {
    this.adminUsersService.getUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (error: unknown) => {
        this.error.set(
          getApiErrorMessage(error, 'No fue posible refrescar la lista de usuarios.')
        );
      },
    });
  }

  private buildCreatePayload(formValue: AdministradorUsuarioFormularioValue): CreateAdministradorUsuarioRequest {
    return {
      nombre: formValue.nombre,
      correo: formValue.correo,
      password: formValue.password,
      rol: formValue.rol,
      departamentoId:
        formValue.departamentoId.length > 0 ? formValue.departamentoId : null,
      activo: formValue.activo,
    };
  }

  private buildUpdatePayload(formValue: AdministradorUsuarioFormularioValue): UpdateAdministradorUsuarioRequest {
    const payload: UpdateAdministradorUsuarioRequest = {
      nombre: formValue.nombre,
      correo: formValue.correo,
      departamentoId:
        formValue.departamentoId.length > 0 ? formValue.departamentoId : null,
      activo: formValue.activo,
    };

    if (formValue.password.length > 0) {
      payload.password = formValue.password;
    }

    return payload;
  }
}
