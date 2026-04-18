# Features

Las rutas y pantallas de la aplicacion estan organizadas por feature para escalar sin mezclar responsabilidades.

## Features actuales

- `admin/`: mantenimiento y diseno de politicas.
- `auth/`: entrada de autenticacion web.
- `dashboard/`: vistas por rol.
- `home/`: inicio publico.
- `access/`: vistas de acceso denegado.

## Criterio aplicado

- Modularizacion por dominio funcional (`home`, `auth`, `dashboard`, `admin`, `access`).
- Compatibilidad total: se conservaron rutas publicas y contratos con backend.
- Sin duplicados legacy: ya no existe `src/app/pages`, `src/app/services` ni `src/app/models`.
