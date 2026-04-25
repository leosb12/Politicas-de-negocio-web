export type AdminGuideScreen =
  | 'POLICY_DESIGNER'
  | 'POLICY_LIST'
  | 'ADMIN_USERS'
  | 'ADMIN_ROLES'
  | 'ADMIN_DEPARTMENTS'
  | 'ADMIN_ANALYTICS'
  | 'ADMIN_AI_SERVICES'
  | 'ADMIN_SIMULATIONS'
  | 'GENERAL_ADMIN';

export type AdminGuideSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export interface AdminGuideRequest {
  screen: AdminGuideScreen;
  question: string;
  context?: {
    policyId?: string | null;
    selectedNodeId?: string | null;
    availableActions?: string[];
  };
}

export interface AdminGuideSuggestedResponsible {
  name: string;
  reason: string;
}

export interface AdminGuideSuggestedFormField {
  label: string;
  type: string;
  required: boolean;
}

export interface AdminGuideIssue {
  type: string;
  message: string;
}

export interface AdminGuideAction {
  action: string;
  label: string;
}

export interface AdminGuideResponse {
  answer: string;
  steps: string[];
  suggestedResponsible?: AdminGuideSuggestedResponsible | null;
  suggestedForm: AdminGuideSuggestedFormField[];
  detectedIssues: AdminGuideIssue[];
  suggestedActions: AdminGuideAction[];
  severity: AdminGuideSeverity;
  intent?: string;
  source?: string;
  available?: boolean;
}
