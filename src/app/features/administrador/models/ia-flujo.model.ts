/**
 * Tipos e interfaces para la respuesta del microservicio de IA
 * que genera workflows a partir de descripciones en texto
 */

export interface IaFlujoResponse {
  policy: IaPolitica;
  departments: IaDepartamento[];
  roles: IaRol[];
  nodes: IaNodo[];
  transitions: IaTransicion[];
  forms: IaFormulario[];
  businessRules: IaReglaNegocio[];
  analysis: IaAnalisis;
}

export interface IaPolitica {
  name: string;
  description: string;
  objective: string;
  version: string;
}

export interface IaDepartamento {
  id: string;
  name: string;
  description?: string | null;
  aliases?: string[];
}

export interface IaRol {
  id: string;
  name: string;
  description: string;
}

export interface IaNodo {
  id: string;
  type: IaTipoNodo;
  name: string;
  description: string;
  responsibleRoleId: string | null;
  formId: string | null;
  decisionCriteria: string | null;
  responsibleType?: IaTipoResponsable | null;
  departmentHint?: string | null;
}

export type IaTipoResponsable = 'department' | 'initiator';

export type IaTipoNodo =
  | 'start'
  | 'task'
  | 'decision'
  | 'parallel_start'
  | 'parallel_end'
  | 'end';

export interface IaTransicion {
  id: string;
  from: string;
  to: string;
  label: string;
  condition: string | null;
}

export interface IaFormulario {
  id: string;
  nodeId: string;
  name: string;
  fields: IaCampoFormulario[];
}

export interface IaCampoFormulario {
  id: string;
  label: string;
  type: IaTipoCampo;
  required: boolean;
  options: IaOpcionCampoFormulario[];
}

export type IaTipoCampo =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'file'
  | 'email'
  | 'phone'
  | 'currency';

export interface IaOpcionCampoFormulario {
  value: string;
  label: string;
}

export interface IaReglaNegocio {
  id: string;
  name: string;
  description: string;
  appliesToNodeId: string | null;
  expression: string;
  severity: 'info' | 'warning' | 'blocking';
}

export interface IaAnalisis {
  summary: string;
  assumptions: string[];
  warnings: string[];
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Request al microservicio de IA
 */
export interface IaFlujoRequest {
  descripcion: string;
  context?: IaFlujoRequestContext;
}

export interface IaFlujoRequestContext {
  departamentos: Array<{
    id: string;
    nombre: string;
  }>;
}

/**
 * Estado de la generación de workflow
 */
export interface IaEstadoGeneracion {
  isLoading: boolean;
  error: string | null;
  data: IaFlujoResponse | null;
}
