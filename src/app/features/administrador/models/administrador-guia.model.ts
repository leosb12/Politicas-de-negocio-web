export type AdministradorGuiaScreen =
  | 'POLICY_DESIGNER'
  | 'POLICY_LIST'
  | 'ADMIN_USERS'
  | 'ADMIN_ROLES'
  | 'ADMIN_DEPARTMENTS'
  | 'ADMIN_ANALYTICS'
  | 'ADMIN_AI_SERVICES'
  | 'ADMIN_SIMULATIONS'
  | 'PERFIL_USUARIO'
  | 'GENERAL_ADMIN';

export type AdministradorGuiaSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export interface AdministradorGuiaRequest {
  screen: AdministradorGuiaScreen;
  question: string;
  context?: {
    policyId?: string | null;
    selectedNodeId?: string | null;
    availableActions?: string[];
  };
}

export interface AdministradorGuiaSuggestedResponsible {
  name: string;
  reason: string;
}

export interface AdministradorGuiaSuggestedFormField {
  label: string;
  type: string;
  required: boolean;
}

export interface AdministradorGuiaIssue {
  type: string;
  message: string;
}

export interface AdministradorGuiaAction {
  action: string;
  label: string;
}

export interface AdministradorGuiaResponse {
  answer: string;
  steps: string[];
  suggestedResponsible?: AdministradorGuiaSuggestedResponsible | null;
  suggestedForm: AdministradorGuiaSuggestedFormField[];
  detectedIssues: AdministradorGuiaIssue[];
  suggestedActions: AdministradorGuiaAction[];
  severity: AdministradorGuiaSeverity;
  intent?: string;
  source?: string;
  available?: boolean;
}
