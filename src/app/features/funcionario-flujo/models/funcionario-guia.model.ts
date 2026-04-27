export type FuncionarioGuiaScreen =
  | 'EMPLOYEE_DASHBOARD'
  | 'TASK_DETAIL'
  | 'TASK_FORM'
  | 'TASK_HISTORY'
  | 'PERFIL_USUARIO';

export type FuncionarioGuiaSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export interface FuncionarioGuiaRequest {
  screen: FuncionarioGuiaScreen;
  question: string;
  context?: {
    taskId?: string | null;
    instanceId?: string | null;
    availableActions?: string[];
  };
}

export interface FuncionarioGuiaFormHelp {
  field: string;
  help: string;
}

export interface FuncionarioGuiaMissingField {
  field: string;
  message: string;
}

export interface FuncionarioGuiaPrioritySuggestion {
  recommendedTaskId?: string | null;
  reason: string;
}

export interface FuncionarioGuiaAction {
  action: string;
  label: string;
}

export interface FuncionarioGuiaResponse {
  answer: string;
  steps: string[];
  formHelp: FuncionarioGuiaFormHelp[];
  missingFields: FuncionarioGuiaMissingField[];
  prioritySuggestion?: FuncionarioGuiaPrioritySuggestion | null;
  nextStepExplanation?: string | null;
  suggestedActions: FuncionarioGuiaAction[];
  severity: FuncionarioGuiaSeverity;
  intent?: string;
  source?: string;
  available?: boolean;
}
