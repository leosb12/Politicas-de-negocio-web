export interface AdministradorUsuario {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  departamentoId: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export interface CreateAdministradorUsuarioRequest {
  nombre: string;
  correo: string;
  password: string;
  rol: string;
  departamentoId?: string | null;
  activo: boolean;
}

export interface UpdateAdministradorUsuarioRequest {
  nombre?: string | null;
  correo?: string | null;
  password?: string | null;
  departamentoId?: string | null;
  activo?: boolean;
}

export interface AsignarRolAdministradorUsuarioRequest {
  rol: string;
}
