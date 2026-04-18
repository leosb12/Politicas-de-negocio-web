# Feature Auth

Este modulo define el enrutado de autenticacion web y centraliza su entrada funcional.

## Que contiene

- `auth.routes.ts`: rutas de acceso/login del frontend.
- `pages/login/`: pantalla de inicio de sesion.
- `components/`, `services/`, `models/`: estructura preparada para crecimiento del modulo.

## Pantallas relacionadas

- La pantalla de login vive dentro de este feature en `features/auth/pages/login`.

## Backend relacionado

- Login web via `core/auth/services/AuthService` (`API_ENDPOINTS.auth`).
