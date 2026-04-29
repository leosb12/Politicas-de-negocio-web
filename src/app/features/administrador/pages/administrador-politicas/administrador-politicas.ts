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
import { AdministradorDepartamentosService } from '../../services/administrador-departamentos.service';
import { AdministradorDepartamento } from '../../models/administrador-departamento.model';
import { IaFlujoService } from '../../services/ia-flujo.service';
import { IaFlujoMapperService } from '../../services/ia-flujo-mapper.service';

import { LucideAngularModule } from 'lucide-angular';

type PoliticaConfirmActionType = 'DELETE' | 'DISABLE';
type PoliticaModalMode = 'CREATE' | 'EDIT';
type EstadoPoliticaFilter = EstadoPolitica | 'TODAS';
type TipoPoliticaFilter = TipoPolitica | 'TODAS';
type PagoPoliticaFilter = 'TODAS' | 'GRATIS' | 'DE_PAGO';

interface PoliticaConfirmAction {
  type: PoliticaConfirmActionType;
  politica: PoliticaNegocio;
}

interface PaymentConfigNormalized {
  requierePago: boolean;
  montoPago: number | null;
  monedaPago: string;
  descripcionPago: string;
}

@Component({
  selector: 'app-administrador-politicas',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmDialogComponent],
  templateUrl: './administrador-politicas.html',
  styleUrl: './administrador-politicas.css',
})
export class AdministradorPoliticasPageComponent implements OnInit {
  private readonly svc = inject(PoliticaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly departmentsService = inject(AdministradorDepartamentosService);
  private readonly iaService = inject(IaFlujoService);
  private readonly iaMapper = inject(IaFlujoMapperService);

  politicas = signal<PoliticaNegocio[]>([]);
  departments = signal<AdministradorDepartamento[]>([]);
  loading = signal(false);
  departmentsLoading = signal(false);
  showModal = signal(false);
  showIaModal = signal(false);
  promptIa = signal('');
  generatingIa = signal(false);
  saving = signal(false);
  search = signal('');
  estadoFilter = signal<EstadoPoliticaFilter>('TODAS');
  tipoFilter = signal<TipoPoliticaFilter>('TODAS');
  pagoFilter = signal<PagoPoliticaFilter>('TODAS');
  actionPending = signal(false);
  confirmAction = signal<PoliticaConfirmAction | null>(null);
  modalMode = signal<PoliticaModalMode>('CREATE');
  editingPoliticaId = signal<string | null>(null);

  form: {
    nombre: string;
    descripcion: string;
    tipoPolitica: TipoPolitica;
    departamentoInicioId: string | null;
    requierePago: boolean;
    montoPago: number | null;
    monedaPago: string;
    descripcionPago: string;
  } = {
    nombre: '',
    descripcion: '',
    tipoPolitica: 'EXTERNA',
    departamentoInicioId: null,
    requierePago: false,
    montoPago: null,
    monedaPago: 'USD',
    descripcionPago: '',
  };

  isEditMode = computed(() => this.modalMode() === 'EDIT');
  modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Politica de Negocio' : 'Nueva Politica de Negocio'
  );
  modalSavingLabel = computed(() => (this.isEditMode() ? 'Guardando...' : 'Creando...'));
  activeDepartments = computed(() => this.departments().filter((department) => department.activo));

  filteredPoliticas = computed(() => {
    const q = this.search().trim().toLowerCase();
    const estado = this.estadoFilter();
    const tipo = this.tipoFilter();
    const pago = this.pagoFilter();

    return this.politicas().filter((p) => {
      const matchesSearch =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? '').toLowerCase().includes(q);
      const matchesEstado = estado === 'TODAS' || p.estado === estado;
      const matchesTipo = tipo === 'TODAS' || (p.tipoPolitica ?? 'EXTERNA') === tipo;
      const matchesPago =
        pago === 'TODAS' ||
        (pago === 'GRATIS' && !this.policyRequiresPayment(p)) ||
        (pago === 'DE_PAGO' && this.policyRequiresPayment(p));

      return matchesSearch && matchesEstado && matchesTipo && matchesPago;
    });
  });

  hasActiveFilters = computed(
    () =>
      this.search().trim().length > 0 ||
      this.estadoFilter() !== 'TODAS' ||
      this.tipoFilter() !== 'TODAS' ||
      this.pagoFilter() !== 'TODAS'
  );

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

  clearFilters(): void {
    this.search.set('');
    this.estadoFilter.set('TODAS');
    this.tipoFilter.set('TODAS');
    this.pagoFilter.set('TODAS');
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
      requierePago: false,
      montoPago: null,
      monedaPago: 'USD',
      descripcionPago: '',
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
      requierePago: this.policyRequiresPayment(politica),
      montoPago: this.policyRequiresPayment(politica)
        ? (politica.montoPago ?? null)
        : null,
      monedaPago: (politica.monedaPago ?? 'USD').trim() || 'USD',
      descripcionPago: this.policyRequiresPayment(politica)
        ? (politica.descripcionPago ?? 'Pago de trámite')
        : (politica.descripcionPago ?? ''),
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

  openIaModal(): void {
    this.promptIa.set('');
    this.showIaModal.set(true);
  }

  closeIaModal(): void {
    if (this.generatingIa()) return;
    this.showIaModal.set(false);
  }

  submitPromptIa(): void {
    const prompt = this.promptIa().trim();
    if (!prompt) {
      this.toast.error('Validacion', 'Por favor ingresa una instruccion o prompt');
      return;
    }

    if (prompt.length < 10) {
      this.toast.error('Validacion', 'Por favor brinda mas detalles en tu descripcion (minimo 10 caracteres)');
      return;
    }

    this.generatingIa.set(true);

    const context = {
      departamentos: this.departments().map((d) => ({
        id: d.id,
        nombre: d.nombre,
      })),
    };

    this.iaService.generarFlujoDesdeTexto(prompt, context).subscribe({
      next: (iaResponse) => {
        const nombre = iaResponse.policy?.name || 'Politica generada con IA';
        const descripcion = iaResponse.policy?.description || 'Politica generada automaticamente a partir de una instruccion del administrador.';

        const payloadCreate: CreatePoliticaRequest = {
          nombre,
          descripcion,
          tipoPolitica: 'EXTERNA',
          requierePago: false,
          montoPago: null,
          monedaPago: 'USD',
          descripcionPago: '',
          departamentoInicioId: null,
        };

        this.svc.create(payloadCreate).subscribe({
          next: (created) => {
            const mapperContext = { departamentos: context.departamentos };
            const mapped = this.iaMapper.mapIaResponseToFlujo(iaResponse, mapperContext);

            this.svc.saveFlujo(created.id, {
              nodos: mapped.nodos,
              conexiones: mapped.conexiones,
            }).subscribe({
              next: () => {
                this.generatingIa.set(false);
                this.closeIaModal();
                this.toast.success('Generada', `Politica "${created.nombre}" generada con IA exitosamente`);
                this.router.navigate(['/admin/politicas', created.id, 'canvas']);
              },
              error: () => {
                this.generatingIa.set(false);
                this.toast.error('Error', 'La IA genero la politica, pero no se pudo guardar el flujo en el sistema.');
              }
            });
          },
          error: () => {
            this.generatingIa.set(false);
            this.toast.error('Error', 'La IA genero la politica, pero no se pudo crear en el sistema.');
          }
        });
      },
      error: () => {
        this.generatingIa.set(false);
        this.toast.error('Error', 'No se pudo generar la politica con IA. Intenta nuevamente o revisa el servicio de IA.');
      }
    });
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

    const paymentConfig = this.getNormalizedPaymentConfig();
    if (!paymentConfig) {
      return;
    }

    this.saving.set(true);
    const payload: CreatePoliticaRequest = {
      nombre,
      descripcion,
      requierePago: paymentConfig.requierePago,
      montoPago: paymentConfig.montoPago,
      monedaPago: paymentConfig.monedaPago,
      descripcionPago: paymentConfig.descripcionPago,
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

    const paymentConfig = this.getNormalizedPaymentConfig();
    if (!paymentConfig) {
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

    const currentRequiresPayment = this.policyRequiresPayment(current);
    const currentMontoPago = currentRequiresPayment ? (current.montoPago ?? null) : null;
    const currentMonedaPago = (current.monedaPago ?? 'USD').trim() || 'USD';
    const currentDescripcionPago = currentRequiresPayment
      ? ((current.descripcionPago ?? 'Pago de trámite').trim() || 'Pago de trámite')
      : (current.descripcionPago ?? '').trim();

    const paymentChanged =
      paymentConfig.requierePago !== currentRequiresPayment ||
      paymentConfig.montoPago !== currentMontoPago ||
      paymentConfig.monedaPago !== currentMonedaPago ||
      paymentConfig.descripcionPago !== currentDescripcionPago;

    if (
      !payload.nombre &&
      payload.descripcion === undefined &&
      payload.tipoPolitica === undefined &&
      payload.departamentoInicioId === undefined &&
      !paymentChanged
    ) {
      this.toast.info('Sin cambios', 'No hay cambios para guardar');
      this.closeModal();
      return;
    }

    payload.requierePago = paymentConfig.requierePago;
    payload.montoPago = paymentConfig.montoPago;
    payload.monedaPago = paymentConfig.monedaPago;
    payload.descripcionPago = paymentConfig.descripcionPago;

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

  onRequierePagoChange(value: boolean): void {
    this.form.requierePago = value;

    if (!value) {
      this.form.montoPago = null;
      this.form.monedaPago = 'USD';
      this.form.descripcionPago = '';
      return;
    }

    this.form.monedaPago = (this.form.monedaPago ?? '').trim() || 'USD';
    this.form.descripcionPago = (this.form.descripcionPago ?? '').trim() || 'Pago de trámite';
    if ((this.form.montoPago ?? 0) <= 0) {
      this.form.montoPago = null;
    }
  }

  policyRequiresPayment(politica: PoliticaNegocio): boolean {
    return politica.requierePago === true;
  }

  formatPaymentAmount(montoPago: number | null | undefined, monedaPago: string | null | undefined): string {
    const value = montoPago ?? 0;
    const currency = (monedaPago ?? 'USD').trim() || 'USD';

    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
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

  private getNormalizedPaymentConfig(): PaymentConfigNormalized | null {
    if (!this.form.requierePago) {
      return {
        requierePago: false,
        montoPago: null,
        monedaPago: 'USD',
        descripcionPago: '',
      };
    }

    const montoPago = Number(this.form.montoPago);
    if (!Number.isFinite(montoPago) || montoPago <= 0) {
      this.toast.error('Validacion', 'El precio debe ser mayor a 0');
      return null;
    }

    const monedaPago = (this.form.monedaPago ?? '').trim().toUpperCase();
    if (!monedaPago) {
      this.toast.error('Validacion', 'La moneda es obligatoria cuando la politica es de paga');
      return null;
    }

    const descripcionPago = (this.form.descripcionPago ?? '').trim() || 'Pago de trámite';

    return {
      requierePago: true,
      montoPago,
      monedaPago,
      descripcionPago,
    };
  }

  private departmentExists(departamentoId: string): boolean {
    return this.activeDepartments().some((department) => department.id === departamentoId);
  }
}
