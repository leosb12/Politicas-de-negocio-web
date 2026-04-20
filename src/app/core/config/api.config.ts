type AppRuntimeConfig = {
  apiBaseUrl?: string;
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
  tareas: `${API_BASE_URL}/api/tareas`,
  instancias: `${API_BASE_URL}/api/instancias`,
  archivos: `${API_BASE_URL}/api/archivos`,
} as const;
