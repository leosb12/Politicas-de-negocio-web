export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  departamentoId: string | null;
  activo?: boolean;
  fechaCreacion?: string;
}