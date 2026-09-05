# Hoja de Ruta y Tutorial de Depuración del Plan de Producción

Este documento sirve como una guía paso a paso para depurar y validar todo el flujo de generación del plan de producción, desde la carga de datos inicial hasta la visualización del plan final.

**Objetivo:** Islar y verificar cada componente del proceso para asegurar que los datos fluyen correctamente y que la lógica de negocio se aplica según lo esperado.

---

## **Paso 0: Preparación**

**Acción:** No se requiere ninguna acción en la aplicación. Este es un paso de preparación conceptual.

**Verificación:**
1.  Abra las herramientas de desarrollador de su navegador (usualmente con F12 o `Ctrl+Shift+I`).
2.  Seleccione la pestaña "Consola". Aquí es donde aparecerán todos los logs que hemos instrumentado.
3.  Mantenga esta consola abierta y limpia (puede usar el botón de limpiar consola) antes de iniciar cada paso.

**Criterio de Éxito:** Estar listos para observar el flujo de datos en tiempo real.

---

## **Paso 1: Importación y Validación de Datos de Ventas**

**Objetivo:** Asegurar que los datos del presupuesto de ventas se cargan y se transforman correctamente desde la API.

### Incidente Común: Error de CORS

Al entrar a la pestaña "Importar Ventas", es posible que la aplicación no muestre las opciones en los filtros y la consola del navegador muestre un **error de CORS**.

- **Log del Error:** `Access to fetch at 'https://intranet.chaide.com/...' has been blocked by CORS policy...`
- **Causa:** El navegador, por seguridad, bloquea las peticiones desde el dominio de desarrollo hacia el dominio de la API (`intranet.chaide.com`).
- **Solución Aplicada:** Se configuró un "proxy de reescritura" en el archivo `next.config.ts`. Esto hace que la aplicación apunte a una URL local (ej. `/Aplicativos/Api...`) y el servidor de Next.js redirige la petición de forma interna, evitando el problema de CORS.

### Depuración del Paso 1

**Acción en la UI:**
1.  Navegue a la sección **"Importar Ventas"**. (Las opciones de los filtros ya deberían cargar correctamente).
2.  Seleccione el año `2025` y el mes `Enero`.
3.  Presione el botón **"Previsualizar"**.

**Qué Observar en la Consola:**
1.  **Consulta a la API:** Busque el log que comienza con `[useApiData] Querying API:`.
    *   Verifique que el objeto `filters` contenga `Año: 2025` y `Mes: 1`.
    *   **Esta es la consulta exacta que puede replicar en Swagger para validar la respuesta de la API.**
2.  **Respuesta de la API:** Busque el log `[useApiData] API Response:`.
    *   Confirme que la respuesta es un arreglo de objetos y no está vacío.
3.  **Transformación de Datos:** Busque el log `[DataImportSection] Mapped data for preview:`.
    *   Verifique que el número de registros coincide con la respuesta de la API.
    *   Inspeccione uno o dos objetos del arreglo y confirme que la estructura coincide con el tipo `SalesDataRow` (ej. `código` normalizado a 8 dígitos, `centro` sin espacios extra, etc.).

**Criterio de Éxito:** La tabla de previsualización en la interfaz se llena con datos y los logs en la consola confirman que la consulta a la API y la transformación de datos son correctas. Solo entonces avanzaremos.

---

## **Paso 2: Sincronización y Validación de Datos Maestros**

**Objetivo:** Confirmar que la estructura de producción (centros, líneas, puestos) y los tiempos de ensamble se descubren y validan correctamente.

**Acción en la UI:**
1.  Navegue a la sección **"Definir Restricciones"**.
2.  Presione el botón **"Sincronizar y Validar Datos"**.

**Qué Observar en la Consola:**
1.  **Consulta a la API:** Busque el log `[useApiData] Querying API:` para la fuente `TiemposEnsamblado`.
    *   Verifique que la consulta no tiene filtros y pide todos los datos (`operation: 'get_data'`).
2.  **Procesamiento de Datos:** Busque el log `--- INICIANDO PROCESAMIENTO Y VALIDACIÓN DE DATOS DE ENSAMBLE ---`.
3.  **Estructura Descubierta:** Revise los logs que muestran:
    *   `Work Centers Discovered:`
    *   `Production Lines Discovered:`
    *   `Workstation Definitions Discovered:`
    *   Confirme que los nombres y cantidades parecen lógicos y corresponden a su conocimiento de la operación.
4.  **Errores de Validación:** Busque específicamente si aparece el log `[VALIDATION ERRORS]`. Si este log aparece, la ejecución se detendrá y nos mostrará los problemas exactos que encontró (ej. productos en la demanda sin tiempos de ensamble, etc.).

**Criterio de Éxito:** El proceso termina con un mensaje de "Sincronización exitosa" en la UI. La consola no debe mostrar errores de validación. La estructura de producción descubierta en la UI debe ser coherente.

---

## **Paso 3: Generación del Plan de Producción**

**Objetivo:** Validar que el motor de optimización carga correctamente todos los datos de ventas del año y genera un plan completo.

**Acción en la UI:**
1.  Navegue a la sección **"Plan de Producción"**.
2.  Presione el botón **"Iniciar Planificación"**.

**Qué Observar en la Consola:**
1.  **Inicio y Carga de Datos:** Verá una serie de notificaciones `Carga de datos de ventas completada. Se encontraron X registros en total...`. El número de registros debe ser grande (decenas de miles) si cargó todo el año.
2.  **Lógica Mensual:** Revise los logs que comienzan con `--- Planificando Mes X / 12 ---`. Confirme que el proceso avanza por todos los meses que contienen datos de ventas sin detenerse.
3.  **Lógica Diaria:** Al final, el proceso debe entrar en la generación del plan diario. Verá logs como `--- Procesando Plan Diario para Mes X/2025 ---` y `Día X: Procesando...`.

**Criterio de Éxito:** El proceso completo debe terminar, la interfaz debe mostrar los 4 pasos del "wizard" de planificación y la tabla del plan diario debe llenarse con datos correspondientes a los meses cargados, sin que el navegador se congele.
