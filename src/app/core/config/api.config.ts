type AppRuntimeConfig = {
  apiBaseUrl?: string;
  iaApiBaseUrl?: string;
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

function resolveIaApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const runtimeIaApiBaseUrl = normalizeApiBaseUrl(window.__APP_CONFIG__?.iaApiBaseUrl);
  if (runtimeIaApiBaseUrl) {
    return runtimeIaApiBaseUrl;
  }

  return 'http://127.0.0.1:8001';
}

export const API_BASE_URL = resolveApiBaseUrl();
export const IA_API_BASE_URL = resolveIaApiBaseUrl();

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/api/auth`,
  adminUsers: `${API_BASE_URL}/api/admin/usuarios`,
  adminRoles: `${API_BASE_URL}/api/admin/roles`,
  adminDepartments: `${API_BASE_URL}/api/admin/departamentos`,
  politicas: `${API_BASE_URL}/api/politicas`,
  simulations: `${API_BASE_URL}/api/simulations`,
  analytics: `${API_BASE_URL}/api/analytics`,
  tareas: `${API_BASE_URL}/api/tareas`,
  instancias: `${API_BASE_URL}/api/instancias`,
  archivos: `${API_BASE_URL}/api/archivos`,
} as const;
