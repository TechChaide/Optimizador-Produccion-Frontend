
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Scissors,
  Package,
  Loader2,
  LayoutDashboard,
  ShoppingCart,
  RefreshCw,
  Wrench,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  CheckCircle2,
  Database,
  Save,
  Truck,
  FileOutput,
  Pencil,
  Trash2,
  Mail
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { serviciosService } from '@/services/servicios.service';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useAppContext } from '@/context/AppProvider';
import type { Grupo, PlanGrupo, DetalleTactico, Restriccion } from '@/types/interfaces';
import type { BodyResponse } from '@/types/body-response';
import { cn } from '@/lib/utils';
import { nextBusinessDay as nextBusinessDayCal, addBusinessDays as addBusinessDaysCal, cargarDiasNoLaborables, fechaLocalEcuador, type DiasNoLaborables } from '@/lib/dias-laborables';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// --- CONSTANTES TÉCNICAS PLANTA ---
// Grupo propio de Corte Espuma ("Taller de Corte") — dueño de su propia fila de restricción
// ALMACEN_CONSUMO (codigo_restriccion 421), separada de la de Laminado (codigo_grupo 8). Solo se usa
// para ESA lectura de restricción (fetchNecesidadesPlanta) — el PlanGrupo que se GRABA como Respuesta
// P3/PFD no usa este código, ver CODIGO_GRUPO_LAMINADO más abajo.
const CODIGO_GRUPO_ESPUMA = 7;

// El PlanGrupo de la Respuesta P3/PFD de Corte Espuma se graba con codigo_grupo = 8 (Corte y
// Laminado), NO con CODIGO_GRUPO_ESPUMA (7) — verificado con datos reales: todas las filas "P3"/"PFD"
// (incluida "P3 - Espumas Venta") quedan bajo codigo_grupo 8 en la tabla real, sin importar si el
// material es de Espuma o de Laminado. Corte Espuma y Corte y Laminado responden como un solo grupo
// SAP (8); grupo 7 solo identifica la restricción propia de este módulo, no la respuesta.
const CODIGO_GRUPO_LAMINADO = 8;

// codigo_grupo real (tabla grupo) de "Ensamblado - Quito" y "Ensamblado - Guayaquil" — dueños del
// plan "PFF" cuya explosión de BOM alimenta la necesidad de lámina ya cortada (LAMINA D##/LAMINA
// RECUPERADA/LAMINA BABY D##) que Corte Espuma corta en carrusel (verificado con datos reales de
// producción: esas órdenes FERT corren en máquinas HR-CAR0x/CL-CAR0x — carrusel, no el LOOPER de
// Corte y Laminado). No se resuelve vía ALMACEN_CONSUMO como Forros/Muebles/Prensado/VentaExterna
// porque acá hace falta un paso adicional (explosión de BOM) que esos orígenes no necesitan.
const CODIGO_GRUPO_ENSAMBLADO_QUITO = 1;
const CODIGO_GRUPO_ENSAMBLADO_GUAYAQUIL = 6;

// El plan de Ensamblado apareció primero como "...- P1" y luego como "...- PFF" en datos reales — no
// hay certeza de cuál nombre se va a consolidar, así que se aceptan ambos. Debe ser el sufijo FINAL
// del valor (no solo "contiene P1"): planes como "...- P1.5 - N1"/"...- P1.3" son de Forros/Muebles y
// no tienen relación con Ensamblado.
const ES_PLAN_ENSAMBLADO_FIRME = (valor: unknown): boolean => /-\s*p1\s*$/i.test(String(valor || '').trim()) || /pff/i.test(String(valor || ''));

// Segundo nivel del BOM del colchón: la lámina YA CORTADA que Corte Espuma produce en carrusel a
// partir de un bloque formulado. Sin restricción de NIVEL: verificado con datos reales (material
// 20006183) que la misma familia de lámina puede aparecer en NIVEL 1, 2 o 3 según el producto (no es
// un nivel fijo — restringir a "nivel 2" pierde matches reales, ver caso 30003777/30004960/30003295
// en nivel 1). "LAMINA D"/"LAMINA RECUPERADA"/"LAMINA BABY D"/"TACO ESPUMA" se prueban explícitos (no
// un patrón genérico "LAMINA...D#"/"ESPUMA") para no capturar "LAMINA CILINDRICA D##" (Corte y
// Laminado) ni "LAMINA PRENSADA D##"/"TACO PRENSADO D##" (Prensado), que son procesos distintos.
// "TACO ESPUMA" se agregó verificado con datos reales: material 30008616 "TACO ESPUMA D30 NRJA
// 189X19.5X7.5" tiene RESP CP 039 (el mismo responsable de operación alterna de Corte Espuma), pero
// no matcheaba con el patrón anterior — quedaba fuera en silencio.
const ES_LAMINA_CORTADA = (desc: string): boolean => /LAMINA D|LAMINA RECUPERADA|LAMINA BABY D|TACO ESPUMA/i.test(String(desc || '').toUpperCase());

// FORRO (funda de tela, no lámina de espuma) — verificado con datos reales del inventario Centro
// 2000: de 122 materiales con responsable "de corte" (002/038/039), 105 son FORRO y solo 17 son
// lámina/espuma real. El responsable "002" en Guayaquil NO es exclusivo de espuma — también cubre
// FORRO, así que confiar solo en el responsable (ver esDeCorte en explotarPFFParaCentro) colaba
// masivamente materiales FORRO como si fueran necesidad de Corte Espuma. Mismo patrón que ya existe
// para "PRENSAD" en getFilteredData (el responsable tampoco alcanza a distinguir ESE proceso).
const ES_FORRO = (desc: string): boolean => /FORRO/i.test(String(desc || ''));

// Cualquier componente del árbol del BOM que mencione "ESPUMA" — mucho más amplio que
// ES_LAMINA_CORTADA a propósito: se usa solo para decidir si vale la pena reportar un material como
// "sin lámina cortada en su BOM" (diagnóstico). Si NINGÚN componente del árbol menciona espuma en
// absoluto (ej. 20009814 "BASE IMPERIAL", cuyo único componente es un FORRO — verificado con datos
// reales, ver captura del usuario), ese material simplemente no necesita Corte Espuma — no es un
// error ni una fila perdida, así que no debe aparecer en el diagnóstico. El diagnóstico solo tiene
// sentido para materiales que SÍ mencionan espuma en algún punto de su árbol pero cuyo patrón exacto
// no coincidió con ES_LAMINA_CORTADA (ahí sí puede haber un gap real de nomenclatura).
const TIENE_COMPONENTE_ESPUMA = (desc: string): boolean => /ESPUMA/i.test(String(desc || ''));
const CAROUSEL_DIAMETER_CM = 320;
// Tiempo real de un ciclo de descarga física del carrusel, cronometrado en campo por el usuario
// (2026-08-31): Centro 1000 (Quito) 2.7 min, Centro 2000 (Guayaquil) 4.48 min — reemplaza el modelo
// simulado con marcadores de posición (ver [[corte_espuma_modelo_carga_descarga_simulado]]; el peso
// máximo de levantamiento ya no se usa: cada sub-bloque corresponde a 1 ciclo real medido, sin
// desglose por peso). Solo cubre DESCARGA — el tiempo de CARGA sigue sin dato real, se deja el "4
// ciclos por la cúpula" existente sin tocar.
const TIEMPO_DESCARGA_CICLO_MIN: Record<string, number> = { '1000': 2.7, '2000': 4.48 };
 // El 13% de pérdidas estándar (OEE) YA se aplica como "Paro T1/T2" de cada turno, que por defecto
// vale 13 y es editable por máquina. Existía además esta constante EFFICIENCY_FACTOR = 0.87 que lo
// volvía a descontar: la capacidad salía ~13% más baja de lo real. Verificado contra el cálculo del
// usuario y contra Corte y Laminado, que aplica el 0.87 UNA sola vez:
//   Turno Día  07:00-15:45 = 8.75 h → −13% = 7.61 → ×90% rendimiento = 6.85 h
//   Turno Noche 21:00-05:30 = 8.50 h → −13% = 7.40 → ×90% rendimiento = 6.66 h
// Fórmula vigente: horas_turno × (1 − paro%) × (rendimiento%). Nada más.
// TiempoCorte de KPIMaestroCarruseles viene en segundos (Tiempos Ensamblado ya viene en minutos)
// y no incluye una actividad adicional del proceso que Tiempos Ensamblado sí contempla — se
// homologa a minutos y se le suma ese 35% cuando se usa como respaldo.
const CARRUSEL_TIEMPO_CORTE_A_MINUTOS = 1 / 60;
const CARRUSEL_ACTIVIDAD_ADICIONAL_FACTOR = 1.35;

// Responsables de Control de Producción de Corte, por centro. Es solo el RESPALDO: los valores reales
// se leen de las restricciones del grupo "Corte y Laminado" de cada centro (ver
// responsablesPorCentro), que es donde el negocio los mantiene. Esta lista queda como red de
// seguridad para el arranque —antes de que las restricciones carguen— y para el caso de que un centro
// no tenga la restricción creada.
//
// Grupos reales: Centro 1000 → grupo 8, Centro 2000 → grupo 16. Restricciones que se leen:
//   RespCtrlProd             → TODOS los responsables permitidos del centro
//   RespCtrlProd_Verticales  → subconjunto que trabaja en corte VERTICAL
//   (carruseles = permitidos − verticales, no hay restricción propia)
const ALLOWED_RESP_CORTE_FALLBACK: Record<'1000' | '2000', string[]> = {
  '1000': ['013', '038', '039', '044', '036', '029'],
  '2000': ['002', '038', '039'],
};
const VERTICALES_RESP_FALLBACK: Record<'1000' | '2000', string[]> = {
  '1000': ['039', '036', '029'],
  '2000': ['039'],
};
const CODIGO_GRUPO_CORTE_POR_CENTRO: Record<'1000' | '2000', number> = { '1000': 8, '2000': 16 };
const NOMBRE_RESTRICCION_RESP = 'RESPCTRLPROD';
const NOMBRE_RESTRICCION_RESP_VERTICALES = 'RESPCTRLPROD_VERTICALES';

// Determina si la fecha de una orden FERT corresponde a la necesidad P2 de un material, según el
// criterio de fecha correcto para el ÁREA de origen de ese P2 — verificado contra datos reales, no
// es el mismo criterio para todas:
// - Venta Externa: su P2 sí tiene fecha_inicio_plan confiable. Sus Provisionales se generan a hoy+1,
//   pero al liberarse/convertirse en FERT se traslapan con la fecha del P2 (hoy+2) — tolerancia ±2
//   alrededor de esa fecha real.
// - Muebles/Colchones: su fecha_inicio_plan NO siempre es confiable (documentado en la propia
//   restricción ALMACEN_CONSUMO: "no distingue si el material ya se fabricó o sigue pendiente") —
//   comprobado con datos reales: P2 de Muebles #73 fechado 2026-08-04, pero sus órdenes FERT reales
//   caen 2026-07-30/31 (a 4-5 días de esa fecha, ninguna tolerancia razonable las alcanza). Se prueba
//   primero una ventana FIJA [hoy, hoy+1]; si no alcanza, cae al mismo criterio que cualquier otra
//   área (ver más abajo) — un P2 de Muebles agendado varios días adelante SÍ puede tener una fecha
//   real y confiable (caso real: P2 #533 fechado 31-ago con una orden Provisional real exacta a esa
//   fecha, 3 días después de hoy — la ventana fija sola nunca la hubiera alcanzado).
// - Cualquier otra área (ej. Prensado): tolerancia ±1 alrededor de la fecha real del P2 (en la
//   práctica su P2 sí quedó cerca de "hoy").
//
// Rango completo de la orden [FECHAINICIO, FECHAFIN] (corregido 2026-08-14): antes solo se
// comparaba FECHAINICIO ± tolerancia contra la fecha del P2, ignorando FECHAFIN. Caso real que lo
// destapó: material 30005606, provisional #0144003101 con FECHAINICIO=14-ago/FECHAFIN=18-ago
// (rango que SÍ incluye el 17-ago, fecha real del P2 #329 de Venta Externa) no coincidía porque
// 14-ago está a 3 días de 17-ago y la tolerancia de Venta Externa es solo 2 — aunque el rango
// completo de la orden sí cubre esa fecha. Se comprueba el rango PRIMERO; la tolerancia alrededor
// de FECHAINICIO se mantiene como respaldo adicional (no se quita nada de lo que ya coincidía).
const fechaOrdenCoincideConP2 = (fechaOrdenStr: string, fechaOrdenFinStr: string, area: string, fechaP2Str: string, hoyStr: string): boolean => {
  const tOrden = new Date(fechaOrdenStr).getTime();
  if (isNaN(tOrden)) return false;
  if (/muebles|colchones/i.test(area)) {
    const tHoy = new Date(hoyStr).getTime();
    if (!isNaN(tHoy) && tOrden >= tHoy && tOrden <= tHoy + 86400000) return true; // [hoy, hoy+1]
    // La ventana fija [hoy,hoy+1] no alcanzó: cae al mismo criterio que el resto de áreas (rango
    // completo de la orden + tolerancia ±1 día alrededor de la fecha real del P2), en vez de
    // descartar directo. Caso real que lo destapó: material 30023211, P2 Muebles #533 fechado 3 días
    // adelante (31-ago, hoy 28-ago) con una orden Provisional real EXACTA a esa fecha — la ventana
    // fija nunca puede alcanzar un P2 agendado más allá de mañana. No se quita la ventana [hoy,hoy+1]
    // (sigue resolviendo el caso histórico que la motivó, P2 #73 con FERT reales 4-5 días ANTES de su
    // propia fecha) — se agrega como respaldo adicional, no se reemplaza.
  }
  const tP2 = new Date(fechaP2Str).getTime();
  if (isNaN(tP2)) return false;
  const tOrdenFinParsed = new Date(fechaOrdenFinStr).getTime();
  const tOrdenFin = isNaN(tOrdenFinParsed) ? tOrden : tOrdenFinParsed;
  if (tP2 >= tOrden && tP2 <= tOrdenFin) return true;
  const dias = /venta\s*externa/i.test(area) ? 2 : 1;
  return Math.abs(tOrden - tP2) <= dias * 86400000;
};

// Almacenes de stock disponible por centro para la Respuesta P3 (último fallback de la cascada
// FERT → Provisional → Stock). Antes solo contaba 1006/2006 — verificado con datos reales (caso
// 30024108 "LAMINA BASE GRAN D15": 0 en 1006, 6 en 1011) que quedaba stock real sin contar, mismo
// patrón que ya resuelve Corte y Laminado sumando varios almacenes (ver su stockKgPorMaterialPorCentro:
// 1006+1008+1015). Esta lista sale de auditar en qué almacenes existe HOY stock real (LIBREUTILIZACION
// > 0) de materiales de la familia LAMINA D#/PLANCHA ESPUMA/TACO ESPUMA (excluyendo CILINDRICA/
// PRENSADA, que son de otros procesos) — confirmado con el usuario. Centro 2000 no tenía stock fuera
// de 2006 en la auditoría, así que se deja igual por ahora.
const ALMACENES_STOCK_POR_CENTRO: Record<'1000' | '2000', string[]> = {
  '1000': ['1006', '1001', '1009', '1011', '1012', '1014'],
  '2000': ['2006'],
};

// Máquinas de cabecera del resumen (Capacidad Operativa), reutilizadas para vincular
// cada registro de Mantenimiento SAP (ID_MAQUINA) con su tarjeta correspondiente.
// `proceso` clasifica la CAPACIDAD de cada máquina, para poder medir la ocupación de Carruseles
// contra máquinas de carrusel y la de Verticales contra máquinas verticales. Antes ambas ocupaciones
// se dividían por la capacidad TOTAL de la planta, lo que las diluía a las dos.
//
// Hoy TODAS las máquinas configuradas son de carrusel (confirmado por el usuario). Las máquinas de
// corte vertical todavía NO están cargadas acá, aunque sí existen en SAP y tienen carga real —
// identificadas por las órdenes de los responsables verticales (036/039 en UIO, 039 en GYE):
// UIO → HR_V03_1 (124 órdenes), HR_V02 (33), HR_V03_3 (20), HR_V03_2 (8), HR-TACOS (19), V03_MBL (5);
// GYE → HR-VAGYE (46). Mientras no se agreguen con su horario, la ocupación de Verticales no tiene
// contra qué medirse y se muestra como "sin capacidad configurada" en vez de un porcentaje inventado.
type ProcesoCorte = 'carrusel' | 'vertical' | 'cnc';
// Código real de puesto de trabajo SAP para la Cortadora CNC (HR-CTCNC) — verificado con el maestro
// MaquinaSim/PuestoTrabajo/RespCtrlProd que compartió el usuario y con la restricción real
// "Hojas_Rutas_ PuestoTrabajo" (codigo_restriccion 554, grupo 8, ver hojaRutaPuestoTrabajoPorCentro).
// Es el ÚNICO código de este maestro sin ambigüedad entre máquinas (a diferencia de HR-CAR03, que
// comparten CR03 y CR04, o HR-TACOS, que comparten CR04 y la Vertical 3) — por eso CNC se puede
// separar de forma confiable hoy; CR01/CR03/CR04 individuales, no todavía.
const CODIGO_MAQUINA_CNC = 'HR-CTCNC';
const esFilaCNC = (maquina: unknown): boolean => String(maquina || '').trim().toUpperCase() === CODIGO_MAQUINA_CNC;
const MACHINES_BY_PLANTA: Record<'UIO' | 'GYE', { id: string; n: string; proceso: ProcesoCorte }[]> = {
  UIO: [
    { id: 'CR04', n: 'CARRUSEL 4 FECKEN', proceso: 'carrusel' },
    { id: 'CR03', n: 'CARRUSEL 3 SCHMUZIGER', proceso: 'carrusel' },
    { id: 'CR01', n: 'CARRUSEL 1 SCHMUZIGER', proceso: 'carrusel' },
    { id: 'CNC01', n: 'CORTADORA CNC GIOTTO', proceso: 'cnc' },
    // Corte vertical: dos máquinas que se activan en el turno DÍA con el mismo horario que los
    // carruseles (8.75 h − 13% de paros). Los códigos salen de las órdenes reales de los
    // responsables verticales (039/036/029) en Provisionales y FERT: HR_V02 y HR_V03.
    { id: 'V02', n: 'VERTICAL HR_V02', proceso: 'vertical' },
    { id: 'V03', n: 'VERTICAL HR_V03', proceso: 'vertical' },
  ],
  GYE: [
    { id: 'CR02', n: 'CARRUSEL 2 FEMA', proceso: 'carrusel' },
    { id: 'CR01', n: 'CARRUSEL 1 SCHMUZIGER', proceso: 'carrusel' },
    { id: 'LA02', n: 'LAMINADORA REPOTENCIADA', proceso: 'carrusel' },
    // Guayaquil tiene UNA sola máquina vertical según las órdenes reales del responsable 039
    // (HR-VAGYE, 46 órdenes). Inferido de los datos, no confirmado por el usuario.
    { id: 'VAGYE', n: 'VERTICAL HR-VAGYE', proceso: 'vertical' },
  ],
};

interface UnifiedRow {
  orden: string;
  fecha: string;
  fechaFin: string;
  material: string;
  descripcion: string;
  ancho: number;
  largo: number;
  esp: number;
  dens: string;
  cant: number;
  peso: number;
  // Cantidad real en unidades (a diferencia de `cant`, que en auditMapper es la cantidad cruda de SAP
  // sin corregir por UNIDAD='KG') — usado por Respuesta P3 (Corte Espuma) para comparar en UN en vez
  // de Kg. Ver respuestaSalidaRowsPorCentro.
  cantUnidadReal: number;
  alturaTotal: number;
  tIndiv: number;
  tTotal: number;
  // Componente de tTotal correspondiente solo a descarga física (subBloques × ciclo real medido por
  // centro / 60) — ver TIEMPO_DESCARGA_CICLO_MIN y calcularMetricasCapacidad.
  tiempoDescargaH: number;
  subBloques: number;
  nroCargas: number;  
  undBatch: number;
  apertura: string;
  categoria: string;
  centro: string;
  almacen: string;
  responsable: string;
  maquina: string;
  isAlterna: boolean;
  origenArea?: string;
  origenCodigoGrupo?: number;
  origenCodigoPlanGrupo?: number;
  origenAmbiguo?: boolean;
  origenCandidatosCount?: number;
  tIndivEstimado?: boolean;
  tIndivEstimadoNivel?: '3a' | '3b' | '3c';
  // true cuando el material no tiene ancho/largo/esp/densidad parseables desde su descripción (ver
  // parseDimensions) — sin geometría no hay base para estimar tiempo ni capacidad, así que se marca
  // "Sin dato" en vez de forzar el fallback global 3c (que antes inflaba T. Total H con un tiempo
  // sin relación al material real, ver calcularMetricasCapacidad).
  sinGeometria?: boolean;
  // Solo poblado para materiales de Venta Externa (ver necesidadCapacidadMapper y
  // materialPendientesPorCentro) — cruce contra "Pendientes Totales" (pedidos de venta reales,
  // sector "09 ESPUMAS") sin FERT que los cubra todavía.
  atrasado?: boolean;
  proximaFechaEntrega?: string;
}

interface NecesidadPlantaRow {
  codigo_material: number;
  cantidad_produccion_neta: string;
  fecha_inicio: string;
  fecha_fin: string;
  codigo_grupo: number;
  codigo_plan_grupo: number;
  // Centro físico (1000=UIO, 2000=GYE) del Grupo dueño del PlanGrupo P2 de origen — "Venta Externa"
  // tiene un codigo_grupo distinto por centro (18/19), por eso se puede resolver aquí sin ambigüedad.
  // Alimenta la Respuesta P3 (ver materialNecesidadesPlantaMapPorCentro), que sí necesita separar por centro.
  centro: string;
}

interface ConsolidatedNeedRow extends NecesidadPlantaRow {
  area: string;
}

// Respuesta P3 (tab "Respuesta P3"): por cada material que Necesidades Planta (P2) pide en un centro
// dado, se calcula CUÁNTO de esa necesidad ya está cubierto y CUÁNTO falta producir.
//
// Regla de negocio (confirmada por el usuario):
//   disponible = stock + provisionales + FERT VIGENTES
//   cubierto   = min(necesidadP2, disponible)
//   faltante   = max(0, necesidadP2 - disponible)
//
// La base de la cobertura son las ÓRDENES PROVISIONALES, pero una provisional se convierte en orden
// FERT el mismo día en que se ejecuta: al correr el P3 por la mañana la provisional ya no existe y la
// cobertura daba 0 aunque la producción estuviera comprometida. Por eso las FERT se parten por su
// FECHA de programación, que es lo que las asigna a un ciclo de P2:
//   FECHA >  hoy → VIGENTE : responde al P2 del día siguiente, el que se está planificando. Cubre.
//   FECHA <= hoy → ANTERIOR: ciclo ya ejecutado. No cubre; es carga en curso para la capacidad.
//
// Caso real que lo demostró: material 30005472 sin NINGUNA provisional, pero con una FERT creada hoy
// (FECHAORDEN 07-ago) programada al 12-ago por 35 unidades = 196 Kg — la tabla mostraba esos 196 Kg
// en la columna FERT mientras marcaba el material como "Sin cobertura".
//
// Doble conteo: cuando una provisional y su FERT gemela conviven, la provisional se descarta
// (clavesProvisionalesTransformadas, match por material + fecha + cantidad) — verificado con datos
// reales: 153 materiales aparecen en ambas fuentes y 24 pares calzan exacto.
type FuenteRespuestaP3 =
  | 'Stock' | 'Provisional' | 'FERT'                              // una sola fuente cubre
  | 'Stock + Provisional' | 'Stock + FERT' | 'Provisional + FERT' // combinaciones
  | 'Stock + Provisional + FERT'
  | 'Sin cobertura'         // la necesidad existe pero nada la cubre todavía (P3)
  | 'Producir'              // el PFD sí tiene faltante que fabricar
  | 'Cubierto'              // el PFD no necesita generar orden: lo disponible alcanza
  | 'Sin dato';             // ni la necesidad P2 tiene Kg calculable (ej. material sin geometría)

interface RespuestaP3Row {
  material: string;
  descripcion: string;
  tienePlan: boolean;
  // Lo que se graba en DetalleTactico: en el P3 es la COBERTURA (cuánto de la necesidad ya está
  // resuelto); en el PFD es el FALTANTE (cuánto hay que fabricar). Ver respuestaSalidaRowsPorCentro.
  // Ya está en UNIDADES directo (= esPFD ? faltante : cubierto, sin conversión) — el P2 que se está
  // respondiendo (Venta Externa/Muebles/Prensado) pide y registra en UN, no en Kg; comparar/grabar en
  // Kg estimado producía comparaciones falsas — verificado con datos reales: material 30008499
  // (100X200X4) respondía 211 "Kg" contra una necesidad P2 de 120 UN, mientras 30007130/30008498
  // quedaban cortos — los 3 ratios Kg/UN observados (0.44 / 0.88 / 1.76) escalaban exactamente 1:2:4
  // con el espesor (X1/X2/X4), confirmando que el número grabado era peso, no unidades. Segundo caso
  // real (mismo problema, un nivel arriba): material 30005606, P2=300 UN mostraba "Necesidad P2 (Kg)"
  // = 102 — un estimado, no el número real que el negocio compara.
  cantidadUnidades: number;
  necesidad: number;
  stock: number;
  provisional: number;
  // FERT hacia adelante: responde al P2 vigente, SÍ entra en la cobertura.
  fertVigente: number;
  // FERT de hoy hacia atrás: ciclo ya ejecutado. Solo referencia, no cubre el P2 vigente.
  fertAnterior: number;
  cubierto: number;
  faltante: number;
  // Kg SOLO informativo (badge de capacidad/peso) — no participa en ninguna decisión de cobertura o
  // estado. = faltante × pesoUNPorMaterial (estimado geométrico), puede dar 0 para materiales sin
  // geometría parseable aunque su faltante real (en UN) sea mayor que cero.
  faltanteKgEstimado: number;
  origenes: string;
  fuente: FuenteRespuestaP3;
}

interface PlanGrupoPreviewEspuma {
  centro: '1000' | '2000';
  codigo_grupo: number;
  nombreGrupo: string;
  valor: string;
  fechaInicio: string;
  fechaFin: string;
  rows: RespuestaP3Row[];
}

// "Editar Plan" (mismo patrón que Corte y Laminado, ver TacticalPlanCorteLaminadoSection): permite
// corregir un P3/PFD ya guardado sin esperar al ciclo del día siguiente. `cantidad` va en UN, no en
// Kg — coherente con el fix de [[respuesta_p3_espuma_kg_vs_unidades]] (la respuesta se compara contra
// el P2, que pide en UN).
interface EditableDetalleRowEspuma {
  codigo_detalle_tactico: number;
  material: string;
  descripcion: string;
  cantidad: number;
  marcadoEliminar: boolean;
  esNuevo: boolean;
  codigo_plan_grupo_padre: number;
}

interface EditPlanPreviewEspuma {
  codigo_plan_grupo: number;
  centro: '1000' | '2000';
  valor: string;
  fechaInicio: string;
  fechaFin: string;
  rows: EditableDetalleRowEspuma[];
  planOriginal: PlanGrupo;
}

// Fila cruda proveniente de endpoints SAP/servicios internos: los nombres de columna varían de
// mayúsculas/minúsculas y de endpoint a endpoint, por eso se accede siempre vía getProp/cleanCode/safeNum.
type RawApiRow = Record<string, unknown>;

interface MachineShiftConfig {
  day: string;
  night: string;
  op1D: string;
  op2D: string;
  op1N: string;
  op2N: string;
  paro1: number;
  paro2: number;
  // Turno Sábado: independiente de Día (mismas opciones, shiftOptions -- ya incluye 07:00-13:00), se
  // SUMA a Día+Noche en vez de reemplazar a Día. En 'EMPTY' por defecto -- no es un turno regular,
  // solo se activa cuando se decide producir un sábado puntual (mismo criterio ya aplicado en Corte y
  // Laminado, ver [[sabado_turno_dia_corto_espuma_laminado]]).
  saturday: string;
  op1S: string;
  op2S: string;
  paro3: number;
  // Máquina fuera de servicio para esta corrida (no hay demanda que justifique encenderla): no aporta
  // horas a la capacidad. Distinto de dejar los turnos en "VACÍO", que es "todavía no lo definí".
  activa: boolean;
}

interface PlantaConfig {
  performance: number;
  // Rendimiento propio de la Cortadora CNC — separado del de Carruseles: sus tiempos de corte no
  // están tan calibrados como los de los carruseles reales (más dependientes de tIndiv estimado por
  // vecino, no siempre del catálogo real de SAP), así que aplicarle el mismo % que a los carruseles
  // sobreestima su ocupación real. Editable en la UI, sin valor "quemado" — el usuario lo ajusta.
  performanceCNC: number;
  shifts: Record<string, MachineShiftConfig>;
}

const safeNum = (val: unknown): number => {
  const n = Number(String(val || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const cleanCode = (code: unknown): string => {
  return String(code || '').replace(/^0+/, '').trim();
};

// Cantidad viene como texto desde DetalleTactico (p.ej. "120.5000"); se limpia igual que en
// el tab homólogo de Corte y Laminado para poder sumarla de forma segura en la Respuesta P3.
const parseQty = (val: unknown): number => {
  const n = Number(String(val || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// `new Date('yyyy-MM-dd')` (constructor ISO) fija la medianoche en UTC — si la zona horaria LOCAL del
// entorno donde corre esto está detrás de UTC (Ecuador, UTC-5), la fecha calendario LOCAL de ese
// instante ya es el día ANTERIOR. Cualquier aritmética de días hábiles hecha después (que opera con
// getDate()/setDate(), en hora LOCAL) hereda ese día de menos — mismo bug de fondo que ya documenta
// fechaLocalEcuador para lecturas, pero aplicado a un caso de ESCRITURA/aritmética: sumar o restar
// días hábiles a una fecha 'yyyy-MM-dd' ya existente (ver restarDiasHabiles en renderDashboard/
// renderAuditTable). El constructor `new Date(año, mes, día)` interpreta los números directo como
// fecha LOCAL, sin ambigüedad UTC de por medio — evita el corrimiento sin importar la zona del server.
const parseFechaLocal = (fecha: string): Date => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// Sector de "Pendientes Totales" que corresponde a Corte Espuma — Colchones/Muebles/Prensado NO se
// venden como producto terminado directo (no tienen pedido/fecha de entrega a nivel de material
// cortado, solo Venta Externa vende espuma como producto terminado). Mismo criterio que ya usa
// Programación Táctica Venta Externa para su tab "Pendientes".
const SECTOR_ESPUMAS_PENDIENTES = '09 ESPUMAS';

// Cod.Buscar: misma clave de cruce que Venta Externa usa entre "Pendientes Totales" y "Órdenes FERT"
// (POSICION+PEDIDO+MATERIAL, cada valor forzado a número para eliminar ceros a la izquierda) — se
// duplica aquí en vez de importarla porque TacticalPlanVentaExternaSection no exporta sus helpers.
const buildCodBuscar = (posicion: unknown, pedido: unknown, material: unknown): string => {
  const num = (v: unknown) => String(parseQty(v));
  return `${num(posicion)}${num(pedido)}${num(material)}`;
};

const formatNum = (val: unknown, decimals: number = 2): string => {
  const n = safeNum(val);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// Kg del balance de la Respuesta P3. Una lámina puede pesar gramos (ej. "LAMINA OPORTO RESPALDO D19
// 67X14X2" = 67×14×2 cm a densidad 19 → ~36 g), así que redondear a 0 decimales mostraba "0" en toda
// la fila y parecía que el cálculo estaba roto. Bajo 1 Kg se muestran 2 decimales; de 1 Kg en
// adelante, entero (a esa escala los decimales solo hacen ruido).
const formatKg = (v: number): string => (v > 0 && v < 1 ? formatNum(v, 2) : formatNum(v, 0));

const getProp = (obj: Record<string, unknown> | null | undefined, keys: string[]): string => {
  if (!obj) return '';
  const rowKeys = Object.keys(obj);
  for (const k of keys) {
    const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
    if (found) return String(obj[found]).trim();
  }
  return '';
};

const median = (values: number[]): number => {
  const clean = values.filter(v => v > 0).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
};

interface MaterialGeomConocido { ancho: number; largo: number; esp: number; dens: number; tIndiv: number; }

// Tiempo estándar de corte por lámina cuando NINGÚN catálogo (Tiempos Ensamblado / Maestro
// Carruseles) tiene el material: se estima a partir de vecinos REALES del mismo batch, en vez de
// una constante fija (una constante única no representa a la vez a una lámina D18 fina y a una
// D40 gruesa — un ancla fija de "tiempo promedio" quedó demasiado lejos del orden de magnitud real
// de familias densas/anchas, ver caso 30004402 vs 30004400). Jerarquía, de mejor a peor evidencia:
//  3a) Vecino(s) de la MISMA densidad Y MISMO espesor (misma familia física real) — se escala su
//      tIndiv real por la razón de ancho×largo (el recorrido de corte cambia con esas dos
//      dimensiones, confirmado con planta), y se toma la mediana si hay más de un vecino.
//  3b) Sin vecino de la misma familia exacta: mismo densidad, espesor distinto. Antes se promediaba
//      TODOS los vecinos de esa densidad escalando por ancho×largo×espesor a la vez — 3 razones
//      compuestas multiplicativamente, que con un vecino de ancho/largo muy distinto (ej. una
//      "LAMINA CILINDRICA" con largo≈0 por no tener tercera dimensión real) disparaba el estimado a
//      un orden de magnitud irreal (ver caso 30024837: mediana daba 3.34 cuando el vecino sano
//      escalaba a ~0.4). Ahora se elige el vecino con el ancho MÁS CERCANO al objetivo (esa es la
//      dimensión que la planta confirmó que más pesa) y se escala SOLO por la razón de espesor —
//      sin duplicar factores ancho×largo sobre un vecino que ya se eligió por ser el más parecido.
//  3c) Sin ningún vecino de esa densidad en el batch: no hay mejor evidencia que la mediana global
//      de los tiempos REALES conocidos del batch (sigue siendo dato de planta, no un número
//      inventado) — se marca con menor confianza en la UI.
const estimarTiempoIndivPorVecino = (
  target: { ancho: number; largo: number; esp: number; dens: number },
  conocidos: MaterialGeomConocido[]
): { valor: number; nivel: '3a' | '3b' | '3c' } | null => {
  // Un vecino con geometría degenerada (ancho/largo/esp en 0 — típico de descripciones que no son
  // un bloque rectangular estándar, ej. "LAMINA CILINDRICA") no sirve como referencia de escalado:
  // cualquier ratio contra una dimensión ~0 dispara el resultado sin relación con el material real.
  const conocidosValidos = conocidos.filter(c => c.ancho > 0 && c.largo > 0 && c.esp > 0);
  if (conocidosValidos.length === 0) return null;

  const escalarPorAnchoLargo = (vecino: MaterialGeomConocido) => {
    const factorAncho = target.ancho / vecino.ancho;
    const factorLargo = target.largo / vecino.largo;
    return vecino.tIndiv * factorAncho * factorLargo;
  };
  const escalarPorEspesor = (vecino: MaterialGeomConocido) => vecino.tIndiv * (target.esp / vecino.esp);

  const familiaExacta = conocidosValidos.filter(c => c.dens === target.dens && c.esp === target.esp);
  const estimadoExacto = familiaExacta.length > 0 ? median(familiaExacta.map(escalarPorAnchoLargo)) : 0;
  if (estimadoExacto > 0) return { valor: estimadoExacto, nivel: '3a' };

  const familiaDensidad = conocidosValidos.filter(c => c.dens === target.dens);
  if (familiaDensidad.length > 0) {
    const vecinoMasCercano = familiaDensidad.reduce((mejor, actual) =>
      Math.abs(actual.ancho - target.ancho) < Math.abs(mejor.ancho - target.ancho) ? actual : mejor
    );
    const estimadoDensidad = escalarPorEspesor(vecinoMasCercano);
    if (estimadoDensidad > 0) return { valor: estimadoDensidad, nivel: '3b' };
  }

  const estimadoGlobal = median(conocidosValidos.map(c => c.tIndiv));
  return estimadoGlobal > 0 ? { valor: estimadoGlobal, nivel: '3c' } : null;
};

const parseDimensions = (desc: string) => {
  const d = String(desc || '').toUpperCase();
  const densMatch = d.match(/D(\d+)/);
  const dens = densMatch ? densMatch[1] : '—';
  const dimMatch = d.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*[xX*]\s*(\d+(?:\.\d+)?))?/);
  const ancho = dimMatch ? parseFloat(dimMatch[1]) : 0;
  const largo = dimMatch ? parseFloat(dimMatch[2]) : 0;
  const esp = dimMatch && dimMatch[3] ? parseFloat(dimMatch[3]) : 0;
  
  const apertureRegex = /194\.5|206|219|228/;
  const apertureMatch = d.match(apertureRegex);
  const apertura = apertureMatch ? apertureMatch[0] : '—';

  return { dens, ancho, largo, esp, apertura };
};

interface MetricasCapacidad {
  hTotal: number;
  subBloques: number;
  capGiro: number;
  undBatch: number;
  nroCargas: number;
  tIndiv: number;
  tIndivEstimado: boolean;
  tIndivEstimadoNivel: '3a' | '3b' | '3c' | undefined;
  tTotal: number;
  tiempoDescargaH: number;
  sinGeometria: boolean;
}

// Física de corte en carrusel (altura útil por densidad, subbloques, capacidad de giro, cargas y
// tiempo total) — extraída de auditMapper para poder reutilizarla también con filas de "Necesidades
// Planta" (ver necesidadCapacidadMapper), que no vienen de una orden real sino de un PlanGrupo P2/PFF.
// Mismas reglas de negocio documentadas ahí: densidad >=28 usa 85 de altura de bloque, <28 usa 103;
// capGiro se calcula como cuerdas de un polígono inscrito, no como división lineal de la circunferencia.
const calcularMetricasCapacidad = (
  info: { ancho: number; largo: number; esp: number },
  densVal: number,
  qty: number,
  tIndivReal: number,
  conocidos: MaterialGeomConocido[],
  centro: string
): MetricasCapacidad => {
  const usefulHeight = densVal >= 28 ? 85 : 103;
  const hTotal = info.esp * qty;
  const subB = usefulHeight > 0 ? hTotal / usefulHeight : 0;
  // Descarga real: 1 ciclo cronometrado por sub-bloque (ver TIEMPO_DESCARGA_CICLO_MIN) — subB YA es
  // (cantidad×espesor)/alturaÚtil, la misma fórmula que dio el usuario como ejemplo.
  const tiempoDescargaH = (subB * (TIEMPO_DESCARGA_CICLO_MIN[centro] || 0)) / 60;

  const gap = 10;
  const radioCarrusel = CAROUSEL_DIAMETER_CM / 2;
  const cuerdaReq = info.ancho + gap;
  const capGiro = cuerdaReq > 0 && cuerdaReq < 2 * radioCarrusel
    ? Math.floor(Math.PI / Math.asin(cuerdaReq / (2 * radioCarrusel)))
    : (cuerdaReq > 0 ? 1 : 0);
  const slicesPerBlock = info.esp > 0 ? Math.floor(usefulHeight / info.esp) : 0;

  const undBatch = slicesPerBlock * capGiro;
  const nLoads = capGiro > 0 ? Math.ceil(subB / capGiro) : 0;
  // REGLA: sumarle 4 ciclos por la cúpula al número de la cantidad para el cálculo
  const totalCycles = qty + (nLoads * 4);

  // Sin ancho/largo/esp/densidad válidos no hay con qué comparar family (3a/3b) ni qué escalar — el
  // único candidato sería el fallback ciego 3c (mediana global, sin relación con este material), que
  // antes se aplicaba igual y fabricaba un T. Total H que no correspondía a este material (ver
  // "PICADO DE ESPUMA": ancho/esp/dens en 0 por descripción no estándar, igual recibía un tiempo
  // estimado de la mediana global). Se bloquea la estimación entera y se marca sinGeometria en vez
  // de adivinar.
  const hasValidGeometria = info.ancho > 0 && info.largo > 0 && info.esp > 0 && densVal > 0;

  let tIndiv = tIndivReal;
  let tIndivEstimado = false;
  let tIndivEstimadoNivel: '3a' | '3b' | '3c' | undefined;
  if (tIndiv === 0 && hasValidGeometria) {
    const estimado = estimarTiempoIndivPorVecino(
      { ancho: info.ancho, largo: info.largo, esp: info.esp, dens: densVal },
      conocidos
    );
    if (estimado) {
      tIndiv = estimado.valor;
      tIndivEstimado = true;
      tIndivEstimadoNivel = estimado.nivel;
    }
  }

  return {
    hTotal,
    subBloques: subB,
    capGiro,
    undBatch,
    nroCargas: nLoads,
    tIndiv,
    tIndivEstimado,
    tIndivEstimadoNivel,
    tTotal: (tIndiv * totalCycles) / 60 + tiempoDescargaH,
    tiempoDescargaH,
    sinGeometria: tIndiv === 0 && !hasValidGeometria,
  };
};

// Los días hábiles ahora viven en @/lib/dias-laborables y reciben el conjunto de días NO laborables
// (feriados + días que la planta decide no trabajar) que se carga del calendario configurado en
// Configuraciones → Calendario Área. Antes se resolvían aquí con un salto fijo (viernes +3, sábado
// +2, resto +1) que no contemplaba feriados: un P2 fechado "el siguiente día laborable" podía caer
// en feriado y nadie lo advertía. Dentro del componente se usan los wrappers siguienteDiaHabil /
// sumarDiasHabiles, que ya llevan el calendario cargado.

// Selector de fecha individual y reutilizable (Provisionales y FERT tienen cada uno el suyo, con
// su propio rango permitido — ver isDateDisabled). Antes había un único calendario global
// compartido por todo el módulo, lo que mezclaba criterios que no aplican igual a ambos tabs.
const DateFilterPopover: React.FC<{
  label: string;
  selectedDates: Set<string>;
  onToggleDate: (dateStr: string) => void;
  onClear: () => void;
  viewDate: Date;
  setViewDate: React.Dispatch<React.SetStateAction<Date>>;
  datesWithOrders: Set<string>;
  isDateDisabled: (dateStr: string) => boolean;
}> = ({ label, selectedDates, onToggleDate, onClear, viewDate, setViewDate, datesWithOrders, isDateDisabled }) => {
  const calendarDaysList = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="h-9 px-4 rounded-2xl border border-gray-200 bg-white hover:border-red-500/50 flex items-center gap-2 font-black text-[10px] uppercase shadow-sm transition-all">
          <Filter className="w-3.5 h-3.5 text-red-500" /> {selectedDates.size === 0 ? label : `${selectedDates.size} día(s) seleccionado(s)`}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-3" align="end">
        <div className="bg-white p-5 font-sans text-left text-[11px]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-black text-slate-800 capitalize">{format(viewDate, 'MMMM yyyy', { locale: es })}</h3>
            <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
              <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => subMonths(prev, 1))} className="h-8 w-8 hover:bg-white"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => addMonths(prev, 1))} className="h-8 w-8 hover:bg-white"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1.5 text-center mb-4">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <div key={d} className="text-[9px] font-black text-slate-300 uppercase py-1">{d}</div>)}
            {calendarDaysList.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const dStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDates.has(dStr);
              const disabled = isDateDisabled(dStr);
              return (
                <button
                  key={dStr}
                  disabled={disabled}
                  onClick={() => onToggleDate(dStr)}
                  className={cn(
                    "relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all",
                    disabled ? "opacity-20 cursor-not-allowed" : "hover:bg-slate-50",
                    isSelected && !disabled ? "bg-red-600 text-white shadow-md shadow-red-200" : ""
                  )}
                >
                  <span className={cn("text-xs font-black", isSelected && !disabled ? "text-white" : (datesWithOrders.has(dStr) ? "text-slate-800" : "text-slate-200"))}>{format(day, 'd')}</span>
                  {datesWithOrders.has(dStr) && !isSelected && !disabled && <div className="absolute bottom-1.5 w-1 h-1 bg-red-400 rounded-full" />}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-red-600 h-9 mt-1 rounded-xl tracking-widest" onClick={onClear}>Ver Todo (dentro del rango permitido)</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Snapshot de lo que este módulo tiene cargado. Se guarda al sincronizar y se restaura al volver de
// otro módulo, para no perder el trabajo en curso solo por navegar (ver @/lib/cache-modulos).
const CACHE_CORTE_ESPUMA = 'tactica-corte-espuma';
interface SnapshotCorteEspuma {
  ordenesProvisionales: RawApiRow[];
  ordenesFert: RawApiRow[];
  inventarioSAP: RawApiRow[];
  cuboInventarios: RawApiRow[];
  tiemposCatalogo: RawApiRow[];
  mantenimientosSAP: RawApiRow[];
  kpiLooperData: RawApiRow[];
  kpiCarruselesData: RawApiRow[];
  operadoresCorte: RawApiRow[];
  restriccionesCorte: Restriccion[];
  diasNoLaborables: string[];
  necesidadesPlantaData: Record<string, NecesidadPlantaRow[]>;
  necesidadPFFData: Record<'1000' | '2000', NecesidadPlantaRow[]>;
  // Nivel 2 de Capacidad Planificada (hoy+2 días hábiles, ver calcularNecesidadPFF) — se calcula junto
  // con necesidadPFFData pero no se cacheaba: navegar a otro módulo y volver perdía el Nivel 2 aunque
  // el Nivel 1 sí sobrevivía, dejando el panel "sobre-ocupado" inconsistente (verificación de
  // persistencia entre módulos de esta sesión).
  necesidadPFFNivel2Data: Record<'1000' | '2000', NecesidadPlantaRow[]>;
}

export const TacticalPlanEspumasSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [isLoading, setIsLoading] = useState(false);
  // El módulo YA NO sincroniza solo al abrirse (antes un useEffect disparaba fetchDataAsync +
  // fetchNecesidadesPlanta apenas montaba): entrar a mirar no debe costar 8 llamadas pesadas a SAP.
  // La carga es explícita — botón "Sincronizar" (o "Actualizar P2" para solo el P2) — y este flag
  // sirve para mostrar el estado vacío que le dice al usuario que todavía no hay datos.
  const [datosCargados, setDatosCargados] = useState(false);
  // "Sincronizar" + "Generar Necesidades · P1/PFF" (antes 2 clics) se combinan en 1 — el usuario lo
  // pidió por ser repetitivo en el uso diario, mismo patrón ya aplicado en Corte y Laminado (ver
  // [[modulos_tacticos_sincronizar_y_generar_combinado]]). "Entregas VE" y "Actualizar P2" NO se
  // tocan: son acciones independientes con su propio propósito (decidir qué pedidos aplazar; releer
  // un P2 que otra rama/módulo actualizó), no un segundo paso del mismo cálculo.
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');
  const [ordenesProvisionales, setOrdenesProvisionales] = useState<RawApiRow[]>([]);
  const [ordenesFert, setOrdenesFert] = useState<RawApiRow[]>([]);
  // "Pendientes Totales" (pedidos de venta pendientes de entrega, sector "09 ESPUMAS" — mismo dato
  // que ya usa Programación Táctica Venta Externa para su tab "Pendientes") — se carga perezoso
  // (solo al abrir "Necesidades Planta", ver el useEffect más abajo) por el volumen de registros
  // (+20K), igual que hace ese módulo.
  const [pendientesTotales, setPendientesTotales] = useState<RawApiRow[]>([]);
  const [pendientesCargados, setPendientesCargados] = useState(false);
  const [isLoadingPendientes, setIsLoadingPendientes] = useState(false);
  const [inventarioSAP, setInventarioSAP] = useState<RawApiRow[]>([]);
  // Fuente aparte de InventarioAnioActual, para UNA sola cosa: el responsable de control de
  // producción POR CENTRO (RespCtrlProd). Verificado con datos reales (material 30000203: Centro
  // 2000 → RespCtrlProd 002, Centro 1000 → RespCtrlProd 013) que InventarioAnioActual/CODRESPPROD NO
  // varía por centro (siempre el mismo valor sin importar qué CENTRO se consulte — parece un dato de
  // maestro de material único, no el responsable real de control de producción de esa planta), y por
  // eso materialRespCPPorCentro lo usaba mal — ver su comentario. CuboInventarios sí trae Centro +
  // RespCtrlProd correctos por fila, confirmado contra la captura real que compartió el usuario.
  const [cuboInventarios, setCuboInventarios] = useState<RawApiRow[]>([]);
  const [kpiLooperData, setKpiLooperData] = useState<RawApiRow[]>([]);
  const [mantenimientosSAP, setMantenimientosSAP] = useState<RawApiRow[]>([]);
  const [tiemposCatalogo, setTiemposCatalogo] = useState<RawApiRow[]>([]);
  const [kpiCarruselesData, setKpiCarruselesData] = useState<RawApiRow[]>([]);
  const [operadoresCorte, setOperadoresCorte] = useState<RawApiRow[]>([]);
  const [, setGrupos] = useState<Grupo[]>([]);
  // Días NO laborables (feriados + días que la planta decide no trabajar) del calendario configurado.
  // Vacío = solo se saltan fines de semana, igual que antes. Se carga en fetchDataAsync.
  const [diasNoLaborables, setDiasNoLaborables] = useState<DiasNoLaborables>(new Set<string>());
  const siguienteDiaHabil = useCallback((d: Date) => nextBusinessDayCal(d, diasNoLaborables), [diasNoLaborables]);
  const sumarDiasHabiles = useCallback((d: Date, n: number) => addBusinessDaysCal(d, n, diasNoLaborables), [diasNoLaborables]);
  // Fecha de PAREO de Capacidad Planificada (Nivel 1/2): la producción del PT en fecha X requiere que
  // su componente (lámina) esté firme un día hábil ANTES — restarDiasHabiles(X, 1).
  const restarDiasHabiles = useCallback((d: Date, n: number) => addBusinessDaysCal(d, -n, diasNoLaborables), [diasNoLaborables]);

  // Restricciones crudas del grupo Corte y Laminado de cada centro (se cargan en fetchDataAsync).
  const [restriccionesCorte, setRestriccionesCorte] = useState<Restriccion[]>([]);

  // Responsables por centro derivados de las restricciones reales, no de literales en el código.
  // `permitidos` sale de RespCtrlProd, `verticales` de RespCtrlProd_Verticales, y `carruseles` es la
  // diferencia (no existe una restricción propia para carruseles: son "todo lo que no es vertical").
  // Si una restricción no existe todavía —o el módulo aún no cargó— se usa el respaldo, y `origen`
  // deja constancia de cuál se está aplicando para poder mostrarlo en la UI.
  const responsablesPorCentro = useMemo(() => {
    const parse = (valor: unknown) => String(valor || '').split(/[,&]/).map(v => v.trim()).filter(Boolean);
    const construir = (centro: '1000' | '2000') => {
      const codigoGrupo = CODIGO_GRUPO_CORTE_POR_CENTRO[centro];
      const buscar = (nombre: string) => restriccionesCorte.find(r =>
        r.codigo_grupo === codigoGrupo &&
        r.estado === 'A' &&
        String(r.nombre_restriccion || '').trim().toUpperCase() === nombre
      );
      const rTodos = buscar(NOMBRE_RESTRICCION_RESP);
      const rVerticales = buscar(NOMBRE_RESTRICCION_RESP_VERTICALES);

      const declarados = rTodos ? parse(rTodos.valor_restriccion) : ALLOWED_RESP_CORTE_FALLBACK[centro];
      const verticales = rVerticales ? parse(rVerticales.valor_restriccion) : VERTICALES_RESP_FALLBACK[centro];

      // `permitidos` es la UNIÓN de ambas restricciones, no solo RespCtrlProd. Motivo real: al crear
      // RESPCTRLPROD_Verticales para el grupo 16 (Centro 2000) el negocio sacó el 039 de la lista
      // general, que quedó en `002&038`. Si `permitidos` fuera solo esa lista, el 039 quedaría fuera
      // del filtro `allowed` que usan las auditorías y TODA la carga vertical de Guayaquil
      // desaparecería en silencio. La restricción de verticales define el PROCESO; el alcance de
      // responsables es la suma de las dos.
      const permitidos = Array.from(new Set([...declarados, ...verticales]));
      // Carruseles = todo lo permitido que no sea vertical (no hay restricción propia para carrusel).
      const carruseles = permitidos.filter(r => !verticales.includes(r));
      return {
        permitidos,
        verticales,
        carruseles,
        origen: {
          permitidos: rTodos ? 'restricción' : 'respaldo',
          verticales: rVerticales ? 'restricción' : 'respaldo',
        },
      };
    };
    return { '1000': construir('1000'), '2000': construir('2000') } as const;
  }, [restriccionesCorte]);

  const allowedRespPorCentro = useCallback((centro: string) => responsablesPorCentro[centro as '1000' | '2000']?.permitidos || [], [responsablesPorCentro]);
  const esRespVertical = useCallback((centro: string, resp: string) => (responsablesPorCentro[centro as '1000' | '2000']?.verticales || []).includes(resp), [responsablesPorCentro]);

  // Valida CODIGO_MAQUINA_CNC (constante, código SAP real HR-CTCNC — igual de "quemado" que los IDs
  // CR01/CR03/CR04/V02/V03 en MACHINES_BY_PLANTA, ya existentes) contra la restricción real
  // "Hojas_Rutas_ PuestoTrabajo" (codigo_restriccion 554, grupo 8) que el usuario agregó — si SAP
  // alguna vez cambia/retira ese código, esto lo advierte en vez de fallar en silencio.
  useEffect(() => {
    const restr = restriccionesCorte.find(r =>
      r.codigo_grupo === CODIGO_GRUPO_CORTE_POR_CENTRO['1000'] &&
      r.estado === 'A' &&
      /HOJAS_RUTAS.*PUESTOTRABAJO/i.test(String(r.nombre_restriccion || ''))
    );
    if (!restr) return;
    const codigos = String(restr.valor_restriccion || '').split(/[,&]/).map(v => v.trim().toUpperCase());
    if (!codigos.includes(CODIGO_MAQUINA_CNC)) {
      console.warn(`[Capacidad Espuma] El código de máquina CNC (${CODIGO_MAQUINA_CNC}) ya no aparece en la restricción real "Hojas_Rutas_ PuestoTrabajo" — verificar si SAP lo cambió.`);
    }
  }, [restriccionesCorte]);

  const [necesidadesPlantaData, setNecesidadesPlantaData] = useState<Record<string, NecesidadPlantaRow[]>>({});
  const [necesidadesPlantaLoading, setNecesidadesPlantaLoading] = useState(false);

  // Necesidad PFF (Ensamblado - Quito Y Guayaquil): a diferencia de Forros/Muebles/Prensado/
  // VentaExterna, que ya traen su P2 como líneas de material listas para usar, PFF exige explotar el
  // BOM de cada material antes de tener algo comparable — por eso vive en su propio estado y se
  // calcula bajo demanda (botón), en vez de correr automáticamente cada vez que se abre el tab o se
  // pulsa "Actualizar" (explotar decenas de materiales contra el Maestro en cada carga sería
  // innecesariamente lento). Cada fila ya trae su propio "centro", así que se combina en una sola
  // lista y el resto del pipeline (materialNecesidadesPlantaMapPorCentro, etc.) la separa solo.
  const [necesidadPFFData, setNecesidadPFFData] = useState<Record<'1000' | '2000', NecesidadPlantaRow[]>>({ '1000': [], '2000': [] });
  // Capacidad Operativa Nivel 2 (ver renderDashboard): mismo PFF pero apuntando a hoy+2 días hábiles
  // en vez de hoy+3 — red de seguridad para un ciclo que se quedó un día atrás del ideal (el plan
  // sigue 'A' porque nada lo desactivó todavía). NO alimenta el tab "Necesidades Planta" ni la
  // Respuesta P3 — es exclusivo del cálculo de Capacidad Planificada.
  const [necesidadPFFNivel2Data, setNecesidadPFFNivel2Data] = useState<Record<'1000' | '2000', NecesidadPlantaRow[]>>({ '1000': [], '2000': [] });
  // Qué tipo de plan de Ensamblado se usó en la última corrida, por centro — P1 (evaluación inicial,
  // aún no liberado) o PFF (ya liberado a producción; el P1 se inactiva solo al generarlo). El botón
  // y el resumen usan esto para no decir "PFF" fijo cuando en realidad se leyó un P1 activo.
  const [tipoPlanEnsambladoPorCentro, setTipoPlanEnsambladoPorCentro] = useState<Record<'1000' | '2000', 'P1' | 'PFF' | null>>({ '1000': null, '2000': null });
  const [isCalculandoPFF, setIsCalculandoPFF] = useState(false);
  const [pffProgress, setPffProgress] = useState({ current: 0, total: 0 });
  const [pffDiagnostico, setPffDiagnostico] = useState<{ sinMatch: string[]; conError: string[] }>({ sinMatch: [], conError: [] });

  // Array en vez de un solo objeto para poder cubrir 1 centro (botón por centro) o ambos a la vez
  // (botón general "Generar Respuesta P3 (Ambos Centros)") con el mismo diálogo de confirmación.
  const [planPreviewP3, setPlanPreviewP3] = useState<PlanGrupoPreviewEspuma[] | null>(null);
  const [isSavingPlanP3, setIsSavingPlanP3] = useState(false);

  // Mismo patrón que planPreviewP3/isSavingPlanP3, para la variante PFD (ver construirPreviewPFD):
  // insumo del futuro reporte de generación de órdenes, no reemplaza ni modifica el P3.
  const [planPreviewPFD, setPlanPreviewPFD] = useState<PlanGrupoPreviewEspuma[] | null>(null);
  const [isSavingPlanPFD, setIsSavingPlanPFD] = useState(false);

  // "Editar Plan" (mismo patrón que Corte y Laminado): permite corregir un P3/PFD ya guardado sin
  // esperar al ciclo del día siguiente. planesGrupoDisponibles ya viene acotado a un centro (el botón
  // es por centro, igual que "Generar Respuestas P3 UIO/GYE").
  const [editPlanPreview, setEditPlanPreview] = useState<EditPlanPreviewEspuma | null>(null);
  const [isLoadingEditPlan, setIsLoadingEditPlan] = useState(false);
  const [planesGrupoDisponibles, setPlanesGrupoDisponibles] = useState<{ centro: '1000' | '2000'; planes: PlanGrupo[] } | null>(null);
  const [planGrupoSeleccionado, setPlanGrupoSeleccionado] = useState<number | null>(null);
  const [isSavingEditPlan, setIsSavingEditPlan] = useState(false);

  // "Necesidades Planta" (Forros/Muebles/Prensado/VentaExterna, ya guardadas) + PFF (calculada bajo
  // demanda, ver calcularNecesidadPFF) combinadas en una sola vista — así la tabla consolidada, el
  // resumen de materiales y el prorateo de la Respuesta P3 ven a PFF como un área más, sin duplicar
  // lógica. Cada fila de PFF ya trae su propio "centro" (1000/2000), así que no hace falta separarlas
  // aquí — el resto del pipeline ya sabe hacerlo (ver materialNecesidadesPlantaMapPorCentro).
  const necesidadesPlantaConPFF = useMemo(() => {
    const filasPFF = [...necesidadPFFData['1000'], ...necesidadPFFData['2000']];
    if (filasPFF.length === 0) return necesidadesPlantaData;
    // "P1/PFF" genérico: la fila puede venir de cualquiera de los dos según cuál esté activo en cada
    // centro (ver tipoPlanEnsambladoPorCentro para el detalle por centro).
    return { ...necesidadesPlantaData, 'Ensamblado (P1/PFF)': filasPFF };
  }, [necesidadesPlantaData, necesidadPFFData]);

  // Pre-auditoría Provisionales/FERT: cruza codigo_material contra TODAS las filas ya cargadas en
  // "Necesidades Planta" que mencionan ese material (puede haber más de una — mismo material pedido
  // por distintas áreas o por distintos Plan Grupo P2 con rangos de fecha distintos). La
  // desambiguación por fecha de la orden ocurre en auditMapper, no aquí.
  const materialAreaMap = useMemo(() => {
    const map = new Map<string, ConsolidatedNeedRow[]>();
    Object.entries(necesidadesPlantaConPFF).forEach(([area, rows]) => {
      rows.forEach(row => {
        const key = String(Number(row.codigo_material));
        if (!key || key === 'NaN') return;
        const candidatos = map.get(key) || [];
        candidatos.push({ ...row, area });
        map.set(key, candidatos);
      });
    });
    return map;
  }, [necesidadesPlantaConPFF]);

  // Respuesta P3: necesidad P2 agregada por material, SEPARADA por centro (a diferencia de
  // materialAreaMap/necesidadesPlantaConsolidada, que mezclan ambos centros bajo la misma "área" —
  // "Venta Externa" usa un codigo_grupo distinto por centro: 18=UIO/1000, 19=GYE/2000, ver row.centro).
  const materialNecesidadesPlantaMapPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, number>> = { '1000': new Map(), '2000': new Map() };
    Object.values(necesidadesPlantaConPFF).flat().forEach(row => {
      const centro = String(row.centro || '');
      if (!porCentro[centro]) return;
      const key = String(Number(row.codigo_material));
      const map = porCentro[centro];
      map.set(key, (map.get(key) || 0) + parseQty(row.cantidad_produccion_neta));
    });
    return porCentro;
  }, [necesidadesPlantaConPFF]);

  // Igual que materialNecesidadesPlantaMapPorCentro, pero conserva el desglose por codigo_plan_grupo
  // ORIGEN (la otra área/P2 que generó la demanda) para poder prorratear la Respuesta P3 entre esos
  // orígenes reales — mismo patrón que materialOrigenesPlantaMap en Corte y Laminado.
  const materialOrigenesPlantaMapPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, Map<number, number>>> = { '1000': new Map(), '2000': new Map() };
    Object.values(necesidadesPlantaConPFF).flat().forEach(row => {
      const centro = String(row.centro || '');
      if (!porCentro[centro]) return;
      const matKey = String(Number(row.codigo_material));
      const map = porCentro[centro];
      if (!map.has(matKey)) map.set(matKey, new Map());
      const porOrigen = map.get(matKey)!;
      const qty = parseQty(row.cantidad_produccion_neta);
      porOrigen.set(row.codigo_plan_grupo, (porOrigen.get(row.codigo_plan_grupo) || 0) + qty);
    });
    return porCentro;
  }, [necesidadesPlantaConPFF]);

  // Aplana necesidadesPlantaConPFF (agrupado por área) en una sola lista con la columna "área"
  // incluida — alimenta las tablas de capacidad por centro (ver necesidadCapacidadMapper), que ya
  // muestran esta misma información (material, cantidad, plan grupo, fecha, área origen) agrupada
  // y con subtotales por apertura/categoría, así que no hace falta una tabla plana aparte.
  const necesidadesPlantaConsolidada = useMemo<ConsolidatedNeedRow[]>(() => {
    return Object.entries(necesidadesPlantaConPFF).flatMap(([area, rows]) =>
      rows.map(row => ({ ...row, area }))
    );
  }, [necesidadesPlantaConPFF]);

  // Selectores de fecha INDIVIDUALES por tab (antes había uno solo, global, compartido por
  // Provisionales y FERT — mezclaba criterios que no aplican igual a ambos):
  // - Provisionales: solo hoy en adelante. Una orden provisional con fecha pasada no debería
  //   existir/evaluarse por lógica de sistema (no hay tal necesidad ya vencida pendiente).
  // - FERT: solo hoy hacia atrás. Son órdenes "P3" ya aprobadas/ejecutadas — se listan aquí
  //   únicamente para sumar sus horas al cálculo de ocupación de "Capacidad Operativa", no para
  //   cruzarlas contra "Necesidades Planta" (P2), por eso ese tab no tiene la columna de origen.
  const [selectedDatesProv, setSelectedDatesProv] = useState<Set<string>>(new Set());
  const [selectedDatesFert, setSelectedDatesFert] = useState<Set<string>>(new Set());
  const [viewDateProv, setViewDateProv] = useState<Date>(new Date());
  const [viewDateFert, setViewDateFert] = useState<Date>(new Date());
  // Capacidad Operativa: selector de fecha FUNCIONAL, propio de este panel (independiente del
  // selector de Órdenes FERT — preserva la auditoría puntual de ese tab sin efectos secundarios
  // aquí). Por planta, igual que otros selectores del módulo. Vacío = sin evaluar nada todavía.
  const [selectedDatesCapacidad, setSelectedDatesCapacidad] = useState<{ UIO: Set<string>; GYE: Set<string> }>({ UIO: new Set(), GYE: new Set() });
  const [viewDateCapacidad, setViewDateCapacidad] = useState<Date>(new Date());
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Reporte por correo (Capacidad Operativa) — mismo destinatario para ambas plantas, envío
  // independiente por planta (cada una arma y manda su propio cuerpo de correo).
  const [destinatariosReporte, setDestinatariosReporte] = useState('');
  const [isSendingReporte, setIsSendingReporte] = useState<{ UIO: boolean; GYE: boolean }>({ UIO: false, GYE: false });

  // --- CONFIGURACIÓN DASHBOARDS ---
  const [uioConfig, setUioConfig] = useState<PlantaConfig>({
    performance: 90,
    performanceCNC: 90,
    shifts: {
      CR04: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      CR03: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      CR01: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      CNC01: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      // Verticales: solo turno día, mismo horario que los carruseles.
      V02: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      V03: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true }
    }
  });

  const [gyeConfig, setGyeConfig] = useState<PlantaConfig>({
    performance: 75,
    performanceCNC: 75, // Guayaquil no tiene máquina CNC hoy (ver MACHINES_BY_PLANTA.GYE) — sin uso real, solo por tipado.
    shifts: {
      CR02: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      CR01: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      LA02: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      VAGYE: { day: 'H1', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true }
    }
  });

  // useMemo: son constantes, pero al recrearse en cada render invalidaban las dependencias de
  // rellenarTurnoVacio (que las usa para la etiqueta de la notificación).
  const shiftOptions = useMemo(() => [
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'H1', l: '07:00 - 15:45', h: 8.75 },
    { v: 'H2', l: '07:00 - 17:00', h: 10 },
    { v: 'H3', l: '07:00 - 18:00', h: 11 },
    { v: 'H4', l: '07:00 - 19:00', h: 12 },
    // Turno corto para sábado, activación manual cuando se necesita capacidad extra (mismo criterio
    // que Corte y Laminado) -- el sábado no se trata como laborable por defecto; se elige este
    // horario solo el día puntual en que se decide producir. Requiere generar en 2 pasadas (viernes+
    // sábado con este turno, lunes aparte con el normal) porque el módulo no tiene un turno distinto
    // por día de la semana en una misma corrida.
    { v: 'H5', l: '07:00 - 13:00', h: 6 }
  ], []);

  const nightShiftOptions = useMemo(() => [
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'A19', l: '19:00 - 05:30', h: 10.5 },
    { v: 'B21', l: '21:00 - 05:30', h: 8.5 }
  ], []);

  // Descripción del material según el MAESTRO de SAP (InventarioAnioActual), por código. Es la
  // fuente de respaldo de extractMaterialInfo cuando la descripción que trae la propia fila no
  // permite calcular geometría. Se arma sin usar extractMaterialInfo (parsea el código inline) para
  // no crear una dependencia circular entre ambos.
  const descMaestroPorMaterial = useMemo(() => {
    const map = new Map<string, string>();
    inventarioSAP.forEach(inv => {
      const matStr = getProp(inv, ['MATERIAL', 'Material', 'CodMaterial']);
      const m = matStr.match(/^(\d+)/);
      const code = m ? m[0].slice(-8) : matStr.slice(-8);
      const desc = getProp(inv, ['NOMBRE', 'DESCRIPCION']);
      if (code && desc && !map.has(code)) map.set(code, desc);
    });
    return map;
  }, [inventarioSAP]);

  // Línea de producción real (ej. "Carruseles - LINEA 1") por material+centro, para poblar
  // linea_produccion al grabar DetalleTactico — usa el mismo tiemposCatalogo que ya se consulta para
  // el Tiempo[H] real (ver auditMapper), sin fetch nuevo.
  const matchLineaProduccionEspuma = useCallback((materialCode: string, centroId: string): string => {
    const match = tiemposCatalogo.find(t => cleanCode(t.CodMaterial) === materialCode && String(t.Centro).trim() === centroId);
    return match ? getProp(match, ['PuestoTrabajoLinea']) : '';
  }, [tiemposCatalogo]);

  // Respaldo de geometría contra el maestro de SAP. Caso real que lo motivó: el material 30016934
  // llega desde el P2 de Prensado descrito como "CHN MED ESP SEMIORTOPEDICO 110x090x018" — sin token
  // de densidad (D15/D19/D25...), así que pesoUN = ancho×largo×espesor×densidad daba 0 y el material
  // respondía "Sin dato" pese a tener necesidad real (12 unidades). El maestro de SAP lo tiene bien:
  // "LAMINA D17 LILA RR 088X188X5". Lo mismo con 30000274 ("CHN MED ESP SUPER POSTURE" →
  // "LAMINA D30 NARANJA 088X188X4") y 30007426 ("CHN MED ESP FLEX" → "LAMINA D30 NARANJA 090X190X8").
  // La descripción vieja viene de la orden (Provisional/FERT), no del maestro; cuando no sirve para
  // calcular, se usa la del maestro TAMBIÉN como descripción visible, para que la tabla y el cálculo
  // hablen del mismo material. No se inventa ninguna densidad: si el maestro tampoco la trae, la fila
  // sigue quedando sin geometría (que es la verdad del dato).
  const extractMaterialInfo = useCallback((item: RawApiRow) => {
    const matStr = getProp(item, ['MATERIAL', 'Material', 'CodMaterial', 'MATERIAL_ID', 'CODIGO']);
    const nameStr = getProp(item, ['NOMBRE', 'NombreMaterial', 'Descripcion', 'NomMaterial', 'DESCRIPCION']);
    const match = matStr.match(/^(\d+)/);
    const code = match ? match[0].slice(-8) : matStr.slice(-8);
    const desc = nameStr || matStr.replace(/^\d+\s*/, '') || '—';
    const dims = parseDimensions(desc);

    const geometriaCompleta = safeNum(dims.dens) > 0 && dims.ancho > 0 && dims.largo > 0 && dims.esp > 0;
    if (!geometriaCompleta) {
      const descMaestro = descMaestroPorMaterial.get(code);
      if (descMaestro && descMaestro !== desc) {
        const dimsMaestro = parseDimensions(descMaestro);
        if (safeNum(dimsMaestro.dens) > 0 && dimsMaestro.ancho > 0 && dimsMaestro.largo > 0 && dimsMaestro.esp > 0) {
          return { code, desc: descMaestro, ...dimsMaestro };
        }
      }
    }
    return { code, desc, ...dims };
  }, [descMaestroPorMaterial]);

  const auditMapper = useCallback((data: RawApiRow[], centroId: string): UnifiedRow[] => {
    // Pasada previa: resuelve tIndiv real (Tiempos Ensamblado -> Maestro Carruseles) para cada
    // fila del batch, sin el resto de columnas — sirve para armar la lista de vecinos reales
    // (ancho/largo/esp/densidad + tIndiv) que usa el 3er nivel de respaldo más abajo
    // (ver estimarTiempoIndivPorVecino).
    const prepared = data.map(o => {
      const info = extractMaterialInfo(o);
      const tMatch = tiemposCatalogo.find(t => cleanCode(t.CodMaterial) === info.code && String(t.Centro).trim() === centroId);
      let tIndivReal = tMatch ? safeNum(tMatch.Tiempo || tMatch.Tiempo_Min) : 0;
      if (!tMatch) {
        const carruselMatch = kpiCarruselesData.find(c => cleanCode(c.Material) === info.code && String(c.Centro).trim() === centroId);
        if (carruselMatch) {
          const tiempoCorteMin = safeNum(carruselMatch.TiempoCorte) * CARRUSEL_TIEMPO_CORTE_A_MINUTOS;
          tIndivReal = tiempoCorteMin * CARRUSEL_ACTIVIDAD_ADICIONAL_FACTOR;
        }
      }
      return { o, info, tIndivReal };
    });

    const conocidos: MaterialGeomConocido[] = prepared
      .filter(p => p.tIndivReal > 0)
      .map(p => ({ ancho: p.info.ancho, largo: p.info.largo, esp: p.info.esp, dens: safeNum(p.info.dens), tIndiv: p.tIndivReal }));

    return prepared.map(({ o, info, tIndivReal }) => {
      // Carga real = actividad de proceso PENDIENTE. En FERT eso es CANTPENDIENTE (CANTPROGRAMADA
      // menos lo ya notificado): una orden notificada al 90% ya no ocupa la máquina por el total —
      // verificado con datos reales (orden 000062532621: programada 30.000, notificada 85,6,
      // pendiente 29.914,4). Las Provisionales no traen ese campo (todavía no se ejecutan), así que
      // caen a CANTIDAD. getProp busca por existencia de la clave, no por valor, así que una FERT
      // totalmente notificada (CANTPENDIENTE=0) devuelve 0 y no rebota a CANTPROGRAMADA.
      const cantPendiente = getProp(o, ['CANTPENDIENTE']);
      const qty = cantPendiente !== ''
        ? safeNum(cantPendiente)
        : safeNum(getProp(o, ['CANTIDAD', 'CANTPROGRAMADA']));
      const densVal = safeNum(info.dens);
      const resp = String(getProp(o, ['RESPCONTROLPROD', 'RESPCTRLPROD', 'RespControlProd', 'RESP_CONTROL_PROD', 'RESPONSABLE'])).trim();

      // REGLA: Responsables de operación alterna (039, 036, 044)
      const isAlterna = esRespVertical(centroId, resp);

      const metrics = calcularMetricasCapacidad(info, densVal, qty, tIndivReal, conocidos, centroId);
      const { hTotal, subBloques: subB, undBatch, nroCargas: nLoads, tIndiv, tIndivEstimado, tIndivEstimadoNivel, tTotal, tiempoDescargaH, sinGeometria } = metrics;

      const looperMatch = kpiLooperData.find(k => cleanCode(k.Material) === info.code);
      const pesoUN = looperMatch ? safeNum(looperMatch.PesoUN) : (info.ancho * info.largo * info.esp * densVal) / 1000000;
      // El campo UNIDAD de la orden (ST/M/KG conviven en el mismo endpoint, verificado con datos
      // reales) NO se revisaba aquí — a diferencia de Corte y Laminado (materialProd014FertMap), que
      // sí lo hace por el mismo motivo. Sin este check, una orden que ya viene en KG se multiplicaba
      // OTRA VEZ por pesoUN como si "qty" fuera unidades, inflando el peso. Validado contra datos
      // reales de hoy (2026-08-24): hay líneas UNIDAD=KG en Provisionales/FERT, pero ninguna cae hoy
      // dentro de los responsables permitidos de Corte Espuma sin ya estar excluida por descripción
      // (LAMINA DE APROVECHAMIENTO) — el bug no altera ningún número HOY, pero queda latente para el
      // día que aparezca un material real de espuma en KG con un responsable permitido.
      const unidadOrden = String(getProp(o, ['UNIDAD', 'Unidad', 'UNIDAD_MEDIDA'])).trim().toUpperCase();
      const pesoTotal = unidadOrden === 'KG' ? qty : pesoUN * qty;
      // Espejo de pesoTotal, para poder comparar Respuesta P3 en UNIDADES en vez de Kg (ver
      // respuestaSalidaRowsPorCentro): si la orden viene nativa en KG, "qty" no es un conteo de
      // unidades real — se estima dividiendo por pesoUN. Mismo caso latente documentado arriba (hoy
      // sin impacto real, ningún material cae en esta rama), necesario para no reintroducir el mismo
      // bug del lado de unidades.
      const cantUnidadReal = unidadOrden === 'KG' ? (pesoUN > 0 ? qty / pesoUN : 0) : qty;

      const fechaOrden = String(getProp(o, ['FECHAINICIO', 'FECHA', 'FECHA_INICIO'])).split('T')[0];
      // La orden Provisional trae un RANGO propio (FECHAINICIO..FECHAFIN), no una fecha puntual —
      // ej. material 30005655: FECHAINICIO 2026-07-17, FECHAFIN 2026-07-21. Si no viene FECHAFIN,
      // se trata como orden de un solo día (igual a FECHAINICIO).
      const fechaOrdenFin = String(getProp(o, ['FECHAFIN', 'FECHA_FIN'])).split('T')[0] || fechaOrden;

      // Pre-auditoría: un material puede tener varias necesidades candidatas (distintas áreas o
      // distintos Plan Grupo P2 con rangos de fecha distintos). El criterio real es FECHAFIN de la
      // orden — es la fecha con la que SAP "traduce" a qué necesidad responde (confirmado por el
      // usuario con datos reales: material 30010853, orden #086 con Fin extr. 21/08 SÍ corresponde
      // al Plan #375, fechado 21/08; orden #087, misma material, Fin extr. 24/08 NO corresponde a
      // ese mismo plan, aunque su FECHAINICIO (20/08) caiga dentro del rango del plan — antes se
      // comparaba el RANGO completo de la orden [FECHAINICIO,FECHAFIN] contra el del plan, lo que
      // hacía que una orden ancha "rozara" de pasada un plan angosto y se le atribuyera igual).
      // Se prioriza el candidato cuyo rango [fecha_inicio,fecha_fin] contiene el FECHAFIN de esta
      // orden. Si ninguno contiene esa fecha, se usa el primero como referencia y se marca
      // origenAmbiguo — esto aplica también con UN solo candidato: no hay "único candidato de
      // confianza", si su fecha no corresponde, la etiqueta debe advertirlo igual.
      const origenCandidatos = materialAreaMap.get(String(Number(info.code))) || [];
      const origenEnRango = origenCandidatos.find(c =>
        fechaOrdenFin && c.fecha_inicio !== '—' && c.fecha_fin !== '—' &&
        fechaOrdenFin >= c.fecha_inicio && fechaOrdenFin <= c.fecha_fin
      );
      const origen = origenEnRango || origenCandidatos[0];
      const origenAmbiguo = origenCandidatos.length > 0 && !origenEnRango;

      return {
        orden: getProp(o, ['ORDENPREVISIONAL', 'ORDEN']) || '—',
        fecha: fechaOrden,
        fechaFin: fechaOrdenFin,
        material: info.code,
        descripcion: info.desc,
        ancho: info.ancho, largo: info.largo, esp: info.esp, dens: info.dens,
        cant: qty,
        peso: pesoTotal,
        cantUnidadReal,
        alturaTotal: hTotal,
        subBloques: subB,
        nroCargas: nLoads,
        undBatch,
        tIndiv,
        tIndivEstimado,
        tIndivEstimadoNivel,
        tTotal,
        tiempoDescargaH,
        sinGeometria,
        apertura: info.apertura,
        categoria: getProp(o, ['CATEGORIA', 'Categoria', 'CATEGORIA_DESC']) || '—',
        centro: centroId,
        almacen: getProp(o, ['Almacen', 'ALMACEN', 'CENTRO']),
        responsable: resp,
        maquina: getProp(o, ['MAQUINA', 'RECURSO', 'ID_MAQUINA', 'Maquina']).trim(),
        isAlterna,
        origenArea: origen?.area,
        origenCodigoGrupo: origen?.codigo_grupo,
        origenCodigoPlanGrupo: origen?.codigo_plan_grupo,
        origenAmbiguo,
        origenCandidatosCount: origenCandidatos.length
      };
    });
  }, [extractMaterialInfo, tiemposCatalogo, kpiCarruselesData, kpiLooperData, materialAreaMap, esRespVertical]);

  // boundary 'future' (Provisionales): descarta fechas pasadas SIEMPRE, sin importar qué haya
  // seleccionado el usuario — ni siquiera "Ver Todo el Plan" (selección vacía) puede traer una
  // orden provisional de ayer, porque por lógica de sistema no debería existir/evaluarse.
  // boundary 'past' (FERT): antes descartaba todo lo posterior a hoy+1 día hábil — techo fijo que el
  // usuario pidió quitar (selector "estático"), porque con Capacidad Planificada en 3 niveles ahora
  // hay motivo real para mirar FERT de hoy+2/hoy+3 desde este mismo tab, no solo desde el tooltip.
  // 'past' ya no aplica NINGÚN filtro de fecha propio — queda igual de abierto que 'future' lo es
  // hacia el futuro. El nombre del boundary se conserva solo como etiqueta histórica de cuál tab lo
  // usa (Provisionales vs FERT), ya no describe una restricción real distinta entre los dos.
  const getFilteredData = useCallback((rawData: RawApiRow[], centro: string, dates: Set<string>, boundary: 'future' | 'past') => {
    // Auditamos responsables de Corte (013, 038, 039, 044, 036, 034, 002)
    const allowed = allowedRespPorCentro(centro);
    return rawData.filter(o => {
      const c = String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim();
      const r = String(getProp(o, ['RESPCONTROLPROD', 'RESPCTRLPROD', 'RespControlProd', 'RESP_CONTROL_PROD', 'RESPONSABLE'])).trim();
      // Los responsables de "operación alterna" (039/036/044) a veces también gestionan órdenes de
      // Prensado — un proceso físico distinto (prensa, no carrusel). Verificado con datos reales:
      // "LAMINA PRENSADA D##"/"TACO PRENSADO D##" se colaban en este audit de Corte Espuma solo por
      // el responsable, sin haber pasado nunca por el carrusel. Se excluyen por descripción porque
      // el responsable no alcanza a distinguir el proceso.
      const desc = String(getProp(o, ['NOMBRE', 'NombreMaterial', 'Descripcion', 'NomMaterial', 'DESCRIPCION']));
      if (/PRENSAD/i.test(desc)) return false;
      // Mismo caso que PRENSAD: el responsable de Corte en Centro 2000 (002) también cubre FORRO
      // (fundas de tela), no solo lámina/espuma — ver ES_FORRO. Sin órdenes reales de FORRO en este
      // audit al momento de verificarlo (0 en Provisionales/FERT), pero es el mismo riesgo latente.
      if (ES_FORRO(desc)) return false;
      // "LAMINA DE APROVECHAMIENTO" (material 30020501): confirmado por el usuario — son órdenes
      // ANUALES de recuperación de retazo/desperdicio, no cortes reales. Su descripción no trae
      // geometría (ancho/largo/esp quedan en 0), así que su cantidad (decenas de miles por orden) se
      // multiplica por el tiempo unitario igual que cualquier material real — caso real detectado:
      // ~94 órdenes de este material sumaban 10.659h de las 10.708h "totales" de Quito en Órdenes
      // FERT (99.5% del número era este artefacto). Se excluye igual que PRENSAD/FORRO.
      if (/APROVECHAMIENTO/i.test(desc)) return false;
      const dateRaw = String(getProp(o, ['FECHAINICIO', 'FECHA', 'FECHA_INICIO'])).trim();
      const date = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw;
      const dateFinRaw = String(getProp(o, ['FECHAFIN', 'FECHA_FIN'])).trim();
      const dateFin = (dateFinRaw.includes('T') ? dateFinRaw.split('T')[0] : dateFinRaw) || date;
      if (boundary === 'future' && date < todayStr) return false;
      if (dates.size === 0) return c === centro && allowed.includes(r);
      // Coincide si el día seleccionado es el FECHAFIN de la orden — mismo criterio que ya se usa
      // para "Grupo/Área Origen" (ver origenEnRango) y para lo que se MUESTRA en la columna Fecha
      // (ver fechaMostrada): FECHAFIN es la fecha con la que se determina a qué corresponde la orden,
      // no su rango completo. Antes esto comparaba el RANGO [FECHAINICIO,FECHAFIN] contra las fechas
      // seleccionadas — un día seleccionado (ej. 21) hacía aparecer órdenes cuyo FECHAFIN real era
      // muy posterior (ej. 24), inconsistente con lo que la fila mostraba y con el filtro elegido.
      const coincide = dates.has(dateFin);
      return c === centro && allowed.includes(r) && coincide;
    });
  }, [todayStr, allowedRespPorCentro]);

  const provAuditUIO = useMemo(() => auditMapper(getFilteredData(ordenesProvisionales, '1000', selectedDatesProv, 'future'), '1000'), [auditMapper, getFilteredData, ordenesProvisionales, selectedDatesProv]);
  const provAuditGYE = useMemo(() => auditMapper(getFilteredData(ordenesProvisionales, '2000', selectedDatesProv, 'future'), '2000'), [auditMapper, getFilteredData, ordenesProvisionales, selectedDatesProv]);
  const fertAuditUIO = useMemo(() => auditMapper(getFilteredData(ordenesFert, '1000', selectedDatesFert, 'past'), '1000'), [auditMapper, getFilteredData, ordenesFert, selectedDatesFert]);
  const fertAuditGYE = useMemo(() => auditMapper(getFilteredData(ordenesFert, '2000', selectedDatesFert, 'past'), '2000'), [auditMapper, getFilteredData, ordenesFert, selectedDatesFert]);

  // Claves de órdenes Provisionales que YA se transformaron en orden FERT — "las órdenes FERT son las
  // mismas provisionales transformadas" (regla del negocio). Mientras ambas conviven en SAP, sumar sus
  // horas contaba DOS VECES el mismo trabajo en Capacidad Operativa. Verificado con datos reales de
  // Corte Espuma: 24 provisionales calzan exacto en material + fecha + cantidad con una FERT.
  //
  // La clave se arma desde `ordenesFert` en crudo y con CANTPROGRAMADA (no desde el UnifiedRow ya
  // mapeado, cuyo `cant` es CANTPENDIENTE desde que la carga se mide por lo pendiente): la provisional
  // se creó contra la cantidad PROGRAMADA, así que es contra esa que hay que emparejarla. El lado
  // provisional usa su `fecha` (FECHAINICIO) y su `cant` (CANTIDAD), que es como se validó el cruce.
  //
  // Se recorre TODO ordenesFert, sin filtro de fecha: si la FERT gemela existe, la provisional ya está
  // transformada aunque esa FERT caiga fuera de la ventana que muestra el tab.
  const clavesProvisionalesTransformadas = useMemo(() => {
    const porCentro: Record<string, Set<string>> = { '1000': new Set(), '2000': new Set() };
    ordenesFert.forEach(o => {
      const centro = String(getProp(o, ['CENTRO', 'Centro', 'centro'])).trim();
      if (!porCentro[centro]) return;
      const code = extractMaterialInfo(o).code;
      const fecha = String(getProp(o, ['FECHA'])).split('T')[0];
      const cant = safeNum(getProp(o, ['CANTPROGRAMADA']));
      if (!code || !fecha || cant <= 0) return;
      porCentro[centro].add(`${code}|${fecha}|${cant}`);
    });
    return porCentro;
  }, [ordenesFert, extractMaterialInfo]);

  // Quita de la carga las provisionales que ya existen como FERT (ver clavesProvisionalesTransformadas).
  const sinProvisionalesTransformadas = useCallback((rows: UnifiedRow[], centroId: '1000' | '2000'): UnifiedRow[] => {
    const claves = clavesProvisionalesTransformadas[centroId];
    if (!claves || claves.size === 0) return rows;
    return rows.filter(r => !claves.has(`${r.material}|${r.fecha}|${r.cant}`));
  }, [clavesProvisionalesTransformadas]);

  // Capacidad Operativa Nivel 1/2 (ver renderDashboard): filas de FERT/Provisional de un centro cuyo
  // RANGO (fecha..fechaFin) incluye `fechaPareo` — no coincidencia exacta contra `fecha`, porque un
  // Provisional trae rango propio (fecha_inicio..fecha_fin), no un día puntual (mismo bug ya
  // corregido para Respuesta P3, ver fechaOrdenCoincideConP2). Para FERT, que normalmente es un solo
  // día (fecha===fechaFin), el rango se reduce solo a esa fecha exacta igual. `allowedRespPorCentro`
  // + PRENSADO/FORRO/APROVECHAMIENTO: mismo filtro que getFilteredData aplica para los tabs —
  // auditMapper (fuente de fertAuditAllUIO/GYE, provAuditAllUIO/GYE) no lo aplica por su cuenta.
  const filasCentroEnFechaPareo = useCallback((rows: UnifiedRow[], centroId: '1000' | '2000', fechaPareo: string): UnifiedRow[] => {
    const allowed = allowedRespPorCentro(centroId);
    return rows.filter(r =>
      r.fecha <= fechaPareo && fechaPareo <= r.fechaFin &&
      allowed.includes(r.responsable) &&
      !/PRENSAD/i.test(r.descripcion) && !ES_FORRO(r.descripcion) && !/APROVECHAMIENTO/i.test(r.descripcion)
    );
  }, [allowedRespPorCentro]);

  // Selector de fecha de Capacidad Operativa (ver renderDashboard): mismo filtro base que
  // filasCentroEnFechaPareo (allowed + PRENSAD/FORRO/APROVECHAMIENTO), pero con coincidencia de fecha
  // EXACTA o ACUMULADA en vez de ventana de pareo — confirmado con el usuario con ejemplos reales:
  //   'exacta': fechaFin === fecha (FERT real ejecutado ESE día concreto).
  //   'hasta': fechaFin <= fecha (cobertura Provisional: cualquier lote con fecha fin hasta la
  //   evaluada, INCLUSIVE los ya viejos — cuentan sin excepción, pueden ser Provisionales aún no
  //   ejecutados o generados por un nivel del plan P1/PFF que no se había considerado).
  const filasCentroEnFecha = useCallback((rows: UnifiedRow[], centroId: '1000' | '2000', fecha: string, modo: 'exacta' | 'hasta'): UnifiedRow[] => {
    const allowed = allowedRespPorCentro(centroId);
    return rows.filter(r =>
      allowed.includes(r.responsable) &&
      !/PRENSAD/i.test(r.descripcion) && !ES_FORRO(r.descripcion) && !/APROVECHAMIENTO/i.test(r.descripcion) &&
      (modo === 'exacta' ? r.fechaFin === fecha : r.fechaFin <= fecha)
    );
  }, [allowedRespPorCentro]);

  // Fechas P2 (fecha_inicio_plan) por material y centro, con su ÁREA de origen — puede haber varias
  // si el material aparece en más de un P2 (distintos orígenes/fechas). Se usa para acotar qué
  // órdenes FERT/Provisionales "responden" a cuál necesidad (ver fertUnPorMaterialPorCentro,
  // provisionalUnPorMaterialPorCentro): una orden solo cuenta si su fecha cae dentro de la tolerancia
  // de ESA área (fechaOrdenCoincideConP2) respecto a AL MENOS una de estas fechas.
  // Se arma desde necesidadesPlantaConPFF, NO desde necesidadesPlantaData: antes dejaba fuera las
  // filas de la Necesidad PFF (Ensamblado), que viven en necesidadPFFData y solo se unen en
  // necesidadesPlantaConPFF. Consecuencia real: un material pedido ÚNICAMENTE por el PFF no tenía
  // ninguna fecha aquí, y como provisionalUnPorMaterialPorCentro descarta la orden cuando el material
  // no aparece en este mapa (`if (!candidatosP2) return`), sus Provisionales se ignoraban SIEMPRE —
  // el material salía "Sin cobertura" aunque tuviera la provisional que lo cubría entera.
  // Caso verificado: 30020116 (LAMINA D25 BLANCO SOFT 104X188X3.5), necesidad 9 Kg del PFF #216, con
  // una provisional de 5 unidades (≈9 Kg) fechada 12-ago que nunca se contaba. Igual 30008626 y
  // 30008653. Las filas PFF sí traen `fecha_inicio` (la del plan de Ensamblado), así que basta
  // incluirlas para que la tolerancia de fecha pueda evaluarse.
  const fechasP2PorMaterialPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, { fecha: string; area: string }[]>> = { '1000': new Map(), '2000': new Map() };
    Object.entries(necesidadesPlantaConPFF).forEach(([area, rows]) => {
      rows.forEach(row => {
        const centro = String(row.centro || '');
        if (!porCentro[centro] || !row.fecha_inicio || row.fecha_inicio === '—') return;
        const key = String(Number(row.codigo_material));
        const map = porCentro[centro];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ fecha: row.fecha_inicio, area });
      });
    });
    return porCentro;
  }, [necesidadesPlantaConPFF]);

  // Respuesta P3: mismo problema que motivó fertAuditAllUIO/GYE, pero sin corregir hasta ahora —
  // provAuditUIO/GYE (usadas por el tab "Provisionales") dependen de selectedDatesProv, el calendario
  // de ESE tab, ajeno a la necesidad puntual del P2. Se arma aquí su propia versión sin ese filtro,
  // recorriendo TODO ordenesProvisionales por centro.
  const provAuditAllUIO = useMemo(
    () => auditMapper(ordenesProvisionales.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '1000'), '1000'),
    [auditMapper, ordenesProvisionales]
  );
  const provAuditAllGYE = useMemo(
    () => auditMapper(ordenesProvisionales.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '2000'), '2000'),
    [auditMapper, ordenesProvisionales]
  );

  // Respuesta P3: cantidad "ya planificada" por material vía Órdenes Provisionales, en UNIDADES (no
  // Kg — comparar contra la Necesidad P2, que también está en UN, evita el redondeo/estimado de
  // pesoUN) — mismo criterio que fertUnPorMaterialPorCentro (responsable permitido +
  // fechaOrdenCoincideConP2 contra la ventana real del P2). Antes solo exigía "fecha ≥ hoy" sin techo
  // ni relación con la fecha del P2: verificado con datos reales, de 75 provisionales que calzaban
  // por material+responsable, solo 7 caían dentro de la ventana del P2 que decían responder — las
  // otras 68 contaban igual aunque estuvieran a semanas/meses de distancia (ej. material 30000160: P2
  // pide 04-ago, se le acreditaba una provisional del 08-sep). Al exigir la misma ventana que FERT, un
  // material sin provisional real que lo cubra cae a Stock o queda en 0 (ver
  // respuestaSalidaRowsPorCentro).
  const provisionalUnPorMaterialPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, number>> = { '1000': new Map(), '2000': new Map() };

    const procesar = (centro: '1000' | '2000', rows: UnifiedRow[]) => {
      const allowed = allowedRespPorCentro(centro);
      const fechasPorMaterial = fechasP2PorMaterialPorCentro[centro];
      const map = porCentro[centro];
      // Se descartan las provisionales que ya existen como FERT (misma orden en dos estados, ver
      // clavesProvisionalesTransformadas): si no, esa cantidad se contaría dos veces ahora que las
      // FERT vigentes también suman a la cobertura.
      const transformadas = clavesProvisionalesTransformadas[centro];
      rows.forEach(r => {
        if (!allowed.includes(r.responsable)) return;
        if (transformadas?.has(`${r.material}|${r.fecha}|${r.cant}`)) return;
        const candidatosP2 = fechasPorMaterial?.get(r.material);
        if (!candidatosP2 || candidatosP2.length === 0) return;
        const coincide = candidatosP2.some(c => fechaOrdenCoincideConP2(r.fecha, r.fechaFin, c.area, c.fecha, todayStr));
        if (!coincide) return;
        map.set(r.material, (map.get(r.material) || 0) + r.cantUnidadReal);
      });
    };

    procesar('1000', provAuditAllUIO);
    procesar('2000', provAuditAllGYE);
    return porCentro;
  }, [provAuditAllUIO, provAuditAllGYE, fechasP2PorMaterialPorCentro, todayStr, allowedRespPorCentro, clavesProvisionalesTransformadas]);

  // Respuesta P3: cantidad "ya planificada" por material vía Órdenes FERT, emparejadas contra la
  // fecha del P2 que responden (fechasP2PorMaterialPorCentro) dentro de la tolerancia de SU área
  // (fechaOrdenCoincideConP2) — caso real que motivó esto: Venta Externa #78 (material 30005466,
  // 2026-08-03, 12 unidades) tiene su orden FERT #000062753914 exactamente en esa fecha con la misma
  // cantidad, pero no se cruzaba contra el P2 (decisión previa: FERT solo alimentaba horas de
  // Capacidad Operativa). provisionalUnPorMaterialPorCentro (más arriba) aplica el mismo criterio.
  //
  // La cantidad en UN sale de auditMapper (cantUnidadReal — cantidad cruda de SAP, o Kg/pesoUN en el
  // caso latente de una orden nativa en KG). Se recorre TODO ordenesFert por centro (sin el filtro de
  // fecha "hoy+3" ni el selectedDatesFert de la UI, que son ajenos a esta necesidad puntual del P2)
  // para no perder órdenes fuera de esa ventana de visualización.
  const fertAuditAllUIO = useMemo(
    () => auditMapper(ordenesFert.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '1000'), '1000'),
    [auditMapper, ordenesFert]
  );
  const fertAuditAllGYE = useMemo(
    () => auditMapper(ordenesFert.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '2000'), '2000'),
    [auditMapper, ordenesFert]
  );

  // Las órdenes FERT se parten en DOS por su fecha de programación, que es lo que las asigna a un
  // ciclo de P2 (regla del usuario: "las FERT con fecha de hoy hacia atrás son las de los P2 [ya
  // ejecutados]; las que van hacia adelante son las del P2 con fecha del día siguiente"):
  //
  //   FECHA <  hoy  → 'anterior': ciclo ya ejecutado. NO cubre el P2 vigente; es carga en curso.
  //   FECHA >= hoy  → 'vigente' : responde al P2 que se está planificando. SÍ cuenta como cobertura.
  //
  // HOY exacto cuenta como 'vigente' (corregido 2026-08-14, antes el corte era estricto '>' y
  // dejaba fuera lo fechado hoy). Caso real que lo destapó: material 30005606, FERT #62767142
  // fechada exactamente hoy con CANTPENDIENTE=CANTPROGRAMADA=1078 (0% notificada/entregada) — el
  // supuesto "fecha ≤ hoy = ya ejecutado" era falso para esa orden, y la Respuesta P3 la descartaba
  // de la cobertura aunque seguía 100% pendiente.
  //
  // Por qué importa: la base de la cobertura son las órdenes Provisionales, pero una provisional se
  // convierte en FERT el mismo día en que se ejecuta — para cuando se corre el P3 por la mañana ya no
  // existe como provisional y la cobertura daba 0. Caso real verificado: material 30005472 no tiene
  // NINGUNA provisional, pero sí una FERT creada hoy (FECHAORDEN 07-ago) programada para el 12-ago
  // por 35 unidades = los 196 Kg que la tabla mostraba como "FERT" mientras marcaba "Sin cobertura".
  const fertUnPorMaterialPorCentro = useMemo(() => {
    const vacio = () => ({ '1000': new Map<string, number>(), '2000': new Map<string, number>() });
    const vigente: Record<string, Map<string, number>> = vacio();
    const anterior: Record<string, Map<string, number>> = vacio();

    const procesar = (centro: '1000' | '2000', rows: UnifiedRow[]) => {
      const allowed = allowedRespPorCentro(centro);
      rows.forEach(r => {
        if (!allowed.includes(r.responsable)) return;
        const destino = r.fecha >= todayStr ? vigente[centro] : anterior[centro];
        destino.set(r.material, (destino.get(r.material) || 0) + r.cantUnidadReal);
      });
    };

    procesar('1000', fertAuditAllUIO);
    procesar('2000', fertAuditAllGYE);
    return { vigente, anterior };
  }, [fertAuditAllUIO, fertAuditAllGYE, todayStr, allowedRespPorCentro]);

  // Respuesta P3: stock disponible por material y centro, en UNIDADES (tal cual viene
  // LIBREUTILIZACION) — último fallback de la cascada (FERT emparejado → Provisional → Stock), solo
  // para materiales del universo P2 de ese centro que no calzaron con ninguna de las dos fuentes
  // anteriores. Suma TODOS los almacenes de ALMACENES_STOCK_POR_CENTRO, no solo uno. Verificado
  // contra datos reales: en los almacenes de espuma LIBREUTILIZACION viene en UNIDADES/piezas
  // (valores enteros pequeños: 6, 40, 60, 313...), NO en Kg como en Corte y Laminado. También la usa
  // calcularFaltanteNecesidadPlanta (Capacidad Operativa), que ya trabajaba en unidades. A diferencia
  // de una versión Kg que existió acá (eliminada al mover Respuesta P3 a UN — ver
  // respuestaSalidaRowsPorCentro), este mapa NO descarta materiales sin geometría/pesoUN calculable —
  // un material con stock físico real pero descripción no parseable ahora sí cuenta como cobertura.
  const stockUnidadesPorMaterialPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, number>> = { '1000': new Map(), '2000': new Map() };
    inventarioSAP.forEach(inv => {
      const centro = String(getProp(inv, ['CENTRO', 'Centro', 'centro'])).trim();
      const almacenesEsperados = ALMACENES_STOCK_POR_CENTRO[centro as '1000' | '2000'];
      if (!almacenesEsperados) return;
      if (!almacenesEsperados.includes(String(getProp(inv, ['ALMACEN', 'Almacen'])).trim())) return;
      const unidades = safeNum(getProp(inv, ['LIBREUTILIZACION']));
      if (unidades <= 0) return;
      const code = extractMaterialInfo(inv).code;
      if (!code) return;
      const map = porCentro[centro];
      map.set(code, (map.get(code) || 0) + unidades);
    });
    return porCentro;
  }, [inventarioSAP, extractMaterialInfo]);

  // Responsable de Control de Producción por material y centro, en CASCADA de fuentes. Antes solo
  // miraba el inventario del propio centro (CODRESPPROD) y eso dejaba materiales sin responsable, que
  // luego caían en "Sin clasificar" y no se podían medir contra ningún proceso.
  //
  // Caso real que lo destapó (Centro 2000): los materiales 30008500, 30007130, 30010604, 30009873 y
  // 30007131 del P2 #242 NO tienen fila de inventario en el centro 2000 — nunca tuvieron stock ahí —
  // pero su responsable sí es conocible: el inventario del centro 1000 dice 038 y sus propias órdenes
  // en el centro 2000 también dicen 038. Eran ~12h de carga sin clasificar por un dato que sí existía.
  //
  // Fuente del paso 1, CAMBIADA de InventarioAnioActual (CODRESPPROD, en inventarioSAP) a
  // CuboInventarios (RespCtrlProd) — bug real encontrado con el usuario: verificado con datos reales
  // (material 30000203 "LAMINA D19 PLOMO AF 133X188X1.8") que CODRESPPROD de InventarioAnioActual NO
  // varía por centro (da "013" sin importar si se consulta como Centro 1000 o Centro 2000 — es un
  // dato único de maestro de material, no el responsable real de esa planta), mientras que
  // CuboInventarios sí trae el RespCtrlProd correcto POR CENTRO (mismo material: 013 en Centro 1000,
  // 002 en Centro 2000 — confirmado contra una captura real de SAP que compartió el usuario). Esto
  // hacía que Centro 2000 recuperara CERO componentes en su Necesidad PFF/P1: las láminas reales de
  // su BOM (LAMINA D19 PLOMO AF, LAMINA ESQUINA, etc.) tienen ahí RespCtrlProd 002/039 — que SÍ están
  // en la restricción RESPCTRLPROD real de Centro 2000 (002&038, + verticales 039) — pero el código
  // las etiquetaba con el 013/036 heredado de InventarioAnioActual, que no está en esa restricción.
  //
  // Orden de preferencia (de más a menos específico para ese centro):
  //   1. CuboInventarios del propio centro (RespCtrlProd)
  //   2. Órdenes reales del propio centro (Provisionales / FERT)
  //   3. CuboInventarios de cualquier otro centro — el responsable del material suele ser el mismo
  const materialRespCPPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, string>> = { '1000': new Map(), '2000': new Map() };
    const inventarioCualquierCentro = new Map<string, string>();

    // 1. CuboInventarios del propio centro
    cuboInventarios.forEach(inv => {
      const respCP = getProp(inv, ['RespCtrlProd', 'RESPCTRLPROD']);
      if (!respCP) return;
      const code = extractMaterialInfo(inv).code;
      if (!code) return;
      if (!inventarioCualquierCentro.has(code)) inventarioCualquierCentro.set(code, respCP);
      const map = porCentro[String(getProp(inv, ['Centro', 'CENTRO', 'centro'])).trim() as '1000' | '2000'];
      if (map && !map.has(code)) map.set(code, respCP);
    });

    // 2. Órdenes reales del propio centro
    const desdeOrdenes = (filas: RawApiRow[], campoCentro: string[], campoResp: string[]) => {
      filas.forEach(o => {
        const map = porCentro[String(getProp(o, campoCentro)).trim() as '1000' | '2000'];
        if (!map) return;
        const resp = String(getProp(o, campoResp)).trim();
        const code = extractMaterialInfo(o).code;
        if (!resp || !code || map.has(code)) return;
        map.set(code, resp);
      });
    };
    desdeOrdenes(ordenesProvisionales, ['Centro', 'CENTRO', 'centro'], ['RESPCONTROLPROD', 'RESPCTRLPROD']);
    desdeOrdenes(ordenesFert, ['CENTRO', 'Centro', 'centro'], ['RESPCTRLPROD', 'RESPCONTROLPROD']);

    // 3. Inventario de cualquier centro, como último recurso
    (['1000', '2000'] as const).forEach(centro => {
      inventarioCualquierCentro.forEach((resp, code) => {
        if (!porCentro[centro].has(code)) porCentro[centro].set(code, resp);
      });
    });

    return porCentro;
  }, [cuboInventarios, ordenesProvisionales, ordenesFert, extractMaterialInfo]);

  // Descripción por material para la Respuesta P3 — en cascada de fuentes, de más a menos específica.
  // Antes solo leía de Provisionales/FERT auditados (provAuditUIO/GYE, fertAuditUIO/GYE), que son los
  // conjuntos YA filtrados por responsable+fecha — dejaba sin descripción a cualquier material que
  // solo calzara vía fertAuditAllUIO/GYE (fuente real de fertUnPorMaterialPorCentro, sin ese filtro) o
  // vía Stock (inventarioSAP, sin ninguna orden). Verificado con datos reales: Muebles pasó de 0/80 a
  // 80/80 con descripción al sumar esas dos fuentes. Un material sin ninguna orden NI stock en ningún
  // centro queda sin descripción (limitación real, no hay maestro de materiales consultado aquí).
  const materialDescMap = useMemo(() => {
    const map = new Map<string, string>();
    const trySet = (code: string, desc: string) => {
      if (!code || !desc || desc === '—' || map.has(code)) return;
      map.set(code, desc);
    };
    [...provAuditUIO, ...provAuditGYE, ...fertAuditUIO, ...fertAuditGYE, ...fertAuditAllUIO, ...fertAuditAllGYE]
      .forEach(r => trySet(r.material, r.descripcion));
    inventarioSAP.forEach(inv => { const info = extractMaterialInfo(inv); trySet(info.code, info.desc); });
    return map;
  }, [provAuditUIO, provAuditGYE, fertAuditUIO, fertAuditGYE, fertAuditAllUIO, fertAuditAllGYE, inventarioSAP, extractMaterialInfo]);

  // Cruce Pendientes Totales ↔ Órdenes FERT por Cod.Buscar (POSICION+PEDIDO+MATERIAL) — mismo
  // mecanismo que ya usa Programación Táctica Venta Externa: si existe una FERT para esa posición,
  // ya se procesó (ya se cortó), así que esa posición deja de contar como pendiente/atrasada aquí.
  const fertFechaEntregaPorCodBuscar = useMemo(() => {
    const map = new Map<string, string>();
    ordenesFert.forEach(o => {
      const cod = buildCodBuscar(getProp(o, ['POSICION']), getProp(o, ['PEDIDO']), getProp(o, ['MATERIAL']));
      const fecha = getProp(o, ['FECHA']).split('T')[0];
      if (cod && fecha) map.set(cod, fecha);
    });
    return map;
  }, [ordenesFert]);

  // Pendientes de Venta Externa (sector "09 ESPUMAS") SIN FERT todavía, agrupados por el material
  // VENDIDO (PT — ej. "PLANCHA ESPUMA D17 LILA RR 100X200X3", 200xxxxx) dentro de la ventana de
  // búsqueda de 4 días hábiles. IMPORTANTE: el material vendido (PT) NO es el mismo código que la
  // lámina que corta Corte Espuma (HALB — ej. "LAMINA ESPUMA D17 LILA RR 100X200X3", 300xxxxx) —
  // verificado con datos reales: cero coincidencias directas entre los 19,939 registros de
  // Pendientes y los materiales de Necesidades Planta. La relación es de BOM (PT → explota a HALB),
  // no de mismo código — por eso esto es solo el insumo crudo; ver calcularEntregasVentaExterna, que
  // explota el BOM de cada PT único para llegar a la lámina real.
  const pendientesEspumasSinFertPorCentro = useMemo(() => {
    const porCentro: Record<'1000' | '2000', Map<string, string[]>> = { '1000': new Map(), '2000': new Map() };
    const finBusqueda = format(sumarDiasHabiles(new Date(), 4), 'yyyy-MM-dd');

    pendientesTotales.forEach(p => {
      const sector = String(getProp(p, ['SECTOR'])).trim().toUpperCase();
      if (sector !== SECTOR_ESPUMAS_PENDIENTES) return;
      const centro = String(getProp(p, ['CENTRO'])).trim();
      if (centro !== '1000' && centro !== '2000') return;
      const material = cleanCode(getProp(p, ['MATERIAL']));
      if (!material) return;
      // FECHA_ENTREGA es un timestamp UTC real (ej. "2026-01-07T05:00:00.000Z"), no una fecha plana
      // — el mismo bug de zona horaria que en explotarPFFParaCentro (ver fechaLocalEcuador).
      const fechaEntrega = fechaLocalEcuador(getProp(p, ['FECHA_ENTREGA']));
      // Sin cota inferior: un pedido YA vencido debe seguir explotándose (es la alerta de atraso que
      // buscamos). Solo se acota hacia adelante para no consultar el BOM de pedidos lejanos/no urgentes.
      if (!fechaEntrega || fechaEntrega > finBusqueda) return;
      const cod = buildCodBuscar(getProp(p, ['POSICION']), getProp(p, ['PEDIDO']), getProp(p, ['MATERIAL']));
      if (fertFechaEntregaPorCodBuscar.has(cod)) return;

      const map = porCentro[centro as '1000' | '2000'];
      if (!map.has(material)) map.set(material, []);
      map.get(material)!.push(fechaEntrega);
    });

    return porCentro;
  }, [pendientesTotales, fertFechaEntregaPorCodBuscar, todayStr, sumarDiasHabiles]);

  // Resultado de explotar el BOM de cada material PT único de pendientesEspumasSinFertPorCentro (ver
  // calcularEntregasVentaExterna) — YA a nivel de lámina (HALB), la clave que necesidadCapacidadMapper
  // puede cruzar directo contra info.code. Se calcula bajo demanda (botón "Calcular Entregas Venta
  // Externa") porque implica una llamada al Maestro de Materiales por cada PT único — no se dispara
  // solo, para no generar tráfico de golpe cada vez que cambian los pendientes.
  const [pendientesLaminaPorCentro, setPendientesLaminaPorCentro] = useState<Record<'1000' | '2000', Map<string, { atrasado: boolean; proximaFechaEntrega: string }>>>({ '1000': new Map(), '2000': new Map() });
  const [isCalculandoEntregas, setIsCalculandoEntregas] = useState(false);
  const [entregasProgress, setEntregasProgress] = useState({ current: 0, total: 0 });
  const [entregasDiagnostico, setEntregasDiagnostico] = useState<{ sinMatch: string[]; conError: string[] }>({ sinMatch: [], conError: [] });

  // Explota el BOM de cada material PT único (sin FERT, dentro de la ventana de 4 días hábiles) para
  // encontrar su componente de lámina (mismo criterio "ESPUMA" en la descripción que ya usa
  // explodeNecesidadesFert de Programación Táctica Venta Externa) y arma, por lámina, el
  // atrasado/próxima entrega agregando TODOS los PT que la requieren.
  const calcularEntregasVentaExterna = useCallback(async () => {
    setIsCalculandoEntregas(true);
    setEntregasDiagnostico({ sinMatch: [], conError: [] });
    try {
      const porCentroFechas: Record<'1000' | '2000', Array<[string, string[]]>> = {
        '1000': Array.from(pendientesEspumasSinFertPorCentro['1000'].entries()),
        '2000': Array.from(pendientesEspumasSinFertPorCentro['2000'].entries()),
      };
      const total = porCentroFechas['1000'].length + porCentroFechas['2000'].length;
      let current = 0;
      setEntregasProgress({ current: 0, total });

      const resultado: Record<'1000' | '2000', Map<string, { atrasado: boolean; proximaFechaEntrega: string }>> = { '1000': new Map(), '2000': new Map() };
      const sinMatch: string[] = [];
      const conError: string[] = [];

      for (const centro of ['1000', '2000'] as const) {
        for (const [materialPT, fechas] of porCentroFechas[centro]) {
          current++;
          setEntregasProgress({ current, total });
          try {
            const fullCode = materialPT.padStart(18, '0');
            const response = await serviciosService.getMaestroMaterialesExplosion(centro, fullCode, 1, 500);
            const rawData = response?.data?.data || response?.data || [];
            let encontroMatch = false;
            if (Array.isArray(rawData)) {
              (rawData as Record<string, unknown>[]).forEach(row => {
                const desc = String(row.DESCRIPCION_COMPONENTE || '').toUpperCase();
                if (!desc.includes('ESPUMA')) return;
                const laminaCode = cleanCode(row.COMPONENTE);
                if (!laminaCode) return;
                encontroMatch = true;

                const ordenadas = [...fechas].sort();
                const nuevoAtrasado = ordenadas.some(f => f < todayStr);
                const nuevaProxima = ordenadas[0];
                const previo = resultado[centro].get(laminaCode);
                if (!previo) {
                  resultado[centro].set(laminaCode, { atrasado: nuevoAtrasado, proximaFechaEntrega: nuevaProxima });
                } else {
                  resultado[centro].set(laminaCode, {
                    atrasado: previo.atrasado || nuevoAtrasado,
                    proximaFechaEntrega: nuevaProxima < previo.proximaFechaEntrega ? nuevaProxima : previo.proximaFechaEntrega,
                  });
                }
              });
            }
            if (!encontroMatch) sinMatch.push(materialPT);
          } catch (e) {
            console.warn(`[Entregas Venta Externa] Error explotando BOM para material ${materialPT} (centro ${centro}):`, (e as Error).message);
            conError.push(materialPT);
          }
        }
      }

      setPendientesLaminaPorCentro(resultado);
      setEntregasDiagnostico({ sinMatch, conError });
      addNotification('success', `Entregas Venta Externa calculadas: ${resultado['1000'].size} lámina(s) Quito, ${resultado['2000'].size} lámina(s) Guayaquil.`);
    } catch (e) {
      addNotification('error', `Error al calcular Entregas Venta Externa: ${(e as Error).message}`);
    } finally {
      setIsCalculandoEntregas(false);
    }
  }, [pendientesEspumasSinFertPorCentro, todayStr, addNotification]);

  // Adapta filas de "Necesidades Planta" (Forros/Muebles/Prensado/VentaExterna/Ensamblado PFF) al
  // mismo formato UnifiedRow que ya usan FERT/Provisionales (ver renderAuditTable), para poder
  // calcular la capacidad física (subbloques, cargas, tiempo) que esa demanda representaría si se
  // cortara — mismos cálculos que auditMapper (ver calcularMetricasCapacidad), pero partiendo de un
  // PlanGrupo P2/PFF en vez de una orden real ya colocada. Diferencias deliberadas frente a una orden
  // real: no hay orden/almacén reales, así que "Código Plan Grupo" muestra el Plan Grupo de origen
  // (#<codigo>). "Resp CP" y "Op. Alterna" salen de materialRespCPPorCentro (CODRESPPROD de
  // InventarioAnioActual, ver ese useMemo) con la misma regla 039/036/044 que auditMapper. "Grupo
  // Origen" es directamente el área ya conocida de la fila (row.area) — no hace falta la resolución
  // de ambigüedad de auditMapper, que existe para cuando una orden real se cruza contra varias
  // necesidades candidatas.
  const necesidadCapacidadMapper = useCallback((rows: ConsolidatedNeedRow[], centroId: string): UnifiedRow[] => {
    const rowsCentro = rows.filter(r => String(r.centro) === centroId);

    const prepared = rowsCentro.map(r => {
      const code = cleanCode(r.codigo_material);
      const desc = materialDescMap.get(code) || '';
      const dims = parseDimensions(desc);
      const info = { code, desc: desc || '—', ...dims };
      const tMatch = tiemposCatalogo.find(t => cleanCode(t.CodMaterial) === info.code && String(t.Centro).trim() === centroId);
      let tIndivReal = tMatch ? safeNum(tMatch.Tiempo || tMatch.Tiempo_Min) : 0;
      if (!tMatch) {
        const carruselMatch = kpiCarruselesData.find(c => cleanCode(c.Material) === info.code && String(c.Centro).trim() === centroId);
        if (carruselMatch) {
          const tiempoCorteMin = safeNum(carruselMatch.TiempoCorte) * CARRUSEL_TIEMPO_CORTE_A_MINUTOS;
          tIndivReal = tiempoCorteMin * CARRUSEL_ACTIVIDAD_ADICIONAL_FACTOR;
        }
      }
      return { r, info, tIndivReal };
    });

    const conocidos: MaterialGeomConocido[] = prepared
      .filter(p => p.tIndivReal > 0)
      .map(p => ({ ancho: p.info.ancho, largo: p.info.largo, esp: p.info.esp, dens: safeNum(p.info.dens), tIndiv: p.tIndivReal }));

    return prepared.map(({ r, info, tIndivReal }) => {
      const qty = parseQty(r.cantidad_produccion_neta);
      const densVal = safeNum(info.dens);
      const { hTotal, subBloques, undBatch, nroCargas, tIndiv, tIndivEstimado, tIndivEstimadoNivel, tTotal, tiempoDescargaH, sinGeometria } =
        calcularMetricasCapacidad(info, densVal, qty, tIndivReal, conocidos, centroId);

      const looperMatch = kpiLooperData.find(k => cleanCode(k.Material) === info.code);
      const pesoUN = looperMatch ? safeNum(looperMatch.PesoUN) : (info.ancho * info.largo * info.esp * densVal) / 1000000;

      const respCP = materialRespCPPorCentro[centroId]?.get(info.code) || '';
      // Misma regla que Provisionales/FERT (ver auditMapper): responsables 039/036/044 son operación alterna.
      const isAlterna = esRespVertical(centroId, respCP);

      // Atraso/próxima entrega solo aplica a Venta Externa (ver pendientesLaminaPorCentro, resultado
      // de calcularEntregasVentaExterna): Colchones/Muebles/Prensado no tienen pedido de venta
      // directo a nivel de material cortado.
      const esVentaExternaRow = /venta\s*externa/i.test(r.area);
      const pendienteInfo = esVentaExternaRow ? pendientesLaminaPorCentro[centroId as '1000' | '2000']?.get(info.code) : undefined;

      return {
        orden: `#${r.codigo_plan_grupo}`,
        fecha: r.fecha_inicio,
        fechaFin: r.fecha_fin,
        material: info.code,
        descripcion: info.desc,
        ancho: info.ancho, largo: info.largo, esp: info.esp, dens: info.dens,
        cant: qty,
        peso: pesoUN * qty,
        // El P2 siempre está en UN (convención ya establecida — Venta Externa/Muebles/Forros graban
        // cantidad_produccion_neta en unidades, nunca Kg), así que no hace falta la corrección de
        // unidadOrden que sí aplica en auditMapper (datos crudos de SAP).
        cantUnidadReal: qty,
        alturaTotal: hTotal,
        subBloques,
        nroCargas,
        undBatch,
        tIndiv,
        tIndivEstimado,
        tIndivEstimadoNivel,
        tTotal,
        tiempoDescargaH,
        sinGeometria,
        atrasado: pendienteInfo?.atrasado,
        proximaFechaEntrega: pendienteInfo?.proximaFechaEntrega,
        apertura: info.apertura,
        categoria: r.area,
        centro: centroId,
        almacen: '',
        responsable: respCP,
        maquina: '',
        isAlterna,
        origenArea: r.area,
        origenCodigoGrupo: r.codigo_grupo,
        origenCodigoPlanGrupo: r.codigo_plan_grupo,
        origenAmbiguo: false,
        origenCandidatosCount: 1
      };
    });
  }, [materialDescMap, tiemposCatalogo, kpiCarruselesData, kpiLooperData, materialRespCPPorCentro, pendientesLaminaPorCentro, esRespVertical]);

  // Capacidad física que representaría cortar toda la demanda de "Necesidades Planta" — mismo formato
  // de tabla que FERT/Provisionales (ver renderAuditTable), un bloque por centro.
  const necesidadCapacidadUIO = useMemo(() => necesidadCapacidadMapper(necesidadesPlantaConsolidada, '1000'), [necesidadCapacidadMapper, necesidadesPlantaConsolidada]);
  const necesidadCapacidadGYE = useMemo(() => necesidadCapacidadMapper(necesidadesPlantaConsolidada, '2000'), [necesidadCapacidadMapper, necesidadesPlantaConsolidada]);

  // Capacidad Operativa Nivel 2 (red de seguridad, ciclo atrasado un día — ver renderDashboard): SOLO
  // P1/PFF (necesidadPFFNivel2Data, hoy+2 días hábiles). Venta Externa-Espumas NO tiene Nivel 2 propio
  // — verificado que fetchNecesidadesPlanta ya toma "el único P2-Espumas activo del grupo, sea cual
  // sea su fecha" (Venta Externa garantiza como máximo uno activo por centro): si ese plan está
  // atrasado, YA es lo que Nivel 1 está usando, no hay un segundo plan "de ayer" que buscar aparte.
  const necesidadPFFNivel2Consolidada = useMemo(
    () => [...necesidadPFFNivel2Data['1000'], ...necesidadPFFNivel2Data['2000']].map(r => ({ ...r, area: 'Ensamblado' })),
    [necesidadPFFNivel2Data]
  );
  const necesidadCapacidadNivel2UIO = useMemo(() => necesidadCapacidadMapper(necesidadPFFNivel2Consolidada, '1000'), [necesidadCapacidadMapper, necesidadPFFNivel2Consolidada]);
  const necesidadCapacidadNivel2GYE = useMemo(() => necesidadCapacidadMapper(necesidadPFFNivel2Consolidada, '2000'), [necesidadCapacidadMapper, necesidadPFFNivel2Consolidada]);
  // Pool de necesidad por material del Nivel 2 — mismo formato de clave que materialNecesidadesPlantaMapPorCentro
  // (String(Number(codigo_material))), para que calcularFaltanteNecesidadPlanta pueda netear contra él.
  const materialNecesidadPFFNivel2MapPorCentro = useMemo(() => {
    const porCentro: Record<'1000' | '2000', Map<string, number>> = { '1000': new Map(), '2000': new Map() };
    (['1000', '2000'] as const).forEach(centro => {
      necesidadPFFNivel2Data[centro].forEach(row => {
        const key = String(Number(row.codigo_material));
        const map = porCentro[centro];
        map.set(key, (map.get(key) || 0) + parseQty(row.cantidad_produccion_neta));
      });
    });
    return porCentro;
  }, [necesidadPFFNivel2Data]);
  // Necesidad total por material, Nivel 1 + Nivel 2 combinados — para `resolverFecha` (más abajo en
  // renderDashboard), que evalúa ambos niveles JUNTOS en una sola llamada a
  // calcularFaltanteNecesidadPlanta para una fecha puntual. Sin este mapa combinado, esa llamada caía
  // por defecto solo al pool de Nivel 1 (materialNecesidadesPlantaMapPorCentro) y un material con
  // necesidad SOLO en Nivel 2 quedaba con necesidad=0 ahí — se perdía del todo, no solo se contaba mal.
  const necesidadPorMaterialCombinadoPorCentro = useMemo(() => {
    const porCentro: Record<'1000' | '2000', Map<string, number>> = { '1000': new Map(), '2000': new Map() };
    (['1000', '2000'] as const).forEach(centro => {
      const combinado = new Map<string, number>();
      materialNecesidadesPlantaMapPorCentro[centro]?.forEach((qty, material) => combinado.set(material, (combinado.get(material) || 0) + qty));
      materialNecesidadPFFNivel2MapPorCentro[centro]?.forEach((qty, material) => combinado.set(material, (combinado.get(material) || 0) + qty));
      porCentro[centro] = combinado;
    });
    return porCentro;
  }, [materialNecesidadesPlantaMapPorCentro, materialNecesidadPFFNivel2MapPorCentro]);

  // "Necesidades Planta" (P2) que todavía NO cubre ni el stock ni una orden provisional — la parte de
  // la demanda que aún no tiene con qué producirse y que, por lo tanto, sigue pesando en la capacidad.
  //
  // Misma regla que la Respuesta P3 (ver respuestaSalidaRowsPorCentro), pero en unidades en vez de Kg:
  //   faltante = max(0, necesidad_P2 - stock - provisionales)
  //
  // Las FERT ya NO se descuentan aquí (antes sí: `necesidad - (FERT + Provisional)`). Son provisionales
  // ya transformadas que responden a un P2 anterior, así que descontarlas de la necesidad vigente
  // acreditaba dos veces la misma producción. En el resumen las FERT entran por el otro lado —como
  // carga en curso, con su CANTPENDIENTE (ver auditMapper)—, no como cobertura del P2 de hoy.
  //
  // Esto también es la red de seguridad cuando una orden provisional se borra en SAP: la necesidad no
  // desaparece con ella, reaparece íntegra como faltante y sigue ocupando capacidad. Por eso el
  // resumen se alimenta de "provisionales + faltante" y nunca solo de provisionales.
  //
  // Colchones/Muebles generan sus láminas por LOTE (una orden puede cubrir de sobra o solo en parte la
  // necesidad de un material compartido entre áreas — de ahí que se sume necesidad y cobertura por
  // material, no por fila/orden individual); Venta Externa genera 1 a 1, pero la cuenta es la misma.
  // Si sobra faltante, se prorratea el tTotal que necesidadCapacidadUIO/GYE ya calculó para TODA la
  // necesidad de ese material por la razón faltante/necesidad — mismo criterio de escalado que
  // reconciliarProvisionalesConNecesidad, para no duplicar horas que una orden real ya cubre.
  // Devuelve UnifiedRow[] (no un número) para reusar el mismo sumByResp/reduce que ya usa
  // renderDashboard para Carrusel/Vertical — cada fila conserva su "responsable".
  // `cobertura`: FERT + Provisional combinados (antes solo recibía Provisional) — un FERT ya firme
  // cubre la necesidad exactamente igual que un Provisional, ambos son "ya hay algo generándose para
  // esto". `necesidadPorMaterialOverride`: para Capacidad Operativa Nivel 2 (ver renderDashboard),
  // que debe netear contra el pool de necesidad DE ESE nivel, no contra el de Nivel 1
  // (materialNecesidadesPlantaMapPorCentro, que solo tiene el ciclo fresco de hoy). Sin override, el
  // único call-site preexistente (Nivel 1, antes de esta reestructuración) sigue igual.
  // stockYaReservadoPorMaterial: stock que YA se le adjudicó a otra necesidad evaluada antes (ver
  // Nivel 1/Nivel 2 en renderDashboard) — sin esto, dos necesidades del mismo material podían netear
  // cada una contra el stock COMPLETO por separado, "cubriendo" el mismo stock dos veces y escondiendo
  // un faltante real (caso reportado por el usuario, 2026-09-02: material con necesidad repartida
  // entre Nivel 1 y Nivel 2, stock=80, cada nivel por su lado veía faltante=0 aunque la necesidad
  // combinada fuera mayor a 80). Devuelve también stockUsadoPorMaterial para encadenar la reserva
  // hacia la siguiente llamada.
  const calcularFaltanteNecesidadPlanta = useCallback((
    centroId: '1000' | '2000',
    provRows: UnifiedRow[],
    necesidadRows: UnifiedRow[],
    necesidadPorMaterialOverride?: Map<string, number>,
    stockYaReservadoPorMaterial?: Map<string, number>
  ): { faltante: UnifiedRow[]; stockUsadoPorMaterial: Map<string, number> } => {
    const necesidadPorMaterial = necesidadPorMaterialOverride ?? materialNecesidadesPlantaMapPorCentro[centroId];
    const stockUsadoPorMaterial = new Map<string, number>();
    if (!necesidadPorMaterial || necesidadPorMaterial.size === 0) return { faltante: [], stockUsadoPorMaterial };

    const stockPorMaterial = stockUnidadesPorMaterialPorCentro[centroId];
    const provisionalPorMaterial = new Map<string, number>();
    provRows.forEach(r => provisionalPorMaterial.set(r.material, (provisionalPorMaterial.get(r.material) || 0) + r.cant));

    // Faltante y stock realmente consumido, UNA vez por material (no por fila): necesidadRows puede
    // traer varias filas del mismo material (una por área de origen), todas comparten el mismo total.
    const faltantePorMaterial = new Map<string, number>();
    necesidadPorMaterial.forEach((necesidad, material) => {
      if (necesidad <= 0) return;
      const provisional = provisionalPorMaterial.get(material) || 0;
      const stockTotal = stockPorMaterial?.get(material) || 0;
      const stockYaReservado = stockYaReservadoPorMaterial?.get(material) || 0;
      const stockDisponible = Math.max(0, stockTotal - stockYaReservado);
      const cubierta = provisional + stockDisponible;
      faltantePorMaterial.set(material, Math.max(0, necesidad - cubierta));
      const stockUsado = Math.min(stockDisponible, Math.max(0, necesidad - provisional));
      if (stockUsado > 0) stockUsadoPorMaterial.set(material, stockUsado);
    });

    const faltante = necesidadRows.reduce<UnifiedRow[]>((acc, r) => {
      const necesidad = necesidadPorMaterial.get(r.material) || 0;
      if (necesidad <= 0) return acc;
      const faltanteQty = faltantePorMaterial.get(r.material) || 0;
      if (faltanteQty <= 0) return acc;
      acc.push({ ...r, tTotal: r.tTotal * (faltanteQty / necesidad) });
      return acc;
    }, []);

    return { faltante, stockUsadoPorMaterial };
  }, [materialNecesidadesPlantaMapPorCentro, stockUnidadesPorMaterialPorCentro]);

  // Duración en horas de una fila de Mantenimiento SAP. El campo real es Duracion_Minutos
  // (en minutos); T_MTTO_PLANIFICADO no existe en el endpoint pero se conserva como
  // resguardo por si alguna variante del servicio lo llega a incluir (en horas).
  // NOTA: movida más arriba en el archivo (junto con uniqueMantenimientosSAP/resolveMachineLink/
  // getMttoTimeParaFecha) para que resumenReportePorPlanta pueda usarla — antes vivían junto a
  // renderMachineCol/getMttoTime, mucho más abajo, fuera del alcance de este useMemo.
  const getMttoDurationH = (row: RawApiRow): number => {
    const durMin = safeNum(getProp(row, ['Duracion_Minutos']));
    if (durMin > 0) return durMin / 60;
    const legacyH = safeNum(getProp(row, ['T_MTTO_PLANIFICADO', 't_mtto_planificado']));
    if (legacyH > 0) return legacyH;
    const ini = new Date(getProp(row, ['FECHA_OT_PRG_INI']));
    const fin = new Date(getProp(row, ['FECHA_OT_PRG_FIN']));
    if (isValid(ini) && isValid(fin)) return (fin.getTime() - ini.getTime()) / 3600000;
    return 0;
  };

  // El endpoint de SAP no expone un ID de orden (no existe OT_PRG_ID): la misma ventana de
  // mantenimiento (misma máquina + mismo inicio/fin) se repite una vez por cada línea de
  // proceso/responsable que usa esa máquina (fan-out del join de origen). Se deduplica por
  // ID_MAQUINA + FECHA_OT_PRG_INI + FECHA_OT_PRG_FIN para quedarnos con una sola línea por
  // ventana de mantenimiento real. Filtro por AREA: el endpoint trae TODO el mantenimiento de la
  // planta, sin filtrar por área — y los ID_MAQUINA de este módulo NO son exclusivos de Corte
  // Espuma en SAP, se reutilizan en otras áreas (verificado con datos reales). El valor real en SAP
  // trae doble espacio ("Corte y  Laminado"), de ahí el \s+ en vez de comparar literal.
  const uniqueMantenimientosSAP = useMemo(() => {
    const seen = new Set<string>();
    return mantenimientosSAP
      .filter(m => /^corte\s+y\s+laminado$/i.test(getProp(m, ['AREA']).trim()))
      .filter(m => {
        const key = [
          getProp(m, ['ID_MAQUINA']),
          getProp(m, ['FECHA_OT_PRG_INI']),
          getProp(m, ['FECHA_OT_PRG_FIN']),
        ].join('|').trim().toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [mantenimientosSAP]);

  // Vincula un ID_MAQUINA de Mantenimiento SAP con la máquina real del módulo. El endpoint no
  // expone PLANTA como texto: el campo confiable es Centro (1000 = UIO, 2000 = GYE). Si no viene
  // informado, se busca en ambas listas de máquinas (el ID de la máquina ya acota el resultado
  // salvo para CR01, que existe en ambas plantas).
  const resolveMachineLink = (idMaquina: string, centro: string | number, plantaTexto?: string) => {
    const id = String(idMaquina || '').trim().toUpperCase();
    if (!id) return null;
    const centroStr = String(centro ?? '').trim();
    const pStr = String(plantaTexto || '').toUpperCase();
    let candidates: ('UIO' | 'GYE')[];
    if (centroStr === '1000') candidates = ['UIO'];
    else if (centroStr === '2000') candidates = ['GYE'];
    else if (pStr.includes('QUITO')) candidates = ['UIO'];
    else if (pStr.includes('GUAYAQUIL')) candidates = ['GYE'];
    else candidates = ['UIO', 'GYE'];
    for (const planta of candidates) {
      const match = MACHINES_BY_PLANTA[planta].find(m => m.id === id || id.includes(m.id));
      if (match) return { ...match, planta };
    }
    return null;
  };

  // Mantenimiento real para UNA fecha explícita (a diferencia de getMttoTime, más abajo, que usa
  // los selectores de Provisionales/FERT para la tarjeta informativa por máquina) — usado para
  // restar mantenimiento real de la capacidad de Capacidad Operativa y del reporte por correo
  // (antes solo se mostraba informativo, sin afectar el cálculo — confirmado por el usuario que
  // debe afectar el tiempo de la máquina, según fecha).
  const getMttoTimeParaFecha = useCallback((machineId: string, planta: string, fecha: string): number => {
    const target = machineId.trim().toUpperCase();
    return uniqueMantenimientosSAP
      .filter(m => {
        const idMaquina = getProp(m, ['ID_MAQUINA', 'MAQUINA']);
        const link = resolveMachineLink(idMaquina, getProp(m, ['Centro', 'CENTRO']), getProp(m, ['PLANTA']));
        if (!link || link.id !== target || link.planta !== planta) return false;
        return fechaLocalEcuador(getProp(m, ['FECHA_OT_PRG_INI'])) === fecha;
      })
      .reduce((sum, row) => sum + getMttoDurationH(row), 0);
  }, [uniqueMantenimientosSAP]);

  // Resumen de capacidad para el reporte por correo (Capacidad Operativa) — reusa los mismos hooks
  // pesados que ya alimentan renderDashboard (necesidad, faltante neto de stock, etc.), sin duplicar
  // esa lógica; solo reconstruye el "pegamento" de resolución por fecha (resolverFecha/backlog) que
  // renderDashboard mantiene local a su propia función y por eso no es reutilizable desde afuera.
  const resumenReportePorPlanta = useMemo(() => {
    const calcularPlanta = (planta: 'UIO' | 'GYE') => {
      const centroId: '1000' | '2000' = planta === 'UIO' ? '1000' : '2000';
      const necesidadCapacidad = planta === 'UIO' ? necesidadCapacidadUIO : necesidadCapacidadGYE;
      const necesidadCapacidadNivel2 = planta === 'UIO' ? necesidadCapacidadNivel2UIO : necesidadCapacidadNivel2GYE;
      const fertSinVentana = planta === 'UIO' ? fertAuditAllUIO : fertAuditAllGYE;
      const provSinVentana = sinProvisionalesTransformadas(planta === 'UIO' ? provAuditAllUIO : provAuditAllGYE, centroId);

      const resolverFecha = (fecha: string): { row: UnifiedRow; estado: 'FERT' | 'Ya firme' | 'Faltante' }[] => {
        const fertX = filasCentroEnFecha(fertSinVentana, centroId, fecha, 'exacta');
        if (fertX.length > 0) return fertX.map(row => ({ row, estado: 'FERT' as const }));
        const necesidadX = [...necesidadCapacidad, ...necesidadCapacidadNivel2].filter(r => r.fecha === fecha);
        if (necesidadX.length === 0) return [];
        const provX = filasCentroEnFecha(provSinVentana, centroId, fecha, 'hasta');
        const materialesNecesidad = new Set(necesidadX.map(r => r.material));
        const { faltante: faltanteX } = calcularFaltanteNecesidadPlanta(centroId, provX, necesidadX, necesidadPorMaterialCombinadoPorCentro[centroId]);
        return [
          ...provX.filter(r => materialesNecesidad.has(r.material)).map(row => ({ row, estado: 'Ya firme' as const })),
          ...faltanteX.map(row => ({ row, estado: 'Faltante' as const })),
        ];
      };

      // Mismo criterio que renderDashboard (ver su comentario extenso): además del backlog "por
      // necesidad" (solo fechas con PlanGrupo todavía activo), se suma el backlog "por orden real" —
      // FERT pendiente (CANTPENDIENTE>0) cuyo plan origen ya rotó a inactivo. ACOTADO al día hábil
      // INMEDIATO anterior a la fecha elegida (no "todo hacia atrás" sin límite): verificado con
      // datos reales que órdenes FERT con CANTPENDIENTE>0 pueden remontar semanas atrás (SAP no
      // siempre cierra el remanente aunque la orden ya esté resuelta en la práctica) — sumar eso sin
      // tope disparó la Ocupación Total a 200%. El backlog es "lo de ayer que no se hizo", no un
      // acumulado histórico completo.
      const calcularBacklogAntesDe = (fechaLimite: string) => {
        const fechasConNecesidad = Array.from(new Set(
          [...necesidadCapacidad, ...necesidadCapacidadNivel2].map(r => r.fecha)
        )).filter(f => f < fechaLimite);
        const backlogNecesidad = fechasConNecesidad.flatMap(f => resolverFecha(f).map(x => ({ ...x, fecha: f })));

        const diaHabilAnterior = format(restarDiasHabiles(parseFechaLocal(fechaLimite), 1), 'yyyy-MM-dd');
        const yaCapturado = new Set(backlogNecesidad.map(x => `${x.row.orden}|${x.row.material}`));
        const backlogFertReal = fertSinVentana
          .filter(r => r.centro === centroId && r.fecha === diaHabilAnterior && r.cant > 0 && !yaCapturado.has(`${r.orden}|${r.material}`))
          .map(row => ({ row, estado: 'FERT' as const, fecha: row.fecha }));

        return [...backlogNecesidad, ...backlogFertReal];
      };

      const fechasSel = Array.from(selectedDatesCapacidad[planta]).sort();
      const backlogSeleccion = fechasSel.length > 0 ? calcularBacklogAntesDe(fechasSel[0]) : [];
      const filasSeleccion = [...backlogSeleccion, ...fechasSel.flatMap(f => resolverFecha(f).map(x => ({ ...x, fecha: f })))];

      const config = planta === 'UIO' ? uioConfig : gyeConfig;
      const machines = MACHINES_BY_PLANTA[planta];
      const rendimientoDe = (proceso: ProcesoCorte) =>
        proceso === 'vertical' ? 1 : proceso === 'cnc' ? config.performanceCNC / 100 : config.performance / 100;
      const horasDeMaquina = (id: string) => {
        const c = config.shifts[id];
        if (!c || c.activa === false) return 0;
        const proceso = machines.find(m => m.id === id)?.proceso ?? 'carrusel';
        const hD = shiftOptions.find(o => o.v === c.day)?.h || 0;
        const hN = nightShiftOptions.find(o => o.v === c.night)?.h || 0;
        const hS = shiftOptions.find(o => o.v === c.saturday)?.h || 0;
        return ((hD * (1 - c.paro1 / 100)) + (hN * (1 - c.paro2 / 100)) + (hS * (1 - c.paro3 / 100))) * rendimientoDe(proceso);
      };
      const capacidadPorProceso = machines.reduce<Record<ProcesoCorte, number>>((acc, m) => {
        acc[m.proceso] += horasDeMaquina(m.id);
        return acc;
      }, { carrusel: 0, vertical: 0, cnc: 0 });

      const CARRUSEL_RESP = responsablesPorCentro[centroId].carruseles;
      const VERTICAL_RESP = responsablesPorCentro[centroId].verticales;
      // CNC se separa por MÁQUINA real (esFilaCNC, código SAP HR-CTCNC), no por responsable — sus
      // responsables (044, 038) ya estaban dentro de CARRUSEL_RESP, así que Carruseles debe excluir
      // explícitamente las filas de CNC para no contarlas dos veces.
      const filasProceso = (proceso: ProcesoCorte) => proceso === 'cnc'
        ? filasSeleccion.filter(x => esFilaCNC(x.row.maquina))
        : filasSeleccion.filter(x => (proceso === 'carrusel' ? CARRUSEL_RESP : VERTICAL_RESP).includes(x.row.responsable) && !esFilaCNC(x.row.maquina));
      const ocupadoPorProceso = (proceso: ProcesoCorte) => filasProceso(proceso).reduce((s, x) => s + x.row.tTotal, 0);
      // Cantidad (UN) y Peso (Kg) reales — mismas filas que ya se usan para el tiempo (confirmado por
      // el usuario), no un cálculo aparte.
      const cantidadPorProceso = (proceso: ProcesoCorte) => filasProceso(proceso).reduce((s, x) => s + x.row.cantUnidadReal, 0);
      const pesoPorProceso = (proceso: ProcesoCorte) => filasProceso(proceso).reduce((s, x) => s + x.row.peso, 0);

      // Mantenimiento real (mantenimientosSAP), para la fecha seleccionada — antes solo se mostraba
      // informativo, ahora resta de la capacidad de cada proceso (confirmado por el usuario).
      const fechaMtto = fechasSel[0];
      const mttoDeMaquina = (id: string) => fechaMtto ? getMttoTimeParaFecha(id, planta, fechaMtto) : 0;
      const mttoPorProceso = (proceso: ProcesoCorte) =>
        machines.filter(m => m.proceso === proceso).reduce((s, m) => s + mttoDeMaquina(m.id), 0);

      const diaComun = machines.length > 0 && new Set(machines.map(m => config.shifts[m.id]?.day)).size === 1 ? config.shifts[machines[0].id]?.day : '';
      const nocheComun = machines.length > 0 && new Set(machines.map(m => config.shifts[m.id]?.night)).size === 1 ? config.shifts[machines[0].id]?.night : '';

      // Detalle por máquina — para el correo (bloque expandido por carrusel, tabla compacta para
      // CNC/Verticales, ver construirReporteHtmlEspuma): cada máquina con su turno, paro, mtto real
      // ya restado, y el total neto.
      const detallePorMaquina = machines.map(m => {
        const c = config.shifts[m.id];
        const diaLabel = shiftOptions.find(o => o.v === c?.day)?.l || '—';
        const nocheLabel = nightShiftOptions.find(o => o.v === c?.night)?.l || '—';
        const hD = shiftOptions.find(o => o.v === c?.day)?.h || 0;
        const hN = nightShiftOptions.find(o => o.v === c?.night)?.h || 0;
        const rendimiento = rendimientoDe(m.proceso);
        const diaNeta = hD * (1 - (c?.paro1 ?? 0) / 100) * rendimiento;
        const nocheNeta = hN * (1 - (c?.paro2 ?? 0) / 100) * rendimiento;
        const mttoReal = mttoDeMaquina(m.id);
        return {
          id: m.id,
          nombre: m.n,
          proceso: m.proceso,
          diaLabel, nocheLabel,
          diaNeta, nocheNeta,
          paro: c?.paro1 ?? 0,
          mttoReal,
          total: Math.max(0, horasDeMaquina(m.id) - mttoReal),
        };
      });

      return {
        fecha: fechasSel[0] || '',
        diaLabel: shiftOptions.find(o => o.v === diaComun)?.l || '—',
        nocheLabel: nightShiftOptions.find(o => o.v === nocheComun)?.l || '—',
        paroPorc: machines[0] ? config.shifts[machines[0].id]?.paro1 ?? 0 : 0,
        rendimientoPct: config.performance,
        rendimientoCNCPct: config.performanceCNC,
        detallePorMaquina,
        carruseles: { capacidad: Math.max(0, capacidadPorProceso.carrusel - mttoPorProceso('carrusel')), ocupacion: ocupadoPorProceso('carrusel'), cantidad: cantidadPorProceso('carrusel'), peso: pesoPorProceso('carrusel') },
        verticales: { capacidad: Math.max(0, capacidadPorProceso.vertical - mttoPorProceso('vertical')), ocupacion: ocupadoPorProceso('vertical'), cantidad: cantidadPorProceso('vertical'), peso: pesoPorProceso('vertical') },
        cnc: { capacidad: Math.max(0, capacidadPorProceso.cnc - mttoPorProceso('cnc')), ocupacion: ocupadoPorProceso('cnc'), cantidad: cantidadPorProceso('cnc'), peso: pesoPorProceso('cnc') },
      };
    };
    return { UIO: calcularPlanta('UIO'), GYE: calcularPlanta('GYE') };
  }, [
    necesidadCapacidadUIO, necesidadCapacidadGYE, necesidadCapacidadNivel2UIO, necesidadCapacidadNivel2GYE,
    fertAuditAllUIO, fertAuditAllGYE, provAuditAllUIO, provAuditAllGYE, sinProvisionalesTransformadas,
    filasCentroEnFecha, calcularFaltanteNecesidadPlanta, necesidadPorMaterialCombinadoPorCentro,
    selectedDatesCapacidad, uioConfig, gyeConfig, shiftOptions, nightShiftOptions, responsablesPorCentro,
    restarDiasHabiles, getMttoTimeParaFecha,
  ]);

  // Cuerpo del correo — mismo formato ya aprobado en Artifact (Día/Noche/Mtto simple, Carruseles y
  // Verticales SIN combinar en un solo "Tiempo Disponible": mezclarlos diluye la lectura real de cada
  // proceso, mismo criterio que ya usa este dashboard). El % de paro que se aplica es manual
  // (config.shifts[...].paro1/2) — el mantenimiento real (mantenimientosSAP) no entra en este cálculo
  // todavía, se deja fuera del correo por ahora para no mostrar un número que no se está usando.
  const construirReporteHtmlEspuma = (planta: 'UIO' | 'GYE') => {
    const r = resumenReportePorPlanta[planta];
    const nombrePlanta = planta === 'UIO' ? 'Quito' : 'Guayaquil';
    const fechaLabel = r.fecha ? format(parseFechaLocal(r.fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    const pctCarruseles = r.carruseles.capacidad > 0 ? (r.carruseles.ocupacion / r.carruseles.capacidad) * 100 : 0;
    const pctVerticales = r.verticales.capacidad > 0 ? (r.verticales.ocupacion / r.verticales.capacidad) * 100 : 0;
    const pctCnc = r.cnc.capacidad > 0 ? (r.cnc.ocupacion / r.cnc.capacidad) * 100 : 0;
    const tieneCnc = r.cnc.capacidad > 0 || r.cnc.ocupacion > 0 || r.detallePorMaquina.some(m => m.proceso === 'cnc');

    // Detalle por máquina — carruseles: bloque expandido (Día/Noche/Paro programado/Mantenimiento),
    // igual al mockup aprobado por el usuario.
    const carruselesMaquinas = r.detallePorMaquina.filter(m => m.proceso === 'carrusel');
    const carruselesDetalleHtml = carruselesMaquinas.map((m, idx) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #111827;border-radius:10px;overflow:hidden;${idx < carruselesMaquinas.length - 1 ? 'margin-bottom:12px;' : ''}">
        <tr style="background:#ecfdf5;"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:#047857;border-bottom:1px solid #d1d5db;">Día</td><td style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #d1d5db;">${m.diaLabel}</td><td align="right" style="padding:7px 12px;font-size:11px;font-weight:700;color:#047857;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;">${m.diaNeta.toFixed(2)}</td></tr>
        <tr style="background:#eef2ff;"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:#4338ca;border-bottom:1px solid #d1d5db;">Noche</td><td style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #d1d5db;">${m.nocheLabel}</td><td align="right" style="padding:7px 12px;font-size:11px;font-weight:700;color:#4338ca;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;">${m.nocheNeta.toFixed(2)}</td></tr>
        <tr style="background:#fffbeb;"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #d1d5db;">Mantenimiento Programado</td><td style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #d1d5db;"></td><td align="right" style="padding:7px 12px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;">${m.mttoReal > 0 ? m.mttoReal.toFixed(2) : '–'}</td></tr>
        <tr style="background:#ecfdf5;"><td colspan="2" style="padding:8px 12px;font-size:11px;font-weight:800;color:#111827;text-transform:uppercase;">${m.nombre}</td><td align="right" style="padding:8px 12px;font-size:11px;font-weight:800;color:#111827;font-variant-numeric:tabular-nums;">${m.total.toFixed(2)} h</td></tr>
      </table>`).join('');

    // Detalle por máquina — tabla compacta (CNC y Verticales, mismo formato Recurso/T1/T2/Mtto/T.Total).
    const tablaCompactaMaquinas = (lista: typeof r.detallePorMaquina) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Recurso</td>
          <td align="right" style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">T1</td>
          <td align="right" style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">T2</td>
          <td align="right" style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Mtto</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">T. Total</td>
        </tr>
        ${lista.map((m, idx) => `
        <tr${idx % 2 === 1 ? ' style="background:#fafafa;"' : ''}>
          <td style="padding:8px 10px;font-size:11px;font-weight:600;color:#111827;${idx < lista.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}">${m.nombre}</td>
          <td align="right" style="padding:8px 8px;font-size:11px;color:#374151;${idx < lista.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}font-variant-numeric:tabular-nums;">${m.diaNeta.toFixed(2)}</td>
          <td align="right" style="padding:8px 8px;font-size:11px;color:#374151;${idx < lista.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}font-variant-numeric:tabular-nums;">${m.nocheNeta.toFixed(2)}</td>
          <td align="right" style="padding:8px 8px;font-size:11px;color:#374151;${idx < lista.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}font-variant-numeric:tabular-nums;">${m.mttoReal.toFixed(2)}</td>
          <td align="right" style="padding:8px 10px;font-size:11px;font-weight:700;color:#111827;${idx < lista.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}font-variant-numeric:tabular-nums;">${m.total.toFixed(2)}</td>
        </tr>`).join('')}
      </table>`;

    const cncMaquinas = r.detallePorMaquina.filter(m => m.proceso === 'cnc');
    const verticalesMaquinas = r.detallePorMaquina.filter(m => m.proceso === 'vertical');

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td style="background:#dc2626;padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">CHAIDE Y CHAIDE</td>
          <td align="right" style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#fecaca;">Planificación de Producción</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:26px 28px 6px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Corte Espuma · ${nombrePlanta} · Reporte diario</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827;">Gestión de tiempos y capacidad de carrusel</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${fechaLabel} · Correo automático, no responder</p>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Detalle por máquina — carruseles</p>
      ${carruselesDetalleHtml}
    </td>
  </tr>
  ${tieneCnc ? `
  <tr>
    <td style="padding:14px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Detalle por máquina — cnc</p>
      ${tablaCompactaMaquinas(cncMaquinas)}
      <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">Rendimiento ${r.rendimientoCNCPct}% (editable aparte de Carruseles) · ${cncMaquinas.length} máquina${cncMaquinas.length === 1 ? '' : 's'} · Capacidad ${r.cnc.capacidad.toFixed(1)} h · Ocupación ${r.cnc.ocupacion.toFixed(1)} h (${pctCnc.toFixed(0)}%)</p>
    </td>
  </tr>` : ''}
  <tr>
    <td style="padding:14px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Detalle por máquina — verticales</p>
      ${tablaCompactaMaquinas(verticalesMaquinas)}
      <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">100% fijo, no aplica rendimiento · ${verticalesMaquinas.length} máquina${verticalesMaquinas.length === 1 ? '' : 's'} · Capacidad ${r.verticales.capacidad.toFixed(1)} h · Ocupación ${r.verticales.ocupacion.toFixed(1)} h (${pctVerticales.toFixed(0)}%)</p>
    </td>
  </tr>
  <tr>
    <td style="padding:22px 28px 6px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Ocupación por proceso — no se combinan (procesos distintos, capacidad distinta)</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="${tieneCnc ? '32' : '49'}%" style="padding-right:2%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 14px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Carruseles (rend. ${r.rendimientoPct}%)</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${r.carruseles.ocupacion.toFixed(1)} h <span style="font-size:11px;font-weight:600;color:#9ca3af;">/ ${r.carruseles.capacidad.toFixed(1)} h</span></p>
                <p style="margin:5px 0 0;font-size:10px;color:#9ca3af;">Cantidad (und) <span style="color:#e5e7eb;font-weight:700;">${formatNum(r.carruseles.cantidad, 0)}</span></p>
                <p style="margin:1px 0 0;font-size:10px;color:#9ca3af;">Peso (Kg) <span style="color:#e5e7eb;font-weight:700;">${formatNum(r.carruseles.peso, 0)}</span></p>
                <p style="margin:5px 0 0;font-size:11px;font-weight:700;color:${pctCarruseles > 100 ? '#f87171' : '#5eead4'};">${pctCarruseles.toFixed(0)}% ocupado</p>
              </td></tr>
            </table>
          </td>
          ${tieneCnc ? `
          <td width="32%" style="padding:0 2%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 14px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">CNC (rend. ${r.rendimientoCNCPct}%)</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${r.cnc.ocupacion.toFixed(1)} h <span style="font-size:11px;font-weight:600;color:#9ca3af;">/ ${r.cnc.capacidad.toFixed(1)} h</span></p>
                <p style="margin:5px 0 0;font-size:10px;color:#9ca3af;">Cantidad (und) <span style="color:#e5e7eb;font-weight:700;">${formatNum(r.cnc.cantidad, 0)}</span></p>
                <p style="margin:1px 0 0;font-size:10px;color:#9ca3af;">Peso (Kg) <span style="color:#e5e7eb;font-weight:700;">${formatNum(r.cnc.peso, 0)}</span></p>
                <p style="margin:5px 0 0;font-size:11px;font-weight:700;color:${pctCnc > 100 ? '#f87171' : '#5eead4'};">${pctCnc.toFixed(0)}% ocupado</p>
              </td></tr>
            </table>
          </td>` : ''}
          <td width="${tieneCnc ? '32' : '49'}%" style="padding-left:2%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 14px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Verticales (100% rend.)</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${r.verticales.ocupacion.toFixed(1)} h <span style="font-size:11px;font-weight:600;color:#9ca3af;">/ ${r.verticales.capacidad.toFixed(1)} h</span></p>
                <p style="margin:5px 0 0;font-size:10px;color:#9ca3af;">Cantidad (und) <span style="color:#e5e7eb;font-weight:700;">${formatNum(r.verticales.cantidad, 0)}</span></p>
                <p style="margin:1px 0 0;font-size:10px;color:#9ca3af;">Peso (Kg) <span style="color:#e5e7eb;font-weight:700;">${formatNum(r.verticales.peso, 0)}</span></p>
                <p style="margin:5px 0 0;font-size:11px;font-weight:700;color:${pctVerticales > 100 ? '#f87171' : '#5eead4'};">${pctVerticales.toFixed(0)}% ocupado</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
      ${tieneCnc ? '<p style="margin:8px 0 0;font-size:10px;color:#9ca3af;">CNC se muestra aparte de Carruseles: mismo criterio que ya separa Verticales, para no diluir la lectura de cada proceso.</p>' : ''}
      ${!r.fecha ? '<p style="margin:8px 0 0;font-size:10px;color:#b45309;">Sin fecha seleccionada en Capacidad Operativa — la ocupación mostrada es 0. Selecciona una fecha antes de enviar.</p>' : ''}
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 28px;">
      <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
        Este correo fue generado automáticamente por el Optimizador de Producción, favor no responder.
        Para dudas sobre estos datos, contacta a Planificación Táctica.
      </p>
    </td>
  </tr>
</table>`;
  };

  const handleEnviarReporteEspuma = async (planta: 'UIO' | 'GYE') => {
    const destino = destinatariosReporte.trim();
    if (!destino) {
      addNotification('warning', 'Escribe al menos un correo destinatario antes de enviar.');
      return;
    }
    setIsSendingReporte(prev => ({ ...prev, [planta]: true }));
    try {
      const resultado = await serviciosService.enviarCorreo({
        destino,
        // "Corte y Laminado" es el departamento SAP real que agrupa Carruseles (este módulo) y Looper
        // (Corte y Laminado) -- confirmado por el usuario, mismo nombre que ambos correos ya deben
        // usar en el asunto, distinguidos por el proceso entre corchetes, no por el nombre del módulo.
        asunto: `Reporte de producción — Corte y Laminado [Carruseles]-[${planta === 'UIO' ? 'Quito' : 'Guayaquil'}]`,
        cuerpo: construirReporteHtmlEspuma(planta),
        nota: 'Este correo fue generado automáticamente, favor no responder.',
      });
      addNotification('success', `${resultado.message} — ${resultado.destinatarios.join(', ')}`);
    } catch (error) {
      addNotification('error', `Error al enviar el reporte: ${(error as Error).message}`);
    } finally {
      setIsSendingReporte(prev => ({ ...prev, [planta]: false }));
    }
  };

  // Materiales de "Laminado Cilíndrico" (descripción "LAMINA CILINDRICA...") — verificado con datos
  // reales: son 6 materiales, todos de Muebles, y ya reciben su respuesta P3 desde el módulo de
  // Laminado. Se excluyen de la Respuesta P3 de Corte Espuma (ni se muestran ni se guardan) para no
  // generar una segunda respuesta duplicada/conflictiva para el mismo material.
  const esLaminadoCilindrico = (descripcion: string): boolean => /lamina\s*cilindr/i.test(descripcion);

  // Balance de la Respuesta P3 por material (ver RespuestaP3Row para la regla de negocio completa):
  //
  //   cubierto = min(necesidadP2, stock + provisionales)
  //   faltante = max(0, necesidadP2 - stock - provisionales)
  //
  // El P3 responde la COBERTURA (qué parte de la necesidad ya está resuelta y con qué); el PFD
  // (esPFD=true) responde el FALTANTE (lo que sí hay que fabricar). Son dos preguntas distintas
  // sobre el mismo balance, por eso comparten este cálculo y solo cambian qué número publican.
  //
  // Esto reemplaza la cascada excluyente anterior (FERT > Provisional > Stock > Necesidad P2), que
  // tenía dos defectos reales: (1) era todo-o-nada — si el P2 pedía 500 Kg y una FERT cubría 50, se
  // respondía 50 y los 450 restantes no los pedía nadie, porque los niveles inferiores ni se
  // consultaban; (2) acreditaba las órdenes FERT como cobertura del P2 vigente, cuando en realidad
  // son provisionales ya transformadas que responden a un P2 anterior. El nivel de emergencia
  // "Necesidad P2" ya no hace falta: si nada cubre, el faltante ES la necesidad completa, que es
  // justamente lo que el PFD debe mandar a fabricar.
  // Peso por unidad (Kg/UN) por material — mismo criterio que ya usan Provisionales/FERT (looperMatch
  // si existe, si no ancho×largo×espesor×densidad/1e6, ver línea ~1049) — Respuesta P3 ya no lo usa
  // para decidir cobertura (eso es en UN, ver respuestaSalidaRowsPorCentro), solo para el estimado de
  // Kg informativo del badge de capacidad (faltanteKgEstimado en RespuestaP3Row).
  const pesoUNPorMaterial = useMemo(() => {
    const map = new Map<string, number>();
    materialDescMap.forEach((descripcion, material) => {
      const looperMatch = kpiLooperData.find(k => cleanCode(k.Material) === material);
      if (looperMatch) { map.set(material, safeNum(looperMatch.PesoUN)); return; }
      const info = extractMaterialInfo({ MATERIAL: material, NOMBRE: descripcion } as RawApiRow);
      const densVal = safeNum(info.dens);
      map.set(material, (info.ancho * info.largo * info.esp * densVal) / 1000000);
    });
    return map;
  }, [materialDescMap, kpiLooperData, extractMaterialInfo]);

  const respuestaSalidaRowsPorCentro = useCallback((centro: '1000' | '2000', esPFD: boolean = false): RespuestaP3Row[] => {
    const necesidadMap = materialNecesidadesPlantaMapPorCentro[centro];
    const origenesMap = materialOrigenesPlantaMapPorCentro[centro];
    const provisionalMap = provisionalUnPorMaterialPorCentro[centro];
    const fertMapVigente = fertUnPorMaterialPorCentro.vigente[centro];
    const fertMapAnterior = fertUnPorMaterialPorCentro.anterior[centro];
    const stockMap = stockUnidadesPorMaterialPorCentro[centro];

    return Array.from(necesidadMap.keys())
      .filter(material => !esLaminadoCilindrico(materialDescMap.get(material) || ''))
      .map((material): RespuestaP3Row => {
      const fertVigente = fertMapVigente.get(material) || 0;   // FERT hacia adelante: cubre el P2 vigente
      const fertAnterior = fertMapAnterior.get(material) || 0; // FERT de hoy hacia atrás: ciclo ya ejecutado
      const provisional = provisionalMap.get(material) || 0;
      const stock = stockMap.get(material) || 0;
      const necesidad = necesidadMap.get(material) || 0;

      const disponible = stock + provisional + fertVigente;
      const cubierto = Math.min(necesidad, disponible);
      const faltante = Math.max(0, necesidad - disponible);
      const cantidadUnidades = esPFD ? faltante : cubierto;
      // Kg SOLO informativo (badge de capacidad/peso) — no decide cobertura ni estado. Puede dar 0
      // para materiales sin geometría parseable aunque su faltante real (en UN) sea mayor que cero.
      const pesoUN = pesoUNPorMaterial.get(material) || 0;
      const faltanteKgEstimado = faltante * pesoUN;

      let fuente: FuenteRespuestaP3;
      if (necesidad <= 0) fuente = 'Sin dato';
      else if (esPFD) fuente = faltante > 0 ? 'Producir' : 'Cubierto';
      else if (cubierto <= 0) fuente = 'Sin cobertura';
      else {
        const partes = [
          stock > 0 ? 'Stock' : null,
          provisional > 0 ? 'Provisional' : null,
          fertVigente > 0 ? 'FERT' : null,
        ].filter(Boolean);
        fuente = (partes.length > 1 ? partes.join(' + ') : partes[0]) as FuenteRespuestaP3;
      }

      const origenesDeMaterial = origenesMap.get(material);
      const origenes = origenesDeMaterial && origenesDeMaterial.size > 0
        ? Array.from(origenesDeMaterial.keys()).join(', ')
        : '—';
      return {
        material,
        descripcion: materialDescMap.get(material) || '—',
        tienePlan: cantidadUnidades > 0,
        cantidadUnidades,
        necesidad,
        stock,
        provisional,
        fertVigente,
        fertAnterior,
        cubierto,
        faltante,
        faltanteKgEstimado,
        origenes,
        fuente
      };
    // Con respuesta primero (de lo contrario, al no tener paginación este tab, la pantalla inicial
    // muestra solo los "Sin dato" y da la falsa impresión de que todo devuelve 0 — caso real: 148 de
    // 182 materiales sí tenían respuesta, pero quedaban ocultos tras hacer scroll).
    }).sort((a, b) => Number(b.tienePlan) - Number(a.tienePlan));
  }, [materialNecesidadesPlantaMapPorCentro, materialOrigenesPlantaMapPorCentro, provisionalUnPorMaterialPorCentro, fertUnPorMaterialPorCentro, stockUnidadesPorMaterialPorCentro, materialDescMap, pesoUNPorMaterial]);

  // Reparte `cantidad` (en UNIDADES) de un material entre sus planes P2 origen, proporcional a la
  // necesidad que cada uno aportó — mismo criterio que getOrigenesProrrateo de Corte y Laminado, pero
  // SIN redondeo a "rollo" (Espuma no tiene esa unidad física; se redondea a unidad entera). Si no hay
  // origen registrado EN ABSOLUTO, referencia el propio plan P3 recién creado como fallback — un
  // origen SÍ registrado pero con necesidad 0 es un origen real y no debe caer en este fallback (mismo
  // bug corregido en getOrigenesProrrateo de Corte y Laminado: auto-referenciar el P3 en vez del P2
  // real). El nombre del campo/parámetro ya no dice "Kg" — desde el fix de Respuesta P3 en UN, esta
  // función siempre recibe y devuelve unidades, nunca kilogramos.
  const getOrigenesProrrateoEspuma = useCallback((material: string, cantidad: number, centro: '1000' | '2000', fallbackCodigoPlanGrupo: number) => {
    const origenes = materialOrigenesPlantaMapPorCentro[centro].get(material);
    if (!origenes || origenes.size === 0) {
      return [{ codigoPadre: fallbackCodigoPlanGrupo, cantidad: Math.round(cantidad) }];
    }
    if (cantidad <= 0) {
      return Array.from(origenes.keys()).map(codigoPadre => ({ codigoPadre, cantidad: 0 }));
    }
    const entradas = Array.from(origenes.entries());
    const totalOrigen = entradas.reduce((s, [, v]) => s + v, 0);
    // Todos los orígenes registrados pidieron 0: se asigna completo al primero en vez de
    // auto-referenciar el P3 recién creado.
    if (totalOrigen <= 0) {
      return entradas.map(([codigoPadre], i) => ({ codigoPadre, cantidad: i === 0 ? Math.round(cantidad) : 0 }));
    }
    return entradas.map(([codigoPadre, pesoOrigen]) => ({
      codigoPadre,
      cantidad: Math.round(cantidad * (pesoOrigen / totalOrigen))
    }));
  }, [materialOrigenesPlantaMapPorCentro]);

  // Puntos en el calendario: cada selector solo marca los días con datos de SU propia fuente
  // (antes era una sola lista combinada, mostraba puntos de FERT en el selector de Provisionales y viceversa).
  const datesWithProvOrders = useMemo(() => {
    const dates = new Set<string>();
    ordenesProvisionales.forEach(o => {
      const d = String(getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']) || '').trim();
      if (d && d !== 'null') dates.add(d.split('T')[0]);
    });
    return dates;
  }, [ordenesProvisionales]);

  const datesWithFertOrders = useMemo(() => {
    const dates = new Set<string>();
    ordenesFert.forEach(o => {
      const d = String(getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']) || '').trim();
      if (d && d !== 'null') dates.add(d.split('T')[0]);
    });
    return dates;
  }, [ordenesFert]);

  const toggleProvDate = useCallback((dStr: string) => {
    setSelectedDatesProv(prev => {
      const n = new Set(prev);
      if (n.has(dStr)) n.delete(dStr); else n.add(dStr);
      return n;
    });
  }, []);

  const toggleFertDate = useCallback((dStr: string) => {
    setSelectedDatesFert(prev => {
      const n = new Set(prev);
      if (n.has(dStr)) n.delete(dStr); else n.add(dStr);
      return n;
    });
  }, []);

  // Tiempo unitario real por material (Tiempo_Min), filtrado por Centro+Grupo — reemplaza el catálogo
  // genérico /tiemposEnsamblado, que tenía huecos placeholder (verificado: Tiempo[H] no cuadraba
  // contra un pivote real de SAP). Confirmado con el usuario que esta es la misma fuente que usa
  // Venta Externa (ver getTiemposEnsambladobyCentroyCodigoGrupo) y que reproduce el Tiempo[H] real
  // mucho más de cerca (verificado: día 20 pasó de 0.1h a 30.7h vs 32.67h real, ~94%).
  // auditMapper/necesidadCapacidadMapper ya esperaban exactamente esta forma (CodMaterial/Centro/
  // Tiempo_Min como fallback de Tiempo), no requirieron cambios.
  const fetchTiemposCorteYLaminado = useCallback(async (): Promise<BodyResponse<RawApiRow[]>> => {
    const resArr = await Promise.all(
      Object.entries(CODIGO_GRUPO_CORTE_POR_CENTRO).map(([centro, codigoGrupo]) =>
        serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(centro, codigoGrupo).catch(() => ({ data: [] }))
      )
    );
    return { data: resArr.flatMap(r => r.data?.data || r.data || []) };
  }, []);

  const fetchDataAsync = useCallback(async () => {
    setIsLoading(true);
    try {
      const groupsRes = await grupoService.getAll();
      const filteredGroups = (groupsRes.data || []).filter(g => {
        const name = (g.nombre_grupo || '').toLowerCase();
        return (name.includes('corte y laminado') || name.includes('laminado'));
      });
      setGrupos(filteredGroups);
      
      // Restricciones del grupo Corte y Laminado de ambos centros: de ahí salen los responsables
      // permitidos y cuáles son de corte vertical (ver responsablesPorCentro).
      restriccionService.getAll()
        .then(res => {
          const restrs = (res.data || []).filter(r => Object.values(CODIGO_GRUPO_CORTE_POR_CENTRO).includes(r.codigo_grupo));
          setRestriccionesCorte(restrs);
          actualizarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, { restriccionesCorte: restrs });
        })
        .catch(e => console.warn('[Corte Espuma] No se pudieron cargar las restricciones de responsables:', (e as Error).message));

      // fetchTiemposCorteYLaminado se dispara en paralelo pero se espera aparte del resto: metida
      // dentro del mismo Promise.all (con un tipo de retorno distinto a las demás llamadas, que son
      // todas BodyResponse<any> vía su propio .catch inline) rompía la inferencia de tipos del tuple
      // completo — TS colapsaba TODAS las posiciones al tipo del array interno. Aparte, sin tocar.
      const timesPromise = fetchTiemposCorteYLaminado();
      const [provsRes, fertsRes, invRes, skillsRes, maintRes, kpiRes, carruselesRes, cuboRes] = await Promise.all([
        serviciosService.OrdenesProvisionalesPaginados(1, 20000).catch(() => ({ data: [] })),
        serviciosService.getOrdenesFert(1, 20000).catch(() => ({ data: [] })),
        serviciosService.getInventarioAñoActual().catch(() => ({ data: [] })),
        serviciosService.getCuboHabilidadesOP().catch(() => ({ data: [] })),
        serviciosService.ListarMantenimientoPreventivosProgramados().catch(() => ({ data: [] })),
        serviciosService.getKPIMAestroLooper().catch(() => ({ data: [] })),
        serviciosService.getKPIMaestroCarruseles().catch(() => ({ data: [] })),
        serviciosService.getCuboInventarios(1, 50000).catch(() => ({ data: [] }))
      ]);
      const timesRes = await timesPromise;

      setOrdenesProvisionales(provsRes.data?.data || provsRes.data || []);
      setOrdenesFert(fertsRes.data?.data || fertsRes.data || []);
      setInventarioSAP(invRes.data || []);
      setTiemposCatalogo(timesRes.data || []);
      setMantenimientosSAP(Array.isArray(maintRes.data) ? maintRes.data : []);
      setKpiLooperData(kpiRes.data || []);
      setKpiCarruselesData(carruselesRes.data?.data || carruselesRes.data || []);
      setCuboInventarios(Array.isArray(cuboRes.data) ? cuboRes.data : []);
      
      const skills: RawApiRow[] = Array.isArray(skillsRes.data) ? skillsRes.data : [];
      const operadores = skills.filter((s) => String(getProp(s, ['LineaProceso', 'LINEA_PROCESO'])).toUpperCase().includes('CORTE'));
      setOperadoresCorte(operadores);

      // Snapshot para no perder lo cargado al cambiar de módulo (ver CACHE_CORTE_ESPUMA). El P2 y el
      // PFF se agregan por su cuenta desde fetchNecesidadesPlanta / calcularNecesidadPFF.
      const previo = leerDeCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA);
      guardarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, {
        ordenesProvisionales: provsRes.data?.data || provsRes.data || [],
        ordenesFert: fertsRes.data?.data || fertsRes.data || [],
        inventarioSAP: invRes.data || [],
        cuboInventarios: Array.isArray(cuboRes.data) ? cuboRes.data : [],
        tiemposCatalogo: timesRes.data || [],
        mantenimientosSAP: Array.isArray(maintRes.data) ? maintRes.data : [],
        kpiLooperData: kpiRes.data || [],
        kpiCarruselesData: carruselesRes.data?.data || carruselesRes.data || [],
        operadoresCorte: operadores,
        restriccionesCorte: previo?.restriccionesCorte || [],
        diasNoLaborables: previo?.diasNoLaborables || [],
        necesidadesPlantaData: previo?.necesidadesPlantaData || {},
        necesidadPFFData: previo?.necesidadPFFData || { '1000': [], '2000': [] },
        necesidadPFFNivel2Data: previo?.necesidadPFFNivel2Data || { '1000': [], '2000': [] },
      });

      setDatosCargados(true);
    } catch (e) {
      console.error('Error sincronización', e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTiemposCorteYLaminado]);

  const fetchNecesidadesPlanta = useCallback(async (diasOverride?: DiasNoLaborables) => {
    setNecesidadesPlantaLoading(true);
    try {
      const [restrsRes, gruposRes] = await Promise.all([
        restriccionService.getAll(),
        grupoService.getAll()
      ]);

      // 1. Restricción ALMACEN_CONSUMO propia de Corte Espuma (codigo_grupo = CODIGO_GRUPO_ESPUMA,
      // "Taller de Corte"): su valor contiene los nombres de grupo (sin espacios/tildes) a filtrar
      // de la tabla de grupos. Se filtra por codigo_grupo propio (no cualquier fila con ese nombre)
      // para no compartir configuración con la de Laminado (codigo_grupo 8), que tiene su propia
      // fila y necesita ver "Forros" — algo que Espuma no debe considerar (Forros consume rollos
      // laminados, no láminas de espuma cortada).
      const normalizeName = (s: string) => String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();

      const almacenConsumoNames = (restrsRes.data || [])
        .filter((r) => r.nombre_restriccion === 'ALMACEN_CONSUMO' && r.codigo_grupo === CODIGO_GRUPO_ESPUMA)
        .flatMap((r) => String(r.valor_restriccion || '').split(/[,&]/).map((v: string) => normalizeName(v)))
        .filter((v: string) => v !== '');

      const gruposFiltrados = (gruposRes.data || []).filter((g) => g.estado === 'A' && almacenConsumoNames.includes(normalizeName(g.nombre_grupo)));
      const gruposCodigos = gruposFiltrados.map((g) => g.codigo_grupo);
      const grupoPorCodigo = new Map(gruposFiltrados.map((g) => [g.codigo_grupo, g]));

      if (gruposCodigos.length === 0) {
        setNecesidadesPlantaData({});
        return;
      }

      // 2. PlanGrupo activos cuyo valor coincide con "Plan Táctico - Centro <centro> - P2" y cuyo grupo esté en la lista anterior.
      // "Venta Externa" alimenta necesidad tanto de Espuma como de Laminado (planes "...P2 - Espumas"
      // y "...P2 - Rollos" respectivamente) — aquí solo cuenta la variante "Espumas".
      //
      // Además del estado, se exige que fecha_inicio_plan sea EXACTO hoy + 1 día hábil — así se graba
      // el P2 en origen (generarPlanP2Core en Venta Externa fija fecha_inicio_plan = nextBusinessDay(hoy)
      // directo, sin pasos intermedios). Sin esto, un P2 que quedó "A" por olvido del área origen
      // (nunca desactivado al generar el siguiente ciclo) seguía apareciendo como necesidad vigente
      // indefinidamente, sin importar qué tan vieja fuera su fecha.
      //
      // EXCEPCIÓN — Venta Externa "Espumas": ya NO se graba a hoy+1 fijo (generarPlanP2Core ahora usa
      // la fecha que el planificador seleccionó en "Ventana de Producción", la "fecha del PT" —
      // mismo criterio que ya usa P1/PFF, ver explotarPFFParaCentro). Exigir aquí el match exacto
      // contra hoy+1 dejaría de encontrarlo. Para ESTA rama se toma el plan ACTIVO más reciente por
      // grupo, sin filtrar por fecha — mismo patrón de desempate que masRecientePFF (ver
      // explotarPFFParaCentro): seguro porque desactivarOtrosPlanes en Venta Externa ya garantiza
      // como máximo un P2 Espumas activo por centro a la vez. Muebles/Prensado y cualquier otro grupo
      // no-VentaExterna-Espumas siguen exigiendo el match exacto de siempre, sin cambios.
      // diasOverride: al sincronizar, el calendario de feriados se acaba de cargar y el estado
      // `diasNoLaborables` todavía no se refleja en este closure — se recibe el Set directo para no
      // calcular la fecha objetivo con feriados vacíos (ver handleSincronizarYGenerar).
      const fechaObjetivoP2 = format(nextBusinessDayCal(new Date(), diasOverride ?? diasNoLaborables), 'yyyy-MM-dd');

      const planGruposRes = await planGrupoService.getAll();
      const esEspumaVentaExterna = (pg: PlanGrupo) =>
        /venta\s*externa/i.test(grupoPorCodigo.get(pg.codigo_grupo)?.nombre_grupo || '') && /espuma/i.test(String(pg.valor || ''));

      const candidatosBase = (planGruposRes.data || []).filter((pg) => {
        const valor = String(pg.valor || '').trim();
        if (pg.estado !== 'A' || !gruposCodigos.includes(pg.codigo_grupo)) return false;
        if (!/plan\s*t[aá]ctico.*centro.*p2/i.test(valor)) return false;
        const esVentaExterna = /venta\s*externa/i.test(grupoPorCodigo.get(pg.codigo_grupo)?.nombre_grupo || '');
        if (esVentaExterna && !/espuma/i.test(valor)) return false;
        return true;
      });

      // fechaLocalEcuador, NO split('T')[0]: fecha_inicio_plan es UTC — mismo bug de zona horaria
      // que en explotarPFFParaCentro (ver su comentario). Un P2 grabado tarde en el día cruzaba a
      // la fecha calendario siguiente en UTC y dejaba de coincidir con fechaObjetivoP2 (local).
      const conFechaExacta = candidatosBase.filter((pg) => !esEspumaVentaExterna(pg) && fechaLocalEcuador(pg.fecha_inicio_plan) === fechaObjetivoP2);

      const masRecienteEspumaVEPorGrupo = new Map<number, PlanGrupo>();
      candidatosBase.filter(esEspumaVentaExterna).forEach((pg) => {
        const actual = masRecienteEspumaVEPorGrupo.get(pg.codigo_grupo);
        if (!actual) { masRecienteEspumaVEPorGrupo.set(pg.codigo_grupo, pg); return; }
        const fechaNueva = fechaLocalEcuador(pg.fecha_inicio_plan);
        const fechaActual = fechaLocalEcuador(actual.fecha_inicio_plan);
        if (fechaNueva > fechaActual || (fechaNueva === fechaActual && pg.codigo_plan_grupo > actual.codigo_plan_grupo)) {
          masRecienteEspumaVEPorGrupo.set(pg.codigo_grupo, pg);
        }
      });

      const planesActivos = [...conFechaExacta, ...Array.from(masRecienteEspumaVEPorGrupo.values())];

      const planGrupoCodigos = planesActivos.map((pg) => pg.codigo_plan_grupo);
      const planPorCodigo = new Map(planesActivos.map((pg) => [pg.codigo_plan_grupo, pg]));

      if (planGrupoCodigos.length === 0) {
        setNecesidadesPlantaData({});
        return;
      }

      // 3. DetalleTactico asociado a los PlanGrupo encontrados
      const detallesRes = await detalleTacticoService.getAll();
      const detalles = (detallesRes.data || []).filter((d) => planGrupoCodigos.includes(d.codigo_plan_grupo));

      const grouped: Record<string, NecesidadPlantaRow[]> = {};
      detalles.forEach((d) => {
        const plan = planPorCodigo.get(d.codigo_plan_grupo);
        const grupo = plan ? grupoPorCodigo.get(plan.codigo_grupo) : undefined;
        const area = grupo?.nombre_grupo || 'Sin Área Asignada';
        if (!grouped[area]) grouped[area] = [];
        grouped[area].push({
          codigo_material: d.codigo_material,
          cantidad_produccion_neta: d.cantidad_produccion_neta,
          // fechaLocalEcuador: estas fechas alimentan fechasP2PorMaterialPorCentro, que decide si
          // una orden Provisional/FERT "responde" a esta necesidad — un desfase de un día aquí
          // rechazaba coberturas reales (mismo bug que en explotarPFFParaCentro).
          fecha_inicio: plan?.fecha_inicio_plan ? fechaLocalEcuador(plan.fecha_inicio_plan) : '—',
          fecha_fin: plan?.fecha_fin_plan ? fechaLocalEcuador(plan.fecha_fin_plan) : '—',
          codigo_grupo: plan?.codigo_grupo ?? 0,
          codigo_plan_grupo: d.codigo_plan_grupo,
          centro: String(grupo?.centro || '')
        });
      });

      setNecesidadesPlantaData(grouped);
      actualizarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, { necesidadesPlantaData: grouped });
    } catch (e) {
      console.error('Error al recuperar necesidades de planta', e);
      setNecesidadesPlantaData({});
    } finally {
      setNecesidadesPlantaLoading(false);
    }
  }, [diasNoLaborables]);

  // Carga perezosa de "Pendientes Totales" (ver estado más arriba) — se dispara una sola vez desde
  // el useEffect de activeTab==='necesidadesPlanta', igual que Programación Táctica Venta Externa
  // hace con su propio tab "Pendientes".
  const fetchPendientesTotales = useCallback(async () => {
    setIsLoadingPendientes(true);
    try {
      const res = await serviciosService.getPendientesTotales(1, 20000);
      setPendientesTotales(res.data || []);
    } catch (e) {
      console.error('Error al recuperar Pendientes Totales', e);
    } finally {
      setIsLoadingPendientes(false);
      setPendientesCargados(true);
    }
  }, []);

  // Explota el BOM de los materiales de UN PlanGrupo "PFF"/"P1" (un centro/grupo de Ensamblado a la
  // vez) — mismo patrón que explodeNecesidadesFert en Venta Externa: acumula cantidad por material
  // único antes de explotar (para no repetir llamadas al Maestro), conservando el desglose por
  // codigo_plan_grupo origen para no perder trazabilidad al prorratear la Respuesta P3.
  //
  // Recibe `fechaObjetivo` como parámetro (antes era siempre hoy+3 días hábiles, calculado adentro) —
  // extraído así para que Capacidad Operativa Nivel 2 (ver renderDashboard/calcularNecesidadPFFNivel2)
  // pueda reutilizar EXACTAMENTE esta misma lógica apuntando a hoy+2, sin duplicar ~150 líneas de
  // explosión de BOM. `explotarPFFParaCentro` (más abajo) es un wrapper de una línea que sigue
  // calculando hoy+3 y delega aquí — mismo nombre, misma firma, mismo comportamiento para
  // calcularNecesidadPFF, sin ningún cambio para el flujo P1/PFF existente.
  const explotarPFFParaCentroConFecha = useCallback(async (
    codigoGrupoEnsamblado: number,
    centro: '1000' | '2000',
    planesTodos: PlanGrupo[],
    detallesTodos: DetalleTactico[],
    fechaObjetivoPFF: string,
    onStep: () => void
  ): Promise<{ filas: NecesidadPlantaRow[]; sinMatch: string[]; conError: string[]; tipoPlan: 'P1' | 'PFF' | null }> => {
    // Además del estado, se exige que fecha_inicio_plan coincida EXACTO con `fechaObjetivoPFF`: esa
    // es la fecha de producción del Producto Terminado (PT) real del PFF/P1 — confirmado por el
    // usuario, corrige un valor (hoy+2) que se había fijado en una sesión anterior sin ese respaldo
    // explícito y contradecía la ventana +3 acordada al principio de este trabajo. El P2 sigue fijo en
    // hoy+1 (ver Venta Externa) por su propia regla, independiente de este offset — ya NO son "un día
    // hábil antes" uno del otro, son dos reglas de negocio separadas. Si el origen ya dejó activo un ciclo MÁS LEJANO (ej.
    // hoy+4/hoy+5), como una corrida de "Generar PFF" adelantada, ese no se recupera todavía — solo se
    // procesa el ciclo cuya producción es `fechaObjetivoPFF`, para no adelantar necesidad de lámina que
    // aún no corresponde a este ciclo. Antes se recuperaba TODO plan "A" sin validar contra hoy, y solo se
    // desempataba por "el más reciente" — en datos reales (2026-08-03: planes #131/#132 del 01-ago con
    // fecha 06-ago, y #150/#151 del 03-ago con fecha 07-ago, los 4 "A" a la vez) eso podía quedarse con
    // un ciclo que no correspondía al de hoy.
    const planesPFFCrudo = planesTodos.filter(p => {
      if (p.codigo_grupo !== codigoGrupoEnsamblado || p.estado !== 'A' || !ES_PLAN_ENSAMBLADO_FIRME(p.valor)) return false;
      // fechaLocalEcuador, NO split('T')[0]: la API graba fecha_inicio_plan en UTC. Un plan guardado
      // tarde en el día en Ecuador (ej. 22:00) cruza a la fecha calendario SIGUIENTE en UTC — el
      // recorte ingenuo del ISO devolvía un día de más. Caso real que lo destapó: el P1 #279 grabado
      // a las 17:00 (UTC 22:00, mismo día) coincidía por casualidad; el PFF #292 que lo reemplazó,
      // grabado a las 22:00 (UTC 03:00 del día SIGUIENTE), dejaba de coincidir con la ventana
      // esperada y el módulo reportaba "no hay ningún Plan Grupo P1/PFF activo" aunque sí existiera.
      return fechaLocalEcuador(p.fecha_inicio_plan) === fechaObjetivoPFF;
    });
    // Solo el plan PFF MÁS RECIENTE del grupo — red de seguridad secundaria para el caso (menos común
    // ahora que planesPFFCrudo ya exige fecha_inicio_plan = hoy+3 días hábiles) de que el origen
    // genere dos ciclos "A" con esa misma fecha.
    let masRecientePFF: PlanGrupo | undefined = undefined;
    planesPFFCrudo.forEach(p => {
      const fecha = String(p.fecha_inicio_plan || '').split('T')[0];
      const fechaActual = masRecientePFF ? String(masRecientePFF.fecha_inicio_plan || '').split('T')[0] : '';
      if (!masRecientePFF || fecha > fechaActual) masRecientePFF = p;
    });
    const planesPFF: PlanGrupo[] = masRecientePFF ? [masRecientePFF] : [];
    // Qué tipo de plan se encontró activo — el mismo helper ES_PLAN_ENSAMBLADO_FIRME acepta P1 o PFF
    // por igual (ver su comentario), así que esto es solo para poder DECIR cuál de los dos se está
    // usando en cada momento; no cambia en nada qué se procesa.
    const tipoPlan: 'P1' | 'PFF' | null = masRecientePFF ? (/pff/i.test(String((masRecientePFF as PlanGrupo).valor || '')) ? 'PFF' : 'P1') : null;
    if (planesPFF.length === 0) return { filas: [], sinMatch: [], conError: [], tipoPlan };

    const planPorCodigo = new Map(planesPFF.map(p => [p.codigo_plan_grupo, p]));
    const codigosPlanPFF = new Set(planesPFF.map(p => p.codigo_plan_grupo));
    const detallesPFF = detallesTodos.filter(d => d.estado === 'A' && codigosPlanPFF.has(d.codigo_plan_grupo));
    if (detallesPFF.length === 0) return { filas: [], sinMatch: [], conError: [], tipoPlan };

    const qtyPorMaterialYPlan = new Map<string, Map<number, number>>();
    detallesPFF.forEach(d => {
      const code = cleanCode(d.codigo_material);
      if (!code) return;
      if (!qtyPorMaterialYPlan.has(code)) qtyPorMaterialYPlan.set(code, new Map());
      const porPlan = qtyPorMaterialYPlan.get(code)!;
      porPlan.set(d.codigo_plan_grupo, (porPlan.get(d.codigo_plan_grupo) || 0) + parseQty(d.cantidad_produccion_neta));
    });

    // resultado[codigo_plan_grupo][codigo_lamina] = cantidad acumulada
    const resultadoPorPlan = new Map<number, Map<string, number>>();
    const sinMatch: string[] = [];
    const conError: string[] = [];

    for (const materialCode of qtyPorMaterialYPlan.keys()) {
      try {
        const fullCode = materialCode.padStart(18, '0');
        const response = await serviciosService.getMaestroMaterialesExplosion(centro, fullCode, 1, 500);
        const rawData = response?.data?.data || response?.data || [];
        let encontroMatch = false;
        // Ver TIENE_COMPONENTE_ESPUMA: si NINGÚN componente del árbol menciona espuma en absoluto,
        // este material simplemente no la necesita (ej. una BASE cuyo único componente es un FORRO) —
        // no se reporta en sinMatch, porque no es un gap de nomenclatura, es la respuesta correcta.
        let tieneAlgunEspuma = false;

        if (Array.isArray(rawData)) {
          // Un mismo componente puede aparecer en VARIOS niveles del árbol, cada uno con su propia
          // CANTIDAD_ACUMULADA (verificado: el CHN 20013334 trae la lámina 30004179 en nivel 4 con
          // 0,399 y en nivel 5 con 0,178). Sumar ambas filas contaría el mismo corte dos veces, así
          // que se conserva UNA sola por componente: la del nivel MÁS PROFUNDO, que es la que refleja
          // la cantidad real de ese componente en el árbol completo.
          //
          // Caso real distinto (verificado 2026-09-03, material 20004463 -> lámina 30027586, plan
          // #602): 2 filas para el MISMO COMPONENTE con el MISMO MATERIAL_PADRE (20004463, el propio
          // FERT consultado) -- no son 2 rutas BOM reales, es la MISMA relación directa reportada dos
          // veces por SAP con un NIVEL/CANTIDAD_ACUMULADA distinto (nivel1: unitaria=2/acumulada=2;
          // nivel2: unitaria=2/acumulada=0.02). "Preferir el nivel más profundo" en este caso tomaba
          // la fila corrupta (0.02) sobre la sana (2) -- 120 unidades del plan devolvían 2.4 en vez de
          // 240. Una relación directa (MATERIAL_PADRE = el Fert consultado) SIEMPRE debe cumplir
          // acumulada=unitaria (verificado también en otro material real con 10/10 filas nivel 1
          // consistentes) -- cuando 2 filas comparten el mismo MATERIAL_PADRE, se prefiere la que sí
          // cumple esa igualdad (autoconsistente) sobre la que no, antes de aplicar el criterio de
          // nivel más profundo (que sigue aplicando tal cual para rutas BOM genuinamente distintas,
          // es decir, MATERIAL_PADRE diferente).
          const porComponente = new Map<string, { nivel: number; cantAcum: number; materialPadre: string; autoconsistente: boolean }>();

          (rawData as Record<string, unknown>[]).forEach((row) => {
            const desc = String(row.DESCRIPCION_COMPONENTE || '');
            if (TIENE_COMPONENTE_ESPUMA(desc)) tieneAlgunEspuma = true;
            const laminaCode = cleanCode(row.COMPONENTE);
            if (!laminaCode) return;

            // Relevancia por RESPONSABLE (criterio autoritativo, el mismo que usa el resto del
            // módulo y que el negocio mantiene en las restricciones), con el patrón de nombres como
            // respaldo para los componentes sin responsable conocido.
            //
            // Por qué cambió: decidir por el nombre perdía material real. Auditado con datos de
            // producción — "ESPUMA BABY D15 AM AF" (resp 039), "LAMINA ESQUINA 012X031X5" (036/039) y
            // "LAMINA ESPUMA D30 PLATA RR" (038) son de Corte Espuma y quedaban fuera solo porque su
            // descripción no empieza por "LAMINA D". "LAMINA PRENSADA D100" (resp 017) sigue quedando
            // fuera sola. La nomenclatura se dispersa en los niveles profundos del árbol (LAMINA D /
            // ESPUMA BABY / LAMINA ESQUINA / TACO ESPUMA conviven en el mismo nivel); el responsable no.
            const respComponente = materialRespCPPorCentro[centro]?.get(laminaCode) || '';
            // FORRO nunca es de corte, sin importar el responsable — ver ES_FORRO. Se comprueba ANTES
            // del criterio de responsable/patrón porque el responsable por sí solo puede dar falso
            // positivo (verificado: 105 de 122 materiales con resp. de corte en Centro 2000 son FORRO).
            //
            // PRENSADO tiene el MISMO problema, verificado después con datos reales (CuboInventarios):
            // 27 materiales "TACO PRENSADO"/"TACO DE PRENSADO" reales tienen responsable 029 o 039 —
            // ambos códigos SÍ están en `allowedRespPorCentro` (029/039 son "operación alterna" de
            // Corte Espuma) — se colaban como si fueran "TACO ESPUMA" (que sí es de Corte, mismos
            // responsables) solo por compartir máquina/responsable. El comentario de arriba asumía que
            // solo el resp 017 ("LAMINA PRENSADA") quedaba fuera del filtro de responsable — cierto,
            // pero incompleto: no cubría "TACO PRENSADO" con 029/039.
            const esDeCorte = !ES_FORRO(desc) && !/PRENSAD/i.test(desc) && (respComponente
              ? allowedRespPorCentro(centro).includes(respComponente)
              : ES_LAMINA_CORTADA(desc));
            if (!esDeCorte) return;

            encontroMatch = true;
            const nivel = Number(row.NIVEL || 0);
            const cantUnitaria = Number(row.CANTIDAD_UNITARIA || 0);
            const cantAcum = Number(row.CANTIDAD_ACUMULADA || cantUnitaria || 0);
            const materialPadre = cleanCode(row.MATERIAL_PADRE);
            const autoconsistente = Math.abs(cantAcum - cantUnitaria) < 0.0001;
            const previo = porComponente.get(laminaCode);
            if (!previo) {
              porComponente.set(laminaCode, { nivel, cantAcum, materialPadre, autoconsistente });
            } else if (previo.materialPadre === materialPadre) {
              if (autoconsistente && !previo.autoconsistente) {
                porComponente.set(laminaCode, { nivel, cantAcum, materialPadre, autoconsistente });
              }
            } else if (nivel > previo.nivel) {
              porComponente.set(laminaCode, { nivel, cantAcum, materialPadre, autoconsistente });
            }
          });

          porComponente.forEach(({ cantAcum }, laminaCode) => {

            const porPlan = qtyPorMaterialYPlan.get(materialCode)!;
            porPlan.forEach((qtyPFF, codigoPlanGrupo) => {
              if (!resultadoPorPlan.has(codigoPlanGrupo)) resultadoPorPlan.set(codigoPlanGrupo, new Map());
              const porLamina = resultadoPorPlan.get(codigoPlanGrupo)!;
              porLamina.set(laminaCode, (porLamina.get(laminaCode) || 0) + qtyPFF * cantAcum);
            });
          });
        }
        if (!encontroMatch && tieneAlgunEspuma) sinMatch.push(materialCode);
      } catch (e) {
        console.warn(`[Necesidad PFF] Error explotando BOM para material ${materialCode} (centro ${centro}):`, (e as Error).message);
        conError.push(materialCode);
      } finally {
        onStep();
      }
    }

    const filas: NecesidadPlantaRow[] = [];
    resultadoPorPlan.forEach((porLamina, codigoPlanGrupo) => {
      const plan = planPorCodigo.get(codigoPlanGrupo);
      // fechaLocalEcuador: igual que en fetchNecesidadesPlanta, esta fecha termina en
      // fechasP2PorMaterialPorCentro y decide si una orden real cubre esta necesidad del PFF.
      const fechaInicio = plan?.fecha_inicio_plan ? fechaLocalEcuador(plan.fecha_inicio_plan) : '—';
      const fechaFin = plan?.fecha_fin_plan ? fechaLocalEcuador(plan.fecha_fin_plan) : fechaInicio;
      porLamina.forEach((cantidad, codigoLamina) => {
        filas.push({
          codigo_material: Number(codigoLamina),
          cantidad_produccion_neta: cantidad.toFixed(4),
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          codigo_grupo: codigoGrupoEnsamblado,
          codigo_plan_grupo: codigoPlanGrupo,
          centro,
        });
      });
    });

    return { filas, sinMatch, conError, tipoPlan };
  }, [allowedRespPorCentro, materialRespCPPorCentro]);

  // Wrapper de siempre: hoy+3 días hábiles, delega en explotarPFFParaCentroConFecha. Mismo
  // nombre/firma/comportamiento de antes — no cambia nada para calcularNecesidadPFF.
  const explotarPFFParaCentro = useCallback((
    codigoGrupoEnsamblado: number,
    centro: '1000' | '2000',
    planesTodos: PlanGrupo[],
    detallesTodos: DetalleTactico[],
    onStep: () => void
  ) => explotarPFFParaCentroConFecha(codigoGrupoEnsamblado, centro, planesTodos, detallesTodos, format(sumarDiasHabiles(new Date(), 3), 'yyyy-MM-dd'), onStep),
  [explotarPFFParaCentroConFecha, sumarDiasHabiles]);

  // Botón manual "Calcular Necesidad PFF": corre la explosión para Ensamblado - Quito (1000, grupo 1)
  // Y Ensamblado - Guayaquil (2000, grupo 6) en la misma acción. A diferencia de Corte y Laminado
  // (que solo tiene flujo de guardado para Centro 1000), Corte Espuma ya soporta la Respuesta P3
  // completa para ambos centros, así que ambos resultados alimentan por igual el prorateo real.
  const calcularNecesidadPFF = useCallback(async () => {
    setIsCalculandoPFF(true);
    setPffDiagnostico({ sinMatch: [], conError: [] });
    try {
      const [planesRes, detallesRes] = await Promise.all([
        planGrupoService.getAll(),
        detalleTacticoService.getAll(),
      ]);
      const planesTodos = planesRes.data || [];
      const detallesTodos = detallesRes.data || [];

      const totalMateriales = (codigoGrupo: number) => {
        const codigosPlan = new Set(
          planesTodos.filter(p => p.codigo_grupo === codigoGrupo && p.estado === 'A' && ES_PLAN_ENSAMBLADO_FIRME(p.valor)).map(p => p.codigo_plan_grupo)
        );
        return new Set(
          detallesTodos.filter(d => d.estado === 'A' && codigosPlan.has(d.codigo_plan_grupo)).map(d => cleanCode(d.codigo_material))
        ).size;
      };
      const total = totalMateriales(CODIGO_GRUPO_ENSAMBLADO_QUITO) + totalMateriales(CODIGO_GRUPO_ENSAMBLADO_GUAYAQUIL);
      let current = 0;
      setPffProgress({ current: 0, total });
      const onStep = () => setPffProgress({ current: ++current, total });

      const [resultado1000, resultado2000] = [
        await explotarPFFParaCentro(CODIGO_GRUPO_ENSAMBLADO_QUITO, '1000', planesTodos, detallesTodos, onStep),
        await explotarPFFParaCentro(CODIGO_GRUPO_ENSAMBLADO_GUAYAQUIL, '2000', planesTodos, detallesTodos, onStep),
      ];

      const pff = { '1000': resultado1000.filas, '2000': resultado2000.filas };
      setNecesidadPFFData(pff);
      setTipoPlanEnsambladoPorCentro({ '1000': resultado1000.tipoPlan, '2000': resultado2000.tipoPlan });
      actualizarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, { necesidadPFFData: pff });

      // Nivel 2 de Capacidad Operativa (red de seguridad, ciclo atrasado un día — ver renderDashboard):
      // mismos planesTodos/detallesTodos ya obtenidos arriba, sin fetch extra, apuntando a hoy+2 en vez
      // de hoy+3. Silencioso (onStep no-op, no se suma al contador de progreso visible ni se muestra en
      // la notificación) para no confundir el flujo principal — solo alimenta Capacidad Planificada.
      const fechaObjetivoNivel2 = format(sumarDiasHabiles(new Date(), 2), 'yyyy-MM-dd');
      const [resultado1000Nivel2, resultado2000Nivel2] = [
        await explotarPFFParaCentroConFecha(CODIGO_GRUPO_ENSAMBLADO_QUITO, '1000', planesTodos, detallesTodos, fechaObjetivoNivel2, () => {}),
        await explotarPFFParaCentroConFecha(CODIGO_GRUPO_ENSAMBLADO_GUAYAQUIL, '2000', planesTodos, detallesTodos, fechaObjetivoNivel2, () => {}),
      ];
      const pffNivel2 = { '1000': resultado1000Nivel2.filas, '2000': resultado2000Nivel2.filas };
      setNecesidadPFFNivel2Data(pffNivel2);
      actualizarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, { necesidadPFFNivel2Data: pffNivel2 });

      const sinMatch = [...resultado1000.sinMatch, ...resultado2000.sinMatch];
      const conError = [...resultado1000.conError, ...resultado2000.conError];
      setPffDiagnostico({ sinMatch, conError });

      if (resultado1000.filas.length === 0 && resultado2000.filas.length === 0 && sinMatch.length === 0 && conError.length === 0) {
        addNotification('warning', 'No hay ningún Plan Grupo "P1"/"PFF" activo con materiales, ni en Quito ni en Guayaquil.');
        return;
      }

      const incidencias = [
        sinMatch.length > 0 ? `${sinMatch.length} material(es) sin lámina cortada en su BOM` : null,
        conError.length > 0 ? `${conError.length} material(es) con error al consultar el BOM` : null,
      ].filter(Boolean).join(' · ');
      const etiquetaTipo = (t: 'P1' | 'PFF' | null) => t ? ` (${t})` : '';
      addNotification(
        conError.length > 0 ? 'warning' : 'success',
        `Necesidad calculada: ${resultado1000.filas.length} línea(s) Quito${etiquetaTipo(resultado1000.tipoPlan)}, ${resultado2000.filas.length} línea(s) Guayaquil${etiquetaTipo(resultado2000.tipoPlan)}.${incidencias ? ' ' + incidencias : ''}`
      );
    } catch (e) {
      addNotification('error', `Error al calcular la Necesidad PFF: ${(e as Error).message}`);
    } finally {
      setIsCalculandoPFF(false);
    }
  }, [addNotification, explotarPFFParaCentro, explotarPFFParaCentroConFecha, sumarDiasHabiles]);

  // Segunda fase de "Sincronizar y Generar Necesidades" (ver handleSincronizarYGenerar): corre
  // calcularNecesidadPFF automáticamente en cuanto el render con los datos recién sincronizados ya
  // ocurrió — acá arriba, calcularNecesidadPFF ya es la versión fresca (sus dependencias, como
  // explotarPFFParaCentro, ya se recalcularon con el inventarioSAP/materialDescMap actualizados).
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    setSyncStep('generando');
    calcularNecesidadPFF().finally(() => setSyncStep('idle'));
  }, [autoGenerarPendiente, calcularNecesidadPFF]);

  // Paso 1 de la Respuesta P3: arma la vista previa de lo que se va a grabar para UN centro y abre el
  // diálogo de confirmación. No llama a ningún servicio todavía — mismo patrón de dos pasos que
  // "Guardar Plan" en Corte y Laminado (handleOpenGuardarPlan/handleConfirmGuardarPlan).
  // Arma la vista previa de UN centro — no toca el estado, la decisión de abrir el diálogo (y con
  // qué centros) queda en manos de quien llama (handleAbrirRespuestaP3 / handleAbrirRespuestaP3Todos).
  const construirPreviewP3 = useCallback((centro: '1000' | '2000'): PlanGrupoPreviewEspuma | null => {
    const rows = respuestaSalidaRowsPorCentro(centro);
    if (rows.length === 0) return null;
    // El P3 es la RESPUESTA del día siguiente HÁBIL a la revisión — mismo criterio de negocio que
    // Laminado: su fecha_inicio_plan/fecha_fin_plan se fuerza siempre al próximo día laborable (no
    // simplemente hoy+1 calendario, que caía en sábado/domingo si hoy era viernes/sábado).
    const fechaRespuesta = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');
    return {
      centro,
      codigo_grupo: CODIGO_GRUPO_LAMINADO,
      nombreGrupo: 'Corte Espuma',
      // Sufijo "Espuma" — igual que el PFD (más abajo) y que el P2 ya distingue "Rollos" de
      // "Espumas". Necesario porque codigo_grupo=8 es compartido con la Respuesta P3/PFD de Corte y
      // Laminado: sin el sufijo, ambos P3 del mismo centro/fecha son indistinguibles por el valor, y
      // Laminado depende de este texto para no desactivar por error los planes de Espuma al guardar
      // los suyos (ver desactivarPlanesLaminadoSuperados en TacticalPlanCorteLaminadoSection).
      valor: `Plan Táctico - Centro ${centro} - P3 - Espuma`,
      fechaInicio: fechaRespuesta,
      fechaFin: fechaRespuesta,
      rows
    };
  }, [respuestaSalidaRowsPorCentro, siguienteDiaHabil]);

  const handleAbrirRespuestaP3 = useCallback((centro: '1000' | '2000') => {
    const preview = construirPreviewP3(centro);
    if (!preview) {
      addNotification('warning', `No hay materiales de Necesidades Planta para el Centro ${centro}.`);
      return;
    }
    setPlanPreviewP3([preview]);
  }, [construirPreviewP3, addNotification]);

  // Botón general: arma la vista previa de AMBOS centros en un solo diálogo — un centro sin
  // materiales de Necesidades Planta simplemente no aparece (no bloquea al otro).
  const handleAbrirRespuestaP3Todos = useCallback(() => {
    const previews = (['1000', '2000'] as const)
      .map(centro => construirPreviewP3(centro))
      .filter((p): p is PlanGrupoPreviewEspuma => p !== null);
    if (previews.length === 0) {
      addNotification('warning', 'No hay materiales de Necesidades Planta en ningún centro.');
      return;
    }
    setPlanPreviewP3(previews);
  }, [construirPreviewP3, addNotification]);

  // Al confirmar un nuevo P3/PFD de Espuma, cualquier otro PlanGrupo de Espuma ("- Espuma", MISMO
  // centro, MISMO canal — ver esPFD) que siga activo y cuya fecha_inicio_plan sea del mismo día o de
  // un día ANTERIOR al del plan recién creado queda superado — mismo criterio ya probado en Corte y
  // Laminado (ver desactivarPlanesLaminadoSuperados ahí). Antes esto no existía: correr "Generar
  // Respuestas P3" dos veces el mismo día creaba dos PlanGrupo distintos en vez de reconciliar uno
  // solo (posible causa de los duplicados observados en datos reales). Se filtra por centro además de
  // por "Espuma" porque, a diferencia de Laminado (un solo centro), Espuma responde Quito y
  // Guayaquil por separado.
  //
  // P3 y PFD son canales INDEPENDIENTES, no intercambiables (mismo fix que Laminado): un PFD nuevo
  // solo desactiva PFD viejos, un P3 nuevo solo P3 viejos — nunca uno al otro.
  const desactivarPlanesEspumaSuperados = useCallback(async (centro: '1000' | '2000', fechaNuevoPlan: string, codigoPlanGrupoNuevo: number, esPFD: boolean): Promise<number> => {
    try {
      const planesRes = await planGrupoService.getAll();
      const centroRegex = new RegExp(`centro\\s*${centro}`, 'i');
      const superados = (planesRes.data || []).filter(p => {
        if (p.codigo_grupo !== CODIGO_GRUPO_LAMINADO || p.estado !== 'A' || p.codigo_plan_grupo === codigoPlanGrupoNuevo) return false;
        const valor = String(p.valor || '');
        if (!/espuma/i.test(valor) || !centroRegex.test(valor)) return false;
        if (/pfd/i.test(valor) !== esPFD) return false;
        // fechaLocalEcuador: fechaNuevoPlan es una fecha LOCAL (siguienteDiaHabil); comparar contra
        // el recorte crudo de un fecha_inicio_plan (UTC) podía fallar la superación de planes justo
        // en el filo del día.
        const inicio = fechaLocalEcuador(p.fecha_inicio_plan);
        return inicio !== '' && inicio <= fechaNuevoPlan;
      });
      for (const plan of superados) {
        try {
          await planGrupoService.save({ ...plan, estado: 'I' } as unknown as PlanGrupo);
        } catch (e) {
          console.warn(`[Respuesta Espuma] No se pudo desactivar el Plan Grupo #${plan.codigo_plan_grupo} superado:`, (e as Error).message);
        }
      }
      return superados.length;
    } catch (e) {
      console.warn('[Respuesta Espuma] No se pudo evaluar planes superados para desactivar:', (e as Error).message);
      return 0;
    }
  }, []);

  // "Editar Plan" — mismo patrón que Corte y Laminado (reconciliarDetallesParaPlan): recalcula la
  // salida de datos ACTUAL del centro (misma fuente que al crear el plan — respuestaSalidaRowsPorCentro,
  // con el mismo esPFD que ya tenía el plan) y la usa como base editable, cruzando por material +
  // codigo_plan_grupo_padre contra los DetalleTactico ya persistidos para reutilizar
  // codigo_detalle_tactico en vez de duplicar. Lo que ya no aparece en el cálculo actual queda
  // premarcado para eliminar. `cantidad` sale en UN (row.cantidadUnidades vía
  // getOrigenesProrrateoEspuma), no en Kg — mismo criterio que handleConfirmarRespuestaP3/PFD.
  const reconciliarDetallesParaPlanEspuma = useCallback(async (
    plan: PlanGrupo,
    centro: '1000' | '2000'
  ): Promise<EditableDetalleRowEspuma[]> => {
    const detallesRes = await detalleTacticoService.getAll();
    const detallesPlan = (detallesRes.data || []).filter(d =>
      d.codigo_plan_grupo === plan.codigo_plan_grupo && d.estado === 'A'
    );
    const claveMaterial = (m: string | number) => String(Number(m));
    const existentesPorClave = new Map<string, DetalleTactico>();
    detallesPlan.forEach(d => {
      existentesPorClave.set(`${claveMaterial(d.codigo_material)}|${d.codigo_plan_grupo_padre}`, d);
    });

    const esPFD = /pfd/i.test(plan.valor);
    const salidaFresca = respuestaSalidaRowsPorCentro(centro, esPFD);

    const clavesUsadas = new Set<string>();
    const rows: EditableDetalleRowEspuma[] = [];
    salidaFresca.forEach(row => {
      const splits = getOrigenesProrrateoEspuma(row.material, row.cantidadUnidades, centro, plan.codigo_plan_grupo);
      splits.forEach(split => {
        const key = `${claveMaterial(row.material)}|${split.codigoPadre}`;
        clavesUsadas.add(key);
        const existente = existentesPorClave.get(key);
        rows.push({
          codigo_detalle_tactico: existente?.codigo_detalle_tactico ?? 0,
          material: row.material,
          descripcion: row.descripcion,
          cantidad: split.cantidad,
          marcadoEliminar: false,
          esNuevo: !existente,
          codigo_plan_grupo_padre: split.codigoPadre,
        });
      });
    });

    detallesPlan.forEach(d => {
      const key = `${claveMaterial(d.codigo_material)}|${d.codigo_plan_grupo_padre}`;
      if (clavesUsadas.has(key)) return;
      const materialCode = cleanCode(d.codigo_material);
      rows.push({
        codigo_detalle_tactico: d.codigo_detalle_tactico,
        material: materialCode,
        descripcion: materialDescMap.get(materialCode) || '—',
        cantidad: parseQty(d.cantidad_produccion_neta),
        marcadoEliminar: true,
        esNuevo: false,
        codigo_plan_grupo_padre: d.codigo_plan_grupo_padre,
      });
    });

    return rows;
  }, [respuestaSalidaRowsPorCentro, getOrigenesProrrateoEspuma, materialDescMap]);

  // Persistencia reutilizable de filas reconciliadas (upsert de las vigentes, delete de las
  // marcadas) — mismo criterio que Corte y Laminado (persistirFilasEditables).
  const persistirFilasEditablesEspuma = useCallback(async (
    codigoPlanGrupo: number,
    rows: EditableDetalleRowEspuma[],
    usuario: string,
    centro: string
  ) => {
    let actualizados = 0;
    let agregados = 0;
    let eliminados = 0;
    let fallidos = 0;

    for (const row of rows) {
      try {
        if (row.marcadoEliminar) {
          await detalleTacticoService.delete(row.codigo_detalle_tactico);
          eliminados++;
          continue;
        }

        const detallePayload = {
          codigo_detalle_tactico: row.esNuevo ? 0 : row.codigo_detalle_tactico,
          codigo_material: Number(row.material),
          cantidad_produccion_neta: Math.round(row.cantidad).toFixed(0),
          resp_ctrl_prod: '',
          clase_aprovisionamiento: 'E',
          cantidad_aprovisionamiento: 0,
          estado: 'A',
          codigo_plan_grupo: codigoPlanGrupo,
          codigo_plan_grupo_padre: row.codigo_plan_grupo_padre,
          usuario_modificacion: usuario,
          linea_produccion: matchLineaProduccionEspuma(row.material, centro),
        };
        await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
        if (row.esNuevo) agregados++; else actualizados++;
      } catch (e) {
        console.warn(`[Editar Plan Espuma] Falló material ${row.material} (padre ${row.codigo_plan_grupo_padre}):`, (e as Error).message);
        fallidos++;
      }
    }

    return { actualizados, agregados, eliminados, fallidos };
  }, [matchLineaProduccionEspuma]);

  // Paso 1 de edición: lista los PlanGrupo activos (P3 o PFD, cualquiera de los dos) de ESE centro
  // para que el usuario elija cuál corregir — mismo criterio de filtro (codigo_grupo + "Espuma" +
  // centro) que desactivarPlanesEspumaSuperados, así solo aparecen planes reales de este módulo.
  const handleOpenEditarPlan = useCallback(async (centro: '1000' | '2000') => {
    setIsLoadingEditPlan(true);
    try {
      const planesRes = await planGrupoService.getAll();
      const centroRegex = new RegExp(`centro\\s*${centro}`, 'i');
      const planesGrupo = (planesRes.data || [])
        .filter(p => p.codigo_grupo === CODIGO_GRUPO_LAMINADO && p.estado === 'A' && /espuma/i.test(String(p.valor || '')) && centroRegex.test(String(p.valor || '')))
        .sort((a, b) => b.codigo_plan_grupo - a.codigo_plan_grupo);

      if (planesGrupo.length === 0) {
        addNotification('warning', `No hay ningún Plan Grupo activo guardado para Corte Espuma (Centro ${centro}).`);
        return;
      }

      setPlanesGrupoDisponibles({ centro, planes: planesGrupo });
      setPlanGrupoSeleccionado(planesGrupo[0].codigo_plan_grupo);
    } catch (e) {
      addNotification('error', `Error al cargar los planes: ${(e as Error).message}`);
    } finally {
      setIsLoadingEditPlan(false);
    }
  }, [addNotification]);

  // Paso 2: ya elegido el PlanGrupo, reconcilia contra la salida actual y arma la vista editable. La
  // fecha se RECALCULA (no se conserva la que traía el plan) — mismo criterio que al crear un P3
  // nuevo (próximo día laborable desde hoy); PFD no tiene ventana propia en Espuma (a diferencia de
  // Laminado), así que usa el mismo criterio.
  const handleConfirmarSeleccionPlanEspuma = useCallback(async () => {
    if (!planGrupoSeleccionado || !planesGrupoDisponibles) return;
    const planVigente = planesGrupoDisponibles.planes.find(p => p.codigo_plan_grupo === planGrupoSeleccionado);
    if (!planVigente) return;

    setIsLoadingEditPlan(true);
    try {
      const rows = await reconciliarDetallesParaPlanEspuma(planVigente, planesGrupoDisponibles.centro);
      const fechaInicio = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');

      setEditPlanPreview({
        codigo_plan_grupo: planVigente.codigo_plan_grupo,
        centro: planesGrupoDisponibles.centro,
        valor: planVigente.valor,
        fechaInicio,
        fechaFin: fechaInicio,
        rows,
        planOriginal: planVigente,
      });
      setPlanesGrupoDisponibles(null);
      setPlanGrupoSeleccionado(null);
    } catch (e) {
      addNotification('error', `Error al cargar el plan: ${(e as Error).message}`);
    } finally {
      setIsLoadingEditPlan(false);
    }
  }, [planGrupoSeleccionado, planesGrupoDisponibles, addNotification, reconciliarDetallesParaPlanEspuma, siguienteDiaHabil]);

  // Materiales de Necesidades Planta (mismo centro, mismo esPFD del plan) que todavía no están en el
  // plan cargado, disponibles para agregar a mano.
  const materialesDisponiblesParaAgregarEspuma = useMemo(() => {
    if (!editPlanPreview) return [];
    const yaIncluidos = new Set(editPlanPreview.rows.filter(r => !r.marcadoEliminar).map(r => r.material));
    const esPFD = /pfd/i.test(editPlanPreview.valor);
    return respuestaSalidaRowsPorCentro(editPlanPreview.centro, esPFD).filter(r => r.cantidadUnidades > 0 && !yaIncluidos.has(r.material));
  }, [editPlanPreview, respuestaSalidaRowsPorCentro]);

  const handleAddMaterialToEditPlanEspuma = (material: string) => {
    if (!editPlanPreview) return;
    const needRow = respuestaSalidaRowsPorCentro(editPlanPreview.centro, /pfd/i.test(editPlanPreview.valor)).find(r => r.material === material);
    if (!needRow) return;
    const splits = getOrigenesProrrateoEspuma(needRow.material, needRow.cantidadUnidades, editPlanPreview.centro, editPlanPreview.codigo_plan_grupo);
    const nuevasFilas: EditableDetalleRowEspuma[] = splits
      .filter(split => split.cantidad > 0)
      .map(split => ({
        codigo_detalle_tactico: 0,
        material: needRow.material,
        descripcion: needRow.descripcion,
        cantidad: split.cantidad,
        marcadoEliminar: false,
        esNuevo: true,
        codigo_plan_grupo_padre: split.codigoPadre,
      }));
    setEditPlanPreview(prev => {
      if (!prev) return prev;
      return { ...prev, rows: [...prev.rows, ...nuevasFilas] };
    });
  };

  // En filas nuevas (aún no guardadas) "quitar" simplemente las descarta; en filas existentes se
  // marcan para eliminar (DELETE real al confirmar), permitiendo deshacer antes de guardar.
  const handleRemoveEditRowEspuma = (index: number) => {
    setEditPlanPreview(prev => {
      if (!prev) return prev;
      const row = prev.rows[index];
      if (row.esNuevo) {
        return { ...prev, rows: prev.rows.filter((_, i) => i !== index) };
      }
      return { ...prev, rows: prev.rows.map((r, i) => (i === index ? { ...r, marcadoEliminar: !r.marcadoEliminar } : r)) };
    });
  };

  const handleUpdateEditRowCantidadEspuma = (index: number, value: number) => {
    setEditPlanPreview(prev => {
      if (!prev) return prev;
      const rows = prev.rows.map((r, i) => (i === index ? { ...r, cantidad: value } : r));
      return { ...prev, rows };
    });
  };

  const handleConfirmEditarPlanEspuma = useCallback(async () => {
    if (!editPlanPreview) return;
    setIsSavingEditPlan(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      await planGrupoService.save({
        ...editPlanPreview.planOriginal,
        fecha_inicio_plan: editPlanPreview.fechaInicio,
        fecha_fin_plan: editPlanPreview.fechaFin,
      } as unknown as PlanGrupo);

      const { actualizados, agregados, eliminados, fallidos } =
        await persistirFilasEditablesEspuma(editPlanPreview.codigo_plan_grupo, editPlanPreview.rows, usuario, editPlanPreview.centro);

      const superados = await desactivarPlanesEspumaSuperados(editPlanPreview.centro, editPlanPreview.fechaInicio, editPlanPreview.codigo_plan_grupo, /pfd/i.test(editPlanPreview.valor));
      const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo día o anterior fueron desactivados.` : '';

      if (fallidos === 0) {
        addNotification('success', `Plan Grupo #${editPlanPreview.codigo_plan_grupo} actualizado (vigencia ${editPlanPreview.fechaInicio} a ${editPlanPreview.fechaFin}): ${actualizados} modificados, ${agregados} agregados, ${eliminados} eliminados.${sufijoSuperados}`);
      } else {
        addNotification('warning', `Plan Grupo #${editPlanPreview.codigo_plan_grupo} actualizado con errores: ${actualizados} modificados, ${agregados} agregados, ${eliminados} eliminados, ${fallidos} fallidos.${sufijoSuperados}`);
      }
      fetchNecesidadesPlanta();
      setEditPlanPreview(null);
    } catch (e) {
      addNotification('error', `Error al actualizar el plan: ${(e as Error).message}`);
    } finally {
      setIsSavingEditPlan(false);
    }
  }, [editPlanPreview, addNotification, fetchNecesidadesPlanta, persistirFilasEditablesEspuma, desactivarPlanesEspumaSuperados]);

  // Paso 2: el usuario confirmó en el diálogo. Por cada centro de la vista previa (uno solo si vino
  // del botón por centro, hasta dos si vino del botón general "Ambos Centros"), crea su propio
  // PlanGrupo (grupo 8, compartido con Corte y Laminado — ver CODIGO_GRUPO_LAMINADO) y, por cada
  // material (incluidos los de cantidad 0 — a diferencia del "Guardar Plan" base de Laminado, aquí SÍ
  // se conservan para dejar constancia de qué quedó sin Provisional que lo cubra), uno o más
  // DetalleTactico vía getOrigenesProrrateoEspuma. Un centro que falle no bloquea al otro — se
  // reporta por separado.
  const handleConfirmarRespuestaP3 = useCallback(async () => {
    if (!planPreviewP3 || planPreviewP3.length === 0) return;
    setIsSavingPlanP3(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      const resultadosPorCentro: string[] = [];
      let huboError = false;

      for (const preview of planPreviewP3) {
        try {
          const planPayload = {
            codigo_plan_grupo: 0,
            codigo_grupo: preview.codigo_grupo,
            codigo_familia_grupo: null,
            codigo_plan: null,
            valor: preview.valor,
            fecha_inicio_plan: preview.fechaInicio,
            fecha_fin_plan: preview.fechaFin,
            estado: 'A',
            usuario_creacion: usuario,
            // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales).
            // Mismo patrón ya usado en grupo-operadores/components/form.tsx.
            fecha_creacion: new Date(),
          };

          const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
          const nuevoCodigoPlanGrupo = planResponse.data.codigo_plan_grupo;

          let exitosos = 0;
          let fallidos = 0;

          for (const row of preview.rows) {
            // row.cantidadUnidades: el P2 que se responde pide y registra en UN — Respuesta P3 ya
            // compara/calcula todo en UN (ver respuestaSalidaRowsPorCentro), sin conversión Kg de por
            // medio.
            const splits = getOrigenesProrrateoEspuma(row.material, row.cantidadUnidades, preview.centro, nuevoCodigoPlanGrupo);
            for (const split of splits) {
              try {
                const detallePayload = {
                  codigo_detalle_tactico: 0,
                  codigo_material: Number(row.material),
                  cantidad_produccion_neta: Math.round(split.cantidad).toFixed(0),
                  resp_ctrl_prod: '',
                  clase_aprovisionamiento: 'E',
                  cantidad_aprovisionamiento: 0,
                  estado: 'A',
                  codigo_plan_grupo: nuevoCodigoPlanGrupo,
                  codigo_plan_grupo_padre: split.codigoPadre,
                  usuario_modificacion: usuario,
                  linea_produccion: matchLineaProduccionEspuma(row.material, preview.centro),
                };
                await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
                exitosos++;
              } catch (e) {
                console.warn(`[Respuesta P3 Espuma] Falló material ${row.material} (padre ${split.codigoPadre}, centro ${preview.centro}):`, (e as Error).message);
                fallidos++;
              }
            }
          }

          const superados = await desactivarPlanesEspumaSuperados(preview.centro, preview.fechaInicio, nuevoCodigoPlanGrupo, false);
          const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo centro desactivado(s).` : '';

          if (fallidos === 0) {
            resultadosPorCentro.push(`Centro ${preview.centro}: ${exitosos} materiales en Plan Grupo #${nuevoCodigoPlanGrupo}.${sufijoSuperados}`);
          } else {
            huboError = true;
            resultadosPorCentro.push(`Centro ${preview.centro}: ${exitosos} guardados, ${fallidos} fallaron (Plan Grupo #${nuevoCodigoPlanGrupo}).${sufijoSuperados}`);
          }
        } catch (e) {
          huboError = true;
          resultadosPorCentro.push(`Centro ${preview.centro}: error al crear el Plan Grupo — ${(e as Error).message}`);
        }
      }

      const mensaje = `Respuesta P3 guardada. ${resultadosPorCentro.join(' | ')}`;
      addNotification(huboError ? 'warning' : 'success', mensaje);
      fetchNecesidadesPlanta();
      setPlanPreviewP3(null);
    } catch (e) {
      addNotification('error', `Error al guardar la Respuesta P3: ${(e as Error).message}`);
    } finally {
      setIsSavingPlanP3(false);
    }
  }, [planPreviewP3, addNotification, fetchNecesidadesPlanta, getOrigenesProrrateoEspuma, desactivarPlanesEspumaSuperados, matchLineaProduccionEspuma]);

  // Variante PFD de construirPreviewP3 (ver conversación): mismo universo de materiales y misma
  // fecha de respuesta, pero con la cascada de respuestaSalidaRowsPorCentro forzando a 0 la fuente
  // "Stock" (esPFD=true) — insumo pensado para el futuro reporte de generación de órdenes, que no
  // debe sugerir una orden nueva para material que ya está cubierto por stock. No reemplaza ni
  // modifica el P3 normal (mismo criterio que el PFD de Corte y Laminado): es un PlanGrupo aparte.
  const construirPreviewPFD = useCallback((centro: '1000' | '2000'): PlanGrupoPreviewEspuma | null => {
    const rows = respuestaSalidaRowsPorCentro(centro, true);
    if (rows.length === 0) return null;
    const fechaRespuesta = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');
    return {
      centro,
      codigo_grupo: CODIGO_GRUPO_LAMINADO,
      nombreGrupo: 'Corte Espuma',
      valor: `Plan Táctico - Centro ${centro} - PFD - Espuma`,
      fechaInicio: fechaRespuesta,
      fechaFin: fechaRespuesta,
      rows
    };
  }, [respuestaSalidaRowsPorCentro, siguienteDiaHabil]);

  const handleAbrirRespuestaPFD = useCallback((centro: '1000' | '2000') => {
    const preview = construirPreviewPFD(centro);
    if (!preview) {
      addNotification('warning', `No hay materiales de Necesidades Planta para el Centro ${centro}.`);
      return;
    }
    setPlanPreviewPFD([preview]);
  }, [construirPreviewPFD, addNotification]);

  const handleAbrirRespuestaPFDTodos = useCallback(() => {
    const previews = (['1000', '2000'] as const)
      .map(centro => construirPreviewPFD(centro))
      .filter((p): p is PlanGrupoPreviewEspuma => p !== null);
    if (previews.length === 0) {
      addNotification('warning', 'No hay materiales de Necesidades Planta en ningún centro.');
      return;
    }
    setPlanPreviewPFD(previews);
  }, [construirPreviewPFD, addNotification]);

  // Paso 2 del PFD: mismo guardado que handleConfirmarRespuestaP3 (PlanGrupo + DetalleTactico vía
  // getOrigenesProrrateoEspuma), solo cambia el valor del PlanGrupo (ya viene con sufijo "- PFD -
  // Espuma" desde construirPreviewPFD) y las cantidades que trae preview.rows (con Stock en 0).
  const handleConfirmarRespuestaPFD = useCallback(async () => {
    if (!planPreviewPFD || planPreviewPFD.length === 0) return;
    setIsSavingPlanPFD(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      const resultadosPorCentro: string[] = [];
      let huboError = false;

      for (const preview of planPreviewPFD) {
        try {
          const planPayload = {
            codigo_plan_grupo: 0,
            codigo_grupo: preview.codigo_grupo,
            codigo_familia_grupo: null,
            codigo_plan: null,
            valor: preview.valor,
            fecha_inicio_plan: preview.fechaInicio,
            fecha_fin_plan: preview.fechaFin,
            estado: 'A',
            usuario_creacion: usuario,
            // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales).
            // Mismo patrón ya usado en grupo-operadores/components/form.tsx.
            fecha_creacion: new Date(),
          };

          const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
          const nuevoCodigoPlanGrupo = planResponse.data.codigo_plan_grupo;

          let exitosos = 0;
          let fallidos = 0;

          for (const row of preview.rows) {
            // row.cantidadUnidades: el P2 que se responde pide y registra en UN — Respuesta P3 ya
            // compara/calcula todo en UN (ver respuestaSalidaRowsPorCentro), sin conversión Kg de por
            // medio.
            const splits = getOrigenesProrrateoEspuma(row.material, row.cantidadUnidades, preview.centro, nuevoCodigoPlanGrupo);
            for (const split of splits) {
              try {
                const detallePayload = {
                  codigo_detalle_tactico: 0,
                  codigo_material: Number(row.material),
                  cantidad_produccion_neta: Math.round(split.cantidad).toFixed(0),
                  resp_ctrl_prod: '',
                  clase_aprovisionamiento: 'E',
                  cantidad_aprovisionamiento: 0,
                  estado: 'A',
                  codigo_plan_grupo: nuevoCodigoPlanGrupo,
                  codigo_plan_grupo_padre: split.codigoPadre,
                  usuario_modificacion: usuario,
                  linea_produccion: matchLineaProduccionEspuma(row.material, preview.centro),
                };
                await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
                exitosos++;
              } catch (e) {
                console.warn(`[Respuesta PFD Espuma] Falló material ${row.material} (padre ${split.codigoPadre}, centro ${preview.centro}):`, (e as Error).message);
                fallidos++;
              }
            }
          }

          const superados = await desactivarPlanesEspumaSuperados(preview.centro, preview.fechaInicio, nuevoCodigoPlanGrupo, true);
          const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo centro desactivado(s).` : '';

          if (fallidos === 0) {
            resultadosPorCentro.push(`Centro ${preview.centro}: ${exitosos} materiales en Plan Grupo #${nuevoCodigoPlanGrupo}.${sufijoSuperados}`);
          } else {
            huboError = true;
            resultadosPorCentro.push(`Centro ${preview.centro}: ${exitosos} guardados, ${fallidos} fallaron (Plan Grupo #${nuevoCodigoPlanGrupo}).${sufijoSuperados}`);
          }
        } catch (e) {
          huboError = true;
          resultadosPorCentro.push(`Centro ${preview.centro}: error al crear el Plan Grupo — ${(e as Error).message}`);
        }
      }

      const mensaje = `PFD guardado. ${resultadosPorCentro.join(' | ')}`;
      addNotification(huboError ? 'warning' : 'success', mensaje);
      fetchNecesidadesPlanta();
      setPlanPreviewPFD(null);
    } catch (e) {
      addNotification('error', `Error al guardar el PFD: ${(e as Error).message}`);
    } finally {
      setIsSavingPlanPFD(false);
    }
  }, [planPreviewPFD, addNotification, fetchNecesidadesPlanta, getOrigenesProrrateoEspuma, desactivarPlanesEspumaSuperados, matchLineaProduccionEspuma]);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    setViewDateProv(today);
    setViewDateFert(today);
    setSelectedDatesProv(new Set([format(today, 'yyyy-MM-dd')]));
    // FERT arranca en "Ver Todo" (sin selección): su rango ya está 100% acotado por regla de
    // negocio (todo lo pasado + siguiente día laborable), no hace falta forzar "solo hoy" al montar.
    setSelectedDatesFert(new Set());

    // Rehidratación: si ya se había sincronizado en esta sesión, se recupera lo trabajado en vez de
    // dejar el módulo vacío. Cambiar de módulo para mirar otra pantalla ya no cuesta volver a
    // sincronizar; los datos se reemplazan solo cuando el usuario pide datos nuevos (Sincronizar /
    // Actualizar P2 / generar la Necesidad PFF).
    const snap = leerDeCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA);
    if (snap) {
      setOrdenesProvisionales(snap.ordenesProvisionales);
      setOrdenesFert(snap.ordenesFert);
      setInventarioSAP(snap.inventarioSAP);
      setCuboInventarios(snap.cuboInventarios || []);
      setTiemposCatalogo(snap.tiemposCatalogo);
      setMantenimientosSAP(snap.mantenimientosSAP);
      setKpiLooperData(snap.kpiLooperData);
      setKpiCarruselesData(snap.kpiCarruselesData);
      setOperadoresCorte(snap.operadoresCorte);
      setRestriccionesCorte(snap.restriccionesCorte);
      setDiasNoLaborables(new Set(snap.diasNoLaborables));
      setNecesidadesPlantaData(snap.necesidadesPlantaData);
      setNecesidadPFFData(snap.necesidadPFFData);
      setNecesidadPFFNivel2Data(snap.necesidadPFFNivel2Data || { '1000': [], '2000': [] });
      setDatosCargados(true);
    }
  }, []);

  // Sincronización manual: se dispara con el botón "Sincronizar" del encabezado (o "Actualizar P2"
  // para recargar solo el P2), y también después de cada acción que escribe datos (guardar P3/PFD),
  // que ya llaman a fetchNecesidadesPlanta por su cuenta. No hay carga automática al montar.
  // El calendario de feriados se carga PRIMERO y se pasa explícito a fetchNecesidadesPlanta. Si se
  // dispararan en paralelo, la recuperación del P2 correría con `diasNoLaborables` todavía vacío
  // (setState no actualiza el closure de forma síncrona) y buscaría el P2 en un día feriado — que es
  // exactamente el desfase que se quería eliminar: el origen graba el plan saltando el feriado y
  // aquí se lo buscaría un día antes, sin encontrarlo nunca.
  const handleSincronizarYGenerar = useCallback(async () => {
    setSyncStep('sincronizando');
    try {
      const dias = await cargarDiasNoLaborables();
      setDiasNoLaborables(dias);
      await Promise.all([fetchDataAsync(), fetchNecesidadesPlanta(dias)]);
      // calcularNecesidadPFF hace su propia consulta fresca a planGrupoService/detalleTacticoService
      // (no depende de closures de fetchDataAsync), pero SÍ depende de materialDescMap/inventarioSAP
      // ya reflejados en el render — se dispara desde el efecto de más abajo (declarado después de
      // calcularNecesidadPFF), no acá directo, para no leer esas dependencias por closure vieja antes
      // de que el siguiente render las recalcule (mismo criterio que Corte y Laminado).
      setAutoGenerarPendiente(true);
    } catch (e) {
      addNotification('error', `Error al sincronizar: ${(e as Error).message}`);
      setSyncStep('idle');
    }
  }, [fetchDataAsync, fetchNecesidadesPlanta, addNotification]);

  // "Pendientes Totales" (+20K registros) sigue siendo perezoso, pero ahora solo se carga si el
  // usuario ya sincronizó: abrir el tab sin datos base no debe disparar una consulta pesada sola.
  useEffect(() => {
    if (datosCargados && activeTab === 'necesidadesPlanta' && !pendientesCargados && !isLoadingPendientes) {
      fetchPendientesTotales();
    }
  }, [datosCargados, activeTab, pendientesCargados, isLoadingPendientes, fetchPendientesTotales]);

  const updateConfig = (planta: 'UIO' | 'GYE', machine: string, field: string, value: string | number | boolean) => {
    const setFn = planta === 'UIO' ? setUioConfig : setGyeConfig;
    setFn((prev) => ({
      ...prev,
      shifts: { ...prev.shifts, [machine]: { ...prev.shifts[machine], [field]: value } }
    }));
  };

  // Relleno automático de turnos: aplica el horario elegido a TODAS las máquinas de la planta que
  // todavía tengan ese turno en "VACÍO". No pisa las que ya tienen horario propio — si una máquina
  // se configuró distinta a propósito, se respeta. Nace del aviso "Turnos sin configurar": avisar sin
  // dar la acción obligaba a repetir la misma selección máquina por máquina.
  const aplicarTurnoAPlanta = useCallback((planta: 'UIO' | 'GYE', campo: 'day' | 'night' | 'saturday', valor: string) => {
    if (!valor) return; // '' = opción "Mixto", no es una selección real
    const setFn = planta === 'UIO' ? setUioConfig : setGyeConfig;
    setFn(prev => {
      const shifts = { ...prev.shifts };
      Object.keys(shifts).forEach(id => { shifts[id] = { ...shifts[id], [campo]: valor }; });
      return { ...prev, shifts };
    });
    const etiqueta = (campo === 'day' || campo === 'saturday' ? shiftOptions : nightShiftOptions).find(o => o.v === valor)?.l;
    const nombreCampo = campo === 'day' ? 'Día' : campo === 'saturday' ? 'Sábado' : 'Noche';
    addNotification('success', `Turno ${nombreCampo} → ${etiqueta} en todas las máquinas de ${planta}. Capacidad y ocupación recalculadas.`);
  }, [addNotification, shiftOptions, nightShiftOptions]);

  const renderMachineCol = (id: string, name: string, planta: 'UIO' | 'GYE') => {
    const config = planta === 'UIO' ? uioConfig.shifts[id] : gyeConfig.shifts[id];

    // Se quitó "Ocupación Recurso" (ocupación por máquina). Cruzaba la carga con la máquina usando
    // `r.maquina === id || r.maquina.includes(id)`, pero los IDs de esta configuración (CR04, CR03,
    // CNC01…) son un modelo manual del planificador y NO son los códigos de máquina de SAP
    // (HR-CAR01/02/03, HR-CARG1, HR_V02, HR_V03_1…). Resultado: mostraba 0.0% en casi todas las
    // columnas —lo que se leía como "esta máquina está libre" cuando en realidad era "no encontré
    // nada que cruzar"— y solo acertaba por casualidad en V02/V03, donde 'HR_V02'.includes('V02').
    // Para devolverla hace falta un mapeo explícito ID de configuración → código(s) SAP.
    //
    // MTTO PREVENTIVO: antes usaba los selectores de fecha de Provisionales/FERT (getMttoTime, ya
    // eliminada) — mostraba 0.00h casi siempre porque esos selectores no tienen por qué coincidir
    // con la fecha que se está evaluando en Capacidad Operativa. Caso real reportado por el usuario:
    // la tarjeta mostraba 0.00h mientras el resumen de abajo (que sí usa la fecha de Capacidad
    // Operativa) ya restaba mantenimiento real — dos fuentes distintas para el mismo dato. Ahora
    // ambas usan la MISMA fecha (selectedDatesCapacidad[planta]).
    const fechaCapacidadSel = Array.from(selectedDatesCapacidad[planta]).sort()[0];
    const mttoHours = fechaCapacidadSel ? getMttoTimeParaFecha(id, planta, fechaCapacidadSel) : 0;

    const activa = config.activa !== false;

    return (
      <div key={id} className={cn("col-span-1 border-r border-gray-100 flex flex-col font-sans", !activa && "bg-slate-50/80")}>
        <div className="p-3 border-b border-gray-100 text-center">
          <p className={cn("text-xs font-black uppercase tracking-tight", activa ? "text-slate-800" : "text-slate-400 line-through")}>{id}</p>
          <p className={cn("text-[9px] font-bold uppercase truncate", activa ? "text-slate-500" : "text-slate-400")}>{name}</p>
          {/* Apagar la máquina cuando no hay demanda que la justifique: deja de aportar horas a la
              capacidad, sin tener que borrarle los turnos (que significa "aún no lo definí"). */}
          <button
            type="button"
            onClick={() => updateConfig(planta, id, 'activa', !activa)}
            className={cn(
              "mt-1.5 w-full rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors border",
              activa
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
            )}
            title={activa ? 'Máquina en servicio: sus horas suman a la capacidad. Click para apagarla.' : 'Máquina fuera de servicio: no aporta capacidad. Click para encenderla.'}
          >
            {activa ? 'En servicio' : 'Fuera de servicio'}
          </button>
        </div>
        <div className="p-3 space-y-3 text-left">
          <div className="space-y-1">
             <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-wide">Mtto Preventivo</p>
             <div className="bg-indigo-50 border border-indigo-200 rounded p-1.5 text-center">
                <span className="text-[10px] font-black text-indigo-700">{mttoHours.toFixed(2)}H</span>
             </div>
          </div>
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Turno Día</p>
            <select value={config.day} onChange={e => updateConfig(planta, id, 'day', e.target.value)} className="w-full bg-white text-amber-700 font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200">
              {shiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={config.op1D} onChange={e => updateConfig(planta, id, 'op1D', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">— OP1 —</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
            <select value={config.op2D} onChange={e => updateConfig(planta, id, 'op2D', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">— OP2 AYUD —</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
          </div>
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Turno Noche</p>
            <select value={config.night} onChange={e => updateConfig(planta, id, 'night', e.target.value)} className="w-full bg-white text-purple-700 font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200">
              {nightShiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={config.op1N} onChange={e => updateConfig(planta, id, 'op1N', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">— OP1 —</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
            <select value={config.op2N} onChange={e => updateConfig(planta, id, 'op2N', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">— OP2 AYUD —</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
          </div>
          {/* Turno Sábado: independiente de Turno Día, en VACÍO por defecto -- se suma aparte a la
              capacidad, no reemplaza el turno día normal (ver MachineShiftConfig.saturday). */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Turno Sábado</p>
            <select value={config.saturday} onChange={e => updateConfig(planta, id, 'saturday', e.target.value)} className="w-full bg-white text-amber-700 font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200">
              {shiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={config.op1S} onChange={e => updateConfig(planta, id, 'op1S', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">— OP1 —</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
            <select value={config.op2S} onChange={e => updateConfig(planta, id, 'op2S', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">— OP2 AYUD —</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
          </div>
          {/* Los paros T1/T2 (13% por turno) ya se descuentan solos en el cálculo — tenerlos como
              campo editable por máquina ocupaba media columna sin que nadie los cambiara. El valor
              sigue en la configuración y se informa una sola vez en la cabecera Gestión de Tiempos. */}
        </div>
      </div>
    );
  };

  const renderDashboard = (planta: 'UIO' | 'GYE') => {
    const config = planta === 'UIO' ? uioConfig : gyeConfig;
    const machines = MACHINES_BY_PLANTA[planta];
    // Columnas de máquina agrupadas por proceso (ver JSX más abajo, junto a renderProcesoPanel):
    // separan la grilla en dos bloques con su propia cabecera de color, para que se corresponda
    // visualmente con los paneles Carruseles/Verticales de la izquierda.
    const machinesCarrusel = machines.filter(m => m.proceso === 'carrusel');
    const machinesVertical = machines.filter(m => m.proceso === 'vertical');
    const machinesCnc = machines.filter(m => m.proceso === 'cnc');
    // Ajuste visual pedido por el usuario: en Guayaquil (3 carruseles vs 1 vertical) el panel de
    // Verticales quedaba demasiado angosto para su contenido (flex proporcional al conteo real de
    // máquinas, 3:1). Se le da un peso mínimo de 2 SOLO en GYE — ensancha Verticales y achica un
    // poco Carruseles (queda 3:2 en vez de 3:1) sin tocar el layout de Quito (2 verticales, ya
    // balanceado), que sigue usando el conteo real.
    const flexVertical = planta === 'GYE' ? Math.max(machinesVertical.length, 2) : machinesVertical.length;

    // El % de rendimiento de la planta aplica al CARRUSEL. El corte vertical trabaja al 100%
    // (confirmado por el usuario): solo se le descuentan los paros del turno.
    const rendimientoDe = (proceso: ProcesoCorte) => proceso === 'vertical' ? 1 : config.performance / 100;

    const horasDeMaquina = (id: string) => {
      const c = config.shifts[id];
      // Máquina apagada a propósito (sin demanda que la justifique): no aporta capacidad.
      if (!c || c.activa === false) return 0;
      const proceso = machines.find(m => m.id === id)?.proceso ?? 'carrusel';
      const hD = shiftOptions.find(o => o.v === c.day)?.h || 0;
      const hN = nightShiftOptions.find(o => o.v === c.night)?.h || 0;
      const hS = shiftOptions.find(o => o.v === c.saturday)?.h || 0;
      return ((hD * (1 - c.paro1 / 100)) + (hN * (1 - c.paro2 / 100)) + (hS * (1 - c.paro3 / 100))) * rendimientoDe(proceso);
    };
    const totalH = Object.keys(config.shifts).reduce((s, m) => s + horasDeMaquina(m), 0);

    // Capacidad separada por proceso (ver MACHINES_BY_PLANTA.proceso): la ocupación de Carruseles debe
    // medirse contra máquinas de carrusel y la de Verticales contra máquinas verticales. Dividir ambas
    // por la capacidad total de la planta las diluía a las dos — con 4 máquinas, un proceso al 40% real
    // se mostraba al 10%.
    const capacidadPorProceso = machines.reduce<Record<ProcesoCorte, number>>((acc, m) => {
      acc[m.proceso] += horasDeMaquina(m.id);
      return acc;
    }, { carrusel: 0, vertical: 0, cnc: 0 });

    // Las máquinas de corte vertical todavía no están cargadas en la configuración (ver
    // MACHINES_BY_PLANTA), así que Verticales se quedaba sin nada contra qué medirse. Mientras tanto
    // se le asigna una capacidad EQUIVALENTE A UN TURNO DÍA de carrusel — decisión del usuario, es una
    // referencia razonable para no dejar el proceso sin medir. En cuanto se carguen las máquinas
    // verticales con su propio horario, esta estimación deja de aplicar sola.
    const capacidadVerticalEstimada = capacidadPorProceso.vertical === 0
      ? (() => {
          const primeraCarrusel = machines.find(m => m.proceso === 'carrusel');
          if (!primeraCarrusel) return 0;
          const c = config.shifts[primeraCarrusel.id];
          const hD = shiftOptions.find(o => o.v === c?.day)?.h || 0;
          return hD * (1 - (c?.paro1 ?? 0) / 100); // el vertical va al 100% de rendimiento
        })()
      : 0;
    const capacidadVerticalUsada = capacidadPorProceso.vertical || capacidadVerticalEstimada;
    const verticalEsEstimada = capacidadPorProceso.vertical === 0 && capacidadVerticalEstimada > 0;

    // Máquinas con algún turno en "VACÍO": esas horas no entran en totalH (ver arriba), así que la
    // ocupación se ve más holgada de lo que es. Se listan para avisarlo en la tarjeta de capacidad.
    // Por PROCESO (no agregado de toda la planta): cada panel (Carruseles/Verticales) muestra solo
    // el aviso de sus propias máquinas, para que una vertical sin turno no aparezca en el panel de
    // Carruseles y viceversa.
    const turnosSinConfigurarPorProceso = (proceso: ProcesoCorte) => {
      const machinesProceso = machines.filter(m => m.proceso === proceso);
      const lista = machinesProceso.flatMap(m => {
        const c = config.shifts[m.id];
        if (!c) return [];
        const faltan: string[] = [];
        if (c.day === 'EMPTY') faltan.push(`${m.id} día`);
        if (c.night === 'EMPTY') faltan.push(`${m.id} noche`);
        return faltan;
      });
      // Resumen corto del aviso: enumerar máquina por máquina daba un párrafo ilegible ("CR04 noche,
      // CR03 noche, CR01 noche…"). Basta con decir qué turno falta y en cuántas máquinas del proceso.
      const sinDia = machinesProceso.filter(m => config.shifts[m.id]?.day === 'EMPTY').length;
      const sinNoche = machinesProceso.filter(m => config.shifts[m.id]?.night === 'EMPTY').length;
      const resumen = [
        sinDia > 0 ? `Día en ${sinDia} de ${machinesProceso.length}` : null,
        sinNoche > 0 ? `Noche en ${sinNoche} de ${machinesProceso.length}` : null,
      ].filter(Boolean).join(' · ');
      return { lista, resumen };
    };

    // Capacidad Operativa se organiza por FECHA (una tarjeta por día) — "Nivel 1/2/3" es la
    // maquinaria interna que decide de dónde sale cada fecha y qué tan firme está, pero ya no es el
    // eje que ve el usuario (antes lo era, y resultó ilegible para alguien que no construyó el
    // código). Referencia de qué alimenta cada fecha:
    //   Necesidad "a tiempo" (antes Nivel 1): 3 fuentes con su propia fecha real de origen — P1/PFF
    //     hoy+3 días hábiles, P2-Espumas Venta la fecha que seleccionó el planificador, P2-Muebles/
    //     Prensado hoy+1 día hábil exacto.
    //   Necesidad "red de seguridad" (antes Nivel 2, ver necesidadPFFNivel2Data): solo P1/PFF, para
    //     un plan que se quedó fechado hoy+2 en vez de hoy+3 (activo pero invisible para la necesidad
    //     "a tiempo", que exige match exacto). Venta Externa-Espumas no la necesita: garantiza un
    //     solo plan activo por centro, si está atrasado ya es el que usa la necesidad "a tiempo".
    //   Tarjeta "Atrasado" (antes Nivel 3, WIP — SIN CAMBIOS): todo FERT con fecha ≤ hoy, sin ventana.
    const centroId = planta === 'UIO' ? '1000' : '2000';
    const necesidadCapacidad = planta === 'UIO' ? necesidadCapacidadUIO : necesidadCapacidadGYE;
    const necesidadCapacidadNivel2 = planta === 'UIO' ? necesidadCapacidadNivel2UIO : necesidadCapacidadNivel2GYE;

    const nivel3Fert = (planta === 'UIO' ? fertAuditUIO : fertAuditGYE).filter(r => r.fecha <= todayStr);

    // fertAuditAllUIO/GYE, provAuditAllUIO/GYE: mismas fuentes ya usadas por Respuesta P3, sin ventana
    // de fecha — no dependen del selector de los tabs Provisionales/FERT (esos siguen intactos).
    const fertSinVentana = planta === 'UIO' ? fertAuditAllUIO : fertAuditAllGYE;
    // Provisionales sin las que ya se transformaron en FERT (ver clavesProvisionalesTransformadas):
    // esas ya resolvieron una necesidad de un ciclo anterior, no deben descontar la de hoy.
    const provSinVentana = sinProvisionalesTransformadas(planta === 'UIO' ? provAuditAllUIO : provAuditAllGYE, centroId);

    // calcularNivel: agrupa las filas de necesidad por su fecha PROPIA (fecha objetivo real), y por
    // cada una busca lo YA firme (FERT/Provisional fechado 1 día hábil antes — la lámina se corta el
    // día previo a cuando se necesita) y calcula el Faltante neto. Alimenta únicamente el total de
    // fondo (candidatosDiferir) — el resultado visible del panel ahora lo resuelve `resolverFecha`,
    // más abajo, por selección manual del usuario.
    // stockYaReservadoPorMaterial: encadena lo que un nivel anterior ya usó del stock, para que el
    // siguiente no vuelva a netear contra el stock COMPLETO (ver comentario en
    // calcularFaltanteNecesidadPlanta — caso real 2026-09-02: mismo material con necesidad en Nivel 1
    // y Nivel 2 a la vez, cada uno "cubría" con el mismo stock por separado).
    const calcularNivel = (
      necesidadRows: UnifiedRow[],
      necesidadPorMaterialOverride?: Map<string, number>,
      stockYaReservadoPorMaterial?: Map<string, number>
    ) => {
      const fechasUnicas = Array.from(new Set(necesidadRows.map(r => r.fecha).filter(f => f && f !== '—')));
      const fertRows: UnifiedRow[] = [];
      const provRows: UnifiedRow[] = [];
      fechasUnicas.forEach(fecha => {
        const fechaPareo = format(restarDiasHabiles(parseFechaLocal(fecha), 1), 'yyyy-MM-dd');
        // Anti doble-conteo: si la fecha de pareo cae en hoy o antes, esas horas de FERT ya las
        // cuenta "Pendientes" (fecha <= hoy) — se omiten aquí como horas (el Faltante igual las sigue
        // usando como cobertura, más abajo).
        const fert = fechaPareo > todayStr ? filasCentroEnFechaPareo(fertSinVentana, centroId, fechaPareo) : [];
        const prov = filasCentroEnFechaPareo(provSinVentana, centroId, fechaPareo);
        fertRows.push(...fert); provRows.push(...prov);
      });
      const { faltante, stockUsadoPorMaterial } = calcularFaltanteNecesidadPlanta(
        centroId, [...fertRows, ...provRows], necesidadRows, necesidadPorMaterialOverride, stockYaReservadoPorMaterial
      );
      return { fertRows, provRows, faltante, stockUsadoPorMaterial };
    };

    const nivel1 = calcularNivel(necesidadCapacidad);
    const nivel2 = calcularNivel(necesidadCapacidadNivel2, materialNecesidadPFFNivel2MapPorCentro[centroId], nivel1.stockUsadoPorMaterial);

    const faltanteNecesidad = [...nivel1.faltante, ...nivel2.faltante];
    const firmeNivel1y2 = [...nivel1.fertRows, ...nivel1.provRows, ...nivel2.fertRows, ...nivel2.provRows];

    const totalPlannedH = nivel3Fert.reduce((s, r) => s + r.tTotal, 0)
      + firmeNivel1y2.reduce((s, r) => s + r.tTotal, 0)
      + faltanteNecesidad.reduce((s, r) => s + r.tTotal, 0);
    // globalOccupancy ya no se muestra como cifra única (mezclaba horas de VARIOS días — pasado sin
    // límite + ~3 días futuros — contra la capacidad de UN SOLO día): cada tarjeta de fecha, más
    // abajo, sí compara 1 día de demanda contra 1 día de capacidad. Se conserva solo como criterio
    // interno para decidir cuándo mostrar el panel de rebalanceo "candidatos a diferir".
    const globalOccupancy = totalH > 0 ? (totalPlannedH / totalH) * 100 : 0;

    // REGLA: Desglose por proceso de corte — carruseles vs verticales, tomado de las RESTRICCIONES
    // del grupo Corte y Laminado de este centro (RespCtrlProd / RespCtrlProd_Verticales), no de
    // literales en el código. Antes estaban fijos aquí y ya se habían desincronizado del negocio: la
    // lista incluía 044 y 034, cuando la restricción real de verticales dice 039&036&029.
    const CARRUSEL_RESP = responsablesPorCentro[centroId].carruseles;
    const VERTICAL_RESP = responsablesPorCentro[centroId].verticales;
    const todasLasFilasCarga = [...nivel3Fert, ...firmeNivel1y2, ...faltanteNecesidad];

    // Horas que NO caen en ninguno de los dos procesos: su responsable no está en CARRUSEL_RESP ni en
    // VERTICAL_RESP. Dos orígenes reales: (a) responsable 034, permitido en Corte Espuma pero sin
    // proceso asignado; (b) filas de necesidad P2 cuyo material no tiene responsable mapeado en el
    // inventario, que llegan con responsable vacío. Se muestran aparte en el resumen compacto para
    // que el desglose cuadre y se puedan clasificar, en vez de disolverse en el total.
    const filasSinClasificar = todasLasFilasCarga.filter(r =>
      !CARRUSEL_RESP.includes(r.responsable) && !VERTICAL_RESP.includes(r.responsable)
    );
    const plannedSinClasificar = filasSinClasificar.reduce((s, r) => s + r.tTotal, 0);
    const respSinClasificar = Array.from(new Set(filasSinClasificar.filter(r => r.tTotal > 0).map(r => r.responsable || '(sin responsable)'))).sort();
    // Los materiales que más horas aportan sin clasificar — sin esto el aviso decía cuántas horas
    // sobraban pero no de dónde salían, y no había forma de rastrearlas desde la pantalla.
    const topSinClasificar = Array.from(
      filasSinClasificar.reduce((m, r) => {
        if (r.tTotal <= 0) return m;
        const k = `${r.material}|${r.responsable || 'sin resp.'}|${r.orden}`;
        return m.set(k, (m.get(k) || 0) + r.tTotal);
      }, new Map<string, number>())
    ).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([k, h]) => `${k.split('|')[0]} (${k.split('|')[2]}, resp ${k.split('|')[1]}): ${h.toFixed(1)}h`);

    // Rebalanceo de capacidad (punto b): si el centro está sobre-ocupado, candidatos a diferir son
    // materiales de Venta Externa con holgura real todavía — su "Próx. Entrega" (ver
    // calcularEntregasVentaExterna) no ha vencido, así que cortarlos un poco más tarde no incumple al
    // cliente y libera horas de hoy. Ordenados de más a menos holgura. Puramente informativo: no
    // mueve ninguna fecha por sí solo, el planificador decide qué diferir — mismo criterio de "mostrar
    // el dato, no decidir por la persona" que el resto del módulo.
    const candidatosDiferir = globalOccupancy > 100
      ? necesidadCapacidad
          .filter(r => r.proximaFechaEntrega && !r.atrasado)
          .map(r => ({ ...r, holguraDias: Math.round((new Date(r.proximaFechaEntrega!).getTime() - new Date(todayStr).getTime()) / 86400000) }))
          .filter(r => r.holguraDias > 0)
          .sort((a, b) => b.holguraDias - a.holguraDias)
      : [];
    const horasDiferibles = candidatosDiferir.reduce((s, r) => s + r.tTotal, 0);

    // Config de planta por proceso (Rendimiento %, Capacidad Total en horas, aviso de turnos sin
    // horario) — NO depende de qué fecha se esté mirando, es la misma sin importar la tarjeta
    // expandida, así que vive UNA sola vez aquí en vez de repetirse dentro de cada tarjeta (antes
    // vivía mezclada con Capacidad Planificada/Ocupación, que sí variaban por Nivel).
    const renderProcesoConfig = (proceso: ProcesoCorte) => {
      const esCarrusel = proceso === 'carrusel';
      const esCnc = proceso === 'cnc';
      const nEnGrupo = esCarrusel ? machinesCarrusel.length : esCnc ? machinesCnc.length : flexVertical;
      if (nEnGrupo === 0) return null;
      const label = esCarrusel ? 'Carruseles' : esCnc ? 'CNC' : 'Verticales';
      const colorClass = esCarrusel ? 'text-cyan-700' : esCnc ? 'text-amber-700' : 'text-fuchsia-700';
      const bgClass = esCarrusel ? 'bg-cyan-50/30 border-cyan-200' : esCnc ? 'bg-amber-50/30 border-amber-200' : 'bg-fuchsia-50/30 border-fuchsia-200';
      const cap = esCarrusel ? capacidadPorProceso.carrusel : esCnc ? capacidadPorProceso.cnc : capacidadVerticalUsada;
      const estimada = proceso === 'vertical' && verticalEsEstimada;
      const { lista: turnosFaltantesProceso, resumen: resumenTurnosProceso } = turnosSinConfigurarPorProceso(proceso);
      const nMaquinas = machines.filter(m => m.proceso === proceso && config.shifts[m.id]?.activa !== false).length;
      // Ocupación de ESTE proceso para la fecha (o fechas) elegidas en "Evaluar Capacidad" — filasSeleccion
      // se define más abajo en la función, pero como closure ya está lista para cuando esto se
      // renderiza (JSX se evalúa al final). Escala la capacidad igual que el resultado principal
      // (N fechas seleccionadas × capacidad de 1 día), para no comparar demanda de varios días
      // contra la capacidad de uno solo.
      //
      // CNC se separa por MÁQUINA real (esFilaCNC, código SAP HR-CTCNC), no por responsable — sus
      // responsables (044, 038) ya estaban dentro de CARRUSEL_RESP, así que Carruseles excluye
      // explícitamente las filas de CNC para no contarlas dos veces (caso real 30016933: el mismo
      // material puede cortarse en carrusel, vertical o CNC — cada orden real ya dice a cuál fue).
      const respProceso = esCarrusel ? CARRUSEL_RESP : VERTICAL_RESP;
      const ocupadoProceso = esCnc
        ? filasSeleccion.filter(x => esFilaCNC(x.row.maquina)).reduce((s, x) => s + x.row.tTotal, 0)
        : filasSeleccion.filter(x => respProceso.includes(x.row.responsable) && !esFilaCNC(x.row.maquina)).reduce((s, x) => s + x.row.tTotal, 0);

      // Mantenimiento real (mantenimientosSAP) para la fecha seleccionada — antes solo se mostraba
      // informativo en la tarjeta por máquina, ahora resta de la capacidad de este proceso
      // (confirmado por el usuario: debe afectar el tiempo de la máquina, según fecha).
      const fechaMtto = fechasSel[0];
      const mttoProceso = fechaMtto
        ? machines.filter(m => m.proceso === proceso).reduce((s, m) => s + getMttoTimeParaFecha(m.id, planta, fechaMtto), 0)
        : 0;
      const capSeleccionProceso = Math.max(0, cap * fechasSel.length - mttoProceso);
      const ocupacionPctProceso = capSeleccionProceso > 0 ? (ocupadoProceso / capSeleccionProceso) * 100 : null;

      return (
        <div
          key={proceso}
          className={cn("flex flex-wrap items-start gap-x-6 gap-y-3 p-4 border-t-2", bgClass)}
          style={{ flex: `${nEnGrupo} 1 0%` }}
        >
          <div className="shrink-0">
            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1.5", colorClass)}>{label}</p>
            {proceso === 'vertical' ? (
              <p className="text-[9px] font-bold text-slate-400 max-w-[8rem]">100% fijo, no aplica Rendimiento</p>
            ) : (
              <div className="flex items-center gap-1.5">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Rendim. (%)</p>
                  <input
                    type="number"
                    value={esCnc ? config.performanceCNC : config.performance}
                    onChange={e => {
                      const v = safeNum(e.target.value);
                      const patch = esCnc ? { performanceCNC: v } : { performance: v };
                      if (planta === 'UIO') setUioConfig({ ...uioConfig, ...patch });
                      else setGyeConfig({ ...gyeConfig, ...patch });
                    }}
                    className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-black text-emerald-600 outline-none focus:border-emerald-500"
                  />
                </div>
                {esCnc && (
                  <span className="inline-flex cursor-help shrink-0" title="Editable aparte de Carruseles: los tiempos de corte en CNC dependen más de estimados que del catálogo real.">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 min-w-[7rem]">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Capacidad Total (por día)</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-blue-700 tracking-tighter">{cap.toFixed(1)}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase">h</span>
              {/* Antes 3 líneas de texto siempre visibles (turno sin horario / estimado / mtto real)
                  — el usuario pidió reducir el ruido visual: mismos avisos, ahora como íconos con
                  tooltip en vez de párrafos que compiten por espacio. */}
              {turnosFaltantesProceso.length > 0 && (
                <span className="inline-flex cursor-help shrink-0" title={`Turnos sin horario: ${turnosFaltantesProceso.join(', ')} (${resumenTurnosProceso}). Sus horas no entran en la capacidad. Se fijan arriba.`}>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                </span>
              )}
              {mttoProceso > 0 && (
                <span className="inline-flex cursor-help shrink-0" title={`Mantenimiento real (SAP) para la fecha seleccionada: −${mttoProceso.toFixed(2)}h, ya descontado de esta capacidad.`}>
                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                </span>
              )}
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-0.5">{nMaquinas} máquina(s){estimada ? ' · estimado*' : ''}</p>
          </div>

          <div className="shrink-0 min-w-[7rem]">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Ocupación Total</p>
            {fechasSel.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400">Sin fecha seleccionada</p>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-xl font-black tracking-tighter", ocupacionPctProceso !== null && ocupacionPctProceso > 100 ? "text-red-600" : "text-emerald-700")}>{ocupadoProceso.toFixed(1)}</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">h</span>
                  {ocupacionPctProceso !== null && (
                    <span className={cn("text-[11px] font-black tabular-nums", ocupacionPctProceso > 100 ? "text-red-600" : "text-slate-500")}>({ocupacionPctProceso.toFixed(0)}%)</span>
                  )}
                </div>
                <p className="text-[8px] font-bold text-slate-400 mt-0.5">de {capSeleccionProceso.toFixed(1)}h · {label.toLowerCase()}</p>
              </>
            )}
          </div>
        </div>
      );
    };

    // Selector de fecha único — el eje visible de Capacidad Operativa. Para cada fecha X que el
    // usuario seleccione (manual, sin regla automática): primero se busca FERT real ejecutado ESE
    // día exacto; si no hay, se cae a la Necesidad activa de esa fecha (P1/PFF, P2 Venta Externa/
    // Muebles/Prensado) menos la cobertura Provisional (mismo material, fechaFin <= X, lote
    // completo). Confirmado con el usuario con ejemplos reales de SAP — no son categorías separadas,
    // es la MISMA pregunta ("¿cuánto tengo ocupado en X?") resuelta con la fuente que exista.
    const resolverFecha = (fecha: string): { row: UnifiedRow; estado: 'FERT' | 'Ya firme' | 'Faltante' }[] => {
      const fertX = filasCentroEnFecha(fertSinVentana, centroId, fecha, 'exacta');
      if (fertX.length > 0) return fertX.map(row => ({ row, estado: 'FERT' as const }));

      const necesidadX = [...necesidadCapacidad, ...necesidadCapacidadNivel2].filter(r => r.fecha === fecha);
      if (necesidadX.length === 0) return [];

      const provX = filasCentroEnFecha(provSinVentana, centroId, fecha, 'hasta');
      const materialesNecesidad = new Set(necesidadX.map(r => r.material));
      // necesidadPorMaterialCombinadoPorCentro: necesidadX mezcla filas de Nivel 1 Y Nivel 2 — sin el
      // pool combinado, calcularFaltanteNecesidadPlanta caía por defecto solo al de Nivel 1 y perdía
      // por completo la necesidad de un material que solo existiera en Nivel 2.
      const { faltante: faltanteX } = calcularFaltanteNecesidadPlanta(centroId, provX, necesidadX, necesidadPorMaterialCombinadoPorCentro[centroId]);
      return [
        ...provX.filter(r => materialesNecesidad.has(r.material)).map(row => ({ row, estado: 'Ya firme' as const })),
        ...faltanteX.map(row => ({ row, estado: 'Faltante' as const })),
      ];
    };

    // Backlog: todo lo pendiente (Ya firme/Faltante, es decir, SIN FERT que lo confirme ejecutado) de
    // cualquier fecha ANTERIOR a la seleccionada — decisión del usuario: lo que no se procesó un día
    // no desaparece ni se sigue midiendo contra la capacidad de ese día ya vencido, se suma a la carga
    // operativa del día que se está revisando ahora. Reutiliza resolverFecha (ya prioriza FERT-exacto
    // por fecha — si esa fecha pasada SÍ tiene FERT, no aporta nada al backlog, ya se ejecutó).
    //
    // Caso real verificado (2026-09-03): el backlog "por necesidad" solo mira fechas que TODAVÍA
    // tienen un PlanGrupo activo (necesidadCapacidad/Nivel2, ambos filtrados a estado='A') — pero la
    // necesidad P2/P1-PFF rota a diario, así que un plan de hace varios días ya está 'I' (superado
    // por el ciclo siguiente) aunque su orden FERT real siga con CANTPENDIENTE>0 sin ejecutar. Esa
    // orden quedaba invisible para Capacidad Operativa (verificado con datos reales: 22 de 183
    // materiales FERT con responsable permitido en Centro 1000 remontan a un plan P2/P3 ya inactivo).
    // Se agrega un segundo origen de backlog, directo desde las órdenes FERT reales (no desde
    // necesidad), para no perder tiempo de máquina genuinamente pendiente solo porque el plan que lo
    // originó ya rotó — con dedupe por orden+material para no contar dos veces lo que el camino de
    // necesidad ya capturó (cuando la fecha SÍ sigue teniendo necesidad activa).
    //
    // ACOTADO al día hábil INMEDIATO anterior (no "todo hacia atrás" sin límite): verificado con
    // datos reales que hay órdenes FERT con CANTPENDIENTE>0 que remontan semanas atrás — SAP no
    // siempre cierra el remanente aunque la orden ya esté resuelta en la práctica. Sumar eso sin tope
    // disparó la Ocupación Total a 200% en la primera versión de este fix. El backlog es "lo de ayer
    // que no se hizo", no un acumulado histórico completo.
    const calcularBacklogAntesDe = (fechaLimite: string) => {
      const fechasConNecesidad = Array.from(new Set(
        [...necesidadCapacidad, ...necesidadCapacidadNivel2].map(r => r.fecha)
      )).filter(f => f < fechaLimite);
      const backlogNecesidad = fechasConNecesidad.flatMap(f => resolverFecha(f).map(x => ({ ...x, fecha: f })));

      const diaHabilAnterior = format(restarDiasHabiles(parseFechaLocal(fechaLimite), 1), 'yyyy-MM-dd');
      const yaCapturado = new Set(backlogNecesidad.map(x => `${x.row.orden}|${x.row.material}`));
      const backlogFertReal = fertSinVentana
        .filter(r => r.centro === centroId && r.fecha === diaHabilAnterior && r.cant > 0 && !yaCapturado.has(`${r.orden}|${r.material}`))
        .map(row => ({ row, estado: 'FERT' as const, fecha: row.fecha }));

      return [...backlogNecesidad, ...backlogFertReal];
    };

    const fechasSel = Array.from(selectedDatesCapacidad[planta]).sort();
    const backlogSeleccion = fechasSel.length > 0 ? calcularBacklogAntesDe(fechasSel[0]) : [];
    const filasSeleccion = [...backlogSeleccion, ...fechasSel.flatMap(f => resolverFecha(f).map(x => ({ ...x, fecha: f })))];
    // Selector de UNA sola fecha a la vez (antes multi-select): elegir una fecha reemplaza la
    // anterior, no se acumulan — el usuario pidió simplificar, comparar varios días combinados en
    // un solo % confundía más de lo que ayudaba. Con esto, capacidadSeleccion (más abajo) queda
    // en automático capacidad × 1 sin tener que tocar esa fórmula.
    const toggleFechaCapacidad = (fecha: string) => setSelectedDatesCapacidad(prev => {
      const yaEstaba = prev[planta].has(fecha);
      const n = yaEstaba ? new Set<string>() : new Set([fecha]);
      return { ...prev, [planta]: n };
    });
    const limpiarFechasCapacidad = () => setSelectedDatesCapacidad(prev => ({ ...prev, [planta]: new Set<string>() }));

    return (
      <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden mb-10 text-left font-sans">
        {/* Turnos de la planta: control ÚNICO y siempre visible para fijar el horario de las N
            máquinas de una vez. Antes esto vivía escondido dentro del aviso "Turnos sin configurar",
            que solo aparecía si algo estaba vacío — quedaba muy contextual y obligaba a repetir la
            misma selección máquina por máquina el resto del tiempo. El aviso volvió a ser solo texto:
            un mismo comando no debe existir en dos lugares. Los selectores por máquina siguen abajo
            para las excepciones; este los pisa a propósito (es "toda la planta"). */}
        <div className="px-8 py-4 bg-slate-50/70 border-b border-gray-100">
          {/* Ubicación Técnica se fusionó en esta misma cabecera (antes tenía su propia barra
              lateral angosta y separada) — el usuario pidió reubicarla junto con el resto de la
              info que quedaba en esa barra, para no dejar una columna angosta sola. */}
          {/* Título a la izquierda, selector de fecha a la derecha en la MISMA fila — antes el
              selector quedaba apilado debajo del título, angosto y poco distinguible como control
              propio. Separado a la derecha queda claro que es un control aparte, no parte del
              título. */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-baseline gap-3">
              <h3 className="text-xl font-black tracking-tighter text-gray-800">{planta === 'UIO' ? 'QUITO' : 'GUAYAQUIL'}</h3>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gestión de Tiempos</p>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                  >
                    <Mail className="w-3.5 h-3.5" /> Enviar Reporte
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 space-y-3" align="end">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">Enviar reporte por correo</p>
                    <p className="text-[10px] text-slate-400 mt-1">Gestión de tiempos y ocupación por proceso — snapshot de {planta === 'UIO' ? 'Quito' : 'Guayaquil'} en este momento.</p>
                  </div>
                  <textarea
                    value={destinatariosReporte}
                    onChange={(e) => setDestinatariosReporte(e.target.value)}
                    placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
                    className="w-full h-20 text-[11px] border border-slate-200 rounded-lg p-2 outline-none focus:border-red-400"
                  />
                  <Button
                    onClick={() => handleEnviarReporteEspuma(planta)}
                    disabled={isSendingReporte[planta] || !destinatariosReporte.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest h-9"
                  >
                    {isSendingReporte[planta] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar
                  </Button>
                </PopoverContent>
              </Popover>
              <div title="Elige una fecha para ver la ocupación de Capacidad Operativa: FERT real si ya existe, o el plan (Necesidad) todavía sin ejecutar si no. Elegir otra fecha reemplaza la anterior.">
                <DateFilterPopover
                  label="Evaluar Capacidad"
                  selectedDates={selectedDatesCapacidad[planta]}
                  onToggleDate={toggleFechaCapacidad}
                  onClear={limpiarFechasCapacidad}
                  viewDate={viewDateCapacidad}
                  setViewDate={setViewDateCapacidad}
                  datesWithOrders={selectedDatesCapacidad[planta]}
                  isDateDisabled={() => false}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Turnos Día/Noche/Sábado + Paro: antes en una sola fila horizontal -- con 3 turnos ya no
            entraba bien, se veía apretado y confuso (el usuario lo marcó tras agregar Sábado).
            Apilados verticalmente, uno por línea, misma info. */}
        <div className="px-8 py-3 bg-white border-b border-gray-100 flex flex-col gap-1.5">
          {([
            { campo: 'day' as const, etiqueta: 'Día', opciones: shiftOptions, paro: 'paro1' as const, color: 'text-indigo-700' },
            { campo: 'night' as const, etiqueta: 'Noche', opciones: nightShiftOptions, paro: 'paro2' as const, color: 'text-purple-700' },
            { campo: 'saturday' as const, etiqueta: 'Sábado', opciones: shiftOptions, paro: 'paro3' as const, color: 'text-amber-700' },
          ]).map(t => {
            // Valor común si todas las máquinas comparten horario; si difieren, queda "Mixto" para
            // no mentir sobre el estado real (y ahí el detalle se ve en cada columna).
            const valores = new Set(machines.map(m => config.shifts[m.id]?.[t.campo]));
            const comun = valores.size === 1 ? [...valores][0] : '';
            // Disponibilidad neta del turno para UNA máquina, con su paro y el rendimiento de la
            // planta — mismo criterio con el que se calcula la capacidad total.
            const horasBase = t.opciones.find(o => o.v === comun)?.h || 0;
            const paroComun = machines[0] ? config.shifts[machines[0].id]?.[t.paro] ?? 0 : 0;
            const netas = horasBase * (1 - paroComun / 100) * (config.performance / 100);
            return (
              <div key={t.campo} className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-500 uppercase w-14">{t.etiqueta}</span>
                <select
                  value={comun}
                  onChange={(e) => aplicarTurnoAPlanta(planta, t.campo, e.target.value)}
                  className={cn("bg-white border border-slate-200 rounded-md px-2 py-1 text-[10px] font-black outline-none appearance-none cursor-pointer w-[160px]", t.color)}
                  title={`Aplica este horario a las ${machines.length} máquinas de ${planta}. Después puedes ajustar una máquina puntual en su propia columna, o apagarla si no hay demanda.`}
                >
                  {comun === '' && <option value="">— Mixto —</option>}
                  {t.opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                {/* Muestra la hora CRUDA del turno (antes mostraba "netas" — ya con paro y
                    rendimiento aplicados — al lado del "13% Paros", lo que parecía un descuento
                    duplicado). El neto real por máquina sigue disponible en el tooltip y en
                    "Capacidad Total (por día)" de cada panel, más abajo. */}
                <span className={cn("text-[10px] font-black whitespace-nowrap tabular-nums w-10", t.color)} title={`Disponibilidad neta por CARRUSEL: ${horasBase}h − paro ${paroComun}% − rendimiento ${config.performance}% = ${netas.toFixed(2)}h`}>
                  {horasBase}h
                </span>
              </div>
            );
          })}
        </div>
        {/* Columnas de máquina agrupadas por proceso, con una barra de cabecera coloreada (mismo
            cyan/fuchsia que los resúmenes de abajo) para que se vea de un vistazo qué columnas
            alimenta cada proceso — antes las N máquinas corrían en una sola fila sin ninguna marca
            que las separara. */}
        <div className="flex">
          {machinesCarrusel.length > 0 && (
            <div className="flex items-center justify-center py-1.5 border-b-2 border-cyan-300 bg-cyan-50/50" style={{ flex: `${machinesCarrusel.length} 1 0%` }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-700">Carruseles ({machinesCarrusel.length})</span>
            </div>
          )}
          {machinesCnc.length > 0 && (
            <div className="flex items-center justify-center py-1.5 border-b-2 border-amber-300 bg-amber-50/50" style={{ flex: `${machinesCnc.length} 1 0%` }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">CNC ({machinesCnc.length})</span>
            </div>
          )}
          {machinesVertical.length > 0 && (
            <div className="flex items-center justify-center py-1.5 border-b-2 border-fuchsia-300 bg-fuchsia-50/50" style={{ flex: `${flexVertical} 1 0%` }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-700">Verticales ({machinesVertical.length})</span>
            </div>
          )}
        </div>
        <div className="flex">
          {machinesCarrusel.length > 0 && (
            <div className="grid" style={{ flex: `${machinesCarrusel.length} 1 0%`, gridTemplateColumns: `repeat(${machinesCarrusel.length}, minmax(0, 1fr))` }}>
              {machinesCarrusel.map(m => renderMachineCol(m.id, m.n, planta))}
            </div>
          )}
          {machinesCnc.length > 0 && (
            <div className="grid border-l-2 border-amber-200" style={{ flex: `${machinesCnc.length} 1 0%`, gridTemplateColumns: `repeat(${machinesCnc.length}, minmax(0, 1fr))` }}>
              {machinesCnc.map(m => renderMachineCol(m.id, m.n, planta))}
            </div>
          )}
          {machinesVertical.length > 0 && (
            <div className="grid border-l-2 border-fuchsia-200" style={{ flex: `${flexVertical} 1 0%`, gridTemplateColumns: `repeat(${machinesVertical.length}, minmax(0, 1fr))` }}>
              {machinesVertical.map(m => renderMachineCol(m.id, m.n, planta))}
            </div>
          )}
        </div>
        {/* Config de planta por proceso (Rendimiento/Capacidad Total/turnos) — ver renderProcesoConfig
            arriba. Ya NO incluye Capacidad Planificada/Ocupación: eso ahora vive por tarjeta de
            fecha, más abajo, porque sí varía según qué día se esté mirando. */}
        <div className="flex">
          {renderProcesoConfig('carrusel')}
          {renderProcesoConfig('cnc')}
          {renderProcesoConfig('vertical')}
        </div>

        {/* Resumen compacto de ancho completo: total de horas de TODAS las tarjetas juntas (ya no
            un solo % — mezclar días distintos contra la capacidad de uno solo dejó de mostrarse, ver
            comentario en globalOccupancy más arriba) y las horas "sin clasificar" (responsable
            permitido en Corte Espuma pero sin proceso carrusel/vertical asignado). */}
        {plannedSinClasificar > 0.05 && (
          <div className="px-8 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
            <div
              className="flex items-center gap-2"
              title={`Horas cuya carga no pertenece a Carruseles ni a Verticales porque su responsable no está asignado a ningún proceso: ${respSinClasificar.join(', ')}. Se calcula sobre el total automático de fondo (usado también por "candidatos a diferir"), no sobre la fecha que tengas seleccionada arriba.\n\nMayores aportes:\n${topSinClasificar.join('\n')}`}
            >
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-wide cursor-help">Sin clasif. (fondo)</span>
              <span className="text-[11px] font-black tabular-nums text-amber-700">{plannedSinClasificar.toFixed(1)}h</span>
              <span className="text-[8px] font-bold text-slate-400">resp. {respSinClasificar.join(', ')}</span>
            </div>
          </div>
        )}

        {candidatosDiferir.length > 0 && (
          <div className="border-t border-gray-100 bg-amber-50/40 p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-600" /> {planta} sobre-ocupado ({globalOccupancy.toFixed(0)}%) — candidatos a diferir
              </h4>
              <span className="text-[9px] font-black uppercase text-amber-700">{horasDiferibles.toFixed(1)}h diferibles sin incumplir entrega</span>
            </div>
            <p className="text-[9px] text-amber-700/80 mb-3">
              Estos materiales de Venta Externa todavía tienen holgura frente a su entrega real (no están atrasados) — moverlos a un día posterior no incumple al cliente y libera horas de hoy. No se mueve nada automáticamente.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="text-[8px] font-black uppercase text-amber-600/70 border-b border-amber-200/60">
                  <tr>
                    <th className="py-1.5 pr-4">Material</th>
                    <th className="py-1.5 pr-4">Descripción</th>
                    <th className="py-1.5 pr-4 text-right">Horas</th>
                    <th className="py-1.5 pr-4 text-right">Próx. Entrega</th>
                    <th className="py-1.5 pr-4 text-right">Holgura</th>
                    <th className="py-1.5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60 font-mono">
                  {candidatosDiferir.slice(0, 8).map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 pr-4 font-black text-amber-900">{r.material}</td>
                      <td className="py-1.5 pr-4 font-sans normal-case text-amber-800/80 truncate max-w-[240px]">{r.descripcion}</td>
                      <td className="py-1.5 pr-4 text-right font-black text-amber-900">{r.tTotal.toFixed(2)}h</td>
                      <td className="py-1.5 pr-4 text-right text-amber-700">{r.proximaFechaEntrega}</td>
                      <td className="py-1.5 pr-4 text-right font-black text-emerald-700">+{r.holguraDias}d</td>
                      <td className="py-1.5 text-right">
                        <button
                          className="font-sans normal-case text-[9px] font-black uppercase text-amber-700 hover:text-amber-900 underline decoration-dotted"
                          title="Abre Plan P2 - Venta Externa con la fecha sugerida (mañana) ya preseleccionada en Ventana de Producción. No cambia nada aquí — la decisión final y la regeneración las haces en Venta Externa."
                          onClick={() => {
                            const fechaSugerida = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');
                            router.push(`/dashboard/opciones/tactica-venta-externa?tab=p2&fecha=${fechaSugerida}&material=${r.material}`);
                          }}
                        >
                          Diferir →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {candidatosDiferir.length > 8 && (
                <p className="text-[8px] text-amber-600/70 uppercase font-bold mt-2">y {candidatosDiferir.length - 8} material(es) más con holgura…</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // showOrigen: la columna "Grupo / Área Origen" solo tiene sentido en Provisionales — cruza contra
  // "Necesidades Planta" (P2, demanda pendiente). En FERT las órdenes ya son "P3" aprobadas y
  // ejecutadas, así que ese cruce no aplica; ahí solo se usan para sumar horas de ocupación.
  // ordenLabel/origenLabel: en las tablas de capacidad de "Necesidades Planta" la fila NO es una
  // orden real sino un PlanGrupo P2 (ver necesidadCapacidadMapper), así que ahí se renombran a
  // "Código Plan Grupo"/"Grupo Origen" para no confundir con Provisionales/FERT (orden real).
  // hideOrigenPlanGrupo: en esas mismas tablas de capacidad el Plan Grupo ya se muestra en la
  // columna "Código Plan Grupo", así que el subtexto de origen no lo repite (sí lo repite en
  // Provisionales, donde "Orden" es el número real y el Plan Grupo solo aparece ahí).
  // showEntregaVentaExterna: agrega "Próx. Entrega"/"Holgura" (ver materialPendientesPorCentro) —
  // solo tiene datos para filas de Venta Externa (Colchones/Muebles/Prensado no venden espuma como
  // producto terminado directo), así que solo se activa en las tablas de capacidad de Necesidades
  // Planta, donde conviven varias áreas en la misma tabla.
  const renderAuditTable = (
    data: UnifiedRow[],
    title: string,
    showOrigen: boolean,
    ordenLabel: string = 'Orden',
    origenLabel: string = 'Grupo / Área Origen',
    hideOrigenPlanGrupo: boolean = false,
    showEntregaVentaExterna: boolean = false
  ) => {
    // Ensamblado (P1/PFF): `row.fecha`/`row.fechaFin` guardan la fecha REAL del PT (ej. 21/08) — ese
    // valor sigue siendo el que usan el pareo Nivel 1 de Capacidad Operativa, el matching contra
    // FERT/Provisional y la Respuesta P3, sin cambios. Lo único que cambia acá es lo que se VE en
    // esta tabla: para esas filas se muestra la fecha en que la LÁMINA debe estar lista (1 día hábil
    // antes del PT), que es el dato que el planificador realmente necesita mirar en "Necesidades
    // Planta" — confirmado con el usuario, sin tocar el dato interno.
    const fechaMostrada = (row: UnifiedRow, campo: 'fecha' | 'fechaFin') => {
      const valor = row[campo];
      // La clave real es 'Ensamblado (P1/PFF)' (ver necesidadesPlantaConPFF) para Nivel 1; Nivel 2
      // (Capacidad Operativa, ver necesidadPFFNivel2Consolidada) usa 'Ensamblado' a secas — startsWith
      // cubre ambas sin depender de que coincidan carácter por carácter.
      if (!row.origenArea?.startsWith('Ensamblado') || !valor || valor === '—') return valor;
      return format(restarDiasHabiles(parseFechaLocal(valor), 1), 'yyyy-MM-dd');
    };
    const grouped = data.reduce((acc, row) => {
      const key = `${row.apertura}|${row.categoria}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {} as Record<string, UnifiedRow[]>);

    // Totales del bloque completo, visibles ANTES de abrir ninguna agrupación. Sin esto, para saber
    // cuántas horas representa un tab había que expandir cada apertura y sumar a mano los subtotales
    // — y no había forma de comparar de un vistazo las horas de las órdenes FERT contra las que pide
    // la necesidad P2. Mismo renderizador para Provisionales, FERT y Necesidades Planta, así que las
    // tres quedan comparables con la misma métrica.
    // Todas las filas de un bloque son del mismo centro (cada tab pinta un bloque por centro), así
    // que la etiqueta de la columna de corte vertical se resuelve con el centro de la primera fila.
    const centroBloque = (data[0]?.centro === '2000' ? '2000' : '1000') as '1000' | '2000';
    const verticalesBloque = {
      lista: responsablesPorCentro[centroBloque].verticales,
      origen: responsablesPorCentro[centroBloque].origen.verticales,
    };

    const totales = data.reduce((acc, r) => ({
      cant: acc.cant + r.cant,
      peso: acc.peso + r.peso,
      horas: acc.horas + r.tTotal,
      cargas: acc.cargas + r.nroCargas,
    }), { cant: 0, peso: 0, horas: 0, cargas: 0 });

    return (
      <div className="space-y-4 text-left">
        <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-600" /> {title} ({data.length})</h3>
        {data.length > 0 && (
          <div className="flex items-center gap-6 flex-wrap rounded-xl border border-slate-100 bg-slate-50/60 px-5 py-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total del bloque</span>
            {([
              { l: 'Cantidad', v: formatNum(totales.cant, 0), color: 'text-slate-800' },
              { l: 'Peso (Kg)', v: formatNum(totales.peso, 0), color: 'text-slate-800' },
              { l: 'T. Total (h)', v: totales.horas.toFixed(2), color: 'text-blue-700' },
              { l: 'Cargas', v: formatNum(totales.cargas, 0), color: 'text-amber-700' },
            ]).map(m => (
              <div key={m.l} className="flex items-baseline gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{m.l}</span>
                <span className={cn("text-sm font-black tabular-nums", m.color)}>{m.v}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-center border-collapse text-[10px]">
              <thead className="bg-gray-50 sticky top-0 z-20 text-[9px] font-bold uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-4 border-r border-gray-100 text-left w-32">Material</th>
                  <th className="px-6 py-4 border-r border-gray-100 text-left min-w-[200px]">Descripción</th>
                  <th className="px-2 py-4 border-r border-gray-100">Ancho</th>
                  <th className="px-2 py-4 border-r border-gray-100">Largo</th>
                  <th className="px-2 py-4 border-r border-gray-100 text-blue-600">Esp.</th>
                  <th className="px-2 py-4 border-r border-gray-100">Dens.</th>
                  <th className="px-3 py-4 border-r border-gray-100 font-black bg-yellow-50/50 text-yellow-700">Cant.</th>
                  <th className="px-3 py-4 border-r border-gray-100">Peso Kg</th>
                  <th className="px-3 py-4 border-r border-gray-100 bg-gray-100/70">Alt. Total</th>
                  <th className="px-3 py-4 border-r border-gray-100 bg-indigo-50/50 text-indigo-700">T. Indiv</th>
                  <th className="px-4 py-4 border-r border-gray-100 bg-indigo-50 text-indigo-700 font-black">T. Total H</th>
                  <th className="px-3 py-4 border-r border-gray-100 bg-amber-50/50 text-amber-700 font-black">Cargas</th>
                  <th className="px-3 py-4 border-r border-gray-100">Und/Batch</th>
                  <th className="px-3 py-4 border-r border-gray-100 font-black text-indigo-600"># SUB_Bloque</th>
                  {/* Etiqueta dinámica: los responsables salen de la restricción
                      RespCtrlProd_Verticales del grupo Corte y Laminado de ESTE centro, no de un
                      literal. Antes decía "(39-36-44)" fijo, que ya no coincidía con la restricción
                      real (039&036&029) — cambiarla en Configuraciones no movía nada aquí. */}
                  <th
                    className="px-3 py-4 border-r border-gray-100 bg-gray-100/50 uppercase"
                    title={`Responsables de corte VERTICAL del Centro ${centroBloque}, según la restricción ${NOMBRE_RESTRICCION_RESP_VERTICALES} del grupo Corte y Laminado${verticalesBloque.origen === 'respaldo' ? ' (restricción no encontrada: se está usando el respaldo del código)' : ''}.`}
                  >
                    Corte Vertical ({verticalesBloque.lista.length > 0 ? verticalesBloque.lista.join('-') : 'sin definir'})
                  </th>
                  <th className="px-3 py-4 border-r border-gray-100 uppercase">Planta/ALM</th>
                  <th className="px-3 py-4 border-r border-gray-100">Resp CP</th>
                  <th className="px-3 py-4 border-r border-gray-100">{ordenLabel}</th>
                  <th className={cn("px-3 py-4 uppercase", (showOrigen || showEntregaVentaExterna) ? "border-r border-gray-100" : "")}>Fecha</th>
                  {showOrigen && <th className={cn("px-3 py-4 uppercase text-left bg-gray-100/50", showEntregaVentaExterna ? "border-r border-gray-100" : "")}>{origenLabel}</th>}
                  {showEntregaVentaExterna && (
                    <>
                      <th className="px-3 py-4 uppercase border-r border-gray-100 bg-orange-50/50 text-orange-700">Próx. Entrega (VE)</th>
                      <th className="px-3 py-4 uppercase bg-orange-50/50 text-orange-700">Holgura</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                {Object.entries(grouped).map(([key, items]) => {
                  const isExp = expandedGroups.has(key);
                  const tKg = items.reduce((s, r) => s + r.peso, 0);
                  const tCant = items.reduce((s, r) => s + r.cant, 0);
                  const tH = items.reduce((s, r) => s + r.tTotal, 0);
                  const tBatches = items.reduce((s, r) => s + r.nroCargas, 0);
                  return (
                    <React.Fragment key={key}>
                      <tr className="bg-slate-50 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => {const n = new Set(expandedGroups); if (isExp) { n.delete(key); } else { n.add(key); } setExpandedGroups(n);}}>
                        <td className="px-4 py-3 text-left flex items-center gap-2 font-black text-indigo-900 border-r border-gray-100">
                           {isExp ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                           {key.split('|')[0]} — {key.split('|')[1]}
                        </td>
                        <td colSpan={4} className="text-right pr-6 italic opacity-30 uppercase font-black tracking-widest text-[9px]">Subtotales de Bloque:</td>
                        <td className="border-r border-slate-50"></td>
                        <td className="px-3 py-3 font-black text-slate-900 bg-yellow-50 text-center text-[12px]">{formatNum(tCant, 0)}</td>
                        <td className="px-3 py-3 font-black text-slate-400 opacity-40">{formatNum(tKg, 0)}</td>
                        <td colSpan={2}></td>
                        <td className="px-4 py-3 bg-indigo-50 text-indigo-700 font-black">{tH.toFixed(2)}h</td>
                        <td className="px-3 py-3 bg-amber-50 text-amber-700 font-black">{tBatches}</td>
                        <td colSpan={7 + (showOrigen ? 1 : 0) + (showEntregaVentaExterna ? 2 : 0)}></td>
                      </tr>
                      {isExp && items.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors font-mono text-[9px]">
                          <td className="px-4 py-2 border-r border-slate-50 text-indigo-600 font-black pl-8 text-left">{row.material}</td>
                          <td className="px-6 py-2 border-r border-slate-50 text-left uppercase truncate max-w-[200px]">{row.descripcion}</td>
                          <td className="px-2 py-2 border-r border-slate-50">{row.ancho}</td>
                          <td className="px-2 py-2 border-r border-slate-50">{row.largo}</td>
                          <td className="px-2 py-2 border-r border-slate-50 text-blue-600 font-black">{row.esp}</td>
                          <td className="px-2 py-2 border-r border-slate-50">{row.dens}</td>
                          <td className="px-3 py-2 border-r border-slate-50 text-slate-900 font-black bg-yellow-50">{row.cant}</td>
                          <td className="px-3 py-2 border-r border-slate-50 text-slate-600">{formatNum(row.peso, 1)}</td>
                          <td className="px-3 py-2 border-r border-slate-50 bg-gray-50 text-slate-900 font-black">{row.alturaTotal.toFixed(1)}</td>

                          {/* COLUMNA T. INDIV — gris "SIN DATO" si el material no tiene geometría
                              parseable (ver sinGeometria en calcularMetricasCapacidad: sin ancho/
                              largo/esp/densidad no hay base para estimar, no se fuerza el fallback
                              global); rojo si SÍ tiene geometría válida pero no hubo ningún vecino
                              real con qué estimar (ver estimarTiempoIndivPorVecino); ámbar/naranja
                              según qué tan buena fue la evidencia usada para estimar (3a mejor, 3c
                              más débil) */}
                          <td className={cn(
                            "px-3 py-2 border-r border-slate-50",
                            row.sinGeometria ? "bg-gray-100 text-gray-400 italic"
                              : row.tIndiv === 0 ? "bg-red-500 text-white animate-pulse font-black"
                              : row.tIndivEstimadoNivel === '3c' ? "bg-orange-50 text-orange-700 font-black"
                              : row.tIndivEstimado ? "bg-amber-50 text-amber-700 font-black" : "text-indigo-400"
                          )}>
                            {row.sinGeometria ? (
                              <span className="text-[8px] font-black uppercase tracking-wider">Sin dato</span>
                            ) : (
                              <>
                                {row.tIndiv.toFixed(2)}
                                {row.tIndiv === 0 && <span className="block text-[6px]">⚠️ REVISAR</span>}
                                {row.tIndivEstimado && row.tIndiv > 0 && (
                                  <span className="block text-[6px]">
                                    ≈ EST. {row.tIndivEstimadoNivel === '3a' ? '(familia)' : row.tIndivEstimadoNivel === '3b' ? '(densidad)' : '(general)'}
                                  </span>
                                )}
                              </>
                            )}
                          </td>

                          <td className="px-4 py-2 border-r border-gray-100 bg-indigo-50 text-indigo-800 font-black">
                            {row.sinGeometria ? <span className="text-[8px] uppercase tracking-wider text-gray-400 italic font-normal">Sin dato</span> : row.tTotal.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-50 bg-amber-50 text-amber-700 font-black">{row.nroCargas}</td>
                          <td className="px-3 py-2 border-r border-slate-50 font-black">{Math.round(row.undBatch)}</td>
                          <td className="px-3 py-2 border-r border-slate-50 font-black text-indigo-900">{row.subBloques.toFixed(3)}</td>
                          <td className="px-3 py-2 border-r border-slate-50 font-black text-slate-500 bg-gray-50">
                             {row.isAlterna ? <Badge variant="outline" className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 text-[7px] px-1 font-black">VERTICAL</Badge> : '—'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-50 text-slate-600 font-black">{row.centro}/{row.almacen}</td>
                          <td className="px-3 py-2 border-r border-slate-50">{row.responsable}</td>
                          <td className="px-3 py-2 border-r border-slate-50 text-slate-600">{row.orden}</td>
                          <td
                            className={cn("px-3 py-2 text-slate-600 font-bold", (showOrigen || showEntregaVentaExterna) ? "border-r border-slate-50" : "")}
                            title={
                              row.origenArea?.startsWith('Ensamblado')
                                ? `Fecha de lámina lista (1 día hábil antes del PT). Fecha real de producción del PT: ${row.fecha}.`
                                : (row.fechaFin && row.fechaFin !== row.fecha
                                    ? `Rango real de la orden: ${row.fecha} → ${row.fechaFin}. Se muestra FECHAFIN — es la fecha con la que se determina a qué necesidad corresponde (ver Grupo/Área Origen), no el rango completo.`
                                    : undefined)
                            }
                          >
                            {/* Un solo formato de visualización, siempre — antes mostraba rango (inicio →
                                fin) cuando FECHAINICIO≠FECHAFIN y una sola fecha cuando coincidían,
                                inconsistente entre filas. FECHAFIN ya es el dato autoritativo (con qué
                                fecha SAP "traduce" la orden — ver origenEnRango más arriba), así que es
                                también el único que se muestra acá; el rango completo queda en el tooltip
                                para quien lo necesite. */}
                            {fechaMostrada(row, 'fechaFin') || fechaMostrada(row, 'fecha')}
                          </td>
                          {showOrigen && (
                            <td className={cn("px-3 py-2 text-left", showEntregaVentaExterna ? "border-r border-slate-50" : "")}>
                              {row.origenArea ? (
                                <div className="flex flex-col items-start">
                                  <span className="font-black text-slate-700 uppercase">{row.origenArea}</span>
                                  <span className="text-[8px] text-slate-400">
                                    Grupo #{row.origenCodigoGrupo}{!hideOrigenPlanGrupo && ` · Plan Grupo #${row.origenCodigoPlanGrupo}`}
                                  </span>
                                  {row.origenAmbiguo && (
                                    <span className="text-[7px] text-amber-500 font-black uppercase mt-0.5" title="Ninguna necesidad candidata de este material tiene un rango de fecha que incluya el Fin Extr. (FECHAFIN) de esta orden — se muestra la más probable, sin confirmar.">
                                      ⚠ {row.origenCandidatosCount} necesidad{row.origenCandidatosCount === 1 ? '' : 'es'}, fecha fuera de rango
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-red-400 italic font-black text-[9px] uppercase">Sin necesidad detectada</span>
                              )}
                            </td>
                          )}
                          {showEntregaVentaExterna && (
                            <>
                              <td className="px-3 py-2 border-r border-slate-50 text-slate-500">
                                {row.proximaFechaEntrega || '—'}
                              </td>
                              <td className="px-3 py-2">
                                {row.atrasado ? (
                                  <Badge className="bg-red-50 text-red-700 border-red-200 text-[7px] px-1 font-black animate-pulse">ATRASADO</Badge>
                                ) : row.proximaFechaEntrega ? (
                                  <span className="font-black text-slate-600">
                                    {Math.round((new Date(row.proximaFechaEntrega).getTime() - new Date(todayStr).getTime()) / 86400000)}d
                                  </span>
                                ) : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const headerStyles = "p-4 md:p-6 space-y-6 bg-white min-h-screen rounded-xl border border-gray-100 shadow-sm font-sans text-left";

  if (!mounted) return <div className={headerStyles} />;

  return (
    <div className={headerStyles}>
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3 text-left">
          <div className="p-2 bg-red-600/10 rounded-xl shadow-inner"><Scissors className="w-6 h-6 text-red-600" /></div>
          <div><h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Programación Táctica Corte Espuma</h2><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Capacidad Carrusel 3.2m | Auditoría Técnica SAP</p></div>
        </div>
        <div className="flex items-center gap-3">
           {/* "Sincronizar y Generar Necesidades": un solo botón — trae datos crudos de SAP y, al
               terminar, calcula la Necesidad P1/PFF automáticamente (antes 2 clics separados, ver
               [[modulos_tacticos_sincronizar_y_generar_combinado]]). "Entregas VE" y "Actualizar P2"
               (dentro del tab Necesidades Planta) siguen aparte: son acciones independientes, no un
               segundo paso del mismo cálculo. "Generar Respuestas" (escribe Plan Grupo/Detalle
               Táctico real) sigue sólido/primario, para que el peso visual marque qué botón
               compromete datos reales. */}
           <Button onClick={handleSincronizarYGenerar} disabled={syncStep !== 'idle'} variant={datosCargados ? 'outline' : 'default'} className={cn(
             "rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
             datosCargados
               ? "border-blue-200 text-blue-700 hover:bg-blue-50"
               : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
           )}>{syncStep !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar y Generar Necesidades</Button>
        </div>
      </div>

      {/* Barra de progreso SOLO de la fase "sincronizando" (traer datos crudos de SAP, sin indicador
          propio). La fase "generando" ya tiene su propia barra dentro del tab Necesidades Planta
          (isCalculandoPFF/pffProgress, ver más abajo) — mostrar esta también ahí duplicaba el aviso
          (mismo problema reportado por el usuario con una captura real en Corte y Laminado). */}
      {syncStep === 'sincronizando' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2.5">
          <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-1/2 transition-all duration-700 ease-out" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 shrink-0 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando SAP...
          </span>
        </div>
      )}

      {/* Estado vacío inicial: al abrir el módulo no se consulta nada (carga manual), así que sin
          este aviso las tablas se verían en blanco sin explicación. Es SOLO un aviso — el botón
          "Sincronizar y Generar Necesidades" del encabezado es la única acción de carga general
          (antes había aquí un "Sincronizar ahora" que llamaba a la misma función: dos botones para
          lo mismo). */}
      {!datosCargados && !isLoading && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-2.5 text-left"
          title="Este módulo no consulta SAP al abrirse. Sincronizar y Generar Necesidades trae Provisionales, FERT, Inventario, Tiempos, Mantenimiento y el P2, y calcula la Necesidad P1/PFF automáticamente. Actualizar P2 (Venta Externa) y Entregas VE, dentro de Necesidades Planta, siguen aparte."
        >
          <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Sin datos cargados — pulsa <span className="font-black text-blue-700">Sincronizar y Generar Necesidades</span> para traerlos.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 h-11 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200 mb-8">
          {[ { v: 'resumen', l: 'Capacidad Operativa', i: LayoutDashboard }, { v: 'necesidadesPlanta', l: 'Necesidades Planta', i: Database }, { v: 'respuestaP3', l: 'Respuesta P3', i: Save }, { v: 'ordenes', l: 'Provisionales', i: Package }, { v: 'ordenesFert', l: 'Órdenes FERT', i: ShoppingCart }, { v: 'mantenimiento', l: 'Mantenimiento SAP', i: Wrench } ].map(tab => (
            <TabsTrigger key={tab.v} value={tab.v} className="gap-2 text-[10px] font-black uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-red-600 rounded-xl"><tab.i className="w-4 h-4" /> {tab.l}</TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-6">
          <TabsContent value="resumen" className="animate-in fade-in duration-300">{renderDashboard('UIO')}{renderDashboard('GYE')}</TabsContent>
          <TabsContent value="necesidadesPlanta" className="animate-in fade-in duration-300 space-y-6 text-left">
            <div className="flex items-center justify-end gap-2 flex-wrap">
              {/* "Generar Necesidades · P1/PFF" ya no es un botón aparte — se combinó en "Sincronizar y
                  Generar Necesidades" del encabezado (ver handleSincronizarYGenerar). La etiqueta del
                  progreso (Explotando BOM N/M) sigue mostrándose más abajo mientras isCalculandoPFF
                  esté activo, sin importar si lo disparó el botón combinado o (todavía posible)
                  cualquier otro llamado a calcularNecesidadPFF. */}
              <Button
                onClick={calcularEntregasVentaExterna}
                disabled={isCalculandoEntregas || !pendientesCargados}
                variant="outline"
                className="rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                title={!pendientesCargados ? 'Cargando Pendientes Totales…' : 'Explota el BOM de los pedidos pendientes de Venta Externa (sector Espumas, sin FERT, próximos 4 días hábiles) para calcular atraso/próxima entrega por lámina'}
              >
                {isCalculandoEntregas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                {isCalculandoEntregas ? `Explotando BOM ${entregasProgress.current}/${entregasProgress.total}` : 'Generar Necesidades · Entregas VE'}
              </Button>
              <Button
                onClick={() => fetchNecesidadesPlanta()}
                disabled={necesidadesPlantaLoading}
                variant="outline"
                className="rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                title="Relee el P2 que Venta Externa ya generó (no crea uno nuevo aquí). Espumas: toma el plan activo más reciente. Muebles/Prensado: exige coincidencia exacta con hoy+1 día hábil."
              >
                {necesidadesPlantaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualizar P2 (Venta Externa)
              </Button>
            </div>
            {isCalculandoPFF && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {(() => {
                    // Mismo criterio que tenía el botón "Generar Necesidades" que este paso reemplazó:
                    // refleja el ÚLTIMO tipo de plan de Ensamblado leído por centro (P1 activo aún sin
                    // liberar, o PFF ya liberado — solo uno de los dos vive a la vez por centro).
                    const tipos = new Set([tipoPlanEnsambladoPorCentro['1000'], tipoPlanEnsambladoPorCentro['2000']].filter(Boolean));
                    const etiqueta = tipos.size === 1 ? [...tipos][0] : 'P1/PFF';
                    return `Generando Necesidad · ${etiqueta}: ${pffProgress.current} / ${pffProgress.total}`;
                  })()}
                </p>
                <Progress value={pffProgress.total > 0 ? (pffProgress.current / pffProgress.total) * 100 : 0} className="h-2" />
              </div>
            )}
            {!isCalculandoPFF && (pffDiagnostico.sinMatch.length > 0 || pffDiagnostico.conError.length > 0) && (
              <div className="space-y-1.5 bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2">
                {pffDiagnostico.sinMatch.length > 0 && (
                  <p className="text-[9px] text-amber-800">
                    <span className="font-black uppercase tracking-wider">{pffDiagnostico.sinMatch.length} material(es) PFF sin lámina cortada en su BOM</span> — se consultó su explosión pero ninguna fila coincidió con &quot;LAMINA D&quot;/&quot;LAMINA RECUPERADA&quot;/&quot;LAMINA BABY D&quot;: <span className="font-mono">{pffDiagnostico.sinMatch.join(', ')}</span>
                  </p>
                )}
                {pffDiagnostico.conError.length > 0 && (
                  <p className="text-[9px] text-red-700">
                    <span className="font-black uppercase tracking-wider">{pffDiagnostico.conError.length} material(es) PFF con error al consultar el BOM</span>: <span className="font-mono">{pffDiagnostico.conError.join(', ')}</span>
                  </p>
                )}
              </div>
            )}
            {isCalculandoEntregas && (
              <Progress value={entregasProgress.total > 0 ? (entregasProgress.current / entregasProgress.total) * 100 : 0} className="h-2" />
            )}
            {!isCalculandoEntregas && (entregasDiagnostico.sinMatch.length > 0 || entregasDiagnostico.conError.length > 0) && (
              <div className="space-y-1.5 bg-orange-50/60 border border-orange-200 rounded-xl px-3 py-2">
                {entregasDiagnostico.sinMatch.length > 0 && (
                  <p className="text-[9px] text-orange-800">
                    <span className="font-black uppercase tracking-wider">{entregasDiagnostico.sinMatch.length} pedido(s) PT sin componente de espuma en su BOM</span>: <span className="font-mono">{entregasDiagnostico.sinMatch.join(', ')}</span>
                  </p>
                )}
                {entregasDiagnostico.conError.length > 0 && (
                  <p className="text-[9px] text-red-700">
                    <span className="font-black uppercase tracking-wider">{entregasDiagnostico.conError.length} pedido(s) PT con error al consultar el BOM</span>: <span className="font-mono">{entregasDiagnostico.conError.join(', ')}</span>
                  </p>
                )}
              </div>
            )}
            {necesidadesPlantaLoading ? (
              <div className="flex items-center justify-center py-24 text-slate-300"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <>
                <div className="pt-4 space-y-8">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Capacidad que representaría cortar toda esta demanda en carrusel — mismo cálculo que Órdenes FERT/Provisionales.
                  </p>
                  {renderAuditTable(necesidadCapacidadUIO, 'Necesidades Planta — Capacidad Quito', true, 'Código Plan Grupo', 'Grupo Origen', true, true)}
                  {renderAuditTable(necesidadCapacidadGYE, 'Necesidades Planta — Capacidad Guayaquil', true, 'Código Plan Grupo', 'Grupo Origen', true, true)}
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="respuestaP3" className="animate-in fade-in duration-300 space-y-8 text-left">
            <div className="flex items-center justify-end gap-3">
              <Button
                onClick={handleAbrirRespuestaPFDTodos}
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                title="Variante para el reporte de generación de órdenes: igual que P3, pero sin usar Stock como respuesta (si ya hay stock, no sugiere generar orden)."
              >
                <FileOutput className="w-4 h-4" /> Generar Respuestas · PFD (Ambos Centros)
              </Button>
              <Button
                onClick={handleAbrirRespuestaP3Todos}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Generar Respuestas · P3 (Ambos Centros)
              </Button>
            </div>
            {(['1000', '2000'] as const).map(centro => {
              const rows = respuestaSalidaRowsPorCentro(centro);
              const nombrePlanta = centro === '1000' ? 'UIO' : 'GYE';
              const conDato = rows.filter(r => r.tienePlan).length;
              // "Sin dato" (necesidad <= 0: el material no trae necesidad real este ciclo, no que
              // le falte cobertura) se cuenta APARTE de "Sin Cobertura" — antes se sumaba junto y el
              // badge rojo "X sin cobertura" incluía materiales sin necesidad alguna, sobreestimando
              // el problema real. Ver comentario en FuenteRespuestaP3 ('Sin dato') y el Estado por fila.
              const sinNecesidad = rows.filter(r => r.fuente === 'Sin dato').length;
              const sinCoberturaReal = rows.length - conDato - sinNecesidad;
              const totalFaltanteKg = rows.reduce((s, r) => s + r.faltanteKgEstimado, 0);
              const materialesAProducir = rows.filter(r => r.faltante > 0).length;
              return (
                <div key={centro} className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-600" /> Respuesta P3 — Centro {centro} ({nombrePlanta}) · {rows.length} materiales
                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">{conDato} con cobertura</span>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-600 rounded-full px-3 py-1">{sinCoberturaReal} sin cobertura</span>
                      {sinNecesidad > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 rounded-full px-3 py-1" title="Materiales sin ninguna cantidad real en la Necesidad P2 este ciclo — no es que falte cobertura, es que no hay necesidad que evaluar.">{sinNecesidad} sin necesidad</span>
                      )}
                      <span className="text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-700 rounded-full px-3 py-1" title="Necesidad P2 que ni el stock ni las órdenes provisionales cubren — es lo que el PFD manda a fabricar.">Faltante: {formatKg(totalFaltanteKg)} Kg · {materialesAProducir} mat.</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleOpenEditarPlan(centro)}
                        disabled={isLoadingEditPlan}
                        variant="outline"
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        title="Corrige un P3/PFD ya guardado (cantidades, agregar/quitar material) sin esperar al ciclo del día siguiente."
                      >
                        {isLoadingEditPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Editar Plan
                      </Button>
                      <Button
                        onClick={() => handleAbrirRespuestaPFD(centro)}
                        disabled={rows.length === 0}
                        variant="outline"
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        title="Plan final de fabricación: graba el FALTANTE — la necesidad P2 que ni el stock ni las órdenes provisionales cubren. Es lo que hay que mandar a producir."
                      >
                        <FileOutput className="w-4 h-4" /> PFD
                      </Button>
                      <Button
                        onClick={() => handleAbrirRespuestaP3(centro)}
                        disabled={rows.length === 0}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Generar Respuestas · P3 {nombrePlanta}
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-center border-collapse text-[10px]">
                      <thead className="bg-gray-50 sticky top-0 z-20 text-[9px] font-bold uppercase text-gray-400">
                        <tr>
                          <th className="px-4 py-3 border-r border-gray-100 text-left">Material</th>
                          <th className="px-4 py-3 border-r border-gray-100 text-left">Descripción</th>
                          <th className="px-4 py-3 border-r border-gray-100">Necesidad P2 (UN)</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-amber-50/40 text-amber-700">Stock</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-sky-50/40 text-sky-700">Provisional</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-indigo-50/40 text-indigo-700" title="Órdenes FERT programadas hacia adelante (fecha posterior a hoy): son las provisionales ya convertidas que responden al P2 vigente. SÍ cuentan como cobertura.">FERT vigente</th>
                          <th className="px-4 py-3 border-r border-gray-100 font-black bg-yellow-50/50 text-yellow-700">Cubierto (UN)</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-orange-50/40 text-orange-700">Faltante (UN)</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-slate-50/40 text-slate-500" title="Órdenes FERT programadas de hoy hacia atrás: pertenecen a un ciclo de P2 ya ejecutado. NO cubren este P2; se muestran como referencia y alimentan la carga en curso de Capacidad Operativa.">FERT ciclo anterior</th>
                          <th className="px-4 py-3 border-r border-gray-100">Fuente</th>
                          <th className="px-4 py-3 border-r border-gray-100">Estado</th>
                          <th className="px-4 py-3">Plan(es) Grupo Origen (P2)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                        {rows.length === 0 ? (
                          <tr><td colSpan={12} className="py-16 text-slate-300 uppercase font-black tracking-widest italic opacity-50 text-center">Sin materiales de Necesidades Planta para este centro</td></tr>
                        ) : rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors font-mono text-[10px]">
                            <td className="px-4 py-3 border-r border-slate-50 text-left text-indigo-600 font-black">{row.material}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-left font-sans normal-case">{row.descripcion}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-slate-500">{formatNum(row.necesidad, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-amber-700 bg-amber-50/20">{formatNum(row.stock, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-sky-700 bg-sky-50/20">{formatNum(row.provisional, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-indigo-700 bg-indigo-50/20">{formatNum(row.fertVigente, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-slate-900 font-black bg-yellow-50">{formatNum(row.cubierto, 0)}</td>
                            <td className={cn("px-4 py-3 border-r border-slate-50 font-black bg-orange-50/20", row.faltante > 0 ? "text-orange-700" : "text-slate-300")}>{formatNum(row.faltante, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-slate-500 bg-slate-50/20">{row.fertAnterior > 0 ? formatNum(row.fertAnterior, 0) : '—'}</td>
                            <td className="px-4 py-3 border-r border-slate-50">
                              <Badge
                                className={cn(
                                  "text-[8px] font-black uppercase",
                                  /FERT/.test(row.fuente) ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : row.fuente === 'Stock + Provisional' ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : row.fuente === 'Provisional' ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : row.fuente === 'Stock' ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : row.fuente === 'Sin cobertura' ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                                )}
                              >
                                {row.fuente}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 border-r border-slate-50">
                              {row.fuente === 'Sin dato' ? (
                                <Badge className="text-[8px] font-black uppercase bg-slate-100 text-slate-500 border-slate-200" title="Sin necesidad real este ciclo (no hay Kg calculable) — no es una falta de cobertura.">
                                  Sin Necesidad
                                </Badge>
                              ) : (
                                <Badge className={cn("text-[8px] font-black uppercase", row.tienePlan ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
                                  {row.tienePlan ? 'Con Cobertura' : 'Sin Cobertura'}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400">{row.origenes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </TabsContent>
          <TabsContent value="ordenes" className="animate-in fade-in duration-300 space-y-6">
            <div className="flex items-center justify-end">
              <DateFilterPopover
                label="Hoy en adelante"
                selectedDates={selectedDatesProv}
                onToggleDate={toggleProvDate}
                onClear={() => setSelectedDatesProv(new Set())}
                viewDate={viewDateProv}
                setViewDate={setViewDateProv}
                datesWithOrders={datesWithProvOrders}
                isDateDisabled={(d) => d < todayStr}
              />
            </div>
            <div className="space-y-10">
              {renderAuditTable(provAuditUIO, "AUDITORÍA TÉCNICA QUITO (1000) — PROVISIONALES", true)}
              {renderAuditTable(provAuditGYE, "AUDITORÍA TÉCNICA GUAYAQUIL (2000) — PROVISIONALES", true)}
            </div>
          </TabsContent>
          <TabsContent value="ordenesFert" className="animate-in fade-in duration-300 space-y-6">
            <div className="flex items-center justify-end">
              <DateFilterPopover
                label="Cualquier fecha"
                selectedDates={selectedDatesFert}
                onToggleDate={toggleFertDate}
                onClear={() => setSelectedDatesFert(new Set())}
                viewDate={viewDateFert}
                setViewDate={setViewDateFert}
                datesWithOrders={datesWithFertOrders}
                isDateDisabled={() => false}
              />
            </div>
            <div className="space-y-10">
              {renderAuditTable(fertAuditUIO, "AUDITORÍA TÉCNICA QUITO (1000) — ÓRDENES FERT", false)}
              {renderAuditTable(fertAuditGYE, "AUDITORÍA TÉCNICA GUAYAQUIL (2000) — ÓRDENES FERT", false)}
            </div>
          </TabsContent>
          <TabsContent value="mantenimiento" className="animate-in fade-in duration-300 text-left space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><Wrench className="w-4 h-4" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Mantenimientos Preventivos Programados (SAP)</h3>
            </div>
            <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-center border-collapse text-[10px]">
                  <thead className="bg-gray-50 sticky top-0 z-10 text-[9px] font-bold uppercase text-gray-400">
                    <tr>
                      <th className="px-4 py-5 border-r border-gray-100">Centro</th>
                      <th className="px-6 py-5 border-r border-gray-100">Planta</th>
                      <th className="px-6 py-5 border-r border-gray-100">Área</th>
                      <th className="px-4 py-5 border-r border-gray-100">ID Máquina</th>
                      <th className="px-6 py-5 border-r border-gray-100">Máquina</th>
                      <th className="px-6 py-5 border-r border-gray-100">Línea de Proceso</th>
                      <th className="px-5 py-5 border-r border-gray-100">Inicio</th>
                      <th className="px-5 py-5 border-r border-gray-100">Fin</th>
                      <th className="px-6 py-5 text-indigo-700 bg-indigo-50/50 uppercase font-black tracking-tighter">Duración (H)</th>
                      <th className="px-6 py-5 text-emerald-700 bg-emerald-50/50 uppercase font-black tracking-tighter">Vínculo Resumen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-black text-[11px] text-slate-700">
                    {uniqueMantenimientosSAP.length === 0 ? (
                      <tr><td colSpan={10} className="py-24 text-slate-300 uppercase font-black tracking-widest italic opacity-50 text-center">Sin mantenimientos programados detectados</td></tr>
                    ) : (
                      uniqueMantenimientosSAP.map((row, i) => {
                        const iniStr = getProp(row, ['FECHA_OT_PRG_INI']).trim();
                        const finStr = getProp(row, ['FECHA_OT_PRG_FIN']).trim();
                        const diffHrs = getMttoDurationH(row);
                        const idMaquina = getProp(row, ['ID_MAQUINA']);
                        const centro = getProp(row, ['Centro', 'CENTRO']);
                        const link = resolveMachineLink(idMaquina, centro, getProp(row, ['PLANTA']));
                        const plantaTexto = centro === '1000' ? 'QUITO' : centro === '2000' ? 'GUAYAQUIL' : (getProp(row, ['PLANTA']) || '—');

                        return (
                          <tr key={i} className="hover:bg-indigo-50/10 transition-colors">
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 uppercase opacity-40">{centro}</td>
                            <td className="px-6 py-3 border-r border-dashed border-gray-100 uppercase">{plantaTexto}</td>
                            <td className="px-6 py-3 border-r border-dashed border-gray-100 uppercase">{getProp(row, ['AREA'])}</td>
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 uppercase font-bold text-red-600">{idMaquina}</td>
                            <td className="px-6 py-3 border-r border-dashed border-gray-100 uppercase font-black text-left">{getProp(row, ['MAQUINA'])}</td>
                            <td className="px-6 py-3 border-r border-dashed border-gray-100 uppercase text-left">{getProp(row, ['LineaProceso'])}</td>
                            <td className="px-5 py-3 border-r border-dashed border-gray-100 font-mono text-center text-slate-400">{iniStr}</td>
                            <td className="px-5 py-3 border-r border-dashed border-gray-100 font-mono text-center text-slate-400">{finStr}</td>
                            <td className="px-6 py-3 font-mono text-indigo-700 bg-indigo-50/30 text-center font-black">{diffHrs.toFixed(2)}</td>
                            <td className="px-6 py-3 bg-emerald-50/20 text-left">
                              {link ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{link.id} · {link.n} ({link.planta})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-red-500">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>SIN VINCULAR</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={planPreviewP3 !== null} onOpenChange={(open) => { if (!open && !isSavingPlanP3) setPlanPreviewP3(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Respuesta P3 — Corte Espuma</DialogTitle>
            <DialogDescription>
              Revisa los datos que se van a grabar antes de continuar. Esta acción crea registros nuevos en producción.
            </DialogDescription>
          </DialogHeader>
          {planPreviewP3 && (
            <div className="space-y-6 text-left text-sm">
              {planPreviewP3.map((preview, idx) => (
                <div key={preview.centro} className={cn(idx > 0 && 'pt-6 border-t border-slate-100')}>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Grupo</span>{preview.nombreGrupo} (código {preview.codigo_grupo})</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Centro</span>{preview.centro}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Valor Plan</span>{preview.valor}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Respuesta</span>{preview.fechaInicio}</div>
                  </div>
                  <div className="mt-3">
                    <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Materiales a guardar ({preview.rows.length})</span>
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Material</th>
                            <th className="px-3 py-2 text-right">Necesidad P2</th>
                            <th className="px-3 py-2 text-right">Stock</th>
                            <th className="px-3 py-2 text-right">Provisional</th>
                            <th className="px-3 py-2 text-right font-black text-yellow-700">Cubierto (se graba)</th>
                            <th className="px-3 py-2 text-right">Faltante</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {preview.rows.map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-left font-mono">{row.material}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-400">{formatNum(row.necesidad, 0)}</td>
                              <td className="px-3 py-2 text-right font-mono text-amber-700">{formatNum(row.stock, 0)}</td>
                              <td className="px-3 py-2 text-right font-mono text-sky-700">{formatNum(row.provisional, 0)}</td>
                              <td className="px-3 py-2 text-right font-mono font-black bg-yellow-50">{formatNum(row.cantidadUnidades, 0)}</td>
                              <td className={cn("px-3 py-2 text-right font-mono", row.faltante > 0 ? "text-orange-700 font-black" : "text-slate-300")}>{formatNum(row.faltante, 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanPreviewP3(null)} disabled={isSavingPlanP3}>Cancelar</Button>
            <Button onClick={handleConfirmarRespuestaP3} disabled={isSavingPlanP3} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSavingPlanP3 ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSavingPlanP3 ? 'Guardando...' : 'Confirmar y Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={planPreviewPFD !== null} onOpenChange={(open) => { if (!open && !isSavingPlanPFD) setPlanPreviewPFD(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar PFD — Corte Espuma</DialogTitle>
            <DialogDescription>
              Plan final de fabricación: graba el FALTANTE de cada material — la necesidad P2 que ni el stock ni las órdenes provisionales alcanzan a cubrir. Un material cubierto se graba en 0 (no hay que generarle orden). No reemplaza ni modifica el P3.
            </DialogDescription>
          </DialogHeader>
          {planPreviewPFD && (
            <div className="space-y-6 text-left text-sm">
              {planPreviewPFD.map((preview, idx) => (
                <div key={preview.centro} className={cn(idx > 0 && 'pt-6 border-t border-slate-100')}>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Grupo</span>{preview.nombreGrupo} (código {preview.codigo_grupo})</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Centro</span>{preview.centro}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Valor Plan</span>{preview.valor}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Respuesta</span>{preview.fechaInicio}</div>
                  </div>
                  <div className="mt-3">
                    <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Materiales a guardar ({preview.rows.length})</span>
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Material</th>
                            <th className="px-3 py-2 text-right">Necesidad P2</th>
                            <th className="px-3 py-2 text-right">Cubierto (Stock + Prov.)</th>
                            <th className="px-3 py-2 text-right font-black text-orange-700">A producir (se graba)</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {preview.rows.map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-left font-mono">{row.material}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-400">{formatNum(row.necesidad, 0)}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-500">{formatNum(row.cubierto, 0)}</td>
                              <td className={cn("px-3 py-2 text-right font-mono font-black bg-orange-50/40", row.cantidadUnidades > 0 ? "text-orange-700" : "text-slate-300")}>{formatNum(row.cantidadUnidades, 0)}</td>
                              <td className="px-3 py-2 text-left">
                                <Badge
                                  className={cn(
                                    "text-[8px] font-black uppercase",
                                    row.fuente === 'Producir' ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : row.fuente === 'Cubierto' ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                  )}
                                >
                                  {row.fuente}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanPreviewPFD(null)} disabled={isSavingPlanPFD}>Cancelar</Button>
            <Button onClick={handleConfirmarRespuestaPFD} disabled={isSavingPlanPFD} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSavingPlanPFD ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSavingPlanPFD ? 'Guardando...' : 'Confirmar y Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planesGrupoDisponibles !== null} onOpenChange={(open) => { if (!open && !isLoadingEditPlan) { setPlanesGrupoDisponibles(null); setPlanGrupoSeleccionado(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>¿Qué Plan Grupo quieres editar?</DialogTitle>
            <DialogDescription>
              Hay {planesGrupoDisponibles?.planes.length ?? 0} Plan Grupo activo(s) para Corte Espuma (Centro {planesGrupoDisponibles?.centro}). El último guardado queda preseleccionado; elige otro si necesitas corregir uno anterior.
            </DialogDescription>
          </DialogHeader>
          {planesGrupoDisponibles && (
            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Valor Plan</th>
                    <th className="px-3 py-2 text-left">Fecha Inicio</th>
                    <th className="px-3 py-2 text-left">Fecha Fin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {planesGrupoDisponibles.planes.map((p, idx) => (
                    <tr
                      key={p.codigo_plan_grupo}
                      onClick={() => setPlanGrupoSeleccionado(p.codigo_plan_grupo)}
                      className={cn("cursor-pointer transition-colors", planGrupoSeleccionado === p.codigo_plan_grupo ? "bg-indigo-50" : "hover:bg-slate-50")}
                    >
                      <td className="px-3 py-2 text-center">
                        <input type="radio" readOnly checked={planGrupoSeleccionado === p.codigo_plan_grupo} className="accent-indigo-600" />
                      </td>
                      <td className="px-3 py-2 font-mono font-black">
                        #{p.codigo_plan_grupo}{idx === 0 && <span className="ml-2 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">Último guardado</span>}
                      </td>
                      <td className="px-3 py-2">{p.valor}</td>
                      <td className="px-3 py-2 font-mono">{fechaLocalEcuador(p.fecha_inicio_plan) || '—'}</td>
                      <td className="px-3 py-2 font-mono">{fechaLocalEcuador(p.fecha_fin_plan) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPlanesGrupoDisponibles(null); setPlanGrupoSeleccionado(null); }} disabled={isLoadingEditPlan}>Cancelar</Button>
            <Button onClick={handleConfirmarSeleccionPlanEspuma} disabled={isLoadingEditPlan || !planGrupoSeleccionado} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isLoadingEditPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isLoadingEditPlan ? 'Cargando...' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPlanPreview !== null} onOpenChange={(open) => { if (!open && !isSavingEditPlan) setEditPlanPreview(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plan Grupo guardado</DialogTitle>
            <DialogDescription>
              Se recalculó la salida de datos actual del Plan Grupo #{editPlanPreview?.codigo_plan_grupo} (Centro {editPlanPreview?.centro}): los materiales que ya no aplican quedaron premarcados para eliminar. Corrige cantidades (en UN), agrega o quita materiales si hace falta. Los cambios se graban solo al confirmar.
            </DialogDescription>
          </DialogHeader>
          {editPlanPreview && (
            <div className="space-y-4 text-left text-sm">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div><span className="font-black text-slate-500 text-[10px] uppercase block">Plan Grupo</span>#{editPlanPreview.codigo_plan_grupo} — {editPlanPreview.valor}</div>
                <div><span className="font-black text-slate-500 text-[10px] uppercase block">Vigencia</span>{editPlanPreview.fechaInicio} a {editPlanPreview.fechaFin}</div>
              </div>

              <div>
                <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Materiales ({editPlanPreview.rows.filter(r => !r.marcadoEliminar).length})</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Material</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-right">Cantidad (UN)</th>
                        <th className="px-3 py-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {editPlanPreview.rows.map((row, idx) => (
                        <tr key={`${row.material}-${row.codigo_plan_grupo_padre}-${idx}`} className={cn(row.marcadoEliminar && "opacity-40 line-through", row.esNuevo && !row.marcadoEliminar && "bg-emerald-50/50")}>
                          <td className="px-3 py-2 font-mono">{row.material}</td>
                          <td className="px-3 py-2 truncate max-w-[200px]">{row.descripcion}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={row.cantidad}
                              disabled={row.marcadoEliminar}
                              onChange={(e) => handleUpdateEditRowCantidadEspuma(idx, parseFloat(e.target.value) || 0)}
                              className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-right font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => handleRemoveEditRowEspuma(idx)} className={cn("p-1.5 rounded-lg", row.marcadoEliminar ? "text-emerald-600 hover:bg-emerald-50" : "text-red-500 hover:bg-red-50")} title={row.marcadoEliminar ? "Deshacer" : "Quitar"}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {editPlanPreview.rows.length === 0 && (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-300 uppercase font-black tracking-widest italic">Sin materiales</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {materialesDisponiblesParaAgregarEspuma.length > 0 && (
                <div>
                  <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Agregar material de Necesidades Planta</span>
                  <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1">
                    {materialesDisponiblesParaAgregarEspuma.map(m => (
                      <button
                        key={m.material}
                        type="button"
                        onClick={() => handleAddMaterialToEditPlanEspuma(m.material)}
                        className="text-[10px] font-black uppercase px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> {m.material} — {m.descripcion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlanPreview(null)} disabled={isSavingEditPlan}>Cancelar</Button>
            <Button onClick={handleConfirmEditarPlanEspuma} disabled={isSavingEditPlan} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSavingEditPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSavingEditPlan ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
