# Módulo Offline — `src/app/core/offline/`

Este módulo implementa soporte offline completo para la aplicación Angular.

## Arquitectura

```
core/offline/
├── index.ts                    ← Barrel exports
├── offline-status.service.ts   ← Detección de conexión (navigator.onLine + events)
├── indexeddb.service.ts        ← Abstracción IndexedDB (6 stores)
├── offline-cache.service.ts    ← Cache de respuestas GET
├── offline-queue.service.ts    ← Cola FIFO de operaciones pendientes
├── offline-sync.service.ts     ← Sincronización automática al reconectar
├── offline-conflict.service.ts ← Detección de conflictos de versión
├── offline-http.service.ts     ← Wrapper reutilizable (uso opcional)
└── offline-http.interceptor.ts ← Interceptor global (automático)
```

## Stores IndexedDB

| Store         | Propósito                              |
|---------------|----------------------------------------|
| `httpCache`   | Respuestas GET cacheadas por usuario   |
| `offlineQueue`| Cola de operaciones FIFO pendientes    |
| `syncConflicts| Conflictos de versión detectados      |
| `formDrafts`  | Borradores de formularios              |
| `reportDrafts`| Borradores de reportes                 |
| `documentDrafts| Intenciones de subida de archivos    |

## URLs que siempre requieren internet

- `/api/auth/` — login, logout, recuperación de contraseña
- `/api/pagos/` — pagos con Stripe/PayPal
- `/api/ia/` — servicios de inteligencia artificial
- `/api/push` — notificaciones push

## Cómo funciona el interceptor offline

1. **GET online** → pasa al backend → guarda respuesta en `httpCache`
2. **GET offline** → devuelve `httpCache` directamente
3. **GET error de red** → intenta `httpCache`, si no hay → propaga error
4. **POST/PUT/PATCH/DELETE online** → pasa al backend normalmente
5. **POST/PUT/PATCH/DELETE offline** → encola en `offlineQueue`, retorna `{ queued: true }`
6. **Al reconectar** → `OfflineSyncService` procesa la cola FIFO

## Seguridad

- Al cerrar sesión, `AuthService.cerrarSesion()` llama a `IndexedDbService.clearUserData(userId)`
- Nunca se cachean passwords, tokens de recuperación, ni datos de pago
- Si no hay sesión activa, el interceptor no cachea nada

## Ver en Chrome DevTools

1. **Application > Service Workers** → verificar `ngsw-worker.js` activo
2. **Application > Manifest** → verificar nombre, iconos, display standalone
3. **Application > IndexedDB > politicas-negocio-offline** → ver stores
4. **Network > Offline** → activar para probar modo offline
