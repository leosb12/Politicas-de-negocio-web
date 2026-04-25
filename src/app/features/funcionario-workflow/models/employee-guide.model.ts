export type EmployeeGuideScreen =
  | 'EMPLOYEE_DASHBOARD'
  | 'TASK_DETAIL'
  | 'TASK_FORM'
  | 'TASK_HISTORY';

export type EmployeeGuideSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export interface EmployeeGuideRequest {
  screen: EmployeeGuideScreen;
  question: string;
  context?: {
    taskId?: string | null;
    instanceId?: string | null;
    availableActions?: string[];
  };
}

export interface EmployeeGuideFormHelp {
  field: string;
  help: string;
}

export interface EmployeeGuideMissingField {
  field: string;
  message: string;
}

export interface EmployeeGuidePrioritySuggestion {
  recommendedTaskId?: string | null;
  reason: string;
}

export interface EmployeeGuideAction {
  action: string;
  label: string;
}

export interface EmployeeGuideResponse {
  answer: string;
  steps: string[];
  formHelp: EmployeeGuideFormHelp[];
  missingFields: EmployeeGuideMissingField[];
  prioritySuggestion?: EmployeeGuidePrioritySuggestion | null;
  nextStepExplanation?: string | null;
  suggestedActions: EmployeeGuideAction[];
  severity: EmployeeGuideSeverity;
  intent?: string;
  source?: string;
  available?: boolean;
}
