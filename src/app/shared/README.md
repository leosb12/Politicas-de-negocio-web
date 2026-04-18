# Shared

Esta carpeta es la base visual y funcional comun del frontend. La idea es simple:
si una pieza se repite o deberia verse igual en varias pantallas, vive aqui.

## Que contiene

- `ui/`: primitives globales y configurables.
- `components/`: wrappers de mayor nivel que ya usa la app (`confirm-dialog`, `data-table`, `empty-state`, `loader`, `app-header`).
- `services/`: servicios de soporte visual (por ejemplo `toast.service`).
- `pipes/`: pipes compartidos.
- `directives/`: directivas compartidas.

## Primitives globales actuales

- `app-button`
- `app-input`
- `app-select`
- `app-textarea`
- `app-modal`
- `app-card`
- `app-badge`
- `app-alert`
- `app-table`

## Que SI va en shared

- Estilos y comportamientos visuales reutilizables.
- Componentes UI sin logica de negocio de un modulo concreto.
- Helpers de presentacion que se usan en varias features.

## Que NO va en shared

- Casos de negocio de una feature puntual (admin, dashboard, etc.).
- Componentes que dependen de modelos/reglas de un solo dominio.
- Llamadas HTTP especificas de una feature.

## Como hacer cambios globales rapido

1. Botones principales: ajustar `app-button` en `shared/ui/button/button.ts`.
2. Inputs/selects/textareas: ajustar classes base en `app-input`, `app-select`, `app-textarea`.
3. Modales: ajustar overlay/panel en `app-modal`.
4. Color primario global: cambiar variables en `src/styles.css` (`--app-primary`, `--app-primary-hover`).

## Como hacer un cambio puntual sin romper lo global

- En cada primitive existe `className` o clases extra para overrides locales.
- Usa variantes (`variant`, `size`, etc.) antes de crear un estilo nuevo.
- Si un caso especial empieza a repetirse, conviertelo en variante oficial del componente.

## Criterio de mantenimiento

- Primero reutilizar.
- Si no alcanza, extender variante.
- Si sigue sin alcanzar y es un caso aislado, override local minimo.
- Evitar duplicar Tailwind en cada feature cuando ya exista un primitive.
