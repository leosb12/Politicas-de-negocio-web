# Core

Esta carpeta contiene piezas globales del frontend, es decir, cosas que pueden ser usadas por cualquier feature.

## Que hay aqui

- `config/`: configuracion global, por ejemplo endpoints base.
- `auth/`: autenticacion y sesion global.
- `guards/`: reglas de acceso por sesion y rol.
- `interceptors/`: cabeceras y manejo de errores HTTP transversales.
- `models/`: modelos globales de infraestructura.
- `services/`: servicios globales transversales no ligados a un dominio concreto.
- `utils/`: helpers no visuales reutilizables.

## Con que backend conecta

- `AuthService` vive en `core/auth/services` y usa `API_ENDPOINTS.auth` para mantener la sesion web.
- Los interceptors agregan cabeceras o redirigen segun respuestas del backend (`/api/admin`, `/api/politicas`).
