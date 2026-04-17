export interface AdminDepartment {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  totalUsuarios: number;
}

export interface CreateAdminDepartmentRequest {
  nombre: string;
  descripcion?: string | null;
}

export interface UpdateAdminDepartmentRequest {
  nombre?: string | null;
  descripcion?: string | null;
  activo?: boolean;
}

export interface ReassignDepartmentUsersRequest {
  departamentoDestinoId: string;
}
