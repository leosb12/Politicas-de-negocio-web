export const API_BASE_URL = 'http://localhost:8080';

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
