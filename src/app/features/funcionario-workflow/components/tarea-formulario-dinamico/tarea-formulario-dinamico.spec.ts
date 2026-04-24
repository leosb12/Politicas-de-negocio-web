import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  WorkflowArchivoMetadata,
  WorkflowFormularioDefinicion,
} from '../../models/funcionario-workflow.model';
import { FormularioInteligenteResult } from '../../models/formulario-inteligente.model';
import { TareaFormularioDinamicoComponent } from './tarea-formulario-dinamico';

describe('TareaFormularioDinamicoComponent', () => {
  let component: TareaFormularioDinamicoComponent;
  let fixture: ComponentFixture<TareaFormularioDinamicoComponent>;

  const definition: WorkflowFormularioDefinicion = {
    titulo: 'Formulario test',
    descripcion: null,
    campos: [
      {
        clave: 'comentario',
        etiqueta: 'Comentario',
        tipo: 'TEXTO',
        requerido: true,
        placeholder: null,
        ayuda: null,
        orden: 0,
      },
      {
        clave: 'monto',
        etiqueta: 'Monto',
        tipo: 'NUMERO',
        requerido: true,
        placeholder: null,
        ayuda: null,
        orden: 1,
      },
      {
        clave: 'aprobado',
        etiqueta: 'Aprobado',
        tipo: 'BOOLEANO',
        requerido: true,
        placeholder: null,
        ayuda: null,
        orden: 2,
      },
      {
        clave: 'fechaEjecucion',
        etiqueta: 'Fecha',
        tipo: 'FECHA',
        requerido: false,
        placeholder: null,
        ayuda: null,
        orden: 3,
      },
      {
        clave: 'adjunto',
        etiqueta: 'Adjunto',
        tipo: 'ARCHIVO',
        requerido: false,
        placeholder: null,
        ayuda: null,
        orden: 4,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TareaFormularioDinamicoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TareaFormularioDinamicoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('definicion', definition);
    fixture.detectChanges();
  });

  it('genera payload tipado para completar tarea', () => {
    let emittedPayload: unknown;

    component.submitted.subscribe((payload) => {
      emittedPayload = payload;
    });

    component.control(definition.campos[0]).setValue('Aprobado con observaciones');
    component.control(definition.campos[1]).setValue('1250.5');
    component.control(definition.campos[2]).setValue('true');
    component.control(definition.campos[3]).setValue('2026-04-18');

    const archivo: WorkflowArchivoMetadata = {
      archivoId: 'ARCH-1',
      nombre: 'evidencia.pdf',
      nombreOriginal: 'evidencia.pdf',
      tipoMime: 'application/pdf',
      sizeBytes: 1024,
      fechaCarga: '2026-04-18T10:30:00.000Z',
      rutaOKey: 'tareas/TASK-1/evidencia.pdf',
      storageType: 'local',
      urlAcceso: 'local://tareas/TASK-1/evidencia.pdf',
      bucket: null,
    };

    component.control(definition.campos[4]).setValue(archivo);
    component.observacionesControl.setValue('Todo correcto');

    component.onSubmit();

    expect(emittedPayload).toEqual({
      formularioRespuesta: {
        comentario: 'Aprobado con observaciones',
        monto: 1250.5,
        aprobado: true,
        fechaEjecucion: '2026-04-18',
        adjunto: archivo,
      },
      observaciones: 'Todo correcto',
    });
  });

  it('marca errores cuando faltan campos obligatorios', () => {
    let emitted = false;

    component.submitted.subscribe(() => {
      emitted = true;
    });

    component.onSubmit();

    expect(emitted).toBe(false);
    expect(component.fieldError(definition.campos[0])).toContain('obligatorio');
    expect(component.fieldError(definition.campos[1])).toContain('obligatorio');
  });

  it('no muestra errores mientras el envio esta pendiente', () => {
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();

    component.intentoEnvio.set(true);

    expect(component.fieldError(definition.campos[0])).toBeNull();
    expect(component.fieldError(definition.campos[1])).toBeNull();
  });

  it('emite el File real cuando el usuario selecciona adjunto nuevo', () => {
    let emittedPayload: unknown;

    component.submitted.subscribe((payload) => {
      emittedPayload = payload;
    });

    const archivo = new File(['contenido'], 'evidencia.pdf', {
      type: 'application/pdf',
    });

    component.control(definition.campos[0]).setValue('Aprobado con archivo');
    component.control(definition.campos[1]).setValue('1000');
    component.control(definition.campos[2]).setValue('true');
    component.control(definition.campos[4]).setValue(archivo);

    component.onSubmit();

    const payload = emittedPayload as {
      formularioRespuesta: Record<string, unknown>;
    };

    expect(payload.formularioRespuesta['adjunto']).toBe(archivo);
  });

  it('aplica solo campos validos devueltos por la IA y resalta los actualizados', () => {
    const result: FormularioInteligenteResult = {
      updatedValues: {
        comentario: 'Observado por documentos faltantes',
        aprobado: false,
        campoInesperado: 'ignorar',
      },
      changes: [],
      warnings: ['Verifica el texto final antes de enviar.'],
      confidence: 0.82,
      message: 'Cambios aplicados por IA.',
    };

    component.onIntelligentFormApplied(result);

    expect(component.control(definition.campos[0]).value).toBe(
      'Observado por documentos faltantes'
    );
    expect(component.control(definition.campos[2]).value).toBe('false');
    expect(component.iaUpdatedFieldKeys()).toEqual(['comentario', 'aprobado']);
    expect(component.formulario.controls['campoInesperado']).toBeUndefined();
  });
});
