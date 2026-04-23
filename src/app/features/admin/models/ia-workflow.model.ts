/**
 * Tipos e interfaces para la respuesta del microservicio de IA
 * que genera workflows a partir de descripciones en texto
 */

export interface IaWorkflowResponse {
  policy: IaPolicy;
  roles: IaRole[];
  nodes: IaNode[];
  transitions: IaTransition[];
  forms: IaForm[];
  businessRules: IaBusinessRule[];
  analysis: IaAnalysis;
}

export interface IaPolicy {
  name: string;
  description: string;
  objective: string;
  version: string;
}

export interface IaRole {
  id: string;
  name: string;
  description: string;
}

export interface IaNode {
  id: string;
  type: IaNodeType;
  name: string;
  description: string;
  responsibleRoleId: string | null;
  formId: string | null;
  decisionCriteria: string | null;
  responsibleType?: IaResponsibleType | null;
  departmentHint?: string | null;
}

export type IaResponsibleType = 'department' | 'initiator';

export type IaNodeType =
  | 'start'
  | 'task'
  | 'decision'
  | 'parallel_start'
  | 'parallel_end'
  | 'end';

export interface IaTransition {
  id: string;
  from: string;
  to: string;
  label: string;
  condition: string | null;
}

export interface IaForm {
  id: string;
  nodeId: string;
  name: string;
  fields: IaFormField[];
}

export interface IaFormField {
  id: string;
  label: string;
  type: IaFieldType;
  required: boolean;
  options: IaFormFieldOption[];
}

export type IaFieldType =
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

export interface IaFormFieldOption {
  value: string;
  label: string;
}

export interface IaBusinessRule {
  id: string;
  name: string;
  description: string;
  appliesToNodeId: string | null;
  expression: string;
  severity: 'info' | 'warning' | 'blocking';
}

export interface IaAnalysis {
  summary: string;
  assumptions: string[];
  warnings: string[];
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Request al microservicio de IA
 */
export interface IaWorkflowRequest {
  descripcion: string;
  context?: IaWorkflowRequestContext;
}

export interface IaWorkflowRequestContext {
  departamentos: Array<{
    id: string;
    nombre: string;
  }>;
}

/**
 * Estado de la generación de workflow
 */
export interface IaGenerationState {
  isLoading: boolean;
  error: string | null;
  data: IaWorkflowResponse | null;
}
