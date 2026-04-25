import {
  FlujoBadgeVariant,
  FlujoFormularioCampoTipo,
} from '../models/funcionario-flujo.model';

const TOMABLE_STATES = new Set(['PENDIENTE', 'ABIERTA', 'ASIGNADA']);
const COMPLETABLE_STATES = new Set([
  'EN_PROCESO',
  'TOMADA',
  'ASIGNADA',
  'ABIERTA',
]);

const FINAL_TASK_STATES = new Set([
  'COMPLETADA',
  'CANCELADA',
  'RECHAZADA',
  'FINALIZADA',
]);

export function normalizeEstado(estado: string | null | undefined): string {
  return (estado ?? '').trim().toUpperCase();
}

export function isTareaTomable(estado: string | null | undefined): boolean {
  return TOMABLE_STATES.has(normalizeEstado(estado));
}

export function isTareaCompletable(estado: string | null | undefined): boolean {
  return COMPLETABLE_STATES.has(normalizeEstado(estado));
}

export function isTareaFinalizada(estado: string | null | undefined): boolean {
  return FINAL_TASK_STATES.has(normalizeEstado(estado));
}

export function getEstadoBadgeVariant(
  estado: string | null | undefined
): FlujoBadgeVariant {
  const normalized = normalizeEstado(estado);

  if (normalized === 'COMPLETADA' || normalized === 'FINALIZADA') {
    return 'success';
  }

  if (normalized === 'EN_PROCESO' || normalized === 'TOMADA') {
    return 'warning';
  }

  if (
    normalized === 'PENDIENTE' ||
    normalized === 'ABIERTA' ||
    normalized === 'ASIGNADA'
  ) {
    return 'danger';
  }

  if (normalized === 'CANCELADA' || normalized === 'RECHAZADA') {
    return 'danger';
  }

  return 'neutral';
}

export function getPrioridadBadgeVariant(
  prioridad: string | null | undefined
): FlujoBadgeVariant {
  const normalized = normalizeEstado(prioridad);

  if (normalized === 'ALTA' || normalized === 'CRITICA' || normalized === 'URGENTE') {
    return 'danger';
  }

  if (normalized === 'MEDIA') {
    return 'warning';
  }

  if (normalized === 'BAJA') {
    return 'success';
  }

  return 'neutral';
}

export function isFormularioTipoSoportado(
  tipo: string | null | undefined
): tipo is FlujoFormularioCampoTipo {
  const normalized = normalizeEstado(tipo);
  return (
    normalized === 'TEXTO' ||
    normalized === 'NUMERO' ||
    normalized === 'BOOLEANO' ||
    normalized === 'ARCHIVO' ||
    normalized === 'FECHA'
  );
}
