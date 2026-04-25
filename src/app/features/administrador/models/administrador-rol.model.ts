export interface AdministradorRol {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  sistema: boolean;
}

export interface CreateAdministradorRolRequest {
  nombre: string;
  descripcion?: string | null;
}

export interface UpdateAdministradorRolRequest {
  descripcion?: string | null;
  activo?: boolean;
}
