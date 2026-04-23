# Generación de Workflows con IA

## Descripción General

Este módulo implementa una funcionalidad real para generar workflows automáticamente consumiendo un microservicio de IA. Permite a los administradores escribir una descripción en texto plano de una política de negocio y que la IA genere automáticamente el diagrama de flujo completo.

## Arquitectura

### Componentes Principales

#### 1. **Servicio de Consumo del Microservicio** (`ia-workflow.service.ts`)
Realiza la llamada HTTP real al endpoint `POST /api/ia/texto-a-flujo` del microservicio de IA.

```typescript
// Ejemplo de uso
constructor(private iaService: IaWorkflowService) {}

this.iaService.generarWorkflowDesdeTexto('Descripción del flujo...').subscribe({
  next: (response) => {
    // Respuesta del microservicio
  }
});
```

#### 2. **Modelos de Tipos** (`ia-workflow.model.ts`)
Define las interfaces para tipar la respuesta del microservicio:

- `IaWorkflowResponse`: Estructura completa de la respuesta
- `IaPolicy`: Información de la política
- `IaNode`: Nodos del flujo
- `IaTransition`: Transiciones/conexiones
- `IaForm`: Formularios dinámicos
- `IaBusinessRule`: Reglas de negocio
- `IaAnalysis`: Análisis y complejidad

#### 3. **Servicio de Mapeo** (`ia-workflow-mapper.service.ts`)
Convierte la respuesta del microservicio al formato interno del sistema:

```typescript
const { nodos, conexiones } = this.mapperService.mapIaResponseToWorkflow(response);
```

Mapeos:
- `start` → `INICIO`
- `task` → `ACTIVIDAD`
- `decision` → `DECISION`
- `parallel_start` → `FORK`
- `parallel_end` → `JOIN`
- `end` → `FIN`

#### 4. **Componente Modal** (`ia-workflow-generator/`)
Componente Angular standalone que:
- Proporciona un textarea para escribir la descripción
- Maneja el estado de carga, error y éxito
- Muestra un preview del workflow generado
- Emite el resultado al componente padre

Archivos:
- `ia-workflow-generator.ts`: Lógica del componente
- `ia-workflow-generator.html`: Template
- `ia-workflow-generator.css`: Estilos

#### 5. **Integración en Canvas Designer** (`canvas-designer.ts/html`)
Integra el modal en la página principal de diseño:

```html
<app-ia-workflow-generator
  [isOpen]="showIaWorkflowModal"
  (workflowGenerated)="onIaWorkflowGenerated($event)"
  (closeRequested)="closeIaWorkflowModal()"
></app-ia-workflow-generator>
```

Métodos principales:
- `openIaWorkflowModal()`: Abre el modal
- `closeIaWorkflowModal()`: Cierra el modal
- `onIaWorkflowGenerated(event)`: Procesa el workflow generado

## Flujo de Ejecución

```
Usuario escribe descripción
        ↓
Presiona "Generar Workflow"
        ↓
IaWorkflowService.generarWorkflowDesdeTexto() 
        ↓
POST /api/ia/texto-a-flujo con { descripcion: "..." }
        ↓
Respuesta IaWorkflowResponse (nodos, transiciones, análisis)
        ↓
IaWorkflowMapperService mapea al formato interno
        ↓
Canvas muestra preview con estadísticas
        ↓
Usuario acepta o rechaza
        ↓
Si acepta: nodos y conexiones se aplican al canvas
```

## Manejo de Estados

### Estados del Modal

1. **Formulario de entrada**: Usuario escribe la descripción
2. **Cargando**: La IA está procesando (spinner visible)
3. **Preview**: Se muestra el resultado para confirmar
4. **Error**: Mensaje de error amigable si falla

### Validaciones

- ✅ Descripción no vacía (mínimo 10 caracteres)
- ✅ Respuesta del microservicio no vacía
- ✅ Nodos y transiciones generados correctamente
- ✅ Manejo robusto de errores HTTP

## Manejo de Errores

El componente maneja estos casos:

```typescript
// Error de conexión (status 0)
"Error de conexión. Verifica tu conexión a internet."

// Solicitud inválida (status 400)
"La descripción no es válida. Intenta con más detalles."

// Error del servidor (status 500)
"Error en el servidor. Intenta más tarde."

// Servicio no disponible (status 503)
"El servicio de IA no está disponible en este momento."
```

## Uso en Canvas Designer

### 1. Abrir el Modal

```typescript
// Botón en la paleta de elementos
<button (click)="openIaWorkflowModal()">
  <lucide-icon name="sparkles"></lucide-icon> Generar con IA
</button>
```

### 2. Procesar el Workflow Generado

```typescript
onIaWorkflowGenerated(event: {
  nodos: Nodo[];
  conexiones: Conexion[];
  analysis: IaWorkflowResponse['analysis'];
}): void {
  // Mapea los nodos a NodoCanvas con posiciones iniciales
  const positionedNodos = event.nodos.map((nodo, index) => ({
    ...nodo,
    x: (index % 3) * 400 + 200,
    y: Math.floor(index / 3) * 300 + 150,
  }));

  // Aplica al canvas
  this.nodos.set(positionedNodos);
  this.conexiones.set(event.conexiones);
  
  // Sincroniza cambios colaborativos
  this.queueAutoSave();
}
```

## Respuesta del Microservicio (Ejemplo)

```json
{
  "policy": {
    "name": "Solicitud de Licencia",
    "description": "Flujo de aprobación de licencias",
    "objective": "Automatizar el proceso de solicitud de licencia",
    "version": "1.0"
  },
  "roles": [
    {
      "id": "jefe_directo",
      "name": "Jefe Directo",
      "description": "Responsable de aprobar licencias"
    }
  ],
  "nodes": [
    {
      "id": "start_1",
      "type": "start",
      "name": "Inicio",
      "description": "Punto de entrada",
      "responsibleRoleId": null,
      "formId": null,
      "decisionCriteria": null
    },
    {
      "id": "task_1",
      "type": "task",
      "name": "Solicitar Licencia",
      "description": "El empleado solicita licencia",
      "responsibleRoleId": "empleado",
      "formId": "form_1",
      "decisionCriteria": null
    },
    {
      "id": "decision_1",
      "type": "decision",
      "name": "¿Aprobada?",
      "description": "Decisión del jefe directo",
      "responsibleRoleId": "jefe_directo",
      "formId": null,
      "decisionCriteria": "Validar documentos y disponibilidad"
    }
  ],
  "transitions": [
    {
      "id": "trans_1",
      "from": "start_1",
      "to": "task_1",
      "label": "Ir a solicitud",
      "condition": null
    }
  ],
  "forms": [
    {
      "id": "form_1",
      "nodeId": "task_1",
      "name": "Solicitud de Licencia",
      "fields": [
        {
          "id": "field_1",
          "label": "Fecha de inicio",
          "type": "date",
          "required": true,
          "options": []
        }
      ]
    }
  ],
  "businessRules": [],
  "analysis": {
    "summary": "Flujo simple de aprobación de licencias",
    "assumptions": [
      "El jefe directo siempre está disponible"
    ],
    "warnings": [
      "No hay escalamiento si el jefe rechaza"
    ],
    "complexity": "low"
  }
}
```

## Configuración del Endpoint

El endpoint se construye automáticamente desde la configuración existente:

```typescript
// En ia-workflow.service.ts
private readonly iaUrl = `${API_ENDPOINTS.politicas.replace(/\/api\/politicas$/, '')}/api/ia`;

// Resultado: {API_BASE_URL}/api/ia/texto-a-flujo
```

## Estilos y UX

### Características de Diseño

- ✅ Modal overlay con blur background
- ✅ Animaciones fluidas (fade-in, slide-in)
- ✅ Responsive (mobile-friendly)
- ✅ Indicador de carga con spinner
- ✅ Validación en tiempo real
- ✅ Mensajes de error y éxito

### Estados Visuales

| Estado | Visual |
|--------|--------|
| Cargando | Spinner + "La IA está analizando..." |
| Éxito | Preview con estadísticas + análisis |
| Error | Mensaje rojo con ícono de alerta |
| Vacío | Mensaje amigable "Sin datos válidos" |

## Integración con Colaboración

El workflow generado se sincroniza automáticamente con el sistema de colaboración en tiempo real:

```typescript
// Después de aplicar el workflow
this.queueAutoSave();

// Emite cambios a otros usuarios conectados
this.collabFacade.emitUpdateCanvasState({
  nodos: this.nodos(),
  conexiones: this.conexiones(),
});
```

## Testing

### Casos de Prueba

```typescript
// 1. Validación de entrada
generarWorkflow();
// Esperado: Toast de error "Descripción vacía"

// 2. Descripción válida
descripcion.set("Un cliente solicita licencia...");
generarWorkflow();
// Esperado: Modal muestra spinner de carga

// 3. Respuesta exitosa
// Mockear HTTP response
// Esperado: Preview con estadísticas

// 4. Error del servidor
// Mockear HTTP error 500
// Esperado: Toast de error + mensaje amigable
```

## Mejoras Futuras

- [ ] Guardar descripciones anteriores como plantillas
- [ ] Regenerar workflows con parámetros personalizados
- [ ] Exportar workflow a JSON antes de aplicar
- [ ] Historial de workflows generados
- [ ] Integración con modelos de IA más avanzados
- [ ] Validación de nodos antes de aplicar

## Archivos Creados

```
src/app/features/admin/
├── components/
│   └── ia-workflow-generator/
│       ├── ia-workflow-generator.ts
│       ├── ia-workflow-generator.html
│       └── ia-workflow-generator.css
├── models/
│   └── ia-workflow.model.ts
├── services/
│   ├── ia-workflow.service.ts
│   └── ia-workflow-mapper.service.ts
└── pages/
    └── canvas-designer/
        ├── canvas-designer.ts (actualizado)
        ├── canvas-designer.html (actualizado)
        └── canvas-designer.css (actualizado)
```

## Notas Importantes

1. **No hay datos mock**: El servicio consume un endpoint real
2. **Tipos completos**: Todas las respuestas están tipadas
3. **Manejo robusto de errores**: Validaciones en todos los pasos
4. **Responsive**: Compatible con mobile
5. **Accesible**: ARIA labels y navegación por teclado
6. **Sincronización**: Integrado con colaboración en tiempo real
