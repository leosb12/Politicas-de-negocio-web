type AppRuntimeConfig = {
  apiBaseUrl?: string;
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  firebaseMeasurementId?: string;
  firebaseVapidKey?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig;
  }
}

function normalizeApiBaseUrl(baseUrl: string | undefined): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeApiBaseUrl(window.__APP_CONFIG__?.apiBaseUrl);
}

export const API_BASE_URL = resolveApiBaseUrl();

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/api/auth`,
  adminUsers: `${API_BASE_URL}/api/admin/usuarios`,
  adminRoles: `${API_BASE_URL}/api/admin/roles`,
  adminDepartments: `${API_BASE_URL}/api/admin/departamentos`,
  politicas: `${API_BASE_URL}/api/politicas`,
  guideAdmin: `${API_BASE_URL}/api/guide/admin`,
  guideEmployee: `${API_BASE_URL}/api/guide/employee`,
  simulations: `${API_BASE_URL}/api/simulations`,
  analytics: `${API_BASE_URL}/api/analytics`,
  tareas: `${API_BASE_URL}/api/tareas`,
  instancias: `${API_BASE_URL}/api/instancias`,
  archivos: `${API_BASE_URL}/api/archivos`,
  pushTokens: `${API_BASE_URL}/api/push/tokens`,
  ia: `${API_BASE_URL}/api/ia`,
} as const;
