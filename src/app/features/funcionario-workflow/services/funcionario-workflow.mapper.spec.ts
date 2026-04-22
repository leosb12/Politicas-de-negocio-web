import {
  InstanciaDetalleResponseDto,
  TareaDetalleResponseDto,
  TareaMiaResponseDto,
} from '../models/funcionario-workflow.dto';
import {
  mapInstanciaDetalleDto,
  mapTareaDetalleDto,
  mapTareaMiaDto,
  normalizeFormularioDefinicion,
} from './funcionario-workflow.mapper';

describe('funcionario-workflow.mapper', () => {
  it('mapea correctamente una tarea de bandeja', () => {
    const dto: TareaMiaResponseDto = {
      id: 'TASK-1',
      nombreActividad: 'Validar documento',
      estadoTarea: 'PENDIENTE',
      instanciaId: 'INS-1',
      politicaId: 'POL-1',
      politicaNombre: 'Alta proveedor',
      fechaCreacion: '2026-04-18T10:00:00Z',
      fechaInicio: null,
      prioridad: 'ALTA',
      responsableActual: 'Juan',
      responsableTipo: 'USUARIO',
      responsableId: 'USR-1',
      codigoTramite: 'TRM-001',
      estadoInstancia: 'EN_PROCESO',
      contextoResumen: { detalle: 'Proveedor nuevo' },
    };

    const mapped = mapTareaMiaDto(dto);

    expect(mapped.id).toBe('TASK-1');
    expect(mapped.nombreActividad).toBe('Validar documento');
    expect(mapped.codigoTramite).toBe('TRM-001');
  });

  it('normaliza definicion dinamica y descarta campos invalidos', () => {
    const definition = normalizeFormularioDefinicion({
      titulo: 'Formulario',
      descripcion: 'Descripcion',
      campos: [
        { campo: 'monto', tipo: 'NUMERO', requerido: true },
        { campo: 'observacion', tipo: 'TEXTO' },
        { campo: '', tipo: 'BOOLEANO' },
        { campo: 'invalido', tipo: 'NO_SOPORTADO' },
      ],
    });

    expect(definition.titulo).toBe('Formulario');
    expect(definition.campos.length).toBe(2);
    expect(definition.campos[0].clave).toBe('monto');
    expect(definition.campos[0].tipo).toBe('NUMERO');
    expect(definition.campos[0].requerido).toBe(true);
  });

  it('mapea detalle de tarea incluyendo instancia y historial', () => {
    const instanciaDto: InstanciaDetalleResponseDto = {
      id: 'INS-1',
      politicaId: 'POL-1',
      politicaNombre: 'Alta proveedor',
      politicaDescripcion: 'Proceso',
      politicaEstado: 'ACTIVA',
      politicaVersion: 3,
      codigoTramite: 'TRM-1',
      estadoInstancia: 'EN_PROCESO',
      fechaCreacion: '2026-04-10T10:00:00Z',
      fechaActualizacion: '2026-04-10T11:00:00Z',
      creadaPor: 'USR-1',
      datosContexto: { proveedorId: 'P-1' },
      tokensJoin: {},
      totalTareas: 5,
      tareasAbiertas: 2,
      tareasCompletadas: 3,
      tareasCanceladas: 0,
      tareasRechazadas: 0,
    };

    const dto: TareaDetalleResponseDto = {
      id: 'TASK-1',
      estadoTarea: 'EN_PROCESO',
      fechaCreacion: '2026-04-10T10:00:00Z',
      fechaInicio: '2026-04-10T10:30:00Z',
      fechaFin: null,
      asignadoA: 'USR-1',
      observaciones: 'Pendiente firma',
      actividad: {
        nodoId: 'ACT-1',
        nombreActividad: 'Validar proveedor',
        responsableTipo: 'USUARIO',
        responsableId: 'USR-1',
        formularioDefinicion: [{ campo: 'aprobado', tipo: 'BOOLEANO' }],
      },
      formularioRespuesta: { aprobado: true },
      instancia: instanciaDto,
      politica: {
        id: 'POL-1',
        nombre: 'Alta proveedor',
        descripcion: 'Politica',
        estado: 'ACTIVA',
      },
      historialRelevante: [
        {
          id: 'H-1',
          instanciaId: 'INS-1',
          tareaId: 'TASK-1',
          accion: 'TOMADA',
          usuario: 'USR-1',
          fecha: '2026-04-10T10:31:00Z',
          detalle: 'Tomada por funcionario',
        },
      ],
    };

    const mapped = mapTareaDetalleDto(dto);

    expect(mapped.id).toBe('TASK-1');
    expect(mapped.instanciaId).toBe('INS-1');
    expect(mapped.actividad.formularioDefinicion.campos.length).toBe(1);
    expect(mapped.historialRelevante.length).toBe(1);

    const mappedInstancia = mapInstanciaDetalleDto(instanciaDto);
    expect(mappedInstancia.totalTareas).toBe(5);
    expect(mappedInstancia.tareasCompletadas).toBe(3);
  });
});
