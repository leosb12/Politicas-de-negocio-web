import {
  HistorialInstanciaEventoDto,
  InstanciaDetalleResponseDto,
  TareaDetalleResponseDto,
  TareaMiaResponseDto,
  WorkflowFormularioCampoDefinicionDto,
  WorkflowFormularioDefinicionDto,
} from '../models/funcionario-workflow.dto';
import {
  HistorialEvento,
  InstanciaDetalle,
  TareaDetalle,
  TareaResumen,
  WorkflowFormularioCampo,
  WorkflowFormularioDefinicion,
  WorkflowFormularioCampoTipo,
} from '../models/funcionario-workflow.model';
import { isFormularioTipoSoportado } from './funcionario-workflow-status.util';

export function mapTareaMiaDto(dto: TareaMiaResponseDto): TareaResumen {
  return {
    id: dto.id,
    nombreActividad: dto.nombreActividad,
    estadoTarea: dto.estadoTarea,
    instanciaId: dto.instanciaId,
    politicaId: dto.politicaId,
    politicaNombre: dto.politicaNombre,
    fechaCreacion: dto.fechaCreacion,
    fechaInicio: dto.fechaInicio,
    prioridad: dto.prioridad,
    responsableActual: dto.responsableActual,
    responsableTipo: dto.responsableTipo,
    responsableId: dto.responsableId,
    codigoTramite: dto.codigoTramite,
    estadoInstancia: dto.estadoInstancia,
    contextoResumen: dto.contextoResumen,
  };
}

export function mapTareaDetalleDto(dto: TareaDetalleResponseDto): TareaDetalle {
  const instancia = dto.instancia ? mapInstanciaDetalleDto(dto.instancia) : null;

  return {
    id: dto.id,
    estadoTarea: dto.estadoTarea,
    fechaCreacion: dto.fechaCreacion,
    fechaInicio: dto.fechaInicio,
    fechaFin: dto.fechaFin,
    asignadoA: dto.asignadoA,
    asignadoANombre: dto.asignadoANombre ?? null,
    observaciones: dto.observaciones,
    actividad: {
      nodoId: dto.actividad.nodoId,
      nombreActividad: dto.actividad.nombreActividad,
      responsableTipo: dto.actividad.responsableTipo,
      responsableId: dto.actividad.responsableId,
      formularioDefinicion: normalizeFormularioDefinicion(
        dto.actividad.formularioDefinicion
      ),
    },
    formularioRespuesta: dto.formularioRespuesta ?? {},
    instanciaId: instancia?.id ?? null,
    instancia,
    politica: dto.politica
      ? {
          id: dto.politica.id,
          nombre: dto.politica.nombre,
          descripcion: dto.politica.descripcion,
          estado: dto.politica.estado,
        }
      : null,
    historialRelevante: (dto.historialRelevante ?? []).map(mapHistorialEventoDto),
  };
}

export function mapInstanciaDetalleDto(dto: InstanciaDetalleResponseDto): InstanciaDetalle {
  return {
    id: dto.id,
    politicaId: dto.politicaId,
    politicaNombre: dto.politicaNombre,
    politicaDescripcion: dto.politicaDescripcion,
    politicaEstado: dto.politicaEstado,
    politicaVersion: dto.politicaVersion,
    codigoTramite: dto.codigoTramite,
    estadoInstancia: dto.estadoInstancia,
    fechaCreacion: dto.fechaCreacion,
    fechaActualizacion: dto.fechaActualizacion,
    creadaPor: dto.creadaPor,
    creadaPorNombre: dto.creadaPorNombre ?? null,
    datosContexto: dto.datosContexto ?? {},
    tokensJoin: dto.tokensJoin ?? {},
    totalTareas: dto.totalTareas ?? 0,
    tareasAbiertas: dto.tareasAbiertas ?? 0,
    tareasCompletadas: dto.tareasCompletadas ?? 0,
    tareasCanceladas: dto.tareasCanceladas ?? 0,
    tareasRechazadas: dto.tareasRechazadas ?? 0,
  };
}

export function mapHistorialEventoDto(dto: HistorialInstanciaEventoDto): HistorialEvento {
  return {
    id: dto.id,
    instanciaId: dto.instanciaId,
    tareaId: dto.tareaId,
    accion: dto.accion,
    usuario: dto.usuario,
    fecha: dto.fecha,
    detalle: dto.detalle,
  };
}

export function normalizeFormularioDefinicion(
  rawDefinition: WorkflowFormularioDefinicionDto
): WorkflowFormularioDefinicion {
  const sourceFields = getRawFields(rawDefinition);

  const fields = sourceFields
    .map((field, index) => mapFormularioField(field, index))
    .filter((field): field is WorkflowFormularioCampo => field !== null)
    .sort((a, b) => a.orden - b.orden);

  return {
    titulo:
      rawDefinition && !Array.isArray(rawDefinition)
        ? trimToNull(rawDefinition.titulo)
        : null,
    descripcion:
      rawDefinition && !Array.isArray(rawDefinition)
        ? trimToNull(rawDefinition.descripcion)
        : null,
    campos: fields,
  };
}

function getRawFields(
  rawDefinition: WorkflowFormularioDefinicionDto
): WorkflowFormularioCampoDefinicionDto[] {
  if (Array.isArray(rawDefinition)) {
    return rawDefinition;
  }

  if (rawDefinition && Array.isArray(rawDefinition.campos)) {
    return rawDefinition.campos;
  }

  return [];
}

function mapFormularioField(
  field: WorkflowFormularioCampoDefinicionDto,
  index: number
): WorkflowFormularioCampo | null {
  const key =
    trimToNull(field.clave) ??
    trimToNull(field.campo) ??
    trimToNull(field.nombre);

  if (!key) {
    return null;
  }

  const tipo = normalizeFieldType(field.tipo);
  if (!tipo) {
    return null;
  }

  const label =
    trimToNull(field.etiqueta) ??
    trimToNull(field.label) ??
    trimToNull(field.campo) ??
    trimToNull(field.clave) ??
    `Campo ${index + 1}`;

  return {
    clave: key,
    etiqueta: label,
    tipo,
    requerido: true,
    placeholder: trimToNull(field.placeholder),
    ayuda: trimToNull(field.ayuda),
    orden: typeof field.orden === 'number' ? field.orden : index,
  };
}

function normalizeFieldType(
  fieldType: string | null | undefined
): WorkflowFormularioCampoTipo | null {
  if (!isFormularioTipoSoportado(fieldType)) {
    return null;
  }

  return fieldType.trim().toUpperCase() as WorkflowFormularioCampoTipo;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
