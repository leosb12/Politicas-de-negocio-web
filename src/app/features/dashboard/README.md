# Feature Dashboard

Este modulo agrupa las rutas de dashboards por rol para mantener separacion funcional.

## Que contiene

- `dashboard.routes.ts`: define rutas para dashboard de admin y de funcionario, con sus guards.
- `pages/dashboard-admin/` y `pages/dashboard-funcionario/`: pantallas por rol.
- `components/`, `services/`, `models/`: estructura lista para evolucionar.

## Pantallas relacionadas

- Las pantallas ya viven dentro de este feature.

## Backend relacionado

- Consume datos de sesion y permisos desde `AuthService`.
