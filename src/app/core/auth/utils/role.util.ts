export function normalizeRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? '';
}

export function isFuncionarioRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'FUNCIONARIO';
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'ADMIN';
}
