export const IA_WORKFLOW_EDIT_OPERATION_TYPES = [
  'ADD_NODE',
  'UPDATE_NODE',
  'DELETE_NODE',
  'ADD_TRANSITION',
  'UPDATE_TRANSITION',
  'DELETE_TRANSITION',
  'ASSIGN_RESPONSIBLE',
  'UPDATE_FORM',
  'ADD_FORM_FIELD',
  'DELETE_FORM_FIELD',
  'RENAME_NODE',
  'CREATE_LOOP',
  'UPDATE_DECISION_CONDITION',
  'MOVE_NODE',
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
  condition?: string | null;
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
  appliedAt?: string | null;
  [key: string]: unknown;
}
