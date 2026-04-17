export interface AdminUser {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  departamentoId: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export interface CreateAdminUserRequest {
  nombre: string;
  correo: string;
  password: string;
  rol: string;
  departamentoId?: string | null;
  activo: boolean;
}

export interface UpdateAdminUserRequest {
  nombre?: string | null;
  correo?: string | null;
  password?: string | null;
  departamentoId?: string | null;
  activo?: boolean;
}

export interface AssignAdminUserRoleRequest {
  rol: string;
}
