# Sistema de Observabilidad Profunda (Runtime Inspector)

## 🎯 Resumen

He implementado un **sistema hypervisor completo** que permite al usuario hacer preguntas sobre CUALQUIER variable, operación o estado de la aplicación en tiempo real. El agente de IA puede ahora responder preguntas como:

- "¿Qué valor tiene la variable loadedData?"
- "¿Cuántos registros se cargaron?"
- "¿Qué filtros está usando el usuario?"
- "¿Por qué falló esta operación?"
- "Muéstrame el estado actual del componente DataImport"

---

## 🏗️ Arquitectura

### 1. **RuntimeInspector Service** (`src/services/RuntimeInspector.ts`)
El núcleo del sistema que captura:
- ✅ **Variables**: Cualquier variable de cualquier scope (component, function, api, calculation)
- ✅ **Contextos de Ejecución**: Inputs, outputs, errores, stack traces
- ✅ **Estados de Componentes**: State, props, computed values
- ✅ **Metadata**: Descripciones, dependencias, fuentes de datos

**Características:**
- Single source of truth (patrón Singleton)
- Sistema de suscripción para updates en tiempo real
- Serialización segura (evita referencias circulares)
- Límites de almacenamiento (últimas 50 variables por sección, 100 contextos)
- Búsqueda y filtrado por sección o nombre

### 2. **Chat Tools** (`src/app/actions/chat-tools.ts`)
Nuevas herramientas para el agente:

#### `inspectVariablesTool`
Inspecciona variables en tiempo real:
```typescript
// Ejemplo de uso por el agente:
{
  section: "DataImport",           // Opcional: filtrar por sección
  variableName: "loadedData",      // Opcional: buscar por nombre
  limit: 20                        // Opcional: limitar resultados
}
```

#### `inspectExecutionContextTool`
Inspecciona contextos de ejecución:
```typescript
{
  section: "DataImport",           // Opcional
  limit: 10
}
```
Devuelve:
- Contextos activos (operaciones en ejecución)
- Contextos recientes (completados/fallidos)
- Inputs, outputs, errores, stack traces
- Duración de ejecución

#### `inspectStateTool`
Inspecciona el estado de componentes:
```typescript
{
  section: "DataImport"            // Opcional: muestra todos si se omite
}
```
Devuelve:
- Estado interno del componente
- Props recibidos
- Valores computados

### 3. **Debug Panel** (`src/components/DebugPanel.tsx`)
Panel visual flotante que muestra:
- 📊 **Variables Tab**: Todas las variables capturadas con sus valores
- ⚙️ **Contexts Tab**: Contextos de ejecución con inputs/outputs
- 🗂️ **States Tab**: Estados de componentes
- 🔍 **Filtros**: Por sección (DataImport, ProductionPlan, etc.)
- 📈 **Stats Bar**: Total de variables, contextos activos, secciones monitoreadas

**Ubicación**: Botón flotante morado (icono Bug) en la parte inferior derecha

### 4. **Hook de Instrumentación** (`useRuntimeInspector`)
Hook fácil de usar en cualquier componente:

```typescript
import { useRuntimeInspector } from '@/services/RuntimeInspector';

const inspector = useRuntimeInspector('SectionName');

// Capturar variables
inspector.captureVariable('myVar', value, {
  description: 'Descripción de la variable',
  source: 'api' | 'user' | 'calculation' | 'state',
  dependencies: ['otherVar1', 'otherVar2']
});

// Capturar estado completo
inspector.captureState(
  { loading: true, data: [] },  // state
  { prop1: value },              // props (opcional)
  { computed1: value }           // computed (opcional)
);

// Iniciar contexto de ejecución
const ctxId = inspector.startContext('load_data', { 
  filters: {...} 
});

// Actualizar contexto
inspector.updateContext(ctxId, 'running', {
  outputs: { partial: data }
});

// Completar contexto
inspector.updateContext(ctxId, 'completed', {
  outputs: { total: 100, data: [...] }
});

// Fallar contexto
inspector.updateContext(ctxId, 'failed', {
  error: 'Error message',
  stackTrace: error.stack.split('\n')
});
```

---

## 📝 Implementación Actual

### DataImportSection (Ejemplo Instrumentado)

Ya instrumenté completamente el componente `DataImportSection` como ejemplo:

1. **Variables Capturadas:**
   - `filterOptions`: Opciones de filtros disponibles
   - `filters`: Filtros activos aplicados por el usuario
   - `loadedData`: Datos cargados desde la API
   - `totalRecords`: Total de registros importados
   - `consolidatedRows`: Filas después de consolidar

2. **Contextos de Ejecución:**
   - `load_budget_data`: Proceso completo de carga
     - Inputs: Filtros aplicados, timestamp
     - Outputs: Total de registros, filas consolidadas, muestra de datos
     - Errores: Capturados con stack traces

3. **Estado del Componente:**
   - Capturado al montar con flags iniciales

---

## 🚀 Cómo Usar

### Para el Usuario:

#### 1. **Panel Visual (Debug Panel)**
- Clic en el botón morado (Bug icon) en la esquina inferior derecha
- Navegar por las pestañas:
  - **Variables**: Ver todas las variables con sus valores
  - **Contexts**: Ver operaciones en ejecución y completadas
  - **States**: Ver estado interno de los componentes
- Filtrar por sección usando el dropdown

#### 2. **Preguntas al Chat**
El usuario puede hacer preguntas naturales:

```
Usuario: "¿Qué valor tiene loadedData en DataImport?"
Agente: *Usa inspectVariablesTool* → Responde con el valor actual

Usuario: "¿Cuántos registros se cargaron?"
Agente: *Usa inspectVariablesTool buscando 'totalRecords'* → Responde

Usuario: "¿Por qué falló la última operación?"
Agente: *Usa inspectExecutionContextTool* → Muestra error y stack trace

Usuario: "Muéstrame todos los filtros activos"
Agente: *Usa inspectVariablesTool buscando 'filters'* → Lista filtros

Usuario: "¿Qué está pasando ahora?"
Agente: *Usa inspectExecutionContextTool + getOperationsSummary* → Lista operaciones activas

Usuario: "Dame el estado actual de DataImport"
Agente: *Usa inspectStateTool* → Muestra state, props, computed
```

### Para Desarrolladores:

#### Instrumentar Nuevos Componentes:

```typescript
import { useRuntimeInspector } from '@/services/RuntimeInspector';

export const MyComponent = () => {
  const inspector = useRuntimeInspector('MyComponent');
  
  const [data, setData] = useState([]);
  
  // Capturar cambios de estado
  useEffect(() => {
    inspector.captureVariable('data', data, {
      description: 'Lista de datos del componente',
      source: 'state'
    });
  }, [data]);
  
  // Instrumentar operaciones
  const loadData = async () => {
    const ctxId = inspector.startContext('load_data', { page: 1 });
    
    try {
      const result = await fetchData();
      
      inspector.captureVariable('result', result, {
        description: 'Resultado de la API',
        source: 'api'
      });
      
      inspector.updateContext(ctxId, 'completed', {
        outputs: { count: result.length }
      });
    } catch (error) {
      inspector.updateContext(ctxId, 'failed', {
        error: error.message,
        stackTrace: error.stack?.split('\n')
      });
    }
  };
  
  // Capturar estado periódicamente
  useEffect(() => {
    inspector.captureState(
      { data, loading: false },
      { prop1: 'value' },
      { totalItems: data.length }
    );
  }, [data]);
  
  return <div>...</div>;
};
```

---

## 🎨 Próximos Pasos Recomendados

1. **Instrumentar más componentes:**
   - ProductionPlanSection
   - ConstraintConfigurationSection
   - MaintenanceSection
   - Etc.

2. **Agregar más metadata:**
   - Descripciones más detalladas
   - Dependencias entre variables
   - Categorías/tags

3. **Extender herramientas del chat:**
   - Comparar valores entre timestamps
   - Buscar por tipo de variable
   - Graficar evolución de variables

4. **Exportar/Importar:**
   - Guardar snapshots del estado
   - Replay de operaciones
   - Exportar debug logs

---

## 📊 Ejemplo de Flujo Completo

```
1. Usuario abre DataImportSection
   → RuntimeInspector captura estado inicial

2. Usuario selecciona filtros (año: 2024, centro: 1000)
   → RuntimeInspector captura variable 'filters'

3. Usuario hace clic en "Cargar Datos"
   → RuntimeInspector inicia contexto 'load_budget_data'
   → Captura inputs (filtros)
   
4. API devuelve datos
   → RuntimeInspector captura variable 'loadedData'
   → Captura 'totalRecords', 'consolidatedRows'
   
5. Operación completa
   → RuntimeInspector completa contexto con outputs
   
6. Usuario pregunta en el chat: "¿Cuántos registros cargaste?"
   → Agente usa inspectVariablesTool
   → Busca 'totalRecords' en sección 'DataImport'
   → Responde: "Se cargaron 3,258 registros que se consolidaron en 1,142 filas"
```

---

## 🎯 Beneficios

✅ **Transparencia Total**: El usuario ve exactamente qué está haciendo el código
✅ **Debugging Fácil**: Identificar problemas sin revisar código
✅ **AI-Powered**: El agente puede responder preguntas técnicas sin intervención humana
✅ **Real-Time**: Datos en vivo, no logs estáticos
✅ **Extensible**: Fácil agregar nuevas secciones y variables
✅ **No Invasivo**: No afecta el rendimiento de la aplicación

---

## 🔧 Mantenimiento

- **Límites de Memoria**: Configurados automáticamente (50 vars/sección, 100 contextos)
- **Serialización Segura**: Evita crashes por objetos complejos
- **Timestamps**: Todas las capturas incluyen timestamp para debugging temporal
- **Suscripciones**: Auto-cleanup al desmontar componentes

---

¡El sistema está listo para usar! 🚀
