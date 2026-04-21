# PoliticasNegocioWeb

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Docker (solo frontend)

Este frontend quedo configurado para usar rutas relativas (`/api` y `/ws-politicas`) y evitar hardcodear `localhost`.

- En desarrollo (`npm start`): Angular usa `proxy.conf.json` y reenvia `/api` y `/ws-politicas` a `http://localhost:8080`.
- En Docker produccion: Nginx sirve el frontend y hace reverse proxy al backend configurado en `FRONTEND_API_UPSTREAM`.
- En AWS: puedes mantener proxy relativo (recomendado) o definir `API_BASE_URL` con URL completa.

### Archivos principales

- `Dockerfile`: build multi-stage (Node + Nginx)
- `.dockerignore`: reduce contexto de build
- `docker/nginx/default.conf.template`: SPA fallback + reverse proxy API/WS
- `docker/nginx/runtime-config.js.template`: runtime config por variable de entorno
- `docker-compose.yml`: levanta solo frontend
- `.env`: variables de entorno para runtime

### Levantar solo frontend con Docker Compose

1. Configurar `.env` con alguna de estas opciones:

```powershell
# Opcion A: backend local fuera de Docker (Windows)
FRONTEND_API_UPSTREAM=host.docker.internal:8080
API_BASE_URL=

# Opcion B: backend remoto por URL completa
API_BASE_URL=https://tu-backend.com
```

2. Levantar frontend:

```powershell
docker compose up --build -d
```

3. URL local:

- Frontend: `http://localhost:4200`

### URL de API por entorno

- `npm start`: frontend llama a `/api` y el proxy de Angular redirige a `http://localhost:8080`.
- `docker compose`: frontend llama a `/api` y Nginx redirige a `FRONTEND_API_UPSTREAM` (por defecto `host.docker.internal:8080`).
- AWS: dejar `API_BASE_URL` vacio para proxy relativo, o definir una URL completa si separas frontend/backend por dominio.
