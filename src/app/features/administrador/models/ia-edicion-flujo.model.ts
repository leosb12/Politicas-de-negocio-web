import { PoliticaNegocio } from './politica.model';

export const IA_WORKFLOW_EDIT_OPERATION_TYPES = [
  'ADD_NODE',
  'UPDATE_NODE',
  'DELETE_NODE',
  'ADD_TRANSITION',
  'UPDATE_TRANSITION',
  'DELETE_TRANSITION',
  'ASSIGN_RESPONSIBLE',
  'REMOVE_RESPONSIBLE',
  'UPDATE_FORM',
  'ADD_FORM_FIELD',
  'DELETE_FORM_FIELD',
  'RENAME_NODE',
  'CREATE_LOOP',
  'UPDATE_DECISION_CONDITION',
  'MOVE_NODE',
  'REORDER_FLOW',
  'ADD_BUSINESS_RULE',
  'DELETE_BUSINESS_RULE',
] as const;

export type IaWorkflowEditOperationType =
  (typeof IA_WORKFLOW_EDIT_OPERATION_TYPES)[number];

export interface IaWorkflowEditPreviewRequest {
  prompt: string;
}

export interface IaWorkflowEditApplyRequest {
  prompt: string;
  operations?: IaWorkflowEditOperation[];
}

export interface IaWorkflowEditOperation {
  type: IaWorkflowEditOperationType | string;
  fromNodeName?: string | null;
  toNodeName?: string | null;
  nodeName?: string | null;
  nodeType?: string | null;
  referenceNodeName?: string | null;
  position?: 'before' | 'after' | string | null;
  condition?: string | null;
  fieldLabel?: string | null;
  fieldType?: string | null;
  required?: boolean | null;
  placeholder?: string | null;
  options?: string[] | null;
  newName?: string | null;
  responsibleRoleName?: string | null;
  responsibleType?: string | null;
  payload?: Record<string, unknown> | null;
  summary?: string | null;
  details?: string | null;
  [key: string]: unknown;
}

export interface IaWorkflowEditPreviewResponse {
  policyId: string;
  policyName: string;
  success: boolean;
  valid: boolean;
  intent: string;
  summary: string;
  operations: IaWorkflowEditOperation[];
  warnings: string[];
  errors: string[];
  requiresConfirmation: boolean;
  generatedAt: string;
}

export interface IaWorkflowEditApplyResponse {
  policyId?: string | null;
  policyName?: string | null;
  success?: boolean;
  message?: string | null;
  appliedOperations?: number | null;
  operations?: IaWorkflowEditOperation[] | null;
  workflow?: PoliticaNegocio | null;
  warnings?: string[] | null;
  errors?: string[] | null;
  appliedAt?: string | null;
  [key: string]: unknown;
}
