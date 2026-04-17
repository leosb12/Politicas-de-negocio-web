export interface AdminRole {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  sistema: boolean;
}

export interface CreateAdminRoleRequest {
  nombre: string;
  descripcion?: string | null;
}

export interface UpdateAdminRoleRequest {
  descripcion?: string | null;
  activo?: boolean;
}
