import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  InstanciaDetalle,
  TareaDetalle,
  FlujoUiError,
} from '../../models/funcionario-flujo.model';
import { FuncionarioFlujoApiService } from '../../services/funcionario-flujo-api.service';
import { FuncionarioFlujoFacadeService } from '../../services/funcionario-flujo-facade.service';
import { DocumentoColaborativoMetadata } from '../../services/documento-colaborativo.service';
import { FuncionarioTareaDetallePageComponent } from './funcionario-tarea-detalle';

class FuncionarioFlujoDetalleFacadeStub {
  readonly tareaDetalle = signal<TareaDetalle | null>(null);
  readonly instanciaDetalle = signal<InstanciaDetalle | null>(null);

  readonly detalleLoading = signal(false);
  readonly detalleSyncing = signal(false);
  readonly detalleAction = signal<'tomar' | 'completar' | null>(null);
  readonly detalleError = signal<FlujoUiError | null>(null);
  readonly detalleConflictMessage = signal<string | null>(null);
  readonly detalleCompleteBlocked = signal(false);
  readonly instanciaPausedWarning = signal<string | null>(null);
  readonly detalleLastRefreshAt = signal<Date | null>(null);

  startedTaskId: string | null = null;
  stopCalled = false;
  refreshTaskId: string | null = null;
  tomarTaskId: string | null = null;
  completedTaskId: string | null = null;
  completedPayload: unknown;

  startDetallePolling(taskId: string): void {
    this.startedTaskId = taskId;
  }

  stopDetallePolling(): void {
    this.stopCalled = true;
  }

  clearDetalleState(): void {
    this.tareaDetalle.set(null);
  }

  refreshDetalle(taskId: string): void {
    this.refreshTaskId = taskId;
  }

  tomarTareaEnDetalle(taskId: string): void {
    this.tomarTaskId = taskId;
  }

  completarTarea(taskId: string, payload: unknown): void {
    this.completedTaskId = taskId;
    this.completedPayload = payload;
  }
}

class FuncionarioFlujoApiStub {
  getTareasPorInstancia() {
    return of([]);
  }

  getTareaDetalle() {
    return of({});
  }
}

describe('FuncionarioTareaDetallePageComponent', () => {
  let component: FuncionarioTareaDetallePageComponent;
  let fixture: ComponentFixture<FuncionarioTareaDetallePageComponent>;
  let facadeStub: FuncionarioFlujoDetalleFacadeStub;

  beforeEach(async () => {
    facadeStub = new FuncionarioFlujoDetalleFacadeStub();

    facadeStub.tareaDetalle.set({
      id: 'TASK-1',
      estadoTarea: 'EN_PROCESO',
      fechaCreacion: '2026-04-18T10:00:00Z',
      fechaInicio: null,
      fechaFin: null,
      asignadoA: 'USR-1',
      participantesIds: [],
      participantesNombres: [],
      observaciones: null,
      actividad: {
        nodoId: 'N-1',
        nombreActividad: 'Validar',
        responsableTipo: 'USUARIO',
        responsableId: 'USR-1',
        formularioDefinicion: {
          titulo: null,
          descripcion: null,
          campos: [],
        },
      },
      formularioRespuesta: {},
      instanciaId: 'INS-1',
      instancia: null,
      politica: null,
      historialRelevante: [],
    });

    await TestBed.configureTestingModule({
      imports: [FuncionarioTareaDetallePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'TASK-1' })),
          },
        },
        {
          provide: FuncionarioFlujoFacadeService,
          useValue: facadeStub,
        },
        {
          provide: FuncionarioFlujoApiService,
          useClass: FuncionarioFlujoApiStub,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FuncionarioTareaDetallePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('inicia polling para tarea actual', () => {
    expect(facadeStub.startedTaskId).toBe('TASK-1');
  });

  it('delegar completar tarea al facade', () => {
    const payload = {
      formularioRespuesta: { aprobado: true },
      observaciones: 'ok',
    };

    component.completarTarea(payload);

    expect(facadeStub.completedTaskId).toBe('TASK-1');
    expect(facadeStub.completedPayload).toEqual(payload);
  });

  it('muestra mensaje de conflicto 409', () => {
    facadeStub.detalleConflictMessage.set('La tarea ya fue completada por otro actor.');
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('La tarea ya fue completada por otro actor.');
  });

  it('asocia documentos colaborativos visibles al paso que contiene su campo', () => {
    const detail: TareaDetalle = {
      id: 'TASK-ANTERIOR',
      estadoTarea: 'COMPLETADA',
      fechaCreacion: '2026-04-18T10:00:00Z',
      fechaInicio: '2026-04-18T10:05:00Z',
      fechaFin: '2026-04-18T10:10:00Z',
      asignadoA: 'USR-1',
      participantesIds: [],
      participantesNombres: [],
      observaciones: null,
      actividad: {
        nodoId: 'N-ANT',
        nombreActividad: 'Preparar documento',
        responsableTipo: 'DEPARTAMENTO',
        responsableId: 'DEP-1',
        formularioDefinicion: {
          titulo: null,
          descripcion: null,
          campos: [
            {
              id: 'dc',
              clave: 'dc',
              nombre: 'Documento colaborativo',
              etiqueta: 'DC',
              tipo: 'DOCUMENTO_COLABORATIVO',
              requerido: false,
              placeholder: null,
              ayuda: null,
              orden: 0,
            },
          ],
        },
      },
      formularioRespuesta: {},
      instanciaId: 'INS-1',
      instancia: null,
      politica: null,
      historialRelevante: [],
    };
    const documento: DocumentoColaborativoMetadata = {
      documentoId: 'doc-1',
      clienteId: 'cliente-1',
      tramiteId: 'INS-1',
      campoFormularioId: 'dc',
      nombreDocumento: 'DC',
      descripcion: 'Documento de prueba',
      tipoDocumento: 'WORD',
      estado: 'CREADO',
      s3Key: 'key.docx',
      creadoPor: 'USR-1',
      fechaCreacion: '2026-04-18T10:06:00Z',
      fechaUltimaModificacion: null,
      permisosUsuario: {
        puedeLeer: true,
        puedeEditar: true,
        puedeDescargar: false,
        puedeComentar: false,
        puedeReemplazar: false,
        puedeEliminar: false,
        puedeCompartirInternamente: false,
      },
    };

    const steps = (component as any).buildTraceSteps(
      [
        {
          summary: {
            id: 'TASK-ANTERIOR',
            nombreActividad: 'Preparar documento',
            estadoTarea: 'COMPLETADA',
            fechaInicio: '2026-04-18T10:05:00Z',
            responsableActual: 'DEP-1',
          },
          detail,
        },
      ],
      [],
      [documento]
    );

    expect(steps.length).toBe(1);
    expect(steps[0].documentosColaborativos).toEqual([documento]);
    expect(component.puedeAbrirDocumentoColaborativo(documento)).toBe(true);
    expect(component.etiquetaAccionDocumentoColaborativo(documento)).toBe('Editar');
  });
});
