export interface AdministradorDepartamento {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  totalUsuarios: number;
}

export interface CreateAdministradorDepartamentoRequest {
  nombre: string;
  descripcion?: string | null;
}

export interface UpdateAdministradorDepartamentoRequest {
  nombre?: string | null;
  descripcion?: string | null;
  activo?: boolean;
}

export interface ReasignarUsuariosDepartamentoRequest {
  departamentoDestinoId: string;
}
