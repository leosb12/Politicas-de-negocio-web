import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TareaResumen,
  FlujoUiError,
} from '../../models/funcionario-flujo.model';
import { FuncionarioFlujoFacadeService } from '../../services/funcionario-flujo-facade.service';
import { FuncionarioTareasPageComponent } from './funcionario-tareas';

class FuncionarioFlujoFacadeStub {
  readonly tareas = signal<TareaResumen[]>([]);
  readonly bandejaLoading = signal(false);
  readonly bandejaSyncing = signal(false);
  readonly bandejaActionTareaId = signal<string | null>(null);
  readonly bandejaError = signal<FlujoUiError | null>(null);
  readonly bandejaLastRefreshAt = signal<Date | null>(null);

  readonly tareasTomables = computed(() => this.tareas().length);
  readonly tareasEnProceso = computed(() => this.tareas().length);

  pollingStarted = false;
  pollingStopped = false;
  refreshed = false;
  lastTakenTaskId: string | null = null;

  startInboxPolling(): void {
    this.pollingStarted = true;
  }

  stopInboxPolling(): void {
    this.pollingStopped = true;
  }

  refreshInbox(): void {
    this.refreshed = true;
  }

  tomarTareaDesdeBandeja(taskId: string): void {
    this.lastTakenTaskId = taskId;
  }
}

describe('FuncionarioTareasPageComponent', () => {
  let component: FuncionarioTareasPageComponent;
  let fixture: ComponentFixture<FuncionarioTareasPageComponent>;
  let facadeStub: FuncionarioFlujoFacadeStub;

  beforeEach(async () => {
    facadeStub = new FuncionarioFlujoFacadeStub();

    await TestBed.configureTestingModule({
      imports: [FuncionarioTareasPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: FuncionarioFlujoFacadeService,
          useValue: facadeStub,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FuncionarioTareasPageComponent);
    component = fixture.componentInstance;

    facadeStub.tareas.set([
      {
        id: 'TASK-1',
        nombreActividad: 'Revisar contrato',
        estadoTarea: 'PENDIENTE',
        instanciaId: 'INS-1',
        politicaId: 'POL-1',
        politicaNombre: 'Contrataciones',
        fechaCreacion: '2026-04-18T10:00:00Z',
        fechaInicio: null,
        prioridad: 'ALTA',
        responsableActual: 'USR-1',
        responsableTipo: 'USUARIO',
        responsableId: 'USR-1',
        codigoTramite: 'TRM-001',
        estadoInstancia: 'EN_PROCESO',
        contextoResumen: { detalle: 'Contrato anual' },
      },
      {
        id: 'TASK-2',
        nombreActividad: 'Validar pago',
        estadoTarea: 'COMPLETADA',
        instanciaId: 'INS-2',
        politicaId: 'POL-2',
        politicaNombre: 'Pagos',
        fechaCreacion: '2026-04-18T11:00:00Z',
        fechaInicio: null,
        prioridad: 'MEDIA',
        responsableActual: 'USR-2',
        responsableTipo: 'USUARIO',
        responsableId: 'USR-2',
        codigoTramite: 'TRM-002',
        estadoInstancia: 'FINALIZADA',
        contextoResumen: { detalle: 'Pago proveedor' },
      },
    ]);

    fixture.detectChanges();
  });

  it('inicia y detiene polling de bandeja', () => {
    component.ngOnInit();
    component.ngOnDestroy();

    expect(facadeStub.pollingStarted).toBe(true);
    expect(facadeStub.pollingStopped).toBe(true);
  });

  it('filtra tareas por texto y estado', () => {
    component.searchControl.setValue('contrato');
    component.estadoControl.setValue('PENDIENTE');

    expect(component.tareasFiltradas().length).toBe(1);
    expect(component.tareasFiltradas()[0].id).toBe('TASK-1');
  });

  it('delegar accion tomar al facade', () => {
    component.tomarTarea('TASK-1');

    expect(facadeStub.lastTakenTaskId).toBe('TASK-1');
  });
});
