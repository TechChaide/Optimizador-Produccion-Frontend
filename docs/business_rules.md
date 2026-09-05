# Documentación de Reglas de Negocio y Fuentes de Datos

Este documento detalla la lógica de negocio y las fuentes de datos utilizadas por el Optimizador de Producción para generar los planes de mediano y corto plazo.

## 1. Fuentes de Datos Principales

La planificación se basa en la información extraída de dos fuentes de datos principales a través de la API interna.

### 1.1. Tabla: `Presupuesto`

Esta tabla contiene la proyección de ventas y es el principal impulsor de la demanda.

- **API Query:** `{ source: 'Presupuesto', operation: 'get_data' }`
- **Campos Críticos Utilizados:**
    - `Año`, `Mes`: Definen el período de la demanda.
    - `CodMaterial`: Código del producto vendido. Se normaliza para obtener el código base de 8 dígitos.
    - `Centro`: **Centro de Demanda**. Indica dónde se registra la venta.
    - `UnidadesProyectado`: La cantidad de unidades que se espera vender. Es el principal input para la demanda.
    - `descripciónMaterial`, `Etiqueta`: Se utilizan para obtener un nombre descriptivo del producto.

### 1.2. Tabla: `TiemposEnsamblado`

Esta es la tabla maestra que define la estructura de producción, los tiempos y las reglas de negocio a nivel de producto.

- **API Query:** `{ source: 'TiemposEnsamblado', operation: 'get_data' }`
- **Campos Críticos Utilizados:**
    - `CodMaterial`: Código del producto.
    - `Centro`: Centro de trabajo donde aplica la configuración.
    - `Linea`: Nombre de la línea de producción.
    - `PuestoTrabajo`: Nombre del puesto de trabajo dentro de la línea.
    - `Tiempo`: **Tiempo de ensamble estándar** en minutos por unidad para un producto en un puesto específico. Es la base para calcular la capacidad y las horas requeridas.
    - `ClaseAprovisionamiento`: **Regla de negocio CRÍTICA** que define dónde se fabrica un producto.
    - `StockActual`, `StockSeguridad`, `StockMaximo`: Parámetros de inventario para cada producto en un centro específico. Son fundamentales para calcular la necesidad neta de producción.
    - `TamLoteMin`: El lote mínimo de producción.

---

## 2. Lógica de Negocio del Motor de Planificación

### 2.1. Descubrimiento de Estructura (Sincronización)

Al presionar "Sincronizar", la aplicación no asume una estructura predefinida. La descubre dinámicamente a partir de los datos de `TiemposEnsamblado`:
- **Centros de Trabajo:** Se crean a partir de los valores únicos en el campo `Centro`.
- **Líneas de Producción:** Se crean a partir de las combinaciones únicas de `Centro` y `Linea`.
- **Puestos de Trabajo:** Se crean a partir de las combinaciones únicas de `Centro` y `PuestoTrabajo`.
- **Asignaciones:** La aplicación mapea qué puestos de trabajo pertenecen a qué líneas y qué líneas a qué centros, construyendo la jerarquía operativa completa.

### 2.2. Reglas de Aprovisionamiento (`ClaseAprovisionamiento`)

Esta es una de las reglas más importantes y determina la estrategia de producción y logística:
- **'E' (In-house):** El producto se fabrica en el mismo centro donde se genera su demanda.
- **'F' (Fabricación Centralizada):** El producto **siempre** se fabrica en el centro principal (ID "1000"), sin importar dónde se genere la demanda. El planificador generará automáticamente órdenes de transferencia para mover el producto terminado desde el centro 1000 al centro de demanda.
- **'X' (Flexible):** El producto puede ser fabricado en el centro principal (1000) o en el centro de demanda. Actualmente, la lógica prioriza la fabricación en el mismo centro de la demanda si es posible.

### 2.3. Lógica de Traslados (Cómo funciona la regla 'F')

El sistema no lee una lista de traslados, sino que los **crea y planifica lógicamente**. Este es el proceso:

1.  **Detección de Demanda:** El motor detecta una necesidad de venta. Ej: "Se necesitan 100 unidades del Producto-A en el Centro `2000`".
2.  **Consulta de Regla:** El sistema verifica la `ClaseAprovisionamiento` para el Producto-A y ve que es `'F'`.
3.  **Desplazamiento de la Producción:** En lugar de planificar la producción en el Centro `2000`, el motor **mueve la necesidad de producción** al Centro `1000`. Ahora el plan del Centro `1000` incluye la fabricación de esas 100 unidades adicionales.
4.  **Impacto en Inventarios:**
    *   **Centro `1000` (Fabricante):** Su plan de inventario reflejará una **salida** de 100 unidades por "transferencia". El stock se calcula como: `StockInicial + Producción - VentasPropias - TransferenciasSalientes`.
    *   **Centro `2000` (Receptor):** Su plan de inventario reflejará una **entrada** de 100 unidades por "transferencia" para poder cubrir su demanda de ventas. El stock se calcula como: `StockInicial + TransferenciasEntrantes - VentasPropias`.

En esencia, la regla 'F' actúa como un interruptor que centraliza la fabricación y genera implícitamente las órdenes de transferencia que el plan de inventario debe considerar.

### 2.4. Cálculo de Tiempos y Capacidad

- **Tiempo de Fabricación por Producto:** El tiempo total para fabricar una unidad de un producto en una línea específica se considera igual al **cuello de botella** de esa línea, es decir, al tiempo del puesto de trabajo más lento involucrado en su producción.
- **Capacidad de Línea:** La capacidad total en horas de una línea se calcula sumando las horas laborables de cada día del mes, según lo definido en los `ShiftParameters` (horas normales, extras, de sábados/feriados) y respetando los días no laborables definidos en la restricción de `Holidays`.

### 2.5. Lógica de Planificación Mensual

El objetivo es crear un plan mensual equilibrado.
1.  **Necesidad Neta:** `Producción Requerida = Demanda del Mes + Stock de Seguridad - Stock Inicial del Mes`.
2.  **Suavización de Carga (Adelanto de Producción):** El motor analiza la capacidad ociosa en los meses. Si un mes futuro (ej. Mes 3) tiene un pico de demanda que excede su capacidad, pero un mes actual (ej. Mes 2) tiene horas libres, el sistema automáticamente **adelantará** parte de la producción del Mes 3 al Mes 2 para balancear la carga de trabajo y asegurar el cumplimiento.

### 2.6. Lógica de Secuenciación Diaria (Priorización)

Una vez que se tiene el plan mensual, se desglosa día a día. Esta es la lógica más compleja y crítica:
- **Índice de Urgencia:** Cada día, el sistema **no** produce el producto con la mayor cantidad pendiente. En su lugar, calcula un "índice de urgencia" para cada producto:
    - `Urgencia = (Stock Actual del Día - Demanda Acumulada) / Demanda Diaria Promedio`
- **Prioridad:** El sistema siempre priorizará la fabricación del producto que tenga el **menor índice de urgencia** (menos días de cobertura de stock), minimizando así el riesgo de quiebres de inventario.

### 2.7. Cálculo de Costos

El costo laboral de cada lote de producción se estima multiplicando las horas consumidas por la tarifa horaria, aplicando los factores de recargo (`LaborCostFactors`) según si las horas son normales, extras o de fin de semana/feriado.
