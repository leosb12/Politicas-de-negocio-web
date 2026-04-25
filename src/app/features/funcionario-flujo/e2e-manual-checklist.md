# Checklist E2E Manual - Funcionario Flujo

1. Iniciar backend Spring Boot en `http://localhost:8080`.
2. Iniciar frontend con `npm start` (usa proxy `/api` y `/ws-politicas` hacia `http://localhost:8080`).
3. Iniciar sesion con usuario `FUNCIONARIO`.
4. Abrir `/funcionario/tareas` y verificar carga de bandeja real.
5. Aplicar filtros y busqueda por actividad/codigo tramite.
6. Tomar una tarea en estado tomable y validar cambio de estado en UI.
7. Abrir detalle de tarea y completar formulario dinamico.
8. Confirmar que tras completar se actualiza estado de tarea e instancia.
9. Abrir vista de instancia y verificar historial cronologico y datos de contexto.
10. Forzar escenarios 409 desde backend y verificar mensajes funcionales y bloqueo cuando aplique.
11. Simular 401 y validar redireccion a login.
12. Simular 403 y validar redireccion a acceso denegado.
