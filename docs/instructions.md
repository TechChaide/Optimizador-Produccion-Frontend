# INSTRUCCIONES PARA EL ASISTENTE DE IA

## 1. Stack Tecnológico
- **Framework:** Next.js (App Router), TypeScript, TailwindCSS, ShadCN UI.

## 2. Reglas de Negocio Maestras

### 2.1. Planificación Pull y Prioridad de Cumplimiento
- **Fechas de Forros (Padres):** Son **INAMOVIBLES**. El plan de producto terminado no se posterga para asegurar el nivel de servicio.
- **Fecha Límite de Componentes (JIT):** Los componentes deben estar listos el **mismo día** de la fecha fija del Forro padre o, como máximo, **un día antes**.
- **Ajuste de Capacidad en Componentes:** La ventana de 24 horas antes de la fecha del forro es el espacio para balancear la carga.
- **Configuración de Turnos y Headcount:** La capacidad por puesto se calcula multiplicando (Horas de Turno) x (Número de Turnos) x (Número de Personas por Turno) x (Eficiencia 84%).
- **Capacidad Máxima de Prueba:** Para un sistema de 2 turnos, la capacidad efectiva es de **14.49 horas/día**.
- **Jerarquía de Ajuste de Capacidad:**
    1. **Versión de Fabricación:** Si hay sobrecarga, buscar versiones alternativas (otras máquinas compatibles) para el componente.
    2. **Arrastre Sincronizado:** Cualquier cambio en un "Hijo" (Tapa/Banda) debe validar su disponibilidad para la fecha fija del "Padre" (Forro).
- **Prioridad de Destino:** GYE (Fecha 1) tiene prioridad absoluta sobre los recursos (tiempos de máquina).

### 2.2. Vínculo Técnico y Sincronización Estricta
- **Regla Espejo ACH-PEF:** El número de máquina `XX` de Acolchado (`HR-ACHXX`) y Tapas (`HR-PEFXX`) debe ser el mismo. Si una orden de tapa se mueve a `ACH09` por balanceo, su tapa debe ir a `PEF09`.
- **Especialización de Acolchado:** 
    - **ACH10, 06, 02:** Líneas Económica a Premium Estándar.
    - **ACH08, 09:** Líneas Superiores (Continental, etc.).
    - **ACH09 (Exclusividad):** Referencias Top (Grand Palace, Escape, Resiflex).

### 2.3. Flujos de Componentes y Unidades
- **Bandas:** `ACH11/12/BO01` (Metros) -> `RMTBx` (Unidades) -> `COS3D/ENCBD` (Metros) -> `RMTBm` (Unidades).
- **Interiores:** `INTPR/T` -> `INTPf`. Requiere bandas de `ACH11/12`.
- **Bases:** `MTBS1` (requiere `ACH11/12`) y `MTBS` (telas).
- **Corte de Telas:** Una sola máquina y **una sola persona** para todos los puestos `HR-CT`.
- **Telas y Fundas:** Flexibilidad `TTCF` -> `INTPf` en caso de saturación.

### 2.4. Flexibilidad de Personal
- Puestos al **50% de capacidad** permitidos para optimizar mano de obra.
- Factor de eficiencia del **84%**.

## 3. Protocolo de Datos
- **Códigos de Material:** Normalizar eliminando ceros a la izquierda.
- **Explosión de Materiales (BOM):** Usar la tabla BOM para vincular Forros con sus componentes específicos.
- **Visualización:** Tiempos y cantidades con **dos decimales**.

## 4. Estilo de Interacción
- Validar siempre que el movimiento de un componente no comprometa la fecha fija del Forro.
- Mantener la integridad de la regla espejo ACH-PEF en cada balanceo por versión.
- El componente puede estar el mismo día del forro, o un día antes, pero nunca después.
