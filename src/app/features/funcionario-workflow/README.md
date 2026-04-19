# Funcionario Workflow

Modulo funcional para operacion del funcionario sobre tareas e instancias reales.

## Capas incluidas

- `models/`: contratos DTO y modelos de UI.
- `services/`: API, mapper, facade de estado y utilidades de error/estado.
- `components/`: componentes de presentacion reutilizables.
- `pages/`: contenedores de rutas de bandeja, detalle de tarea e instancia.

## Rutas

- `/funcionario/tareas`
- `/funcionario/tareas/:id`
- `/funcionario/instancias/:id`

## Comportamientos clave

- Polling de bandeja y detalle cada 12 segundos.
- Acciones tomar/completar con reconciliacion real de backend.
- Manejo funcional de errores 400/401/403/404/409/500.
- Conflictos 409 tratados con mensajes operativos claros.
