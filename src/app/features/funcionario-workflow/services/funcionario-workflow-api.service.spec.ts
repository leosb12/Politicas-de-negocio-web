import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import {
  TareaDetalleResponseDto,
  TareaMiaResponseDto,
} from '../models/funcionario-workflow.dto';
import { FuncionarioWorkflowApiService } from './funcionario-workflow-api.service';

describe('FuncionarioWorkflowApiService', () => {
  let service: FuncionarioWorkflowApiService;
  let httpMock: HttpTestingController;

  const detalleMock: TareaDetalleResponseDto = {
    id: 'TASK-1',
    estadoTarea: 'EN_PROCESO',
    fechaCreacion: '2026-04-18T10:00:00Z',
    fechaInicio: null,
    fechaFin: null,
    asignadoA: 'USR-1',
    observaciones: null,
    actividad: {
      nodoId: 'N-1',
      nombreActividad: 'Validar',
      responsableTipo: 'USUARIO',
      responsableId: 'USR-1',
      formularioDefinicion: [],
    },
    formularioRespuesta: {},
    instancia: null,
    politica: null,
    historialRelevante: [],
  };

  const tareaMiaBase: TareaMiaResponseDto = {
    id: 'TASK-1',
    nombreActividad: 'Validar',
    estadoTarea: 'PENDIENTE',
    instanciaId: 'INS-1',
    politicaId: 'POL-1',
    politicaNombre: 'Politica',
    fechaCreacion: '2026-04-18T10:00:00Z',
    fechaInicio: null,
    prioridad: 'ALTA',
    responsableActual: 'USR-1',
    responsableTipo: 'DEPARTAMENTO',
    responsableId: 'DEP-1',
    codigoTramite: 'TRM-1',
    estadoInstancia: 'EN_PROCESO',
    contextoResumen: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FuncionarioWorkflowApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(FuncionarioWorkflowApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('consolida /mias y /mis sin duplicar tareas y conserva datos ricos de /mias', () => {
    let response: TareaMiaResponseDto[] = [];

    service.getMisTareas().subscribe((data) => {
      response = data;
    });

    const reqMias = httpMock.expectOne(`${API_ENDPOINTS.tareas}/mias`);
    expect(reqMias.request.method).toBe('GET');
    reqMias.flush([tareaMiaBase]);

    const reqMis = httpMock.expectOne(`${API_ENDPOINTS.tareas}/mis`);
    expect(reqMis.request.method).toBe('GET');
    reqMis.flush([
      {
        id: 'TASK-1',
        nombreActividad: 'Validar',
        estadoTarea: 'PENDIENTE',
        instanciaId: 'INS-1',
        politicaId: 'POL-1',
        politicaNombre: 'POL-1',
        fechaCreacion: '2026-04-18T10:00:00Z',
        fechaInicio: null,
        prioridad: null,
        responsableActual: null,
        responsableTipo: 'DEPARTAMENTO',
        responsableId: 'DEP-1',
        codigoTramite: null,
        estadoInstancia: null,
        contextoResumen: null,
      } as TareaMiaResponseDto,
      {
        ...tareaMiaBase,
        id: 'TASK-2',
        nombreActividad: 'Aprobar solicitud',
        codigoTramite: 'TRM-2',
      },
    ]);

    expect(response.length).toBe(2);
    expect(response.map((item) => item.id)).toEqual(['TASK-1', 'TASK-2']);
    expect(response.find((item) => item.id === 'TASK-1')?.prioridad).toBe('ALTA');
    expect(response.find((item) => item.id === 'TASK-1')?.estadoInstancia).toBe('EN_PROCESO');
    expect(response.find((item) => item.id === 'TASK-1')?.codigoTramite).toBe('TRM-1');
  });

  it('tolera endpoint alterno inexistente y mantiene resultados disponibles', () => {
    let response: TareaMiaResponseDto[] = [];

    service.getMisTareas().subscribe((data) => {
      response = data;
    });

    const reqMias = httpMock.expectOne(`${API_ENDPOINTS.tareas}/mias`);
    expect(reqMias.request.method).toBe('GET');
    reqMias.flush([tareaMiaBase]);

    const reqMis = httpMock.expectOne(`${API_ENDPOINTS.tareas}/mis`);
    expect(reqMis.request.method).toBe('GET');
    reqMis.flush(
      { message: 'Not Found' },
      { status: 404, statusText: 'Not Found' }
    );

    expect(response).toEqual([tareaMiaBase]);
  });

  it('usa fallback PATCH cuando POST /tomar retorna 405', () => {
    let response: TareaDetalleResponseDto | undefined;

    service.tomarTarea('TASK-1').subscribe((data) => {
      response = data;
    });

    const postReq = httpMock.expectOne(`${API_ENDPOINTS.tareas}/TASK-1/tomar`);
    expect(postReq.request.method).toBe('POST');
    postReq.flush(
      { message: 'Method not allowed' },
      { status: 405, statusText: 'Method Not Allowed' }
    );

    const patchReq = httpMock.expectOne(`${API_ENDPOINTS.tareas}/TASK-1/tomar`);
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush(detalleMock);

    expect(response?.id).toBe('TASK-1');
  });

  it('completa tarea con POST cuando endpoint principal esta disponible', () => {
    let response: TareaDetalleResponseDto | undefined;

    service
      .completarTarea('TASK-1', {
        formularioRespuesta: { aprobado: true },
        observaciones: 'ok',
      })
      .subscribe((data) => {
        response = data;
      });

    const req = httpMock.expectOne(`${API_ENDPOINTS.tareas}/TASK-1/completar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      formularioRespuesta: { aprobado: true },
      observaciones: 'ok',
    });

    req.flush(detalleMock);

    expect(response?.estadoTarea).toBe('EN_PROCESO');
  });
});
