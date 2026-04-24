import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PoliticaService } from '../../services/politica.service';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  PoliticaNegocio,
  EstadoPolitica,
  CreatePoliticaRequest,
  UpdatePoliticaRequest,
  TipoPolitica,
} from '../../models/politica.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { AdminDepartmentsService } from '../../services/admin-departments.service';
import { AdminDepartment } from '../../models/admin-department.model';

import { LucideAngularModule } from 'lucide-angular';

type PoliticaConfirmActionType = 'DELETE' | 'DISABLE';
type PoliticaModalMode = 'CREATE' | 'EDIT';

interface PoliticaConfirmAction {
  type: PoliticaConfirmActionType;
  politica: PoliticaNegocio;
}

@Component({
  selector: 'app-admin-politicas',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmDialogComponent],
  templateUrl: './admin-politicas.html',
  styleUrl: './admin-politicas.css',
})
export class AdminPoliticasPageComponent implements OnInit {
  private readonly svc = inject(PoliticaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly departmentsService = inject(AdminDepartmentsService);

  politicas = signal<PoliticaNegocio[]>([]);
  departments = signal<AdminDepartment[]>([]);
  loading = signal(false);
  departmentsLoading = signal(false);
  showModal = signal(false);
  saving = signal(false);
  search = signal('');
  actionPending = signal(false);
  confirmAction = signal<PoliticaConfirmAction | null>(null);
  modalMode = signal<PoliticaModalMode>('CREATE');
  editingPoliticaId = signal<string | null>(null);

  form: {
    nombre: string;
    descripcion: string;
    tipoPolitica: TipoPolitica;
    departamentoInicioId: string | null;
  } = {
    nombre: '',
    descripcion: '',
    tipoPolitica: 'EXTERNA',
    departamentoInicioId: null,
  };

  isEditMode = computed(() => this.modalMode() === 'EDIT');
  modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Politica de Negocio' : 'Nueva Politica de Negocio'
  );
  modalSavingLabel = computed(() => (this.isEditMode() ? 'Guardando...' : 'Creando...'));
  activeDepartments = computed(() => this.departments().filter((department) => department.activo));

  filteredPoliticas = computed(() => {
    const q = this.search().toLowerCase();
    return this.politicas().filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion?.toLowerCase().includes(q)
    );
  });

  confirmTitle = computed(() => {
    const action = this.confirmAction();
    if (!action) return '';
    return action.type === 'DELETE' ? 'Confirmar eliminacion' : 'Confirmar deshabilitacion';
  });

  confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (!action) return '';

    if (action.type === 'DELETE') {
      return 'Estas seguro de eliminar esta politica?';
    }

    return 'Deseas deshabilitar esta politica? Dejara de usarse en nuevos procesos';
  });

  confirmButtonLabel = computed(() => {
    const action = this.confirmAction();
    if (!action) return 'Confirmar';
    return action.type === 'DELETE' ? 'Eliminar' : 'Deshabilitar';
  });

  confirmDanger = computed(() => this.confirmAction()?.type === 'DELETE');

  countEstado(estado: EstadoPolitica): number {
    return this.politicas().filter((p) => p.estado === estado).length;
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadPoliticas();
  }

  loadDepartments(): void {
    this.departmentsLoading.set(true);
    this.departmentsService.getDepartments().subscribe({
      next: (departments) => {
        this.departments.set(departments);
        this.departmentsLoading.set(false);
      },
      error: () => {
        this.departmentsLoading.set(false);
        this.toast.error('Error', 'No se pudieron cargar los departamentos');
      },
    });
  }

  loadPoliticas(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (data) => {
        this.politicas.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar las politicas');
        this.loading.set(false);
      },
    });
  }

  openModal(): void {
    this.modalMode.set('CREATE');
    this.editingPoliticaId.set(null);
    this.form = {
      nombre: '',
      descripcion: '',
      tipoPolitica: 'EXTERNA',
      departamentoInicioId: null,
    };
    this.showModal.set(true);
  }

  openEditPolitica(politica: PoliticaNegocio, event?: Event): void {
    event?.stopPropagation();
    this.modalMode.set('EDIT');
    this.editingPoliticaId.set(politica.id);
    this.form = {
      nombre: politica.nombre,
      descripcion: politica.descripcion ?? '',
      tipoPolitica: politica.tipoPolitica ?? 'EXTERNA',
      departamentoInicioId: politica.departamentoInicioId ?? null,
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.modalMode.set('CREATE');
    this.editingPoliticaId.set(null);
  }

  submitPoliticaModal(): void {
    if (this.isEditMode()) {
      this.updatePolitica();
      return;
    }

    this.createPolitica();
  }

  createPolitica(): void {
    const nombre = this.form.nombre.trim();
    const descripcion = this.form.descripcion.trim();
    const departamentoInicioId = this.normalizedDepartmentId();

    if (!nombre) {
      this.toast.error('Validacion', 'El nombre es obligatorio');
      return;
    }

    if (this.form.tipoPolitica === 'INTERNA' && departamentoInicioId && !this.departmentExists(departamentoInicioId)) {
      this.toast.error('Validacion', 'El departamento seleccionado no es valido');
      return;
    }

    this.saving.set(true);
    const payload: CreatePoliticaRequest = {
      nombre,
      descripcion,
      tipoPolitica: this.form.tipoPolitica,
      departamentoInicioId,
    };
    this.svc.create(payload).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closeModal();
        this.toast.success('Creada', `Politica "${created.nombre}" lista para diseñar`);
        this.router.navigate(['/admin/politicas', created.id, 'canvas']);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error', 'No se pudo crear la politica');
      },
    });
  }

  updatePolitica(): void {
    const politicaId = this.editingPoliticaId();
    if (!politicaId) {
      return;
    }

    const nombre = this.form.nombre.trim();
    const descripcion = this.form.descripcion.trim();
    const tipoPolitica = this.form.tipoPolitica;
    const departamentoInicioId = this.normalizedDepartmentId();

    if (!nombre) {
      this.toast.error('Validacion', 'El nombre es obligatorio');
      return;
    }

    if (tipoPolitica === 'INTERNA' && departamentoInicioId && !this.departmentExists(departamentoInicioId)) {
      this.toast.error('Validacion', 'El departamento seleccionado no es valido');
      return;
    }

    const current = this.politicas().find((item) => item.id === politicaId);
    if (!current) {
      this.toast.error('Error', 'No se encontro la politica a editar');
      this.closeModal();
      return;
    }

    const payload: UpdatePoliticaRequest = {};
    if (nombre !== current.nombre) {
      payload.nombre = nombre;
    }

    if (descripcion !== (current.descripcion ?? '')) {
      payload.descripcion = descripcion;
    }

    if (tipoPolitica !== (current.tipoPolitica ?? 'EXTERNA')) {
      payload.tipoPolitica = tipoPolitica;
    }

    if (departamentoInicioId !== (current.departamentoInicioId ?? null)) {
      payload.departamentoInicioId = departamentoInicioId;
    }

    if (
      !payload.nombre &&
      payload.descripcion === undefined &&
      payload.tipoPolitica === undefined &&
      payload.departamentoInicioId === undefined
    ) {
      this.toast.info('Sin cambios', 'No hay cambios para guardar');
      this.closeModal();
      return;
    }

    this.saving.set(true);
    this.svc.updateMetadata(politicaId, payload).subscribe({
      next: (updated) => {
        this.politicas.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item))
        );
        this.saving.set(false);
        this.closeModal();
        this.toast.success('Actualizada', `Politica "${updated.nombre}" actualizada correctamente`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toast.error(
          'Error',
          getApiErrorMessage(error, 'No se pudo actualizar la politica')
        );
      },
    });
  }

  openCanvas(id: string): void {
    this.router.navigate(['/admin/politicas', id, 'canvas']);
  }

  onPoliticaCardClick(event: MouseEvent, id: string): void {
    const target = event.target as HTMLElement | null;
    const card = event.currentTarget as HTMLElement | null;

    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }

    const actions = card?.querySelector('.card-actions') as HTMLElement | null;
    if (actions) {
      const rect = actions.getBoundingClientRect();
      const clickInsideActions =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (clickInsideActions) {
        return;
      }
    }

    this.openCanvas(id);
  }

  canDeletePolitica(estado: EstadoPolitica): boolean {
    return estado === 'BORRADOR' || estado === 'DESHABILITADA';
  }

  canDisablePolitica(estado: EstadoPolitica): boolean {
    return estado === 'ACTIVA' || estado === 'PAUSADA';
  }

  deleteDisabledMessage(estado: EstadoPolitica): string {
    if (this.canDeletePolitica(estado)) {
      return 'Eliminar politica';
    }
    return 'Solo se pueden eliminar politicas en borrador o deshabilitadas';
  }

  requestDeletePolitica(politica: PoliticaNegocio, event?: Event): void {
    event?.stopPropagation();

    if (!this.canDeletePolitica(politica.estado)) {
      this.toast.info(
        'Accion no permitida',
        'Solo se pueden eliminar politicas en borrador o deshabilitadas'
      );
      return;
    }

    this.confirmAction.set({ type: 'DELETE', politica });
  }

  requestDisablePolitica(politica: PoliticaNegocio, event?: Event): void {
    event?.stopPropagation();

    if (!this.canDisablePolitica(politica.estado)) {
      return;
    }

    this.confirmAction.set({ type: 'DISABLE', politica });
  }

  closeConfirmDialog(): void {
    if (this.actionPending()) {
      return;
    }
    this.confirmAction.set(null);
  }

  executeConfirmedAction(): void {
    const action = this.confirmAction();
    if (!action || this.actionPending()) {
      return;
    }

    const adminId = this.authService.obtenerSesion()?.id;
    if (!adminId) {
      this.toast.error(
        'Sesion invalida',
        'No se encontro la sesion de administrador. Inicia sesion nuevamente.'
      );
      this.confirmAction.set(null);
      return;
    }

    this.actionPending.set(true);

    if (action.type === 'DELETE') {
      this.svc.delete(action.politica.id).subscribe({
        next: () => {
          this.actionPending.set(false);
          this.confirmAction.set(null);
          this.toast.success('Politica eliminada', 'La politica se elimino correctamente');
          this.loadPoliticas();
        },
        error: (error: unknown) => {
          this.actionPending.set(false);
          this.toast.error('Error', this.getActionErrorMessage(error));
        },
      });
      return;
    }

    this.svc.disable(action.politica.id).subscribe({
      next: (updated) => {
        this.politicas.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item))
        );
        this.actionPending.set(false);
        this.confirmAction.set(null);
        this.toast.success('Politica deshabilitada', 'La politica dejo de usarse para nuevos procesos');
      },
      error: (error: unknown) => {
        this.actionPending.set(false);
        this.toast.error('Error', this.getActionErrorMessage(error));
      },
    });
  }

  getEstadoClass(estado: EstadoPolitica): string {
    const map: Record<EstadoPolitica, string> = {
      BORRADOR: 'estado-borrador',
      ACTIVA: 'estado-activa',
      PAUSADA: 'estado-pausada',
      DESHABILITADA: 'estado-deshabilitada',
    };
    return map[estado] ?? '';
  }

  getEstadoLabel(estado: EstadoPolitica): string {
    const map: Record<EstadoPolitica, string> = {
      BORRADOR: 'Borrador',
      ACTIVA: 'Activa',
      PAUSADA: 'Pausada',
      DESHABILITADA: 'Deshabilitada',
    };
    return map[estado] ?? estado;
  }

  shouldShowDepartmentSelector(): boolean {
    return this.form.tipoPolitica === 'INTERNA';
  }

  onTipoPoliticaChange(tipoPolitica: TipoPolitica): void {
    this.form.tipoPolitica = tipoPolitica;
    if (tipoPolitica !== 'INTERNA') {
      this.form.departamentoInicioId = null;
    }
  }

  getTipoPoliticaLabel(tipoPolitica: TipoPolitica | null | undefined): string {
    const map: Record<TipoPolitica, string> = {
      INTERNA: 'Interna',
      EXTERNA: 'Externa',
      AMBAS: 'Ambas',
    };

    return map[tipoPolitica ?? 'EXTERNA'];
  }

  getDepartmentName(departamentoId: string | null | undefined): string | null {
    if (!departamentoId) {
      return null;
    }

    return this.departments().find((department) => department.id === departamentoId)?.nombre ?? null;
  }

  private getActionErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const fallbackByStatus: Record<number, string> = {
        400: 'La solicitud no es valida para esta accion',
        403: 'No tienes permisos para ejecutar esta accion',
        404: 'La politica no fue encontrada',
        409: 'No se puede completar la accion por reglas de negocio',
      };

      return getApiErrorMessage(
        error,
        fallbackByStatus[error.status] ?? 'No se pudo completar la accion'
      );
    }

    return getApiErrorMessage(error, 'No se pudo completar la accion');
  }

  formatDate(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  trackById(_: number, p: PoliticaNegocio): string {
    return p.id;
  }

  private normalizedDepartmentId(): string | null {
    if (this.form.tipoPolitica !== 'INTERNA') {
      return null;
    }

    const departamentoId = this.form.departamentoInicioId?.trim();
    return departamentoId ? departamentoId : null;
  }

  private departmentExists(departamentoId: string): boolean {
    return this.activeDepartments().some((department) => department.id === departamentoId);
  }
}
