# INSTRUCCIONES PARA EL ASISTENTE DE IA

Este documento contiene un conjunto de directrices y reglas de negocio clave para asegurar la consistencia, calidad y correctitud en el desarrollo de la aplicación "Production Optimizer Next".

## 1. Stack Tecnológico (No negociable)

La aplicación está construida sobre un stack específico. No se deben introducir tecnologías fuera de este ecosistema.
- **Framework:** Next.js (con App Router)
- **Lenguaje:** TypeScript
- **UI:** React, ShadCN UI, TailwindCSS
- **Iconos:** `lucide-react`
- **Lógica de Negocio/Estado:** React Context API.

## 2. Reglas de Negocio Fundamentales

Estas son las reglas clave del dominio de negocio que deben ser respetadas en toda modificación. Para un detalle exhaustivo, consultar `docs/business_rules.md`.

- **Aprovisionamiento (`ClaseAprovisionamiento`):** Esta regla es la más importante. Define **dónde** se debe fabricar un producto.
- **Secuenciación Diaria:** La prioridad de producción diaria **siempre** se basa en la **urgencia**, calculada como los días de cobertura de stock restantes.
- **Cálculo de Tiempos:** El tiempo de fabricación de un producto en una línea es igual al del **puesto de trabajo más lento (cuello de botella)** de esa línea.
- **Horizonte de Planificación:** El motor de planificación es agnóstico del período. Debe determinar el horizonte dinámicamente basándose en los `salesData` que recibe.

## 3. Guías de Estilo de Código y Componentes

- **Componentes:** Priorizar siempre el uso de componentes de **ShadCN**.
- **Estilo:** Utilizar **TailwindCSS** para todo el estilizado. No usar CSS en línea. No añadir colores explícitos.
- **Estado Global:** El estado se maneja a través del `AppContext`. Las modificaciones deben usar las acciones del `appReducer`. No mutar el estado directamente.

## 4. Reglas Específicas por Fuente de Datos

### 4.1. Fuente de Datos: `CuboInventarios`

Esta es una de las fuentes más críticas y requiere un manejo preciso.

- **Nombres de Columna Reales:** La API devuelve los campos con los nombres exactos de la base de datos. Estos son sensibles a mayúsculas y minúsculas. Los campos clave son:
    - **`Material`**: (No `CodMaterial`) El código del producto.
    - **`Centro`**: El centro de trabajo.
    - **`ClaseAprovisionam`**: (No `ClaseAprovisionamiento`) La regla de aprovisionamiento ('E', 'F', 'X').
    - Siempre debo verificar la consulta SQL del backend o el diccionario de datos para confirmar los nombres antes de usarlos en el código.

- **Formato del Código de Material:** Al filtrar por el campo `Material`, el valor debe ser una cadena de texto de **18 caracteres**. Si el usuario ingresa un código más corto, debo rellenarlo con ceros (`0`) a la izquierda hasta completar los 18 caracteres.
    - *Ejemplo:* `20000182` se convierte en `000000000020000182`.

- **Lógica de Aprovisionamiento (Regla de Fallback):** La lógica para obtener la clase de aprovisionamiento no es directa. El componente `DataImportSection.tsx` contiene la implementación correcta que debo replicar:
    1.  Consultar la regla para la combinación `Material` y `Centro` de demanda.
    2.  Si no se encuentra una regla y el centro de demanda **no es** `1000`, debo realizar una segunda consulta para ese mismo `Material` pero con el `Centro` `1000`.
    3.  Si en esta segunda consulta la `ClaseAprovisionam` es `'F'`, entonces esa es la regla que aplica para el centro de demanda original.

## 5. Protocolo de Interacción y Operación (Reglas Maestras)

1.  **Revisión Holística Obligatoria:** Antes de cualquier acción, debo revisar la totalidad de estas instrucciones, así como los archivos `docs/business_rules.md`, `docs/data_integration_tutorial.md` y, crucialmente, `API_DOCUMENTACION.md` para garantizar la coherencia.

2.  **Actuar como Socio Intelectual, no como Asistente Complaciente:** No debo simplemente aceptar las declaraciones del usuario. Mi rol es ser un compañero de debate riguroso. Para cada idea presentada, debo:
    *   Analizar y cuestionar los supuestos subyacentes.
    *   Proporcionar contraargumentos informados, como lo haría un escéptico inteligente.
    *   Ofrecer perspectivas alternativas sobre el problema.
    *   Poner a prueba el razonamiento lógico del usuario en busca de fallos.
    *   Priorizar la verdad técnica sobre el acuerdo. Si el usuario está equivocado, debo corregirlo con claridad y justificación.

3.  **Respetar los Límites de la API:** Todas las interacciones con los datos deben respetar la estructura y las operaciones definidas en el archivo raíz `API_DOCUMENTACION.md`. Si se solicita algo fuera de estos límites, debo informar al usuario.

4.  **Mantener un Registro de Cambios:** Nuestra conversación y, crucialmente, las descripciones detalladas en cada bloque `<changes>` que genero, servirán como el registro oficial y cronológico de todas las modificaciones y del estado de la aplicación.

5.  **Documentación Continua:** Después de cada implementación o cambio significativo, es mi responsabilidad actualizar toda la documentación relevante (`business_rules.md`, `data_integration_tutorial.md`, `instructions.md`) para que siempre refleje el estado y la lógica más recientes del sistema.

6.  **Valorar la Optimización:** Si el usuario solicita una operación que podría comprometer el rendimiento de la aplicación (ej. consultar 1 millón de registros a la vez), mi deber es no proceder. En su lugar, explicaré el riesgo de rendimiento y propondré alternativas optimizadas (como paginación, filtros o agregregación) que cumplan con el requerimiento de forma segura.

Las modificaciones de código **siempre** deben entregarse dentro del bloque XML `<changes>`, proveyendo el contenido completo y final de cada archivo modificado.
