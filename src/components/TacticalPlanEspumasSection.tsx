
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Scissors,
  Loader2,
  LayoutDashboard,
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
  Pencil,
  Trash2,
  Mail,
  Send,
  Info,
  Search,
  X,
  FileText,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { serviciosService, type SolicitudProduccionHBPayload } from '@/services/servicios.service';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { PanelProgreso, usePanelProgreso } from '@/components/PanelProgreso';
import { pasoPanelDiagnosticoP2, type DiagnosticoP2 } from '@/lib/diagnostico-p2';
import { porcentajeRestriccion, RESTRICCION_CAPACIDAD, jornadaDesdeRestricciones, opcionesConHorarios, claveDeHorario, intervaloDeHorario, horasSolapadas } from '@/lib/restriccionesCapacidad';
import { ejecucionPlanHtml, fechaHoraEjecucion } from '@/lib/ventana-plan';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useAppContext } from '@/context/AppProvider';
import type { Grupo, PlanGrupo, DetalleTactico, Restriccion } from '@/types/interfaces';
import { CODIGO_GRUPO_P2_MUEBLES, esP2ParaModulo } from '@/lib/p2-destino';
import type { BodyResponse } from '@/types/body-response';
import { cn } from '@/lib/utils';
import { useReportePlanTxt, ReportePlanTxtAcciones, ReportePlanTxtVistaPrevia, type OrigenEstadoPlan } from '@/components/ReportePlanTxtFlujo';
import { nextBusinessDay as nextBusinessDayCal, addBusinessDays as addBusinessDaysCal, cargarDiasNoLaborables, laborablesHorizonte, marcarDiaComoJornada, fechaLocalEcuador, fechaLocalPlana, ecuadorMidnightISO, ecuadorNowNaiveISO, type DiasNoLaborables } from '@/lib/dias-laborables';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isValid, addDays } from 'date-fns';
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
// (El 015 de Centro 2000 NO va aquí: solo aplica a materiales puntuales, ver RESP_EXCEPCION_POR_MATERIAL.)
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

// Desfase del PT del plan P1/PFF de Ensamblado respecto a hoy, en días hábiles del calendario.
// Ajustado de 3 a 2 (2026-09-28, confirmado con el usuario): Ensamblado acortó su ventana de
// planificación — caso real PFF #920 (1000) / #921 (2000), creados el lunes 28-sep con
// fecha_inicio_plan 30-sep. El Nivel 2 de Capacidad (ciclo atrasado un día) es siempre este valor − 1.
const DIAS_HABILES_PT_ENSAMBLADO = 2;

// Días hábiles ANTES de la fecha de la necesidad en que SAP entrega la provisional que la responde.
// 0 = el mismo día (flujo vigente, validado con MD04 2026-10-03). Se están probando en SAP las
// provisionales a PT−1: si el usuario confirma que funcionan, se pasa a 1.
const DESFASE_PROVISIONAL_DIAS_HABILES: number = 0;

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
// Resultado de cruzar la carga real (filasSeleccion) contra el código SAP de una máquina física
// (ver MACHINE_SAP_CODES_UIO) para la fecha elegida en "Evaluar Capacidad" — 'sin-fecha' y
// 'sin-mapeo' son estados informativos, no ceros: evitan que "no hay dato" se lea como "máquina libre".
type OcupacionMaquinaInfo =
  | { estado: 'ok'; horas: number; capNeta: number; tiempoMaquinaBruto: number; pct: number | null }
  | { estado: 'sin-mapeo' }
  | { estado: 'sin-fecha' };
// Código real de puesto de trabajo SAP para la Cortadora CNC (HR-CTCNC) — verificado con el maestro
// MaquinaSim/PuestoTrabajo/RespCtrlProd que compartió el usuario y con la restricción real
// "Hojas_Rutas_ PuestoTrabajo" (codigo_restriccion 554, grupo 8, ver hojaRutaPuestoTrabajoPorCentro).
const CODIGO_MAQUINA_CNC = 'HR-CTCNC';
const esFilaCNC = (maquina: unknown): boolean => String(maquina || '').trim().toUpperCase() === CODIGO_MAQUINA_CNC;
const normalizarCodigoMaquina = (maquina: unknown): string => String(maquina || '').trim().toUpperCase();

// Mapeo real SAP (Hoja de Ruta / Puesto de Trabajo, columna "Hoja Ruta / P. Trabajo" de Provisionales/
// FERT) → máquina física de Corte Espuma Quito (Centro 1000), confirmado por el usuario 2026-09-18:
// CR04→HR-CAR04, CR03→HR-CAR03, CR01→HR-CAR01, CNC01→HR-CTCNC, V02→HR_V02(+variantes), V03→HR_V03_1/
// 2/3 y V03_MBL. Antes se creía que HR-CAR03 lo compartían CR03/CR04 (dato viejo, ya corregido).
// HR-TACOS queda FUERA a propósito de CR04 y de V03: el usuario confirmó que sigue siendo ambiguo
// entre esas dos (lo corta CR04 o la Vertical 3 según el caso) — asignarlo a una sola inventaría un
// dato que no existe; sus horas quedan en la reconciliación "sin atribuir a máquina" (ver
// renderProcesoConfig). HR-CAR02 puede seguir apareciendo en data histórica (máquina ya
// retirada/replanificada, no vigente en la planificación nueva) y por eso tampoco mapea a nada.
// Solo cubre Quito (UIO) — Guayaquil (GYE) todavía no tiene su propio mapeo confirmado.
const MACHINE_SAP_CODES_UIO: Record<string, (codigoNormalizado: string) => boolean> = {
  CR04: (c) => c === 'HR-CAR04',
  CR03: (c) => c === 'HR-CAR03',
  CR01: (c) => c === 'HR-CAR01',
  CNC01: (c) => c === CODIGO_MAQUINA_CNC,
  V02: (c) => c.startsWith('HR_V02') || c.startsWith('HR-V02'),
  V03: (c) => c.startsWith('HR_V03') || c.startsWith('HR-V03') || c.includes('V03_MBL'),
};
// Nombre exacto de la restricción SAP "Capacidad_Horas_HR-CARxx" (grupo Corte y Laminado, Centro
// 1000/Quito) — techo de capacidad por carrusel confirmado por el usuario 2026-09-18, usado como
// disparador de las sugerencias de redistribución entre carruseles (ver sugerenciasRedistribucionUIO
// en renderDashboard). Si una máquina no tiene esta restricción (ej. CR01, menos flexible que
// CR03/CR04), se usa 100% por defecto — ver techoPctMaquina.
const MACHINE_SAP_NOMBRE_UIO: Partial<Record<string, string>> = {
  CR04: 'HR-CAR04',
  CR03: 'HR-CAR03',
  CR01: 'HR-CAR01',
};
// Materiales que la laminadora repotenciada de Guayaquil (LA02) corta bajo el responsable 015 — el 015
// es de Prensado/Planchas Mixtas, así que NO se habilita completo en Corte Espuma: solo estos
// materiales entran (ver RESP_EXCEPCION_POR_MATERIAL) y se atribuyen a LA02 sin importar su HR.
const MATERIALES_LA02_GYE = new Set(['30002888', '30002889']);
// Responsables que Corte Espuma acepta en un centro SOLO para materiales puntuales (no para todo su
// alcance). Se suman a los carruseles del centro; cualquier otra orden/componente de ese responsable
// se descarta en la entrada (getFilteredData, auditMapper, explosión PFF — ver respExcepcionExcluye).
const RESP_EXCEPCION_POR_MATERIAL: Record<'1000' | '2000', { resp: string; materiales: Set<string> }[]> = {
  '1000': [],
  '2000': [{ resp: '015', materiales: MATERIALES_LA02_GYE }],
};
// true = la fila es de un responsable de excepción pero su material no está habilitado → se descarta.
const respExcepcionExcluye = (centro: string, resp: string, material: string): boolean => {
  const excepcion = RESP_EXCEPCION_POR_MATERIAL[centro as '1000' | '2000']?.find(e => e.resp === resp);
  return !!excepcion && !excepcion.materiales.has(material);
};
// Guayaquil (Centro 2000): Hoja de Ruta → máquina, esquema confirmado por el usuario 2026-09-28:
//   VAGYE → HR-VAGYE (resp 039) · CR02 → HR-CARG2 · CR01 → HR-CARG1 (resp 002/038) ·
//   LA02 → HR-CARG3 (resp 002/015) + materiales 30002888/30002889 (ver MATERIALES_LA02_GYE).
// HR-CAR02/HR-CAR01 son los códigos anteriores de CR02/CR01 ("cambia a"): se siguen aceptando para
// que las órdenes ya creadas con el código viejo no queden sin atribuir mientras SAP migra.
// HR-LAMR1/HR-LAMPT (resp 038) se reparten entre CR01 y CR02 — ver SAP_CODES_COMPARTIDOS_POR_PLANTA.
const MACHINE_SAP_CODES_GYE: Record<string, (codigoNormalizado: string) => boolean> = {
  CR02: (c) => c === 'HR-CARG2' || c === 'HR-CAR02',
  CR01: (c) => c === 'HR-CARG1' || c === 'HR-CAR01',
  LA02: (c) => c === 'HR-CARG3',
  VAGYE: (c) => c === 'HR-VAGYE',
};
const MACHINE_SAP_CODES_POR_PLANTA: Record<'UIO' | 'GYE', Record<string, (codigoNormalizado: string) => boolean>> = {
  UIO: MACHINE_SAP_CODES_UIO,
  GYE: MACHINE_SAP_CODES_GYE,
};
// Hojas de Ruta que no pertenecen a una sola máquina: sus horas se reparten en partes iguales entre
// las máquinas listadas (esquema del usuario: "se reparte a HR-CARG1 / HR-CARG2").
const SAP_CODES_COMPARTIDOS_POR_PLANTA: Record<'UIO' | 'GYE', Record<string, string[]>> = {
  UIO: {},
  GYE: {
    'HR-LAMR1': ['CR01', 'CR02'],
    'HR-LAMPT': ['CR01', 'CR02'],
  },
};
// A qué máquina(s) de la planta se atribuye una orden, y con qué fracción de su tiempo. Exclusivo (una
// orden nunca suma dos veces): 1) material propio de una máquina (LA02 en GYE, sin importar su HR),
// 2) Hoja de Ruta de una sola máquina, 3) Hoja de Ruta compartida (partes iguales). [] = sin mapeo.
const asignacionMaquinaOrden = (planta: 'UIO' | 'GYE', codigoNormalizado: string, material: string): { id: string; fraccion: number }[] => {
  if (planta === 'GYE' && MATERIALES_LA02_GYE.has(material)) return [{ id: 'LA02', fraccion: 1 }];
  const mapa = MACHINE_SAP_CODES_POR_PLANTA[planta];
  const id = Object.keys(mapa).find(k => mapa[k](codigoNormalizado));
  if (id) return [{ id, fraccion: 1 }];
  const compartida = SAP_CODES_COMPARTIDOS_POR_PLANTA[planta][codigoNormalizado];
  return compartida ? compartida.map(m => ({ id: m, fraccion: 1 / compartida.length })) : [];
};
// sinTurnoNoche: la máquina no opera de noche por definición operativa (no es "turno sin definir") —
// no se muestra su selector Noche, no entra en el aviso de turnos vacíos ni en "aplicar a toda la planta".
const MACHINES_BY_PLANTA: Record<'UIO' | 'GYE', { id: string; n: string; proceso: ProcesoCorte; sinTurnoNoche?: boolean }[]> = {
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
  // Modelo operativo de Guayaquil (confirmado por el usuario 2026-09-28):
  //   Día: 2 laminadores para los 3 carruseles (CR02, CR01, LA02) — sin ayudante por máquina.
  //   Noche: 2 laminadores, solo se encienden CR02 y CR01 (la repotenciada LA02 no opera de noche).
  //   Vertical para esquineros (VAGYE): 1 persona.
  GYE: [
    { id: 'CR02', n: 'CARRUSEL 2 FEMA', proceso: 'carrusel' },
    { id: 'CR01', n: 'CARRUSEL 1 SCHMUZIGER', proceso: 'carrusel' },
    { id: 'LA02', n: 'LAMINADORA REPOTENCIADA', proceso: 'carrusel', sinTurnoNoche: true },
    // Guayaquil tiene UNA sola máquina vertical (esquineros) — órdenes reales del responsable 039 en
    // HR-VAGYE; operada por 1 persona.
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
  // La orden responde a un PT de Ensamblado pero su FECHAFIN es el propio día del PT (ver
  // ventanaLaminaEnsamblado): cuenta como cobertura, con aviso de que llega tarde.
  llegaDiaPT?: boolean;
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
  // Solo filas de P1/PFF (explosión BOM): parte de cantidad_produccion_neta que llega directo del FERT
  // (nivel 1) y la que llega vía un semielaborado (nivel 2+). Las demás áreas no las traen.
  cantidad_nivel1?: number;
  cantidad_nivel2?: number;
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
  // Parte de la FERT que SÍ cubre: solo Venta Externa con la FERT liberada al PT del P2 (ver
  // fertQueCubreUnPorMaterialPorCentro).
  fertCubre: number;
  cubierto: number;
  faltante: number;
  // Cantidad de la línea del P3 = faltante + provisional en ventana (se convierte al exportar a SAP).
  aP3: number;
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
  // Materiales del P2 cubiertos con stock/FERT: no se graban en el P3 (solo se informan).
  cubiertos?: number;
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
  nivel?: NivelBom;
}

// Composición de una orden de Exportar a SAP (ver resolverConversionProvisional).
interface ConversionProvisionalEspuma {
  faltantePFD: number;
  provisionalQty: number;
  cantidadOrden: number;
  principal?: string;
  motivo: 'solo-faltante' | 'provisional+faltante' | 'provisional-completa' | 'sin-orden';
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

// Columnas de la tabla editable del diálogo "Confirmar envío a SAP" — mismo orden y campos que
// SOLICITUD_PRODUCCION_FIELDS en TacticalPlanCorteLaminadoSection, para que la vista previa refleje
// 1:1 el body real que recibe InsertarSolicitudProduccionHB.
const SOLICITUD_PRODUCCION_FIELDS_ESPUMA: { key: keyof SolicitudProduccionHBPayload; label: string; type?: 'number' }[] = [
  { key: 'Mandante', label: 'Mandante' },
  { key: 'CodigoOrdenExterna', label: 'Cod. Orden Externa' },
  { key: 'ClaseOrden', label: 'Clase Orden' },
  { key: 'Centro', label: 'Centro' },
  { key: 'CodigoMaterial', label: 'Cod. Material' },
  { key: 'CantidadPlanificada', label: 'Cant. Planificada (UN)', type: 'number' },
  { key: 'VersionFabricacion', label: 'Versión Fabr.' },
  { key: 'PuestoTrabajo', label: 'Puesto Trabajo' },
  { key: 'FechaFinProgramada', label: 'Fecha Fin Prog.' },
  { key: 'HoraFinProgramada', label: 'Hora Fin Prog.' },
  { key: 'FechaInicioProgramada', label: 'Fecha Inicio Prog.' },
  { key: 'HoraInicioProgramada', label: 'Hora Inicio Prog.' },
  { key: 'PedidoComercial', label: 'Pedido Comercial' },
  { key: 'PosicionPedido', label: 'Posición Pedido' },
  { key: 'EstadoRegistro', label: 'Estado Registro' },
  { key: 'Observaciones', label: 'Observaciones' },
  { key: 'EstadoCarga', label: 'Estado Carga' },
  { key: 'NumeroOrdenSap', label: 'Núm. Orden SAP' },
  { key: 'FechaProceso', label: 'Fecha Proceso' },
  { key: 'HoraProceso', label: 'Hora Proceso' },
  { key: 'UsuarioProceso', label: 'Usuario Proceso' },
];

// Campos que no pueden viajar vacíos a SAP: si falta alguno, la vista previa marca la celda y no deja
// enviar (los demás vacíos — fechas/horas fin, pedido, campos que llena SAP — son esperados).
// PuestoTrabajo puede ir vacío: SAP lo acepta (confirmado por el usuario 2026-10-03).
const CAMPOS_OBLIGATORIOS_SAP_ESPUMA: (keyof SolicitudProduccionHBPayload)[] = ['CodigoOrdenExterna', 'CodigoMaterial', 'CantidadPlanificada', 'VersionFabricacion'];
const errorCampoSapEspuma = (payload: SolicitudProduccionHBPayload, campo: keyof SolicitudProduccionHBPayload): string | null => {
  const valor = payload[campo];
  if (CAMPOS_OBLIGATORIOS_SAP_ESPUMA.includes(campo) && (valor === '' || valor === null || valor === undefined || (campo === 'CantidadPlanificada' && Number(valor) <= 0))) return 'Obligatorio';
  return null;
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
// Respaldo de lo planificado guardado junto al TXT ({fecha}.estado.json) para volver a mostrar el
// Resumen (Capacidad Operativa) desde "Recuperar y revisar". Mismo modelo que Laminado (decisión del
// usuario 2026-10-02): se guarda el RESULTADO ya calculado — las filas de demanda que pinta el tablero
// (órdenes de Corte mapeadas a horas por máquina, necesidad P2/PFF con sus horas), la configuración
// de máquinas y las fechas — no los datos SAP crudos (v1 guardaba las 9 consultas enteras, varios MB).
// Al cargar no se consulta SAP ni se vuelve a procesar: el tablero lee este resultado tal cual
// (ver resultadoRestaurado). Es solo consulta: P3/PFD/SAP quedan bloqueados hasta Sincronizar.
// Cambiar su forma exige subir `version`.
interface ResultadoResumenEspuma {
  // "Hoy" del día en que se guardó: el tablero separa atrasado / a tiempo contra esta fecha.
  hoy: string;
  // Filas ya mapeadas (auditMapper / necesidadCapacidadMapper) que consume renderDashboard y el correo.
  fertAudit: Record<'1000' | '2000', UnifiedRow[]>;
  fertAuditAll: Record<'1000' | '2000', UnifiedRow[]>;
  provAuditAll: Record<'1000' | '2000', UnifiedRow[]>;
  necesidadCapacidad: Record<'1000' | '2000', UnifiedRow[]>;
  necesidadCapacidadNivel2: Record<'1000' | '2000', UnifiedRow[]>;
  clavesProvisionalesTransformadas: Record<'1000' | '2000', string[]>;
  densidadCarruselesUIO: [string, string[]][];
}
interface EstadoPlanCorteEspuma {
  tipo: 'corte-espuma';
  version: 2;
  uioConfig: PlantaConfig;
  gyeConfig: PlantaConfig;
  selectedDatesCapacidad: { UIO: string[]; GYE: string[] };
  selectedDatesProv: string[];
  selectedDatesFert: string[];
  tipoPlanEnsambladoPorCentro: Record<'1000' | '2000', 'P1' | 'PFF' | null>;
  restriccionesCorte: Restriccion[];
  diasNoLaborables: string[];
  diasLaborablesExtra: string[];
  // Necesidad (chica) para la pestaña Necesidades Planta y los mapas por material.
  necesidadesPlantaData: Record<string, NecesidadPlantaRow[]>;
  necesidadPFFData: Record<'1000' | '2000', NecesidadPlantaRow[]>;
  necesidadPFFNivel2Data: Record<'1000' | '2000', NecesidadPlantaRow[]>;
  fertsP2Muebles: NecesidadPlantaRow[];
  fertsPFF: NecesidadPlantaRow[];
  // Solo los MTTO de Corte y Laminado (ventana de turnos y horas de mantenimiento por máquina).
  mantenimientosCorte: RawApiRow[];
  resultado: ResultadoResumenEspuma;
}

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
  diasLaborablesExtra: string[];
  necesidadesPlantaData: Record<string, NecesidadPlantaRow[]>;
  necesidadPFFData: Record<'1000' | '2000', NecesidadPlantaRow[]>;
  // Nivel 2 de Capacidad Planificada (hoy+1 día hábil, ver calcularNecesidadPFF) — se calcula junto
  // con necesidadPFFData pero no se cacheaba: navegar a otro módulo y volver perdía el Nivel 2 aunque
  // el Nivel 1 sí sobrevivía, dejando el panel "sobre-ocupado" inconsistente (verificación de
  // persistencia entre módulos de esta sesión).
  necesidadPFFNivel2Data: Record<'1000' | '2000', NecesidadPlantaRow[]>;
  fertsP2Muebles?: NecesidadPlantaRow[];
  fertsPFF?: NecesidadPlantaRow[];
}

// Una línea del BOM de un FERT del P2 Muebles que llega a un componente de corte (ver
// verificarBomP2Muebles). consumo = cantidad del FERT en el P2 × CANTIDAD_ACUMULADA de la línea.
interface LineaBomP2 {
  fert: string;
  cantidadFert: number;
  nivel: number;
  materialPadre: string;
  cantUnitaria: number;
  cantAcumulada: number;
  unidad: string;
  consumo: number;
  nivelBom: 1 | 2;
  valida: boolean;
}

// Verificación contra el BOM real de los FERT de origen (P2 "ESPUMA MUEBLES" del grupo 3 y P1/PFF de
// Ensamblado), por plan y componente:
//   p2Registrado  → lo que el plan registró para la lámina (lo que hoy responde el P3/PFD)
//   bomNivel1/bomNivel2 → suma de las líneas válidas del BOM (ver leerLineaBom), directas del FERT
//                         o vía semielaborado; bomSumaLineas = ambas (mismo criterio que la
//                         explosión PFF desde 2026-09-29)
interface VerificacionBomP2Row {
  centro: string;
  codigoPlanGrupo: number;
  origen: string;
  componente: string;
  descripcion: string;
  p2Registrado: number;
  bomSumaLineas: number;
  bomNivel1: number;
  bomNivel2: number;
  lineas: LineaBomP2[];
}

// Códigos de producto terminado (FERT) — 2xxxxxxx; los semielaborados de corte son 3xxxxxxx.
const ES_CODIGO_FERT = (codigo: string | number): boolean => /^2\d{7}$/.test(String(Number(codigo)));

// Lee una fila de getMaestroMaterialesExplosion para el FERT consultado. Todas las líneas se suman
// (cada una es una posición de consumo real del BOM); la única que se descarta es la fila corrupta
// verificada 2026-09-03 (FERT 20004463 -> lámina 30027586): SAP repite la relación DIRECTA con el
// FERT (MATERIAL_PADRE = el FERT) con otro NIVEL y una CANTIDAD_ACUMULADA distinta de la unitaria
// (unitaria=2/acumulada=0.02). En una relación directa acumulada = unitaria siempre.
// nivelBom: 1 si cuelga directo del FERT, 2 si llega a través de un semielaborado.
const leerLineaBom = (row: Record<string, unknown>, fertConsultado: string) => {
  const nivel = Number(row.NIVEL || 0);
  const cantUnitaria = Number(row.CANTIDAD_UNITARIA || 0);
  const cantAcumulada = Number(row.CANTIDAD_ACUMULADA || cantUnitaria || 0);
  const materialPadre = cleanCode(row.MATERIAL_PADRE);
  const directa = materialPadre === cleanCode(fertConsultado);
  const valida = !(directa && Math.abs(cantAcumulada - cantUnitaria) >= 0.0001);
  return { nivel, cantUnitaria, cantAcumulada, materialPadre, nivelBom: (directa ? 1 : 2) as 1 | 2, valida };
};

// Nivel BOM de una línea de Respuesta P3/PFD (decisión del usuario 2026-09-29): DetalleTactico no
// tiene campo propio, así que cada material se graba en una línea por nivel y el nivel viaja como
// sufijo de linea_produccion ("Carruseles - LINEA 1 · N1" / "· N2"). Solo las necesidades de P1/PFF
// (explosión BOM) llevan nivel; el resto de orígenes graba la línea sin sufijo, como antes.
type NivelBom = 1 | 2;
const sufijoNivelBom = (nivel?: NivelBom): string => nivel ? ` · N${nivel}` : '';
const nivelBomDeLinea = (linea?: string | null): NivelBom | undefined => {
  const m = /·s*N([12])s*$/.exec(String(linea || ''));
  return m ? (Number(m[1]) as NivelBom) : undefined;
};

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
  // Reporte guardado del que viene lo que se ve (ver restaurarEstadoPlan); null = datos de la sesión.
  const [planCargadoDe, setPlanCargadoDe] = useState<OrigenEstadoPlan | null>(null);
  // Resultado del Resumen cargado desde un reporte guardado (ver EstadoPlanCorteEspuma): mientras no
  // sea null, los cálculos del tablero devuelven esto en vez de procesar datos SAP. Se limpia al sincronizar.
  const [resultadoRestaurado, setResultadoRestaurado] = useState<ResultadoResumenEspuma | null>(null);
  // "Sincronizar" + "Generar Necesidades · P1/PFF" (antes 2 clics) se combinan en 1 — el usuario lo
  // pidió por ser repetitivo en el uso diario, mismo patrón ya aplicado en Corte y Laminado (ver
  // [[modulos_tacticos_sincronizar_y_generar_combinado]]). "Entregas VE" y "Actualizar P2" NO se
  // tocan: son acciones independientes con su propio propósito (decidir qué pedidos aplazar; releer
  // un P2 que otra rama/módulo actualizó), no un segundo paso del mismo cálculo.
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');
  const panelProgreso = usePanelProgreso();
  // Fase 2 del panel (2026-10-03): tras confirmar P3/PFD, el reporte de cada centro se guarda solo.
  // Lo corre un efecto (ver más abajo, junto a reporteFlujo) para que construirHtml lea el render
  // posterior a guardar el P3/PFD y refrescar necesidades, no un cierre viejo.
  const [reportesPorGuardar, setReportesPorGuardar] = useState<('1000' | '2000')[] | null>(null);
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
  // Excepciones "Jornada" del mismo calendario: días que SÍ se trabajan aunque caigan en fin de
  // semana — el sábado habilitado puntualmente para cubrir excedente de capacidad (mismo criterio
  // que Corte y Laminado, ver [[sabado_dia_habil_condicional]]).
  const [diasLaborablesExtra, setDiasLaborablesExtra] = useState<DiasNoLaborables>(new Set<string>());
  // Horizonte de planes (P2/P3/PFF): sin Jornadas de fin de semana mientras SAP solo genere órdenes L-V
  // (ver laborablesHorizonte). restarDiasHabiles (ventana de turnos) sí las cuenta.
  const siguienteDiaHabil = useCallback((d: Date) => nextBusinessDayCal(d, diasNoLaborables, laborablesHorizonte(diasLaborablesExtra)), [diasNoLaborables, diasLaborablesExtra]);
  const sumarDiasHabiles = useCallback((d: Date, n: number) => addBusinessDaysCal(d, n, diasNoLaborables, laborablesHorizonte(diasLaborablesExtra)), [diasNoLaborables, diasLaborablesExtra]);
  // Fecha de PAREO de Capacidad Planificada (Nivel 1/2): la producción del PT en fecha X requiere que
  // su componente (lámina) esté firme un día hábil ANTES — restarDiasHabiles(X, 1).
  const restarDiasHabiles = useCallback((d: Date, n: number) => addBusinessDaysCal(d, -n, diasNoLaborables, diasLaborablesExtra), [diasNoLaborables, diasLaborablesExtra]);
  // Ventana de disponibilidad de lámina para un PT de Ensamblado (P1/PFF) — regla del usuario
  // (2026-09-23, caso real material 30007175 / provisional 0144951612 / Plan #868 PT lunes 28-sep):
  // los materiales deben estar disponibles 1 día hábil ANTES del PT, y las provisionales que responden
  // a ese PT caen en DOS fechas: PT−1 hábil (lámina directa, ej. 25-sep) y PT−2 hábiles (subproceso
  // interno de planchas, subnivel del PT, ej. 24-sep). La FECHAFIN de la provisional ya viene así de
  // SAP ("Disponible p.pl.nec."), se compara tal cual. Días hábiles del calendario (diasLaborablesExtra),
  // no fechas fijas: el sábado puede habilitarse como productivo.
  // Ampliada hasta el PROPIO día del PT (decisión del usuario 2026-09-29, caso provisional 0145076478,
  // 30000220, FECHAFIN 01-oct = PT del PFF #942): SAP ya la fechó contra ese PT, y excluirla hacía que
  // el PFD/Exportar a SAP pidiera una orden duplicada. Cuenta íntegra, pero se marca con aviso
  // "llega el día del PT" (ver esDiaPT) — llega tarde respecto a la regla de un día antes.
  const ventanaLaminaEnsamblado = useCallback((fechaPT: string): { desde: string; hasta: string; pt: string } | null => {
    if (!fechaPT || fechaPT === '—') return null;
    const pt = parseFechaLocal(fechaPT);
    if (isNaN(pt.getTime())) return null;
    const ptStr = format(pt, 'yyyy-MM-dd');
    return {
      desde: format(restarDiasHabiles(pt, 2), 'yyyy-MM-dd'),
      hasta: ptStr,
      pt: ptStr,
    };
  }, [restarDiasHabiles]);

  // Fecha en que SAP debe entregar la provisional que responde a una necesidad (ver
  // provisionalesQueCubrenPorCentro): hoy el mismo día; con DESFASE_PROVISIONAL_DIAS_HABILES > 0,
  // esos días hábiles antes.
  const fechaProvisionalEsperada = useCallback((fechaNecesidad: string): string => {
    if (DESFASE_PROVISIONAL_DIAS_HABILES === 0 || !fechaNecesidad || fechaNecesidad === '—') return fechaNecesidad;
    return format(restarDiasHabiles(parseFechaLocal(fechaNecesidad), DESFASE_PROVISIONAL_DIAS_HABILES), 'yyyy-MM-dd');
  }, [restarDiasHabiles]);

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
      // + responsables de excepción por material (ej. 015 en GYE para LA02): entran al alcance, pero sus
      // filas de otros materiales se descartan en la entrada (ver respExcepcionExcluye).
      const excepciones = RESP_EXCEPCION_POR_MATERIAL[centro].map(e => e.resp);
      const permitidos = Array.from(new Set([...declarados, ...verticales, ...excepciones]));
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
  // FERT (producto terminado, código 2xxxxxxx) que trae el P2 "ESPUMA MUEBLES" del grupo 3 junto a
  // las láminas ya explotadas. No son necesidad de corte: no entran a necesidadesPlantaData (así no
  // llegan a Respuesta P3/PFD ni a Exportar a SAP) y solo alimentan la Verificación BOM del tab.
  const [fertsP2Muebles, setFertsP2Muebles] = useState<NecesidadPlantaRow[]>([]);
  // FERT del PFF/P1 de Ensamblado que se explotó en calcularNecesidadPFF — misma Verificación BOM.
  const [fertsPFF, setFertsPFF] = useState<NecesidadPlantaRow[]>([]);
  const [verificacionBomP2, setVerificacionBomP2] = useState<VerificacionBomP2Row[] | null>(null);
  const [isVerificandoBomP2, setIsVerificandoBomP2] = useState(false);
  const [verificacionBomP2Progreso, setVerificacionBomP2Progreso] = useState({ current: 0, total: 0 });
  const [verificacionBomP2Errores, setVerificacionBomP2Errores] = useState<string[]>([]);
  const [verificacionBomP2Abierto, setVerificacionBomP2Abierto] = useState<string | null>(null);

  // Necesidad PFF (Ensamblado - Quito Y Guayaquil): a diferencia de Forros/Muebles/Prensado/
  // VentaExterna, que ya traen su P2 como líneas de material listas para usar, PFF exige explotar el
  // BOM de cada material antes de tener algo comparable — por eso vive en su propio estado y se
  // calcula bajo demanda (botón), en vez de correr automáticamente cada vez que se abre el tab o se
  // pulsa "Actualizar" (explotar decenas de materiales contra el Maestro en cada carga sería
  // innecesariamente lento). Cada fila ya trae su propio "centro", así que se combina en una sola
  // lista y el resto del pipeline (materialNecesidadesPlantaMapPorCentro, etc.) la separa solo.
  const [necesidadPFFData, setNecesidadPFFData] = useState<Record<'1000' | '2000', NecesidadPlantaRow[]>>({ '1000': [], '2000': [] });
  // Capacidad Operativa Nivel 2 (ver renderDashboard): mismo PFF pero apuntando a hoy+1 día hábil
  // en vez de hoy+2 (DIAS_HABILES_PT_ENSAMBLADO) — red de seguridad para un ciclo que se quedó un día atrás del ideal (el plan
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

  // P3 y PFD ya no son dos pasos/diálogos separados (decisión de negocio 2026-09-22, ver
  // guardarPlanGrupoEspuma/handleConfirmarRespuestaP3PFD): un solo botón "Generar Respuestas P3/PFD"
  // calcula y previsualiza AMBOS de una vez (misma fuente en vivo, respuestaSalidaRowsPorCentro, solo
  // cambia esPFD) y un solo "Confirmar y Guardar" crea los DOS PlanGrupo. Siguen siendo dos filas
  // distintas en BD (valor "- P3 -" / "- PFD -", igual que antes — Editar Plan sigue listándolas por
  // separado) — el cambio es solo de secuencia de botones/clics, no del modelo de datos. Array en vez
  // de un solo objeto para poder cubrir 1 centro (botón por centro) o ambos a la vez (botón general).
  const [planPreviewP3PFD, setPlanPreviewP3PFD] = useState<{ centro: '1000' | '2000'; p3: PlanGrupoPreviewEspuma }[] | null>(null);
  const [isSavingPlanP3PFD, setIsSavingPlanP3PFD] = useState(false);

  // "Exportar a SAP" (InsertarSolicitudProduccionHB) — mismo patrón que Corte y Laminado
  // (exportTxtPreview/exportTxtPayloads en TacticalPlanCorteLaminadoSection), pero la fuente NO es un
  // plan de corridas en memoria (Espuma no tiene "reloj" de máquina por fila) sino el PFD YA
  // PERSISTIDO más reciente de ese centro (ver fetchUltimoPFDEspuma/handleExportSap): cada
  // DetalleTactico guardado del PFD (ya separado por lote/actividad de origen vía
  // getOrigenesProrrateoEspuma) se convierte en una línea del payload. exportSapPreview guarda el
  // PlanGrupo + las filas DetalleTactico crudas (para poder mostrar descripción/origen en la tabla);
  // exportSapPayloads es el payload editable 1:1, mismo índice.
  // grupos[i] = las líneas del PFD que se consolidaron en exportSapPayloads[i] (una orden por material);
  // conversion[i] = de qué se compone su cantidad (faltante del PFD + provisional convertida).
  const [exportSapPreview, setExportSapPreview] = useState<{ plan: PlanGrupo; centro: '1000' | '2000'; grupos: DetalleTactico[][]; conversion: ConversionProvisionalEspuma[] } | null>(null);
  const [exportSapPayloads, setExportSapPayloads] = useState<SolicitudProduccionHBPayload[] | null>(null);
  const [isValidandoExportSap, setIsValidandoExportSap] = useState(false);
  const [isEnviandoSap, setIsEnviandoSap] = useState(false);

  // Tab "Validar Stock" (solo lectura/auditoría, no afecta el plan) — muestra la fila cruda de
  // inventarioSAP tal cual la devuelve /InventarioAnioActual, sin pasar por el filtro de
  // ALMACENES_STOCK_POR_CENTRO, para poder confirmar por material si el stock que ve SAP realmente
  // llega a la app y por qué bodega cuenta o no. Mismo patrón que el tab "Validar PR2" de Corte y
  // Laminado (debugPR2Query).
  const [debugStockQuery, setDebugStockQuery] = useState('');

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
  // Las filas de P1/PFF se abren además por nivel BOM (N1 directa del FERT / N2 vía semielaborado,
  // ver cantidad_nivel1/cantidad_nivel2): así la Respuesta P3/PFD graba una línea por nivel.
  const materialOrigenesPlantaMapPorCentro = useMemo(() => {
    type Origen = { codigoPadre: number; nivel?: NivelBom; qty: number };
    const porCentro: Record<string, Map<string, Map<string, Origen>>> = { '1000': new Map(), '2000': new Map() };
    Object.values(necesidadesPlantaConPFF).flat().forEach(row => {
      const centro = String(row.centro || '');
      if (!porCentro[centro]) return;
      const matKey = String(Number(row.codigo_material));
      const map = porCentro[centro];
      if (!map.has(matKey)) map.set(matKey, new Map());
      const porOrigen = map.get(matKey)!;
      const sumar = (qty: number, nivel?: NivelBom) => {
        const key = `${row.codigo_plan_grupo}|${nivel ?? ''}`;
        const previo = porOrigen.get(key) || { codigoPadre: row.codigo_plan_grupo, nivel, qty: 0 };
        previo.qty += qty;
        porOrigen.set(key, previo);
      };
      if (row.cantidad_nivel1 !== undefined || row.cantidad_nivel2 !== undefined) {
        if ((row.cantidad_nivel1 || 0) > 0) sumar(row.cantidad_nivel1 || 0, 1);
        if ((row.cantidad_nivel2 || 0) > 0) sumar(row.cantidad_nivel2 || 0, 2);
      } else {
        sumar(parseQty(row.cantidad_produccion_neta));
      }
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
  const [marcandoSabadoJornada, setMarcandoSabadoJornada] = useState<{ UIO: boolean; GYE: boolean }>({ UIO: false, GYE: false });
  const handleMarcarSabadoJornada = useCallback(async (planta: 'UIO' | 'GYE', fecha: string) => {
    setMarcandoSabadoJornada(prev => ({ ...prev, [planta]: true }));
    try {
      await marcarDiaComoJornada(fecha, `Turno Sábado habilitado — Corte Espuma ${planta === 'UIO' ? 'Quito' : 'Guayaquil'}`);
      setDiasLaborablesExtra(prev => new Set(prev).add(fecha));
      addNotification('success', `Sábado ${fecha} marcado como Jornada en el calendario — las fechas de P2/P3 ya lo consideran hábil.`);
    } catch (e) {
      addNotification('error', `No se pudo marcar el sábado como Jornada: ${(e as Error).message}`);
    } finally {
      setMarcandoSabadoJornada(prev => ({ ...prev, [planta]: false }));
    }
  }, [addNotification]);
  const todayStr = resultadoRestaurado?.hoy ?? format(new Date(), 'yyyy-MM-dd');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Reporte por correo (Capacidad Operativa) — mismo destinatario para ambas plantas, envío
  // independiente por planta (cada una arma y manda su propio cuerpo de correo).
  const [destinatariosReporte, setDestinatariosReporte] = useState('');

  // Destinatarios precargados desde la restricción Grupo_Correos_Corte_Espuma (Grupo_Correos_Laminado
  // es la de Corte y Laminado). Se lee al montar, aparte de la sincronización: al volver al módulo
  // desde caché no se recargan restricciones y el campo quedaba vacío. Nombre sin distinguir
  // mayúsculas y sin filtrar por codigo_grupo (el nombre ya es único). Sigue editable -- solo
  // autocompleta si el usuario todavía no escribió nada.
  useEffect(() => {
    restriccionService.getAll()
      .then(res => {
        const correosGrupo = Array.from(new Set((res.data || [])
          .filter(r => String(r.nombre_restriccion || '').trim().toUpperCase() === 'GRUPO_CORREOS_CORTE_ESPUMA')
          .flatMap(r => String(r.valor_restriccion || '').split(/[,;&]/).map(v => v.trim()))
          .filter(Boolean)));
        if (correosGrupo.length > 0) {
          setDestinatariosReporte(prev => prev.trim() ? prev : correosGrupo.join(', '));
        }
      })
      .catch(e => console.warn('[Corte Espuma] No se pudo cargar Grupo_Correos_Corte_Espuma:', (e as Error).message));
  }, []);

  // --- CONFIGURACIÓN DASHBOARDS ---
  // Valores iniciales de respaldo: al montar, la precarga desde restricciones (ver jornadaPorPlanta,
  // más abajo) reemplaza horarios, paros y rendimiento con los del grupo o la jornada estándar.
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
    // Horarios por defecto del modelo operativo de GYE (ver MACHINES_BY_PLANTA.GYE): Día 07:00-18:00
    // en las 4 máquinas, Noche 21:00-05:30 solo en CR02/CR01/VAGYE (LA02 no opera de noche). Sábado
    // sigue en VACÍO: es condicional, se activa (07:00-13:00) solo cuando se decide producir.
    shifts: {
      CR02: { day: 'H3', night: 'B21', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      CR01: { day: 'H3', night: 'B21', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      LA02: { day: 'H3', night: 'EMPTY', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true },
      VAGYE: { day: 'H3', night: 'B21', op1D: '', op2D: '', op1N: '', op2N: '', paro1: 13, paro2: 13, saturday: 'EMPTY', op1S: '', op2S: '', paro3: 13, activa: true }
    }
  });

  // Jornada laboral por planta, desde las restricciones HORAS_TRABAJO_DÍA / _NOCHE / _FINDESEMANA y
  // NUM_TURNOS del grupo Corte y Laminado de cada centro (ver restriccionesCapacidad.ts). Sin
  // restricción: jornada estándar (Día 07:00-15:45, Noche 21:00-05:30, Sábado 07:00-13:00).
  const jornadaPorPlanta = useMemo(() => ({
    UIO: jornadaDesdeRestricciones(restriccionesCorte, CODIGO_GRUPO_CORTE_POR_CENTRO['1000']),
    GYE: jornadaDesdeRestricciones(restriccionesCorte, CODIGO_GRUPO_CORTE_POR_CENTRO['2000']),
  }), [restriccionesCorte]);

  // Catálogo de horarios: los fijos + los que traigan las restricciones, ordenados de VACÍO a la
  // jornada más larga (todo sigue editable en el dashboard). Memoizado: al recrearse en cada render
  // invalidaban las dependencias de rellenarTurnoVacio (que las usa para la etiqueta de la notificación).
  const shiftOptions = useMemo(() => opcionesConHorarios([
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'H1', l: '07:00 - 15:45', h: 8.75 },
    { v: 'H2', l: '07:00 - 17:00', h: 10 },
    { v: 'H3', l: '07:00 - 18:00', h: 11 },
    { v: 'H4', l: '07:00 - 19:00', h: 12 },
    // Turno corto para sábado, activación manual cuando se necesita capacidad extra (mismo criterio
    // que Corte y Laminado) -- el sábado no se trata como laborable por defecto; se elige este
    // horario solo el día puntual en que se decide producir.
    { v: 'H5', l: '07:00 - 13:00', h: 6 }
  ], [jornadaPorPlanta.UIO.dia, jornadaPorPlanta.GYE.dia, jornadaPorPlanta.UIO.finDeSemana, jornadaPorPlanta.GYE.finDeSemana, ...jornadaPorPlanta.UIO.catalogo.dia, ...jornadaPorPlanta.GYE.catalogo.dia, ...jornadaPorPlanta.UIO.catalogo.finDeSemana, ...jornadaPorPlanta.GYE.catalogo.finDeSemana]), [jornadaPorPlanta]);

  const nightShiftOptions = useMemo(() => opcionesConHorarios([
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'A19', l: '19:00 - 05:30', h: 10.5 },
    { v: 'B21', l: '21:00 - 05:30', h: 8.5 }
  ], [jornadaPorPlanta.UIO.noche, jornadaPorPlanta.GYE.noche, ...jornadaPorPlanta.UIO.catalogo.noche, ...jornadaPorPlanta.GYE.catalogo.noche]), [jornadaPorPlanta]);

  // Precarga desde restricciones: horarios (Día; Noche solo si NUM_TURNOS ≥ 2 y la máquina opera de
  // noche; Sábado siempre VACÍO — es manual), Paros _Planificados y Rendimiento_Carruseles / _Cnc.
  // Verticales siguen al 100% de rendimiento. Se aplica solo cuando el VALOR de alguna restricción
  // cambia (firma), no en cada recarga: un ajuste manual en el dashboard no se pisa al sincronizar,
  // pero si el negocio cambia la restricción, el nuevo valor sí entra.
  const firmaParosAplicada = useRef<Record<'UIO' | 'GYE', string>>({ UIO: '', GYE: '' });
  // Config de máquinas cargada desde un reporte guardado (ver restaurarEstadoPlan): al restaurar
  // también cambian las restricciones y esta precarga la pisaría. Si hay una pendiente, se registra
  // la firma nueva y se vuelve a aplicar la restaurada.
  const configRestaurada = useRef<{ UIO: PlantaConfig; GYE: PlantaConfig } | null>(null);
  useEffect(() => {
    const restaurada = configRestaurada.current;
    (['UIO', 'GYE'] as const).forEach(planta => {
      const codigoGrupo = CODIGO_GRUPO_CORTE_POR_CENTRO[planta === 'UIO' ? '1000' : '2000'];
      const paro = porcentajeRestriccion(restriccionesCorte, codigoGrupo, RESTRICCION_CAPACIDAD.parosPlanificados);
      const rendCarrusel = porcentajeRestriccion(restriccionesCorte, codigoGrupo, RESTRICCION_CAPACIDAD.rendimientoCarruseles);
      const rendCnc = porcentajeRestriccion(restriccionesCorte, codigoGrupo, RESTRICCION_CAPACIDAD.rendimientoCnc);
      const jornada = jornadaPorPlanta[planta];

      const firma = JSON.stringify([paro, rendCarrusel, rendCnc, jornada]);
      if (firma === firmaParosAplicada.current[planta]) return;
      firmaParosAplicada.current[planta] = firma;
      if (restaurada) return;

      const claveDia = claveDeHorario(shiftOptions, jornada.dia);
      const claveNoche = jornada.numTurnos >= 2 ? claveDeHorario(nightShiftOptions, jornada.noche) : 'EMPTY';
      const aplicar = (prev: PlantaConfig): PlantaConfig => {
        const shifts = { ...prev.shifts };
        MACHINES_BY_PLANTA[planta].forEach(m => {
          if (!shifts[m.id]) return;
          shifts[m.id] = {
            ...shifts[m.id],
            day: claveDia,
            night: m.sinTurnoNoche ? 'EMPTY' : claveNoche,
            saturday: 'EMPTY',
            ...(paro !== null ? { paro1: paro, paro2: paro, paro3: paro } : {}),
          };
        });
        return {
          ...prev,
          performance: rendCarrusel ?? prev.performance,
          performanceCNC: rendCnc ?? prev.performanceCNC,
          shifts,
        };
      };
      if (planta === 'UIO') setUioConfig(aplicar);
      else setGyeConfig(aplicar);
    });
    if (restaurada) {
      configRestaurada.current = null;
      setUioConfig(restaurada.UIO);
      setGyeConfig(restaurada.GYE);
    }
  }, [restriccionesCorte, jornadaPorPlanta, shiftOptions, nightShiftOptions]);

  // Capacidad instalada NOMINAL por día y por proceso (Carrusel/CNC/Vertical), independiente de la
  // fecha seleccionada en "Evaluar Capacidad" — mismo cálculo que capacidadPorProceso dentro de
  // renderDashboard, pero como función standalone para poder usarla también en "Necesidades Planta"
  // (ver renderAuditTable, showCapacidadInstalada), que no vive dentro de renderDashboard. Pedido por
  // el usuario 2026-09-19: da una vista temprana de "capacidad instalada vs necesidad" ANTES de que
  // el plan se ejecute, no solo el día a día real de Capacidad Operativa.
  const capacidadInstaladaPorCentro = useCallback((centro: '1000' | '2000') => {
    const planta: 'UIO' | 'GYE' = centro === '1000' ? 'UIO' : 'GYE';
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
    const porProceso = machines.reduce<Record<ProcesoCorte, number>>((acc, m) => {
      acc[m.proceso] += horasDeMaquina(m.id);
      return acc;
    }, { carrusel: 0, vertical: 0, cnc: 0 });
    // Vertical estimado (mismo criterio que capacidadVerticalUsada en renderDashboard): sin máquinas
    // verticales con horario propio cargado, se usa un turno día de carrusel como referencia.
    if (porProceso.vertical === 0) {
      const primeraCarrusel = machines.find(m => m.proceso === 'carrusel');
      const c = primeraCarrusel ? config.shifts[primeraCarrusel.id] : undefined;
      const hD = shiftOptions.find(o => o.v === c?.day)?.h || 0;
      porProceso.vertical = hD * (1 - (c?.paro1 ?? 0) / 100);
    }
    return porProceso;
  }, [uioConfig, gyeConfig, shiftOptions, nightShiftOptions]);

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
    // Responsable de excepción (ej. 015 en GYE, ver RESP_EXCEPCION_POR_MATERIAL): fuera los materiales
    // no habilitados antes de mapear — las auditorías "All" (fertAuditAll*/provAuditAll*) llegan acá sin
    // pasar por getFilteredData y después solo se filtran por responsable.
    const dataHabilitada = data.filter(o => !respExcepcionExcluye(
      centroId,
      String(getProp(o, ['RESPCONTROLPROD', 'RESPCTRLPROD', 'RespControlProd', 'RESP_CONTROL_PROD', 'RESPONSABLE'])).trim(),
      extractMaterialInfo(o).code
    ));
    const prepared = dataHabilitada.map(o => {
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
      // Ensamblado (P1/PFF): su rango es el día del PT, y la lámina cae en [PT−2 hábiles, PT] (ver
      // ventanaLaminaEnsamblado) — sin esto el aviso "fecha fuera de rango" salía para toda orden de
      // Ensamblado bien programada.
      const origenCandidatos = materialAreaMap.get(String(Number(info.code))) || [];
      const origenEnRango = origenCandidatos.find(c => {
        if (!fechaOrdenFin || c.fecha_inicio === '—' || c.fecha_fin === '—') return false;
        if (c.area.startsWith('Ensamblado')) {
          const v = ventanaLaminaEnsamblado(c.fecha_inicio);
          return !!v && fechaOrdenFin >= v.desde && fechaOrdenFin <= v.hasta;
        }
        return fechaOrdenFin >= c.fecha_inicio && fechaOrdenFin <= c.fecha_fin;
      });
      const origen = origenEnRango || origenCandidatos[0];
      const origenAmbiguo = origenCandidatos.length > 0 && !origenEnRango;
      // Con DESFASE_PROVISIONAL_DIAS_HABILES = 0 llegar el día del PT es lo normal: sin aviso.
      const llegaDiaPT = DESFASE_PROVISIONAL_DIAS_HABILES > 0 && !!origenEnRango && origenEnRango.area.startsWith('Ensamblado')
        && fechaOrdenFin === ventanaLaminaEnsamblado(origenEnRango.fecha_inicio)?.pt;

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
        origenCandidatosCount: origenCandidatos.length,
        llegaDiaPT
      };
    });
  }, [extractMaterialInfo, tiemposCatalogo, kpiCarruselesData, kpiLooperData, materialAreaMap, esRespVertical, ventanaLaminaEnsamblado]);

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
      // Responsable de excepción (ej. 015 en GYE): solo sus materiales habilitados pasan.
      if (respExcepcionExcluye(c, r, extractMaterialInfo(o).code)) return false;
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
  }, [todayStr, allowedRespPorCentro, extractMaterialInfo]);

  const provAuditUIO = useMemo(() => auditMapper(getFilteredData(ordenesProvisionales, '1000', selectedDatesProv, 'future'), '1000'), [auditMapper, getFilteredData, ordenesProvisionales, selectedDatesProv]);
  const provAuditGYE = useMemo(() => auditMapper(getFilteredData(ordenesProvisionales, '2000', selectedDatesProv, 'future'), '2000'), [auditMapper, getFilteredData, ordenesProvisionales, selectedDatesProv]);
  const fertAuditUIO = useMemo(() => resultadoRestaurado?.fertAudit['1000'] ?? auditMapper(getFilteredData(ordenesFert, '1000', selectedDatesFert, 'past'), '1000'), [auditMapper, getFilteredData, ordenesFert, selectedDatesFert, resultadoRestaurado]);
  const fertAuditGYE = useMemo(() => resultadoRestaurado?.fertAudit['2000'] ?? auditMapper(getFilteredData(ordenesFert, '2000', selectedDatesFert, 'past'), '2000'), [auditMapper, getFilteredData, ordenesFert, selectedDatesFert, resultadoRestaurado]);

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
    if (resultadoRestaurado) {
      const c = resultadoRestaurado.clavesProvisionalesTransformadas;
      return { '1000': new Set(c['1000']), '2000': new Set(c['2000']) } as Record<string, Set<string>>;
    }
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
  }, [ordenesFert, extractMaterialInfo, resultadoRestaurado]);

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
        // Venta Externa: sus FERT van fechadas al PT (fecha_fin_plan); fecha_inicio_plan es la recuperación.
        const fecha = /venta\s*externa/i.test(area) && row.fecha_fin && row.fecha_fin !== '—' ? row.fecha_fin : row.fecha_inicio;
        map.get(key)!.push({ fecha, area });
      });
    });
    return porCentro;
  }, [necesidadesPlantaConPFF]);

  // Respuesta P3: mismo problema que motivó fertAuditAllUIO/GYE, pero sin corregir hasta ahora —
  // provAuditUIO/GYE (usadas por el tab "Provisionales") dependen de selectedDatesProv, el calendario
  // de ESE tab, ajeno a la necesidad puntual del P2. Se arma aquí su propia versión sin ese filtro,
  // recorriendo TODO ordenesProvisionales por centro.
  const provAuditAllUIO = useMemo(
    () => resultadoRestaurado?.provAuditAll['1000'] ?? auditMapper(ordenesProvisionales.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '1000'), '1000'),
    [auditMapper, ordenesProvisionales, resultadoRestaurado]
  );
  const provAuditAllGYE = useMemo(
    () => resultadoRestaurado?.provAuditAll['2000'] ?? auditMapper(ordenesProvisionales.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '2000'), '2000'),
    [auditMapper, ordenesProvisionales, resultadoRestaurado]
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
  // Lista de las provisionales que cubren cada material (la cobertura de abajo es su suma) — la usa
  // también "Exportar a SAP" para mostrar qué provisional ya existe para cada orden a crear, base del
  // flujo de vincular/ajustar la provisional en vez de crear una orden nueva.
  const provisionalesQueCubrenPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, UnifiedRow[]>> = { '1000': new Map(), '2000': new Map() };

    const procesar = (centro: '1000' | '2000', rows: UnifiedRow[]) => {
      const allowed = allowedRespPorCentro(centro);
      const fechasPorMaterial = fechasP2PorMaterialPorCentro[centro];
      const map = porCentro[centro];
      // Se descartan las provisionales que ya existen como FERT (misma orden en dos estados, ver
      // clavesProvisionalesTransformadas): esa provisional ya es en realidad una orden liberada, y las
      // liberadas no cubren el plan nuevo (ver respuestaSalidaRowsPorCentro).
      const transformadas = clavesProvisionalesTransformadas[centro];
      rows.forEach(r => {
        if (!allowed.includes(r.responsable)) return;
        if (transformadas?.has(`${r.material}|${r.fecha}|${r.cant}`)) return;
        const candidatosP2 = fechasPorMaterial?.get(r.material);
        if (!candidatosP2 || candidatosP2.length === 0) return;
        // Emparejamiento POR FECHA EXACTA (regla del usuario 2026-10-03, validada con MD04: FERT
        // 20007201 necesita 360 de 30008909 al 07-oct ↔ OrdPrv 0145201016 del 07-oct por 363 = lote):
        // la provisional responde a la necesidad si su FECHAFIN (disponibilidad en MD04) es el mismo día
        // de la necesidad (PT del P1/PFF, PT del P2 de Venta Externa, fecha del P2 en las demás áreas)
        // menos DESFASE_PROVISIONAL_DIAS_HABILES. Reemplaza la ventana [PT−2, PT] de Ensamblado y la
        // tolerancia ±1/±2 por área que se usaba antes, que podían sumar la provisional de otro ciclo.
        const coincide = candidatosP2.some(c => r.fechaFin === fechaProvisionalEsperada(c.fecha));
        if (!coincide) return;
        if (!map.has(r.material)) map.set(r.material, []);
        map.get(r.material)!.push(r);
      });
    };

    procesar('1000', provAuditAllUIO);
    procesar('2000', provAuditAllGYE);
    return porCentro;
  }, [provAuditAllUIO, provAuditAllGYE, fechasP2PorMaterialPorCentro, allowedRespPorCentro, clavesProvisionalesTransformadas, fechaProvisionalEsperada]);

  const provisionalUnPorMaterialPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, number>> = { '1000': new Map(), '2000': new Map() };
    (['1000', '2000'] as const).forEach(centro => {
      provisionalesQueCubrenPorCentro[centro].forEach((ordenes, material) => {
        porCentro[centro].set(material, ordenes.reduce((s, o) => s + o.cantUnidadReal, 0));
      });
    });
    return porCentro;
  }, [provisionalesQueCubrenPorCentro]);

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
    () => resultadoRestaurado?.fertAuditAll['1000'] ?? auditMapper(ordenesFert.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '1000'), '1000'),
    [auditMapper, ordenesFert, resultadoRestaurado]
  );
  const fertAuditAllGYE = useMemo(
    () => resultadoRestaurado?.fertAuditAll['2000'] ?? auditMapper(ordenesFert.filter(o => String(getProp(o, ['Centro', 'CENTRO', 'centro'])).trim() === '2000'), '2000'),
    [auditMapper, ordenesFert, resultadoRestaurado]
  );

  // Compatibilidad real entre carruseles por densidad (pedido por el usuario, ver caso real
  // materiales 30000220/30008209: misma densidad D25/familia 158X198, uno corrió en HR-CAR04 y el
  // otro en HR-CAR01) — en vez de una tabla mantenida a mano, se deriva del historial COMPLETO de
  // FERT (fertAuditAllUIO, sin ventana de fecha): para cada densidad, qué carruseles la han cortado
  // alguna vez. Usado por sugerenciasRedistribucionUIO (ver renderDashboard) para saber a qué otro
  // carrusel se le puede sugerir mover una orden cuando el de origen supera su techo de capacidad.
  // Solo Quito: mismo alcance que MACHINE_SAP_CODES_UIO (Guayaquil no tiene su mapeo de máquina
  // confirmado todavía).
  const densidadCarruselesUIO = useMemo(() => {
    // Plan cargado: el mapa se armó con TODAS las FERT de UIO, que el respaldo no guarda.
    if (resultadoRestaurado) return new Map(resultadoRestaurado.densidadCarruselesUIO.map(([d, ids]) => [d, new Set(ids)]));
    const map = new Map<string, Set<string>>();
    const machinesCarruselUIO = MACHINES_BY_PLANTA.UIO.filter(m => m.proceso === 'carrusel').map(m => m.id);
    fertAuditAllUIO.forEach(row => {
      if (row.centro !== '1000' || !row.dens) return;
      const codigo = normalizarCodigoMaquina(row.maquina);
      const machineId = machinesCarruselUIO.find(id => MACHINE_SAP_CODES_UIO[id]?.(codigo));
      if (!machineId) return;
      if (!map.has(row.dens)) map.set(row.dens, new Set());
      map.get(row.dens)!.add(machineId);
    });
    return map;
  }, [fertAuditAllUIO, resultadoRestaurado]);

  // Techo de capacidad por carrusel — restricción SAP "Capacidad_Horas_HR-CARxx" del grupo Corte y
  // Laminado (Centro 1000/Quito, ver MACHINE_SAP_NOMBRE_UIO). Dispara las sugerencias de
  // redistribución apenas la ocupación real supera este % en vez de 100% — mismo techo que ya usa el
  // negocio en SAP (confirmado por el usuario 2026-09-18). Sin restricción para la máquina (ej. CR01),
  // se usa 100%.
  const techoPctMaquina = useCallback((id: string): number => {
    const nombreSap = MACHINE_SAP_NOMBRE_UIO[id];
    if (!nombreSap) return 100;
    const restr = restriccionesCorte.find(r =>
      r.nombre_restriccion === `Capacidad_Horas_${nombreSap}` && r.codigo_grupo === CODIGO_GRUPO_CORTE_POR_CENTRO['1000']
    );
    if (!restr) return 100;
    const v = safeNum(String(restr.valor_restriccion).replace('%', '').trim());
    return v > 0 ? v : 100;
  }, [restriccionesCorte]);

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

  // Excepción a la regla 23/09 (FERT solo informativa), pedida por el usuario 2026-10-03: en Venta
  // Externa la FERT es la orden de la MISMA plancha que se vende, liberada para el PT de este ciclo
  // (caso real GYE P2 #1008: 30024818 necesidad 30, FERT 30 al 06-oct salía "Sin cobertura" y
  // Exportar a SAP la habría duplicado). Cubre solo si su rango [FECHAINICIO, FECHAFIN] contiene el PT
  // del P2 (fecha_fin_plan) — exacto, sin tolerancia de días, que alcanzaría
  // la FERT del PT de ayer (ciclo anterior). Las demás áreas siguen con FERT solo informativa.
  const fertQueCubreUnPorMaterialPorCentro = useMemo(() => {
    const porCentro: Record<string, Map<string, number>> = { '1000': new Map(), '2000': new Map() };
    const procesar = (centro: '1000' | '2000', rows: UnifiedRow[]) => {
      const allowed = allowedRespPorCentro(centro);
      const fechasPorMaterial = fechasP2PorMaterialPorCentro[centro];
      rows.forEach(r => {
        if (!allowed.includes(r.responsable)) return;
        const candidatos = fechasPorMaterial?.get(r.material);
        if (!candidatos) return;
        const cubrePT = candidatos.some(c => /venta\s*externa/i.test(c.area) && r.fecha <= c.fecha && c.fecha <= (r.fechaFin || r.fecha));
        if (!cubrePT) return;
        porCentro[centro].set(r.material, (porCentro[centro].get(r.material) || 0) + r.cantUnidadReal);
      });
    };
    procesar('1000', fertAuditAllUIO);
    procesar('2000', fertAuditAllGYE);
    return porCentro;
  }, [fertAuditAllUIO, fertAuditAllGYE, fechasP2PorMaterialPorCentro, allowedRespPorCentro]);

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
  // Descripciones vistas en la explosión BOM (P1/PFF, P2 Muebles): un material que solo llega por BOM
  // y no tiene provisional/FERT/stock no aparece en materialDescMap — caso real 2026-10-03, 30008707 y
  // 30008716 salían sin descripción en la vista previa de Exportar a SAP.
  const descripcionesBomRef = useRef(new Map<string, string>());
  const materialDescMap = useMemo(() => {
    const map = new Map<string, string>();
    const trySet = (code: string, desc: string) => {
      if (!code || !desc || desc === '—' || map.has(code)) return;
      map.set(code, desc);
    };
    [...provAuditUIO, ...provAuditGYE, ...provAuditAllUIO, ...provAuditAllGYE, ...fertAuditUIO, ...fertAuditGYE, ...fertAuditAllUIO, ...fertAuditAllGYE]
      .forEach(r => trySet(r.material, r.descripcion));
    inventarioSAP.forEach(inv => { const info = extractMaterialInfo(inv); trySet(info.code, info.desc); });
    return map;
  }, [provAuditUIO, provAuditGYE, provAuditAllUIO, provAuditAllGYE, fertAuditUIO, fertAuditGYE, fertAuditAllUIO, fertAuditAllGYE, inventarioSAP, extractMaterialInfo]);

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
                if (!descripcionesBomRef.current.has(laminaCode)) descripcionesBomRef.current.set(laminaCode, String(row.DESCRIPCION_COMPONENTE || ''));
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
  const necesidadCapacidadUIO = useMemo(() => resultadoRestaurado?.necesidadCapacidad['1000'] ?? necesidadCapacidadMapper(necesidadesPlantaConsolidada, '1000'), [necesidadCapacidadMapper, necesidadesPlantaConsolidada, resultadoRestaurado]);
  const necesidadCapacidadGYE = useMemo(() => resultadoRestaurado?.necesidadCapacidad['2000'] ?? necesidadCapacidadMapper(necesidadesPlantaConsolidada, '2000'), [necesidadCapacidadMapper, necesidadesPlantaConsolidada, resultadoRestaurado]);

  // Capacidad Operativa Nivel 2 (red de seguridad, ciclo atrasado un día — ver renderDashboard): SOLO
  // P1/PFF (necesidadPFFNivel2Data, hoy+1 día hábil). Venta Externa-Espumas NO tiene Nivel 2 propio
  // — verificado que fetchNecesidadesPlanta ya toma "el único P2-Espumas activo del grupo, sea cual
  // sea su fecha" (Venta Externa garantiza como máximo uno activo por centro): si ese plan está
  // atrasado, YA es lo que Nivel 1 está usando, no hay un segundo plan "de ayer" que buscar aparte.
  const necesidadPFFNivel2Consolidada = useMemo(
    () => [...necesidadPFFNivel2Data['1000'], ...necesidadPFFNivel2Data['2000']].map(r => ({ ...r, area: 'Ensamblado' })),
    [necesidadPFFNivel2Data]
  );
  const necesidadCapacidadNivel2UIO = useMemo(() => resultadoRestaurado?.necesidadCapacidadNivel2['1000'] ?? necesidadCapacidadMapper(necesidadPFFNivel2Consolidada, '1000'), [necesidadCapacidadMapper, necesidadPFFNivel2Consolidada, resultadoRestaurado]);
  const necesidadCapacidadNivel2GYE = useMemo(() => resultadoRestaurado?.necesidadCapacidadNivel2['2000'] ?? necesidadCapacidadMapper(necesidadPFFNivel2Consolidada, '2000'), [necesidadCapacidadMapper, necesidadPFFNivel2Consolidada, resultadoRestaurado]);
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
  // Ventana del plan de UNA máquina (pedido del usuario 2026-10-02, mismo concepto que Corte
  // Laminado): la fecha de Capacidad Operativa es el DÍA DEL PLAN, y ese plan se produce desde la
  // NOCHE del día hábil anterior hasta el fin del turno DÍA del plan — ej. plan lun 05/10: Noche
  // vie 02/10 19:00 → sáb 05:30, (Sábado si su turno está activo), Día lun 05/10 07:00 → 19:00.
  // Cada máquina con sus propios horarios (config.shifts); fuera de servicio = sin turnos.
  // Días que arma la ventana de un plan: la NOCHE es la del último día hábil de lunes a viernes antes
  // del plan (si un sábado está marcado como Jornada, restarDiasHabiles devolvería ese sábado, pero
  // la noche sigue siendo la del viernes y el sábado entra como Turno Sábado), y los sábados que caen
  // entre esa noche y el día del plan.
  const diasVentanaPlan = useCallback((fecha: string) => {
    const diaPlan = parseFechaLocal(fecha);
    if (!isValid(diaPlan)) return null;
    let noche = restarDiasHabiles(diaPlan, 1);
    while (getDay(noche) === 6 || getDay(noche) === 0) noche = restarDiasHabiles(noche, 1);
    const sabados: Date[] = [];
    for (let d = addDays(noche, 1); d < diaPlan; d = addDays(d, 1)) if (getDay(d) === 6) sabados.push(d);
    return { diaPlan, noche, sabados };
  }, [restarDiasHabiles]);

  const turnosVentanaMaquina = useCallback((planta: 'UIO' | 'GYE', machineId: string, fecha: string) => {
    const c = (planta === 'UIO' ? uioConfig : gyeConfig).shifts[machineId];
    const dias = diasVentanaPlan(fecha);
    if (!c || c.activa === false || !dias) return [];
    const etiqueta = (opciones: { v: string; l: string }[], v: string) => (v === 'EMPTY' ? null : opciones.find(o => o.v === v)?.l ?? null);
    const turnos: { turno: 'Noche' | 'Sábado' | 'Día'; ini: Date; fin: Date }[] = [];
    const agregar = (turno: 'Noche' | 'Sábado' | 'Día', dia: Date, l: string | null) => {
      const iv = l ? intervaloDeHorario(dia, l) : null;
      if (iv) turnos.push({ turno, ...iv });
    };
    agregar('Noche', dias.noche, etiqueta(nightShiftOptions, c.night));
    dias.sabados.forEach(d => agregar('Sábado', d, etiqueta(shiftOptions, c.saturday)));
    agregar('Día', dias.diaPlan, etiqueta(shiftOptions, c.day));
    return turnos;
  }, [uioConfig, gyeConfig, shiftOptions, nightShiftOptions, diasVentanaPlan]);

  // ¿Suma el Turno Sábado a la capacidad? Con UNA fecha evaluada, solo si un sábado cae dentro de la
  // ventana de ese plan (ej. plan del lunes: sí; plan del miércoles: no, aunque el turno esté activo).
  // Con varias fechas o sin fecha, como antes (siempre que el turno esté activo). Pedido del usuario
  // 2026-10-02: "es indispensable que se considere si se activan los sábados".
  const sabadoCuentaEnPlanta = useCallback((planta: 'UIO' | 'GYE') => {
    const fechas = Array.from(selectedDatesCapacidad[planta]);
    if (fechas.length !== 1) return true;
    return (diasVentanaPlan(fechas[0])?.sabados.length ?? 0) > 0;
  }, [selectedDatesCapacidad, diasVentanaPlan]);

  // Con la ventana del plan, el mantenimiento cuenta solo las horas que caen DENTRO de los turnos de
  // esa máquina (ej. el viernes en la noche o el lunes en la mañana sí; un sábado sin turno no).
  // Antes: todo el mantenimiento que EMPEZABA el día del plan, aunque cayera fuera de turno, y nada
  // del de la noche anterior. Sin turnos (máquina apagada o sin horario) queda el criterio anterior.
  const getMttoTimeParaFecha = useCallback((machineId: string, planta: string, fecha: string): number => {
    const target = machineId.trim().toUpperCase();
    const filas = uniqueMantenimientosSAP.filter(m => {
      const idMaquina = getProp(m, ['ID_MAQUINA', 'MAQUINA']);
      const link = resolveMachineLink(idMaquina, getProp(m, ['Centro', 'CENTRO']), getProp(m, ['PLANTA']));
      return !!link && link.id === target && link.planta === planta;
    });
    const turnos = planta === 'UIO' || planta === 'GYE' ? turnosVentanaMaquina(planta, target, fecha) : [];
    const delDia = (m: RawApiRow) => fechaLocalEcuador(getProp(m, ['FECHA_OT_PRG_INI'])) === fecha;
    if (turnos.length === 0) return filas.filter(delDia).reduce((sum, row) => sum + getMttoDurationH(row), 0);
    return filas.reduce((sum, row) => {
      const ini = new Date(getProp(row, ['FECHA_OT_PRG_INI']));
      const fin = new Date(getProp(row, ['FECHA_OT_PRG_FIN']));
      if (!isValid(ini) || !isValid(fin) || fin <= ini) return sum + (delDia(row) ? getMttoDurationH(row) : 0);
      const enVentana = turnos.reduce((s, t) => s + horasSolapadas(ini, fin, t.ini, t.fin), 0);
      return sum + Math.min(getMttoDurationH(row), enVentana);
    }, 0);
  }, [uniqueMantenimientosSAP, turnosVentanaMaquina]);

  // Ventana del plan de la PLANTA para mostrarla (inicio más temprano / fin más tardío de sus
  // máquinas en servicio) — solo con UNA fecha evaluada.
  const ventanaPlanPorPlanta = useMemo(() => {
    const calcular = (planta: 'UIO' | 'GYE') => {
      const fechas = Array.from(selectedDatesCapacidad[planta]).sort();
      if (fechas.length !== 1) return null;
      const turnos = MACHINES_BY_PLANTA[planta].flatMap(m => turnosVentanaMaquina(planta, m.id, fechas[0]));
      if (turnos.length === 0) return null;
      const inicio = new Date(Math.min(...turnos.map(t => t.ini.getTime())));
      const fin = new Date(Math.max(...turnos.map(t => t.fin.getTime())));
      return { fecha: fechas[0], inicio, fin, noche: diasVentanaPlan(fechas[0])?.noche ?? restarDiasHabiles(parseFechaLocal(fechas[0]), 1) };
    };
    return { UIO: calcular('UIO'), GYE: calcular('GYE') };
  }, [selectedDatesCapacidad, turnosVentanaMaquina, restarDiasHabiles, diasVentanaPlan]);

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
        const hS = sabadoCuentaEnPlanta(planta) ? (shiftOptions.find(o => o.v === c.saturday)?.h || 0) : 0;
        return ((hD * (1 - c.paro1 / 100)) + (hN * (1 - c.paro2 / 100)) + (hS * (1 - c.paro3 / 100))) * rendimientoDe(proceso);
      };
      const capacidadPorProceso = machines.reduce<Record<ProcesoCorte, number>>((acc, m) => {
        acc[m.proceso] += horasDeMaquina(m.id);
        return acc;
      }, { carrusel: 0, vertical: 0, cnc: 0 });

      // Tiempo Máquina BRUTO — mismo criterio que renderProcesoConfig del dashboard: horas
      // programadas (Día+Noche+Sábado) SIN descontar paros ni rendimiento, para mostrarlo también en
      // el correo (pedido por el usuario, ver esquema Excel compartido).
      const horasBrutoMaquina = (id: string) => {
        const c = config.shifts[id];
        if (!c || c.activa === false) return 0;
        const hD = shiftOptions.find(o => o.v === c.day)?.h || 0;
        const hN = nightShiftOptions.find(o => o.v === c.night)?.h || 0;
        const hS = sabadoCuentaEnPlanta(planta) ? (shiftOptions.find(o => o.v === c.saturday)?.h || 0) : 0;
        return hD + hN + hS;
      };
      const tiempoMaquinaPorProceso = machines.reduce<Record<ProcesoCorte, number>>((acc, m) => {
        acc[m.proceso] += horasBrutoMaquina(m.id);
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
      // Con UNA fecha evaluada, cada turno lleva su fecha real en una columna propia (pedido del
      // usuario 2026-10-02): Noche = último día hábil L-V antes del plan, Sábado(s) en medio, Día = plan.
      const fechaCorta = (d: Date | null | undefined) => (d ? format(d, 'EEE dd/MM', { locale: es }) : '');
      const diasPlan = fechasSel.length === 1 ? diasVentanaPlan(fechasSel[0]) : null;
      const sabadoCuenta = sabadoCuentaEnPlanta(planta);
      const detallePorMaquina = machines.map(m => {
        const c = config.shifts[m.id];
        const diaLabel = shiftOptions.find(o => o.v === c?.day)?.l || '—';
        const nocheLabel = nightShiftOptions.find(o => o.v === c?.night)?.l || '—';
        const sabadoLabel = shiftOptions.find(o => o.v === c?.saturday)?.l || '—';
        const hD = shiftOptions.find(o => o.v === c?.day)?.h || 0;
        const hN = nightShiftOptions.find(o => o.v === c?.night)?.h || 0;
        const hS = sabadoCuenta ? (shiftOptions.find(o => o.v === c?.saturday)?.h || 0) : 0;
        const rendimiento = rendimientoDe(m.proceso);
        const diaNeta = hD * (1 - (c?.paro1 ?? 0) / 100) * rendimiento;
        const nocheNeta = hN * (1 - (c?.paro2 ?? 0) / 100) * rendimiento;
        const sabadoNeta = hS * (1 - (c?.paro3 ?? 0) / 100) * rendimiento;
        const mttoReal = mttoDeMaquina(m.id);
        return {
          id: m.id,
          nombre: m.n,
          proceso: m.proceso,
          diaLabel, nocheLabel, sabadoLabel,
          diaFecha: fechaCorta(diasPlan?.diaPlan),
          nocheFecha: fechaCorta(diasPlan?.noche),
          sabadoFecha: (diasPlan?.sabados ?? []).map(fechaCorta).join(', '),
          diaBruta: hD, nocheBruta: hN, sabadoBruta: hS,
          diaNeta, nocheNeta, sabadoNeta,
          paro: c?.paro1 ?? 0,
          paroNoche: c?.paro2 ?? 0,
          paroSabado: c?.paro3 ?? 0,
          rendimientoPct: rendimiento * 100,
          mttoReal,
          total: Math.max(0, horasDeMaquina(m.id) - mttoReal),
        };
      });

      // Remanente de CNC — mismo criterio que renderProcesoConfig del dashboard (Capacidad Operativa,
      // ver su comentario extenso): la capacidad libre de CNC ese día (capacidad neta menos lo que ya
      // tiene ocupado) se suma SOLO al total general de Carruseles, nunca a Verticales ni como un
      // "Tiempo Disponible" combinado. El recuadro propio de CNC en el correo no cambia, sigue
      // mostrando su capacidad/ocupación real sin el remanente restado.
      const cncRemanente = Math.max(0, Math.max(0, capacidadPorProceso.cnc * fechasSel.length - mttoPorProceso('cnc')) - ocupadoPorProceso('cnc'));

      return {
        fecha: fechasSel[0] || '',
        diaLabel: shiftOptions.find(o => o.v === diaComun)?.l || '—',
        nocheLabel: nightShiftOptions.find(o => o.v === nocheComun)?.l || '—',
        paroPorc: machines[0] ? config.shifts[machines[0].id]?.paro1 ?? 0 : 0,
        rendimientoPct: config.performance,
        rendimientoCNCPct: config.performanceCNC,
        detallePorMaquina,
        cncRemanente,
        carruseles: { capacidad: Math.max(0, capacidadPorProceso.carrusel - mttoPorProceso('carrusel')) + cncRemanente, ocupacion: ocupadoPorProceso('carrusel'), cantidad: cantidadPorProceso('carrusel'), peso: pesoPorProceso('carrusel'), tiempoMaquina: tiempoMaquinaPorProceso.carrusel },
        verticales: { capacidad: Math.max(0, capacidadPorProceso.vertical - mttoPorProceso('vertical')), ocupacion: ocupadoPorProceso('vertical'), cantidad: cantidadPorProceso('vertical'), peso: pesoPorProceso('vertical'), tiempoMaquina: tiempoMaquinaPorProceso.vertical },
        cnc: { capacidad: Math.max(0, capacidadPorProceso.cnc - mttoPorProceso('cnc')), ocupacion: ocupadoPorProceso('cnc'), cantidad: cantidadPorProceso('cnc'), peso: pesoPorProceso('cnc'), tiempoMaquina: tiempoMaquinaPorProceso.cnc },
      };
    };
    return { UIO: calcularPlanta('UIO'), GYE: calcularPlanta('GYE') };
  }, [
    necesidadCapacidadUIO, necesidadCapacidadGYE, necesidadCapacidadNivel2UIO, necesidadCapacidadNivel2GYE,
    fertAuditAllUIO, fertAuditAllGYE, provAuditAllUIO, provAuditAllGYE, sinProvisionalesTransformadas,
    filasCentroEnFecha, calcularFaltanteNecesidadPlanta, necesidadPorMaterialCombinadoPorCentro,
    selectedDatesCapacidad, uioConfig, gyeConfig, shiftOptions, nightShiftOptions, responsablesPorCentro,
    restarDiasHabiles, getMttoTimeParaFecha, sabadoCuentaEnPlanta, diasVentanaPlan,
  ]);

  // Cuerpo del correo — mismo formato ya aprobado en Artifact (Día/Noche/Mtto simple, Carruseles y
  // Verticales SIN combinar en un solo "Tiempo Disponible": mezclarlos diluye la lectura real de cada
  // proceso, mismo criterio que ya usa este dashboard). El % de paro que se aplica es manual
  // (config.shifts[...].paro1/2) — el mantenimiento real (mantenimientosSAP) no entra en este cálculo
  // todavía, se deja fuera del correo por ahora para no mostrar un número que no se está usando.
  const construirReporteHtmlEspuma = (planta: 'UIO' | 'GYE') => {
    const r = resumenReportePorPlanta[planta];
    const nombrePlanta = planta === 'UIO' ? 'Quito' : 'Guayaquil';
    const ventana = ventanaPlanPorPlanta[planta];
    const ventanaHtml = ventana ? ejecucionPlanHtml(ventana.inicio, ventana.fin) : '';
    // Fecha de LIBERACIÓN del plan (el día en que se genera y guarda el reporte), no la del plan:
    // pedido del usuario 2026-10-02 — la fecha del plan ya se lee en la ejecución (inicio → fin).
    const fechaLabel = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    const pctCarruseles = r.carruseles.capacidad > 0 ? (r.carruseles.ocupacion / r.carruseles.capacidad) * 100 : 0;
    const pctVerticales = r.verticales.capacidad > 0 ? (r.verticales.ocupacion / r.verticales.capacidad) * 100 : 0;
    const pctCnc = r.cnc.capacidad > 0 ? (r.cnc.ocupacion / r.cnc.capacidad) * 100 : 0;
    const tieneCnc = r.cnc.capacidad > 0 || r.cnc.ocupacion > 0 || r.detallePorMaquina.some(m => m.proceso === 'cnc');
    // CNC muestra su tiempo UTILIZADO cuando le sobra capacidad: ese sobrante ya se suma a Carruseles
    // (cncRemanente), mostrar aquí la capacidad completa contaba esas horas dos veces en la fila.
    const cncCedeRemanente = r.cncRemanente > 0.05;

    // Detalle por máquina — mismo esquema para Carruseles, CNC y Verticales: Turno / Horarios /
    // Tiempo Máquina (Horas brutas) / Paros Planificados (%) / Rendimiento Máquina (%) / Tiempo
    // Máquina (Horas Efectivas). Paro y rendimiento van como columnas por turno (antes eran una
    // leyenda "Brutas → Efectivas" debajo); salen de config, que se inicializa con las restricciones
    // Paros _Planificados / Rendimiento_* del grupo Corte y Laminado. Turno vacío: % en blanco.
    const thDet = 'padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;';
    const tdDet = 'padding:7px 10px;font-size:11px;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;';
    // Turno | Fecha | Horario en columnas separadas, en el orden en que se ejecuta el plan: Noche →
    // Sábado (solo si aplica) → Día (pedido del usuario 2026-10-02). "07:00 - 19:00" → "07:00 a 19:00".
    const horarioTexto = (l: string) => l.replace(' - ', ' a ');
    const filaTurnoHtml = (etiqueta: string, fecha: string, horario: string, bruta: number, paroPct: number, rendPct: number, neta: number, fondo: string, color: string) => `
        <tr style="background:${fondo};"><td style="${tdDet}font-weight:700;color:${color};">${etiqueta}</td><td style="${tdDet}color:#374151;text-transform:capitalize;white-space:nowrap;">${fecha || '—'}</td><td style="${tdDet}color:#374151;white-space:nowrap;">${horarioTexto(horario)}</td><td align="right" style="${tdDet}color:#374151;">${bruta.toFixed(2)}</td><td align="right" style="${tdDet}color:#374151;">${bruta > 0 ? `${paroPct.toFixed(0)}%` : ''}</td><td align="right" style="${tdDet}color:#374151;">${bruta > 0 ? `${rendPct.toFixed(0)}%` : ''}</td><td align="right" style="${tdDet}font-weight:700;color:${color};">${neta.toFixed(2)}</td></tr>`;
    const detalleMaquinaHtml = (m: typeof r.detallePorMaquina[number]) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #111827;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="${thDet}">Turno</td>
          <td style="${thDet}">Fecha</td>
          <td style="${thDet}">Horario</td>
          <td align="right" style="${thDet}">Tiempo Máquina<br/>(Horas brutas)</td>
          <td align="right" style="${thDet}">Paros<br/>Planificados (%)</td>
          <td align="right" style="${thDet}">Rendimiento<br/>Máquina (%)</td>
          <td align="right" style="${thDet}">Tiempo Máquina<br/>(Horas Efectivas)</td>
        </tr>${filaTurnoHtml('Noche', m.nocheFecha, m.nocheLabel, m.nocheBruta, m.paroNoche, m.rendimientoPct, m.nocheNeta, '#eef2ff', '#4338ca')}${m.sabadoBruta > 0 ? filaTurnoHtml('Sábado', m.sabadoFecha, m.sabadoLabel, m.sabadoBruta, m.paroSabado, m.rendimientoPct, m.sabadoNeta, '#fffbeb', '#b45309') : ''}${filaTurnoHtml('Día', m.diaFecha, m.diaLabel, m.diaBruta, m.paro, m.rendimientoPct, m.diaNeta, '#ecfdf5', '#047857')}
        <tr style="background:#fffbeb;"><td colspan="6" style="padding:7px 10px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #d1d5db;">Mantenimiento Programado</td><td align="right" style="padding:7px 10px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;">${m.mttoReal > 0 ? m.mttoReal.toFixed(2) : '–'}</td></tr>
        <tr style="background:#ecfdf5;"><td colspan="6" style="padding:8px 10px;font-size:11px;font-weight:800;color:#111827;text-transform:uppercase;">${m.nombre}</td><td align="right" style="padding:8px 10px;font-size:11px;font-weight:800;color:#111827;font-variant-numeric:tabular-nums;">${m.total.toFixed(2)} h</td></tr>
      </table>`;
    const listaDetalleHtml = (lista: typeof r.detallePorMaquina) => lista.map((m, idx) => `
      <div style="${idx < lista.length - 1 ? 'margin-bottom:12px;' : ''}">${detalleMaquinaHtml(m)}</div>`).join('');

    // Resumen final por proceso (pedido del usuario 2026-10-06, mismo formato que el correo de
    // Laminado): Ocupación real | Tiempo operativo | Disponibilidad. Carruseles con el criterio "A":
    // su disponibilidad incluye el remanente de CNC, igual que el tablero del módulo.
    const tarjetaHtml = (titulo: string, valor: string, fondo: string, colorTitulo: string, nota = '') => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fondo};border-radius:10px;">
              <tr><td style="padding:12px 12px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${colorTitulo};">${titulo}</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${valor}</p>${nota ? `
                <p style="margin:2px 0 0;font-size:9px;color:#9ca3af;">${nota}</p>` : ''}
              </td></tr>
            </table>`;
    const resumenProcesoHtml = (proceso: string, pct: number, operativo: number, disponible: number, notaDisponible: string) => `
      <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#111827;text-transform:uppercase;">${proceso}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td width="33.33%" valign="top" style="padding-right:6px;">${tarjetaHtml('Ocupación real', `${pct.toFixed(1)}%`, pct > 100 ? '#7f1d1d' : '#065f46', '#fecaca')}</td>
          <td width="33.34%" valign="top" style="padding:0 6px;">${tarjetaHtml('Tiempo operativo', `${operativo.toFixed(2)} h`, '#111827', '#9ca3af')}</td>
          <td width="33.33%" valign="top" style="padding-left:6px;">${tarjetaHtml('Tiempo disponible', `${disponible.toFixed(2)} h`, '#111827', '#9ca3af', notaDisponible)}</td>
        </tr>
      </table>`;

    const carruselesMaquinas = r.detallePorMaquina.filter(m => m.proceso === 'carrusel');
    const carruselesDetalleHtml = listaDetalleHtml(carruselesMaquinas);

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
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${fechaLabel} · Correo automático, no responder</p>${ventanaHtml}
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
      ${listaDetalleHtml(cncMaquinas)}
    </td>
  </tr>` : ''}
  <tr>
    <td style="padding:14px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Detalle por máquina — verticales</p>
      ${listaDetalleHtml(verticalesMaquinas)}
    </td>
  </tr>
  <tr>
    <td style="padding:22px 28px 6px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Ocupación por proceso — no se combinan (procesos distintos, capacidad distinta)</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbeafe;border-radius:10px;overflow:hidden;">
        <tr style="background:#eff6ff;">
          <td style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#93c5fd;border-bottom:1px solid #dbeafe;"></td>
          <td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#1d4ed8;border-bottom:1px solid #dbeafe;">Carruseles</td>
          ${tieneCnc ? `<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#1d4ed8;border-bottom:1px solid #dbeafe;">CNC</td>` : ''}
          <td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#1d4ed8;border-bottom:1px solid #dbeafe;">Verticales</td>
        </tr>
        <tr>
          <td style="padding:7px 12px;font-size:11px;font-weight:700;color:#1e3a8a;border-bottom:1px solid #eff6ff;">Tiempo disponible (H)</td>
          <td align="right" style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${r.carruseles.capacidad.toFixed(2)}</td>
          ${tieneCnc ? `<td align="right" style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${cncCedeRemanente ? `${r.cnc.ocupacion.toFixed(2)} <span style="font-size:9px;color:#6b7280;">(usado)</span>` : r.cnc.capacidad.toFixed(2)}</td>` : ''}
          <td align="right" style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${r.verticales.capacidad.toFixed(2)}</td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:7px 12px;font-size:11px;font-weight:700;color:#1e3a8a;border-bottom:1px solid #eff6ff;">Tiempo operativo (H)</td>
          <td align="right" style="padding:7px 12px;font-size:11px;font-weight:700;color:#111827;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${r.carruseles.ocupacion.toFixed(2)}</td>
          ${tieneCnc ? `<td align="right" style="padding:7px 12px;font-size:11px;font-weight:700;color:#111827;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${r.cnc.ocupacion.toFixed(2)}</td>` : ''}
          <td align="right" style="padding:7px 12px;font-size:11px;font-weight:700;color:#111827;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${r.verticales.ocupacion.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:7px 12px;font-size:11px;font-weight:700;color:#1e3a8a;border-bottom:1px solid #eff6ff;">Cantidad (und)</td>
          <td align="right" style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${formatNum(r.carruseles.cantidad, 0)}</td>
          ${tieneCnc ? `<td align="right" style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${formatNum(r.cnc.cantidad, 0)}</td>` : ''}
          <td align="right" style="padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #eff6ff;font-variant-numeric:tabular-nums;">${formatNum(r.verticales.cantidad, 0)}</td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:7px 12px;font-size:11px;font-weight:700;color:#1e3a8a;">Peso (Kg)</td>
          <td align="right" style="padding:7px 12px;font-size:11px;color:#374151;font-variant-numeric:tabular-nums;">${formatNum(r.carruseles.peso, 0)}</td>
          ${tieneCnc ? `<td align="right" style="padding:7px 12px;font-size:11px;color:#374151;font-variant-numeric:tabular-nums;">${formatNum(r.cnc.peso, 0)}</td>` : ''}
          <td align="right" style="padding:7px 12px;font-size:11px;color:#374151;font-variant-numeric:tabular-nums;">${formatNum(r.verticales.peso, 0)}</td>
        </tr>
        <tr style="background:#111827;">
          <td style="padding:8px 12px;"></td>
          <td align="right" style="padding:8px 12px;font-size:11px;font-weight:800;color:${pctCarruseles > 100 ? '#f87171' : '#5eead4'};">${pctCarruseles.toFixed(0)}% ocupado</td>
          ${tieneCnc ? `<td align="right" style="padding:8px 12px;font-size:11px;font-weight:800;color:${pctCnc > 100 ? '#f87171' : '#5eead4'};">${cncCedeRemanente ? `${r.cnc.ocupacion.toFixed(1)} de ${r.cnc.capacidad.toFixed(1)} h<br/><span style="font-size:10px;font-weight:600;color:#fcd34d;">${r.cncRemanente.toFixed(1)} h → Carruseles</span>` : `${pctCnc.toFixed(0)}% ocupado`}</td>` : ''}
          <td align="right" style="padding:8px 12px;font-size:11px;font-weight:800;color:${pctVerticales > 100 ? '#f87171' : '#5eead4'};">${pctVerticales.toFixed(0)}% ocupado</td>
        </tr>
      </table>
      ${r.cncRemanente > 0.05 ? `<p style="margin:8px 0 0;font-size:10px;color:#b45309;">Capacidad de Carruseles incluye +${r.cncRemanente.toFixed(1)}h remanente de CNC (capacidad libre de CNC ese día, que un carrusel puede aprovechar). Por eso la columna CNC muestra solo su tiempo utilizado, para no contar esas horas dos veces; el detalle por máquina CNC arriba conserva su tiempo máquina completo.</p>` : ''}
      ${!r.fecha ? '<p style="margin:8px 0 0;font-size:10px;color:#b45309;">Sin fecha seleccionada en Capacidad Operativa — la ocupación mostrada es 0. Selecciona una fecha antes de enviar.</p>' : ''}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 28px 6px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Resumen de ocupación</p>
      ${resumenProcesoHtml('Carruseles', pctCarruseles, r.carruseles.ocupacion, r.carruseles.capacidad, cncCedeRemanente ? `incluye ${r.cncRemanente.toFixed(1)} h libres de CNC` : '')}
      ${resumenProcesoHtml('Verticales', pctVerticales, r.verticales.ocupacion, r.verticales.capacidad, '')}
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

  // "Corte y Laminado" es el departamento SAP real que agrupa Carruseles (este módulo) y Looper
  // (Corte y Laminado) -- confirmado por el usuario, mismo nombre que ambos correos ya deben
  // usar en el asunto, distinguidos por el proceso entre corchetes, no por el nombre del módulo.
  const asuntoReporteEspuma = (planta: 'UIO' | 'GYE') =>
    `Reporte de producción — Corte y Laminado [Carruseles]-[${planta === 'UIO' ? 'Quito' : 'Guayaquil'}]`;

  // "Enviar Reporte" en 3 pasos (Guardar -> Recuperar/vista previa -> Enviar, ver
  // ReportePlanTxtFlujo.tsx): el correo sale de la foto guardada, no se recalcula después de exportar
  // a SAP (las FERT nuevas cambiarían la ocupación). Fecha objetivo = la fecha evaluada en Capacidad
  // Operativa (la misma del correo); sin fecha no se puede guardar — el reporte saldría en 0 y
  // quedaría archivado bajo una fecha que nadie eligió.
  // Respaldo completo del módulo (ver EstadoPlanCorteEspuma): cada planta guarda el suyo junto a su
  // reporte; al cargarlo se restauran las dos plantas tal como estaban al guardar.
  const capturarEstadoPlan = (): EstadoPlanCorteEspuma => {
    // De las órdenes de cada centro, el tablero solo usa las de los responsables de Corte y, aparte, las
    // FERT del día hábil anterior a la fecha evaluada (backlog real): se guarda solo eso.
    const filasDelTablero = (rows: UnifiedRow[], centro: '1000' | '2000', planta: 'UIO' | 'GYE') => {
      const permitidos = allowedRespPorCentro(centro);
      const fechaSel = Array.from(selectedDatesCapacidad[planta]).sort()[0];
      const diaAnterior = fechaSel ? format(restarDiasHabiles(parseFechaLocal(fechaSel), 1), 'yyyy-MM-dd') : '';
      return rows.filter(r => permitidos.includes(r.responsable) || (!!diaAnterior && r.fecha === diaAnterior));
    };
    const permitidas = (rows: UnifiedRow[], centro: '1000' | '2000') => rows.filter(r => allowedRespPorCentro(centro).includes(r.responsable));
    return {
      tipo: 'corte-espuma',
      version: 2,
      uioConfig, gyeConfig,
      selectedDatesCapacidad: { UIO: [...selectedDatesCapacidad.UIO], GYE: [...selectedDatesCapacidad.GYE] },
      selectedDatesProv: [...selectedDatesProv],
      selectedDatesFert: [...selectedDatesFert],
      tipoPlanEnsambladoPorCentro,
      restriccionesCorte,
      diasNoLaborables: [...diasNoLaborables],
      diasLaborablesExtra: [...diasLaborablesExtra],
      necesidadesPlantaData, necesidadPFFData, necesidadPFFNivel2Data, fertsP2Muebles, fertsPFF,
      mantenimientosCorte: uniqueMantenimientosSAP,
      resultado: {
        hoy: todayStr,
        fertAudit: { '1000': fertAuditUIO, '2000': fertAuditGYE },
        fertAuditAll: { '1000': filasDelTablero(fertAuditAllUIO, '1000', 'UIO'), '2000': filasDelTablero(fertAuditAllGYE, '2000', 'GYE') },
        provAuditAll: { '1000': permitidas(provAuditAllUIO, '1000'), '2000': permitidas(provAuditAllGYE, '2000') },
        necesidadCapacidad: { '1000': necesidadCapacidadUIO, '2000': necesidadCapacidadGYE },
        necesidadCapacidadNivel2: { '1000': necesidadCapacidadNivel2UIO, '2000': necesidadCapacidadNivel2GYE },
        clavesProvisionalesTransformadas: {
          '1000': [...(clavesProvisionalesTransformadas['1000'] ?? [])],
          '2000': [...(clavesProvisionalesTransformadas['2000'] ?? [])],
        },
        densidadCarruselesUIO: Array.from(densidadCarruselesUIO.entries()).map(([d, ids]) => [d, [...ids]] as [string, string[]]),
      },
    };
  };
  const restaurarEstadoPlan = (crudo: unknown, origen: OrigenEstadoPlan): boolean => {
    const e = crudo as Partial<EstadoPlanCorteEspuma> | null;
    if (!e || e.tipo !== 'corte-espuma' || e.version !== 2 || !e.resultado || !e.uioConfig || !e.gyeConfig) return false;
    configRestaurada.current = { UIO: e.uioConfig, GYE: e.gyeConfig };
    setUioConfig(e.uioConfig);
    setGyeConfig(e.gyeConfig);
    // Sin datos SAP de la sesión: lo que se ve sale solo del resultado guardado.
    setOrdenesProvisionales([]);
    setOrdenesFert([]);
    setInventarioSAP([]);
    setCuboInventarios([]);
    setTiemposCatalogo([]);
    setKpiLooperData([]);
    setKpiCarruselesData([]);
    setOperadoresCorte([]);
    setMantenimientosSAP(e.mantenimientosCorte ?? []);
    setRestriccionesCorte(e.restriccionesCorte ?? []);
    setDiasNoLaborables(new Set(e.diasNoLaborables ?? []));
    setDiasLaborablesExtra(new Set(e.diasLaborablesExtra ?? []));
    setNecesidadesPlantaData(e.necesidadesPlantaData ?? {});
    setNecesidadPFFData(e.necesidadPFFData ?? { '1000': [], '2000': [] });
    setNecesidadPFFNivel2Data(e.necesidadPFFNivel2Data ?? { '1000': [], '2000': [] });
    setFertsP2Muebles(e.fertsP2Muebles ?? []);
    setFertsPFF(e.fertsPFF ?? []);
    setTipoPlanEnsambladoPorCentro(e.tipoPlanEnsambladoPorCentro ?? { '1000': null, '2000': null });
    setSelectedDatesCapacidad({ UIO: new Set(e.selectedDatesCapacidad?.UIO ?? []), GYE: new Set(e.selectedDatesCapacidad?.GYE ?? []) });
    setSelectedDatesProv(new Set(e.selectedDatesProv ?? []));
    setSelectedDatesFert(new Set(e.selectedDatesFert ?? []));
    setResultadoRestaurado(e.resultado);
    setDatosCargados(true);
    setPlanCargadoDe(origen);
    setActiveTab('resumen');
    return true;
  };

  const reporteFlujoUIO = useReportePlanTxt({
    modulo: 'corte-espuma',
    centro: '1000',
    fechaObjetivo: resumenReportePorPlanta.UIO.fecha || null,
    asunto: asuntoReporteEspuma('UIO'),
    construirHtml: () => construirReporteHtmlEspuma('UIO'),
    capturarEstado: capturarEstadoPlan,
    restaurarEstado: restaurarEstadoPlan,
  });
  const reporteFlujoGYE = useReportePlanTxt({
    modulo: 'corte-espuma',
    centro: '2000',
    fechaObjetivo: resumenReportePorPlanta.GYE.fecha || null,
    asunto: asuntoReporteEspuma('GYE'),
    construirHtml: () => construirReporteHtmlEspuma('GYE'),
    capturarEstado: capturarEstadoPlan,
    restaurarEstado: restaurarEstadoPlan,
  });
  const reporteFlujo = { UIO: reporteFlujoUIO, GYE: reporteFlujoGYE };

  // Fase 2 del panel: guarda el reporte de cada centro confirmado en P3/PFD (sin preguntar si ya
  // había uno: el P3 recién confirmado lo reemplaza) y deja "Ver reporte y enviar" como siguiente
  // paso. El envío sigue siendo manual, desde la vista previa.
  useEffect(() => {
    if (!reportesPorGuardar) return;
    const centros = reportesPorGuardar;
    setReportesPorGuardar(null);
    void (async () => {
      const guardados: ('UIO' | 'GYE')[] = [];
      for (const centro of centros) {
        const planta = centro === '1000' ? 'UIO' : 'GYE';
        const flujo = reporteFlujo[planta];
        if (!flujo.config.fechaObjetivo) {
          panelProgreso.actualizar(`rep-${centro}`, { estado: 'aviso', detalle: 'Sin fecha en "Evaluar Capacidad": elige la fecha y guárdalo desde "Enviar Reporte".' });
          continue;
        }
        panelProgreso.actualizar(`rep-${centro}`, { estado: 'en_curso' });
        const ok = await flujo.guardar({ sinConfirmar: true, silencioso: true });
        panelProgreso.actualizar(`rep-${centro}`, ok
          ? { estado: 'ok', detalle: `Plan del ${flujo.config.fechaObjetivo} guardado en la carpeta compartida (todavía no se envió).` }
          : { estado: 'error', detalle: 'No se pudo guardar; reintenta desde "Enviar Reporte".' });
        if (ok) guardados.push(planta);
      }
      panelProgreso.concluir(
        guardados.length > 0 ? 'P3 y reporte guardados. Exporta a SAP si corresponde y luego revisa y envía el reporte.' : undefined,
        guardados.map(planta => ({
          etiqueta: guardados.length > 1 ? `Ver reporte ${planta === 'UIO' ? 'Quito' : 'Guayaquil'}` : 'Ver reporte y enviar',
          onClick: () => { setActiveTab('resumen'); void reporteFlujo[planta].recuperar(); },
        })),
      );
    })();
  }, [reportesPorGuardar]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const fertCubreMap = fertQueCubreUnPorMaterialPorCentro[centro];
    const stockMap = stockUnidadesPorMaterialPorCentro[centro];

    return Array.from(necesidadMap.keys())
      .filter(material => !esLaminadoCilindrico(materialDescMap.get(material) || ''))
      .map((material): RespuestaP3Row => {
      // FERT (vigente y anterior) queda SOLO informativa, no cubre — regla del usuario (2026-09-23):
      // las órdenes liberadas se generaron para cubrir el plan ANTERIOR; sumarlas al plan nuevo
      // duplicaba cobertura y le restaba necesidad al ciclo siguiente. Aplica a todas las áreas.
      // Cobertura del plan nuevo = provisionales (ventana de fecha de su área) + stock (por lote puede
      // cubrir la necesidad anterior y también la siguiente). Excepción: Venta Externa con FERT al PT
      // de su P2 (fertCubre, ver fertQueCubreUnPorMaterialPorCentro).
      const fertVigente = fertMapVigente.get(material) || 0;
      const fertCubre = fertCubreMap.get(material) || 0;
      const fertAnterior = fertMapAnterior.get(material) || 0;
      const provisional = provisionalMap.get(material) || 0;
      const stock = stockMap.get(material) || 0;
      const necesidad = necesidadMap.get(material) || 0;

      const disponible = stock + provisional + fertCubre;
      const cubierto = Math.min(necesidad, disponible);
      const faltante = Math.max(0, necesidad - disponible);
      // Lo que se graba en el P3 y sale a SAP (regla del usuario 2026-10-03): la provisional en
      // ventana NO es una orden todavía — viaja en el P3 con su cantidad (el lote que fijó SAP) más el
      // faltante, y Exportar a SAP la convierte con el codigo_detalle_tactico de esa línea. Stock y FERT
      // sí son cobertura ya resuelta: no generan línea. Si stock + FERT ya cubren la necesidad, la
      // provisional no hace falta este ciclo (no se convierte).
      const requeridoSinProvisional = Math.max(0, necesidad - stock - fertCubre);
      const aP3 = requeridoSinProvisional > 0 ? Math.max(provisional, requeridoSinProvisional) : 0;
      const cantidadUnidades = esPFD ? aP3 : cubierto;
      // Kg SOLO informativo (badge de capacidad/peso) — no decide cobertura ni estado. Puede dar 0
      // para materiales sin geometría parseable aunque su faltante real (en UN) sea mayor que cero.
      const pesoUN = pesoUNPorMaterial.get(material) || 0;
      const faltanteKgEstimado = faltante * pesoUN;

      let fuente: FuenteRespuestaP3;
      if (necesidad <= 0) fuente = 'Sin dato';
      else if (esPFD) fuente = aP3 > 0 ? 'Producir' : 'Cubierto';
      else if (cubierto <= 0) fuente = 'Sin cobertura';
      else {
        const partes = [
          stock > 0 ? 'Stock' : null,
          provisional > 0 ? 'Provisional' : null,
          fertCubre > 0 ? 'FERT' : null,
        ].filter(Boolean);
        fuente = (partes.length > 1 ? partes.join(' + ') : partes[0]) as FuenteRespuestaP3;
      }

      const origenesDeMaterial = origenesMap.get(material);
      const origenes = origenesDeMaterial && origenesDeMaterial.size > 0
        ? Array.from(origenesDeMaterial.values()).map(o => `${o.codigoPadre}${o.nivel ? ` N${o.nivel}` : ''}`).join(', ')
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
        fertCubre,
        cubierto,
        faltante,
        aP3,
        faltanteKgEstimado,
        origenes,
        fuente
      };
    // Con respuesta primero (de lo contrario, al no tener paginación este tab, la pantalla inicial
    // muestra solo los "Sin dato" y da la falsa impresión de que todo devuelve 0 — caso real: 148 de
    // 182 materiales sí tenían respuesta, pero quedaban ocultos tras hacer scroll).
    }).sort((a, b) => Number(b.tienePlan) - Number(a.tienePlan));
  }, [materialNecesidadesPlantaMapPorCentro, materialOrigenesPlantaMapPorCentro, provisionalUnPorMaterialPorCentro, fertUnPorMaterialPorCentro, fertQueCubreUnPorMaterialPorCentro, stockUnidadesPorMaterialPorCentro, materialDescMap, pesoUNPorMaterial]);

  // Reparte `cantidad` (en UNIDADES) de un material entre sus planes P2 origen, proporcional a la
  // necesidad que cada uno aportó — mismo criterio que getOrigenesProrrateo de Corte y Laminado, pero
  // SIN redondeo a "rollo" (Espuma no tiene esa unidad física; se redondea a unidad entera). Si no hay
  // origen registrado EN ABSOLUTO, referencia el propio plan P3 recién creado como fallback — un
  // origen SÍ registrado pero con necesidad 0 es un origen real y no debe caer en este fallback (mismo
  // bug corregido en getOrigenesProrrateo de Corte y Laminado: auto-referenciar el P3 en vez del P2
  // real). El nombre del campo/parámetro ya no dice "Kg" — desde el fix de Respuesta P3 en UN, esta
  // función siempre recibe y devuelve unidades, nunca kilogramos.
  // Cada origen puede venir abierto por nivel BOM (P1/PFF): el split lleva `nivel` y se graba como
  // línea aparte (ver sufijoNivelBom).
  const getOrigenesProrrateoEspuma = useCallback((material: string, cantidad: number, centro: '1000' | '2000', fallbackCodigoPlanGrupo: number): { codigoPadre: number; nivel?: NivelBom; cantidad: number }[] => {
    const origenes = materialOrigenesPlantaMapPorCentro[centro].get(material);
    if (!origenes || origenes.size === 0) {
      return [{ codigoPadre: fallbackCodigoPlanGrupo, cantidad: Math.round(cantidad) }];
    }
    const entradas = Array.from(origenes.values());
    if (cantidad <= 0) {
      return entradas.map(({ codigoPadre, nivel }) => ({ codigoPadre, nivel, cantidad: 0 }));
    }
    const totalOrigen = entradas.reduce((s, o) => s + o.qty, 0);
    // Todos los orígenes registrados pidieron 0: se asigna completo al primero en vez de
    // auto-referenciar el P3 recién creado.
    if (totalOrigen <= 0) {
      return entradas.map(({ codigoPadre, nivel }, i) => ({ codigoPadre, nivel, cantidad: i === 0 ? Math.round(cantidad) : 0 }));
    }
    return entradas.map(({ codigoPadre, nivel, qty }) => ({
      codigoPadre,
      nivel,
      cantidad: Math.round(cantidad * (qty / totalOrigen))
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

  // onConsulta (opcional): avisa cada consulta SAP terminada — la usa el panel de progreso de
  // "Sincronizar y generar necesidades" para mostrar el avance (x/9) y cuáles fallaron. Devuelve
  // false si la sincronización se cortó por un error.
  const fetchDataAsync = useCallback(async (onConsulta?: (nombre: string, ok: boolean) => void): Promise<boolean> => {
    setIsLoading(true);
    const seguir = <T,>(nombre: string, promesa: Promise<T>): Promise<T> => promesa.then(
      r => { onConsulta?.(nombre, true); return r; },
      e => { onConsulta?.(nombre, false); throw e; }
    );
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
      const timesPromise = seguir('Tiempos de corte', fetchTiemposCorteYLaminado());
      const [provsRes, fertsRes, invRes, skillsRes, maintRes, kpiRes, carruselesRes, cuboRes] = await Promise.all([
        seguir('Órdenes provisionales', serviciosService.OrdenesProvisionalesPaginados(1, 20000)).catch(() => ({ data: [] })),
        seguir('Órdenes FERT', serviciosService.getOrdenesFert(1, 20000)).catch(() => ({ data: [] })),
        seguir('Inventario SAP', serviciosService.getInventarioAñoActual()).catch(() => ({ data: [] })),
        seguir('Habilidades de operadores', serviciosService.getCuboHabilidadesOP()).catch(() => ({ data: [] })),
        seguir('Mantenimientos', serviciosService.ListarMantenimientoPreventivosProgramados()).catch(() => ({ data: [] })),
        seguir('KPI Looper', serviciosService.getKPIMaestroLooper()).catch(() => ({ data: [] })),
        seguir('KPI Carruseles', serviciosService.getKPIMaestroCarruseles()).catch(() => ({ data: [] })),
        seguir('Cubo de inventarios', serviciosService.getCuboInventarios(1, 50000)).catch(() => ({ data: [] }))
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
        diasLaborablesExtra: previo?.diasLaborablesExtra || [],
        necesidadesPlantaData: previo?.necesidadesPlantaData || {},
        necesidadPFFData: previo?.necesidadPFFData || { '1000': [], '2000': [] },
        necesidadPFFNivel2Data: previo?.necesidadPFFNivel2Data || { '1000': [], '2000': [] },
      });

      setDatosCargados(true);
      return true;
    } catch (e) {
      console.error('Error sincronización', e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTiemposCorteYLaminado]);

  // Último diagnóstico de recuperación de P2 (ver pasoPanelDiagnosticoP2): lo muestra el panel.
  const diagnosticoP2Ref = useRef<DiagnosticoP2 | null>(null);
  const fetchNecesidadesPlanta = useCallback(async (diasOverride?: DiasNoLaborables, laborablesExtraOverride?: DiasNoLaborables) => {
    setNecesidadesPlantaLoading(true);
    diagnosticoP2Ref.current = null;
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

      // El grupo 3 (origen de los P2 "- ESPUMA"/"- LAMINA") entra siempre, esté o no
      // en ALMACEN_CONSUMO — aquí solo se toma su variante "- ESPUMA" (ver esP2ParaModulo).
      const gruposFiltrados = (gruposRes.data || []).filter((g) => g.estado === 'A' && (almacenConsumoNames.includes(normalizeName(g.nombre_grupo)) || g.codigo_grupo === CODIGO_GRUPO_P2_MUEBLES));
      const gruposCodigos = gruposFiltrados.map((g) => g.codigo_grupo);
      const grupoPorCodigo = new Map(gruposFiltrados.map((g) => [g.codigo_grupo, g]));

      if (gruposCodigos.length === 0) {
        setNecesidadesPlantaData({}); setFertsP2Muebles([]);
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
      // Venta Externa (Espumas) — 2026-10-02: VE vuelve a grabar fecha_inicio_plan = recuperación
      // (hoy+1 hábil) y fecha_fin_plan = PT (hoy+2), así que cae en la MISMA regla exacta que el resto.
      // Se quitó la excepción de abajo (tomaba el activo más reciente sin mirar la fecha). Historial:
      // HISTORIAL — Venta Externa "Espumas": ya NO se graba a hoy+1 fijo (generarPlanP2Core ahora usa
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
      const fechaObjetivoP2 = format(nextBusinessDayCal(new Date(), diasOverride ?? diasNoLaborables, laborablesHorizonte(laborablesExtraOverride ?? diasLaborablesExtra)), 'yyyy-MM-dd');
      // PT del ciclo (hoy+2 hábiles): el P2 de Venta Externa es un plan de ENTREGA y se reconoce por su
      // PT (fecha_fin_plan). Se acepta también inicio = recuperación: así entran tanto los P2 grabados
      // con la convención vieja (inicio = fin = PT, ej. #1006/#1008 del 02/10) como los nuevos
      // (inicio = hoy+1, fin = PT). Muebles (grupo 3) es subproceso: solo inicio = hoy+1.
      const fechaPTCiclo = format(addBusinessDaysCal(new Date(), DIAS_HABILES_PT_ENSAMBLADO, diasOverride ?? diasNoLaborables, laborablesHorizonte(laborablesExtraOverride ?? diasLaborablesExtra)), 'yyyy-MM-dd');

      const planGruposRes = await planGrupoService.getAll();
      const candidatosBase = (planGruposRes.data || []).filter((pg) => {
        const valor = String(pg.valor || '').trim();
        if (pg.estado !== 'A' || !gruposCodigos.includes(pg.codigo_grupo)) return false;
        if (!/plan\s*t[aá]ctico.*centro.*p2/i.test(valor)) return false;
        const esVentaExterna = /venta\s*externa/i.test(grupoPorCodigo.get(pg.codigo_grupo)?.nombre_grupo || '');
        if (esVentaExterna && !/espuma/i.test(valor)) return false;
        if (!esP2ParaModulo(pg, 'ESPUMA')) return false;
        return true;
      });

      // fechaLocalEcuador, NO split('T')[0]: fecha_inicio_plan es UTC — mismo bug de zona horaria
      // que en explotarPFFParaCentro (ver su comentario). Un P2 grabado tarde en el día cruzaba a
      // la fecha calendario siguiente en UTC y dejaba de coincidir con fechaObjetivoP2 (local).
      const esP2VentaExterna = (pg: PlanGrupo) => /venta\s*externa/i.test(grupoPorCodigo.get(pg.codigo_grupo)?.nombre_grupo || '');
      const planesActivos = candidatosBase.filter((pg) =>
        fechaLocalPlana(pg.fecha_inicio_plan) === fechaObjetivoP2
        || (esP2VentaExterna(pg) && fechaLocalPlana(pg.fecha_fin_plan) === fechaPTCiclo)
      );
      // P2 activos que no son de este ciclo (el origen no los apagó): se avisan en consola para poder
      // distinguir "no hay P2" de "hay P2 pero vencido".
      const vencidos = candidatosBase.filter((pg) => !planesActivos.includes(pg));
      const describirP2 = (pg: PlanGrupo) => `#${pg.codigo_plan_grupo} ${String(pg.valor || '').replace(/^plan\s*t[aá]ctico\s*-\s*/i, '')} (${fechaLocalPlana(pg.fecha_inicio_plan)} → ${fechaLocalPlana(pg.fecha_fin_plan)})`;
      diagnosticoP2Ref.current = { recuperacion: fechaObjetivoP2, pt: fechaPTCiclo, usados: planesActivos.map(describirP2), fuera: vencidos.map(pg => ({ texto: describirP2(pg), fin: fechaLocalPlana(pg.fecha_fin_plan) })) };
      if (vencidos.length > 0) {
        console.warn(`[Necesidades Planta] P2 activos fuera del ciclo (recuperación ${fechaObjetivoP2} / PT ${fechaPTCiclo}):`,
          vencidos.map((pg) => `#${pg.codigo_plan_grupo} ${pg.valor} (${fechaLocalPlana(pg.fecha_inicio_plan)} → ${fechaLocalPlana(pg.fecha_fin_plan)})`));
      }


      const planGrupoCodigos = planesActivos.map((pg) => pg.codigo_plan_grupo);
      const planPorCodigo = new Map(planesActivos.map((pg) => [pg.codigo_plan_grupo, pg]));

      if (planGrupoCodigos.length === 0) {
        setNecesidadesPlantaData({}); setFertsP2Muebles([]);
        return;
      }

      // 3. DetalleTactico asociado a los PlanGrupo encontrados
      const detallesRes = await detalleTacticoService.getAll();
      const detalles = (detallesRes.data || []).filter((d) => planGrupoCodigos.includes(d.codigo_plan_grupo));

      const grouped: Record<string, NecesidadPlantaRow[]> = {};
      const ferts: NecesidadPlantaRow[] = [];
      detalles.forEach((d) => {
        const plan = planPorCodigo.get(d.codigo_plan_grupo);
        const grupo = plan ? grupoPorCodigo.get(plan.codigo_grupo) : undefined;
        const area = grupo?.nombre_grupo || 'Sin Área Asignada';
        // El P2 "ESPUMA MUEBLES" trae sus FERT de origen además de las láminas: esos van aparte (ver
        // fertsP2Muebles), no son algo que Corte Espuma corte ni responda.
        const destino = plan?.codigo_grupo === CODIGO_GRUPO_P2_MUEBLES && ES_CODIGO_FERT(d.codigo_material)
          ? ferts
          : (grouped[area] ??= []);
        destino.push({
          codigo_material: d.codigo_material,
          cantidad_produccion_neta: d.cantidad_produccion_neta,
          // fechaLocalEcuador: estas fechas alimentan fechasP2PorMaterialPorCentro, que decide si
          // una orden Provisional/FERT "responde" a esta necesidad — un desfase de un día aquí
          // rechazaba coberturas reales (mismo bug que en explotarPFFParaCentro).
          fecha_inicio: plan?.fecha_inicio_plan ? fechaLocalPlana(plan.fecha_inicio_plan) : '—',
          fecha_fin: plan?.fecha_fin_plan ? fechaLocalPlana(plan.fecha_fin_plan) : '—',
          codigo_grupo: plan?.codigo_grupo ?? 0,
          codigo_plan_grupo: d.codigo_plan_grupo,
          centro: String(grupo?.centro || '')
        });
      });

      setNecesidadesPlantaData(grouped);
      setFertsP2Muebles(ferts);
      setVerificacionBomP2(null);
      actualizarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, { necesidadesPlantaData: grouped, fertsP2Muebles: ferts });
    } catch (e) {
      console.error('Error al recuperar necesidades de planta', e);
      setNecesidadesPlantaData({});
      setFertsP2Muebles([]);
    } finally {
      setNecesidadesPlantaLoading(false);
    }
  }, [diasNoLaborables, diasLaborablesExtra]);

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

  // ¿Un componente del BOM es de Corte Espuma en este centro? Relevancia por RESPONSABLE (criterio
  // autoritativo, el mismo que usa el resto del módulo), con el patrón de nombres como respaldo para
  // los componentes sin responsable conocido. FORRO y PRENSADO nunca son de corte aunque su
  // responsable coincida (ver los comentarios en explotarPFFParaCentroConFecha). Compartido por la
  // explosión PFF y la Verificación BOM del P2 Muebles, para que ambas decidan igual.
  const esComponenteDeCorte = useCallback((desc: string, codigo: string, centro: string): boolean => {
    if (ES_FORRO(desc) || /PRENSAD/i.test(desc)) return false;
    const resp = materialRespCPPorCentro[centro]?.get(codigo) || '';
    return resp
      ? allowedRespPorCentro(centro).includes(resp) && !respExcepcionExcluye(centro, resp, codigo)
      : ES_LAMINA_CORTADA(desc);
  }, [allowedRespPorCentro, materialRespCPPorCentro]);

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
  ): Promise<{ filas: NecesidadPlantaRow[]; sinMatch: string[]; conError: string[]; tipoPlan: 'P1' | 'PFF' | null; ferts: NecesidadPlantaRow[] }> => {
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
      // fechaLocalEcuador, NO fechaLocalPlana: a diferencia del P2/P3/PFD que graba esta misma app (ver
      // convención "naive Ecuador" en dias-laborables.ts), el PlanGrupo "P1"/"PFF" lo graba el proceso
      // EXTERNO de Ensamblado con timestamp UTC real — la migración del 2026-09-10 (commit 13c4f84)
      // cambió esta línea a fechaLocalPlana por error (reemplazo masivo) y resucitó el bug original que
      // este mismo comentario describe: un plan guardado tarde en el día en Ecuador (ej. 22:00) cruza a
      // la fecha calendario SIGUIENTE en UTC — el recorte ingenuo del ISO (lo que hace fechaLocalPlana)
      // devuelve un día de más. Caso real que lo destapó originalmente: el P1 #279 grabado a las 17:00
      // (UTC 22:00, mismo día) coincidía por casualidad; el PFF #292 que lo reemplazó, grabado a las
      // 22:00 (UTC 03:00 del día SIGUIENTE), dejaba de coincidir con la ventana esperada y el módulo
      // reportaba "no hay ningún Plan Grupo P1/PFF activo" aunque sí existiera.
      return fechaLocalEcuador(p.fecha_inicio_plan) === fechaObjetivoPFF;
    });
    // Solo el plan PFF MÁS RECIENTE del grupo — red de seguridad secundaria para el caso (menos común
    // ahora que planesPFFCrudo ya exige fecha_inicio_plan = hoy+DIAS_HABILES_PT_ENSAMBLADO días hábiles) de que el origen
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
    if (planesPFF.length === 0) return { filas: [], sinMatch: [], conError: [], tipoPlan, ferts: [] };

    const planPorCodigo = new Map(planesPFF.map(p => [p.codigo_plan_grupo, p]));
    const codigosPlanPFF = new Set(planesPFF.map(p => p.codigo_plan_grupo));
    const detallesPFF = detallesTodos.filter(d => d.estado === 'A' && codigosPlanPFF.has(d.codigo_plan_grupo));
    if (detallesPFF.length === 0) return { filas: [], sinMatch: [], conError: [], tipoPlan, ferts: [] };

    const qtyPorMaterialYPlan = new Map<string, Map<number, number>>();
    detallesPFF.forEach(d => {
      const code = cleanCode(d.codigo_material);
      if (!code) return;
      if (!qtyPorMaterialYPlan.has(code)) qtyPorMaterialYPlan.set(code, new Map());
      const porPlan = qtyPorMaterialYPlan.get(code)!;
      porPlan.set(d.codigo_plan_grupo, (porPlan.get(d.codigo_plan_grupo) || 0) + parseQty(d.cantidad_produccion_neta));
    });

    // resultado[codigo_plan_grupo][codigo_lamina] = cantidad por nivel BOM (1 = directa del FERT, 2+ = vía semielaborado)
    const resultadoPorPlan = new Map<number, Map<string, { n1: number; n2: number }>>();
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
          // Cada línea del BOM que llega a una lámina de corte es consumo real y se SUMA (verificado
          // con el usuario 2026-09-29, PFF #942, lámina 30000282: FERT 20001527 la trae en DOS
          // posiciones de nivel 1 (21+21) y otros 4 FERT la traen vía semielaborado en nivel 2 (18) —
          // la necesidad real es 60; el criterio anterior de "una sola línea por componente" daba 39).
          // Solo se descarta la fila corrupta ya documentada (ver lineaBomValida). La cantidad de cada
          // línea se separa además en nivel 1 (directa del FERT) y nivel 2+ (vía semielaborado).
          const porComponente = new Map<string, { n1: number; n2: number }>();

          (rawData as Record<string, unknown>[]).forEach((row) => {
            const desc = String(row.DESCRIPCION_COMPONENTE || '');
            if (TIENE_COMPONENTE_ESPUMA(desc)) tieneAlgunEspuma = true;
            const laminaCode = cleanCode(row.COMPONENTE);
            if (!laminaCode) return;
            if (desc) descripcionesBomRef.current.set(laminaCode, desc);

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
            if (!esComponenteDeCorte(desc, laminaCode, centro)) return;

            encontroMatch = true;
            const linea = leerLineaBom(row, materialCode);
            if (!linea.valida) return;
            const acum = porComponente.get(laminaCode) || { n1: 0, n2: 0 };
            if (linea.nivelBom === 1) acum.n1 += linea.cantAcumulada; else acum.n2 += linea.cantAcumulada;
            porComponente.set(laminaCode, acum);
          });

          porComponente.forEach(({ n1, n2 }, laminaCode) => {
            const porPlan = qtyPorMaterialYPlan.get(materialCode)!;
            porPlan.forEach((qtyPFF, codigoPlanGrupo) => {
              if (!resultadoPorPlan.has(codigoPlanGrupo)) resultadoPorPlan.set(codigoPlanGrupo, new Map());
              const porLamina = resultadoPorPlan.get(codigoPlanGrupo)!;
              const acum = porLamina.get(laminaCode) || { n1: 0, n2: 0 };
              acum.n1 += qtyPFF * n1;
              acum.n2 += qtyPFF * n2;
              porLamina.set(laminaCode, acum);
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
      // fechaLocalEcuador, NO fechaLocalPlana: `plan` acá es el PlanGrupo "P1"/"PFF" de Ensamblado
      // (externo, timestamp UTC real — ver el comentario en planesPFFCrudo más arriba), no un P2/P3/PFD
      // propio en convención naive. Esta fecha termina en fechasP2PorMaterialPorCentro y decide si una
      // orden real cubre esta necesidad del PFF.
      const fechaInicio = plan?.fecha_inicio_plan ? fechaLocalEcuador(plan.fecha_inicio_plan) : '—';
      const fechaFin = plan?.fecha_fin_plan ? fechaLocalEcuador(plan.fecha_fin_plan) : fechaInicio;
      porLamina.forEach(({ n1, n2 }, codigoLamina) => {
        filas.push({
          codigo_material: Number(codigoLamina),
          cantidad_produccion_neta: (n1 + n2).toFixed(4),
          cantidad_nivel1: n1,
          cantidad_nivel2: n2,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          codigo_grupo: codigoGrupoEnsamblado,
          codigo_plan_grupo: codigoPlanGrupo,
          centro,
        });
      });
    });

    // FERT de origen tal como vienen en el PFF — solo para la Verificación BOM del tab Necesidades
    // Planta (ver verificarBomP2Muebles), no entran a ningún cálculo.
    const ferts: NecesidadPlantaRow[] = [];
    qtyPorMaterialYPlan.forEach((porPlan, fert) => porPlan.forEach((qty, codigoPlanGrupo) => {
      ferts.push({
        codigo_material: Number(fert),
        cantidad_produccion_neta: String(qty),
        fecha_inicio: '—',
        fecha_fin: '—',
        codigo_grupo: codigoGrupoEnsamblado,
        codigo_plan_grupo: codigoPlanGrupo,
        centro,
      });
    }));

    return { filas, sinMatch, conError, tipoPlan, ferts };
  }, [esComponenteDeCorte]);

  // Wrapper de siempre: hoy+DIAS_HABILES_PT_ENSAMBLADO días hábiles (antes +3), delega en explotarPFFParaCentroConFecha. Mismo
  // nombre/firma/comportamiento de antes — no cambia nada para calcularNecesidadPFF.
  const explotarPFFParaCentro = useCallback((
    codigoGrupoEnsamblado: number,
    centro: '1000' | '2000',
    planesTodos: PlanGrupo[],
    detallesTodos: DetalleTactico[],
    onStep: () => void
  ) => explotarPFFParaCentroConFecha(codigoGrupoEnsamblado, centro, planesTodos, detallesTodos, format(sumarDiasHabiles(new Date(), DIAS_HABILES_PT_ENSAMBLADO), 'yyyy-MM-dd'), onStep),
  [explotarPFFParaCentroConFecha, sumarDiasHabiles]);

  // Verificación BOM (tab Necesidades Planta, bajo demanda): explota cada FERT del P2 "ESPUMA MUEBLES"
  // y del P1/PFF de Ensamblado y recalcula la lámina de corte que debería pedir, para compararla con
  // lo que quedó como necesidad (que es lo que responden el P3/PFD y lo que sale a SAP). Solo lectura: no cambia la
  // necesidad ni el P3, sirve para auditar diferencias como "el BOM da 126 y el P2 dice 138".
  // Se muestran dos totales porque la explosión PFF de Ensamblado deja UNA línea por componente y
  // FERT, mientras que un componente con dos líneas de consumo reales en el árbol debería sumarlas —
  // ver ambas contra el P2 dice cuál criterio usó el origen.
  const verificarBomP2Muebles = useCallback(async () => {
    const fertsOrigen = [...fertsP2Muebles, ...fertsPFF];
    if (fertsOrigen.length === 0) {
      addNotification('warning', 'No hay FERT de origen para verificar (P2 Muebles / PFF). Sincroniza primero.');
      return;
    }
    // Cantidad por FERT, separada por centro y plan de origen (un mismo FERT puede venir en el P2
    // Muebles y en el PFF a la vez; cada plan se compara contra lo que él mismo registró).
    const fertPorPlan = new Map<string, number>();
    fertsOrigen.forEach(r => {
      const key = `${r.centro}|${r.codigo_plan_grupo}|${Number(r.codigo_material)}`;
      fertPorPlan.set(key, (fertPorPlan.get(key) || 0) + parseQty(r.cantidad_produccion_neta));
    });
    const origenPorPlan = new Map<number, string>();
    fertsP2Muebles.forEach(r => origenPorPlan.set(r.codigo_plan_grupo, 'P2 Muebles'));
    fertsPFF.forEach(r => origenPorPlan.set(r.codigo_plan_grupo, 'Ensamblado P1/PFF'));

    setIsVerificandoBomP2(true);
    setVerificacionBomP2Progreso({ current: 0, total: fertPorPlan.size });
    const porComponente = new Map<string, VerificacionBomP2Row>();
    const errores: string[] = [];
    const filaDe = (centro: string, plan: number, componente: string, descripcion: string) => {
      const key = `${centro}|${plan}|${componente}`;
      if (!porComponente.has(key)) {
        porComponente.set(key, { centro, codigoPlanGrupo: plan, origen: origenPorPlan.get(plan) || '—', componente, descripcion, p2Registrado: 0, bomSumaLineas: 0, bomNivel1: 0, bomNivel2: 0, lineas: [] });
      }
      return porComponente.get(key)!;
    };

    const explosionCache = new Map<string, Record<string, unknown>[]>();
    let paso = 0;
    for (const [key, cantidadFert] of fertPorPlan) {
      const [centro, planStr, fert] = key.split('|');
      const plan = Number(planStr);
      try {
        const cacheKey = `${centro}|${fert}`;
        if (!explosionCache.has(cacheKey)) {
          const response = await serviciosService.getMaestroMaterialesExplosion(centro, fert.padStart(18, '0'), 1, 500);
          const data = response?.data?.data || response?.data || [];
          explosionCache.set(cacheKey, Array.isArray(data) ? data as Record<string, unknown>[] : []);
        }
        explosionCache.get(cacheKey)!.forEach(row => {
          const desc = String(row.DESCRIPCION_COMPONENTE || '');
          const componente = cleanCode(row.COMPONENTE);
          if (componente && desc) descripcionesBomRef.current.set(componente, desc);
          if (!componente || !esComponenteDeCorte(desc, componente, centro)) return;
          const linea = leerLineaBom(row, fert);
          const consumo = cantidadFert * linea.cantAcumulada;
          const fila = filaDe(centro, plan, componente, desc);
          fila.lineas.push({
            fert, cantidadFert, nivel: linea.nivel, materialPadre: linea.materialPadre,
            cantUnitaria: linea.cantUnitaria, cantAcumulada: linea.cantAcumulada,
            unidad: String(row.UNIDAD || row.UNIDAD_MEDIDA || '—'),
            consumo, nivelBom: linea.nivelBom, valida: linea.valida,
          });
          if (!linea.valida) return;
          fila.bomSumaLineas += consumo;
          if (linea.nivelBom === 1) fila.bomNivel1 += consumo; else fila.bomNivel2 += consumo;
        });
      } catch (e) {
        console.warn(`[Verificación BOM] Error explotando ${fert} (centro ${centro}):`, (e as Error).message);
        errores.push(fert);
      }
      setVerificacionBomP2Progreso({ current: ++paso, total: fertPorPlan.size });
    }

    // Lo que cada plan registró por lámina: el P2 Muebles (grupo 3) y la necesidad PFF ya explotada.
    [
      ...Object.values(necesidadesPlantaData).flat().filter(r => r.codigo_grupo === CODIGO_GRUPO_P2_MUEBLES),
      ...necesidadPFFData['1000'], ...necesidadPFFData['2000'],
    ].forEach(r => {
      const componente = String(Number(r.codigo_material));
      filaDe(r.centro, r.codigo_plan_grupo, componente, materialDescMap.get(componente) || '—').p2Registrado += parseQty(r.cantidad_produccion_neta);
    });

    const filas = Array.from(porComponente.values())
      .map(f => ({ ...f, descripcion: materialDescMap.get(f.componente) || f.descripcion }))
      .sort((a, b) => Math.abs(b.p2Registrado - b.bomSumaLineas) - Math.abs(a.p2Registrado - a.bomSumaLineas));
    setVerificacionBomP2(filas);
    setVerificacionBomP2Errores(errores);
    setIsVerificandoBomP2(false);
  }, [fertsP2Muebles, fertsPFF, necesidadesPlantaData, necesidadPFFData, materialDescMap, esComponenteDeCorte, addNotification]);

  // Botón manual "Calcular Necesidad PFF": corre la explosión para Ensamblado - Quito (1000, grupo 1)
  // Y Ensamblado - Guayaquil (2000, grupo 6) en la misma acción. A diferencia de Corte y Laminado
  // (que solo tiene flujo de guardado para Centro 1000), Corte Espuma ya soporta la Respuesta P3
  // completa para ambos centros, así que ambos resultados alimentan por igual el prorateo real.
  // El resultado lo muestra el panel de progreso (único llamador), sin toast aparte que lo tape.
  const calcularNecesidadPFF = useCallback(async (): Promise<{ estado: 'ok' | 'aviso' | 'error'; mensaje: string; progreso?: { actual: number; total: number } }> => {
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
      const fertsEnsamblado = [...resultado1000.ferts, ...resultado2000.ferts];
      setFertsPFF(fertsEnsamblado);
      setVerificacionBomP2(null);
      setTipoPlanEnsambladoPorCentro({ '1000': resultado1000.tipoPlan, '2000': resultado2000.tipoPlan });
      actualizarEnCache<SnapshotCorteEspuma>(CACHE_CORTE_ESPUMA, { necesidadPFFData: pff, fertsPFF: fertsEnsamblado });

      // Nivel 2 de Capacidad Operativa (red de seguridad, ciclo atrasado un día — ver renderDashboard):
      // mismos planesTodos/detallesTodos ya obtenidos arriba, sin fetch extra, apuntando un día hábil
      // antes que el ciclo "a tiempo" (hoy+1 con DIAS_HABILES_PT_ENSAMBLADO = 2). Silencioso (onStep no-op, no se suma al contador de progreso visible ni se muestra en
      // la notificación) para no confundir el flujo principal — solo alimenta Capacidad Planificada.
      const fechaObjetivoNivel2 = format(sumarDiasHabiles(new Date(), DIAS_HABILES_PT_ENSAMBLADO - 1), 'yyyy-MM-dd');
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
        return { estado: 'aviso', mensaje: 'Sin Plan Grupo "P1"/"PFF" activo en ningún centro.' };
      }

      const incidencias = [
        sinMatch.length > 0 ? `${sinMatch.length} material(es) sin lámina cortada en su BOM` : null,
        conError.length > 0 ? `${conError.length} material(es) con error al consultar el BOM` : null,
      ].filter(Boolean).join(' · ');
      const etiquetaTipo = (t: 'P1' | 'PFF' | null) => t ? ` (${t})` : '';
      const mensajePFF = `${resultado1000.filas.length} línea(s) Quito${etiquetaTipo(resultado1000.tipoPlan)}, ${resultado2000.filas.length} línea(s) Guayaquil${etiquetaTipo(resultado2000.tipoPlan)}.${incidencias ? ' ' + incidencias : ''}`;
      return { estado: conError.length > 0 || sinMatch.length > 0 ? 'aviso' : 'ok', mensaje: mensajePFF, progreso: { actual: current, total } };
    } catch (e) {
      return { estado: 'error', mensaje: (e as Error).message };
    } finally {
      setIsCalculandoPFF(false);
    }
  }, [explotarPFFParaCentro, explotarPFFParaCentroConFecha, sumarDiasHabiles]);

  // Segunda fase de "Sincronizar y Generar Necesidades" (ver handleSincronizarYGenerar): corre
  // calcularNecesidadPFF automáticamente en cuanto el render con los datos recién sincronizados ya
  // ocurrió — acá arriba, calcularNecesidadPFF ya es la versión fresca (sus dependencias, como
  // explotarPFFParaCentro, ya se recalcularon con el inventarioSAP/materialDescMap actualizados).
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    setSyncStep('generando');
    panelProgreso.actualizar('pff', { estado: 'en_curso' });
    calcularNecesidadPFF()
      .then(r => {
        // El conteo final llega en r.progreso: el último setPffProgress se aplica en el mismo render
        // que syncStep vuelve a 'idle', así que el efecto de avance no alcanza a reflejarlo (quedaba N-1/N).
        panelProgreso.actualizar('pff', { estado: r.estado, detalle: r.mensaje, ...(r.progreso ? { progreso: r.progreso } : {}) });
        panelProgreso.concluir();
      })
      .finally(() => setSyncStep('idle'));
  }, [autoGenerarPendiente, calcularNecesidadPFF, panelProgreso]);

  // Avance del cálculo PFF (materiales explotados / total) reflejado en el panel mientras corre.
  useEffect(() => {
    if (syncStep !== 'generando' || pffProgress.total === 0) return;
    panelProgreso.actualizar('pff', { progreso: { actual: pffProgress.current, total: pffProgress.total } });
  }, [syncStep, pffProgress, panelProgreso.actualizar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arma la vista previa de la Respuesta P3 de UN centro — no toca el estado, la decisión de abrir el
  // diálogo (y con qué centros) queda en manos de quien llama (handleAbrirRespuestaP3PFD /
  // handleAbrirRespuestaP3PFDTodos, más abajo).
  // 2026-10-03 (decisión del usuario): el P3 publica el FALTANTE (lo que hay que fabricar) y ya no se
  // graba un PFD aparte — P3 y PFD eran redundantes. Exportar a SAP y Venta Externa leen este P3.
  const construirPreviewP3 = useCallback((centro: '1000' | '2000'): PlanGrupoPreviewEspuma | null => {
    const todas = respuestaSalidaRowsPorCentro(centro, true);
    if (todas.length === 0) return null;
    // Sin líneas en 0 (regla del usuario 2026-10-03): solo viaja lo que hay que fabricar (faltante +
    // provisional a convertir, ver aP3). Lo cubierto con stock/FERT no se graba; Venta Externa lo da por
    // cubierto al emparejar P2 vs P3. Si todo
    // queda cubierto se graba igual la cabecera del P3 (sin líneas) para dejar constancia de la respuesta.
    const rows = todas.filter(r => r.necesidad > 0 && r.cantidadUnidades > 0);
    const cubiertos = todas.filter(r => r.necesidad > 0 && r.cantidadUnidades <= 0).length;
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
      rows,
      cubiertos
    };
  }, [respuestaSalidaRowsPorCentro, siguienteDiaHabil]);


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
        // Un P3 nuevo supera P3 y PFD viejos (desde 2026-10-03 ya no se graba PFD: el P3 es el faltante).
        if (esPFD && !/pfd/i.test(valor)) return false;
        // fechaLocalEcuador: fechaNuevoPlan es una fecha LOCAL (siguienteDiaHabil); comparar contra
        // el recorte crudo de un fecha_inicio_plan (UTC) podía fallar la superación de planes justo
        // en el filo del día.
        const inicio = fechaLocalPlana(p.fecha_inicio_plan);
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
  // getOrigenesProrrateoEspuma), no en Kg — mismo criterio que guardarPlanGrupoEspuma.
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
      existentesPorClave.set(`${claveMaterial(d.codigo_material)}|${d.codigo_plan_grupo_padre}|${nivelBomDeLinea(d.linea_produccion) ?? ''}`, d);
    });

    const salidaFresca = respuestaSalidaRowsPorCentro(centro, true); // P3 y PFD = faltante

    const clavesUsadas = new Set<string>();
    const rows: EditableDetalleRowEspuma[] = [];
    salidaFresca.forEach(row => {
      const splits = getOrigenesProrrateoEspuma(row.material, row.cantidadUnidades, centro, plan.codigo_plan_grupo);
      splits.forEach(split => {
        const key = `${claveMaterial(row.material)}|${split.codigoPadre}|${split.nivel ?? ''}`;
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
          nivel: split.nivel,
        });
      });
    });

    detallesPlan.forEach(d => {
      const key = `${claveMaterial(d.codigo_material)}|${d.codigo_plan_grupo_padre}|${nivelBomDeLinea(d.linea_produccion) ?? ''}`;
      if (clavesUsadas.has(key)) return;
      const materialCode = cleanCode(d.codigo_material);
      rows.push({
        codigo_detalle_tactico: d.codigo_detalle_tactico,
        material: materialCode,
        descripcion: materialDescMap.get(materialCode) || '—',
        cantidad: parseQty(d.cantidad_produccion_neta),
        marcadoEliminar: true,
        esNuevo: false,
        codigo_plan_grupo_padre: d.codigo_plan_grupo_padre ?? 0,
        nivel: nivelBomDeLinea(d.linea_produccion),
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
        // Sin líneas en 0 (regla 2026-10-03): una fila editada a 0 se elimina; una nueva en 0 no se graba.
        const quedaEnCero = Math.round(row.cantidad) <= 0;
        if (row.marcadoEliminar || quedaEnCero) {
          if (row.esNuevo) continue;
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
          linea_produccion: matchLineaProduccionEspuma(row.material, centro) + sufijoNivelBom(row.nivel),
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
    if (resultadoRestaurado) { addNotification('warning', 'Plan cargado de un reporte guardado (solo consulta): sincroniza para generar el P3, editar planes o exportar a SAP con datos vigentes.'); return; }
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
  }, [addNotification, resultadoRestaurado]);

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
    return respuestaSalidaRowsPorCentro(editPlanPreview.centro, true).filter(r => r.cantidadUnidades > 0 && !yaIncluidos.has(r.material));
  }, [editPlanPreview, respuestaSalidaRowsPorCentro]);

  const handleAddMaterialToEditPlanEspuma = (material: string) => {
    if (!editPlanPreview) return;
    const needRow = respuestaSalidaRowsPorCentro(editPlanPreview.centro, true).find(r => r.material === material);
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
        nivel: split.nivel,
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
        fecha_inicio_plan: ecuadorMidnightISO(editPlanPreview.fechaInicio),
        fecha_fin_plan: ecuadorMidnightISO(editPlanPreview.fechaFin),
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

  // Paso 1: arma la vista previa del P3 (faltante) de un centro en el diálogo de confirmación. Si el
  // centro no tiene materiales se bloquea con aviso.
  const handleAbrirRespuestaP3PFD = useCallback((centro: '1000' | '2000') => {
    if (resultadoRestaurado) { addNotification('warning', 'Plan cargado de un reporte guardado (solo consulta): sincroniza para generar el P3, editar planes o exportar a SAP con datos vigentes.'); return; }
    const p3 = construirPreviewP3(centro);
    if (!p3) {
      addNotification('warning', `No hay materiales de Necesidades Planta para el Centro ${centro}.`);
      return;
    }
    setPlanPreviewP3PFD([{ centro, p3 }]);
  }, [construirPreviewP3, addNotification, resultadoRestaurado]);

  // Botón general: arma la vista previa de AMBOS centros en un solo diálogo — un centro sin
  // materiales de Necesidades Planta simplemente no aparece (no bloquea al otro).
  const handleAbrirRespuestaP3PFDTodos = useCallback(() => {
    if (resultadoRestaurado) { addNotification('warning', 'Plan cargado de un reporte guardado (solo consulta): sincroniza para generar el P3, editar planes o exportar a SAP con datos vigentes.'); return; }
    const previews = (['1000', '2000'] as const)
      .map(centro => {
        const p3 = construirPreviewP3(centro);
        return p3 ? { centro, p3 } : null;
      })
      .filter((p): p is { centro: '1000' | '2000'; p3: PlanGrupoPreviewEspuma } => p !== null);
    if (previews.length === 0) {
      addNotification('warning', 'No hay materiales de Necesidades Planta en ningún centro.');
      return;
    }
    setPlanPreviewP3PFD(previews);
  }, [construirPreviewP3, addNotification, resultadoRestaurado]);

  // Paso 2: el usuario confirmó en el diálogo. Guarda un PlanGrupo (grupo 8, compartido con Corte y
  // Laminado — ver CODIGO_GRUPO_LAMINADO) + sus DetalleTactico (uno o más por material vía
  // getOrigenesProrrateoEspuma). Desde 2026-10-03 NO se graban líneas en 0: el P3 lleva solo el
  // faltante; lo cubierto con stock/provisional lo deduce Venta Externa al emparejar P2 vs P3.
  // Lógica compartida entre P3 y PFD (antes duplicada en handleConfirmarRespuestaP3/
  // handleConfirmarRespuestaPFD, ahora fusionadas en handleConfirmarRespuestaP3PFD) — el único punto
  // real de diferencia es esPFD, que solo cambia a qué canal (P3 o PFD) desactivarPlanesEspumaSuperados
  // supera planes previos.
  const guardarPlanGrupoEspuma = useCallback(async (
    preview: PlanGrupoPreviewEspuma,
    usuario: string,
    esPFD: boolean
  ): Promise<{ mensaje: string; huboError: boolean }> => {
    const etiqueta = esPFD ? 'PFD' : 'P3';
    try {
      const planPayload = {
        codigo_plan_grupo: 0,
        codigo_grupo: preview.codigo_grupo,
        codigo_familia_grupo: null,
        codigo_plan: null,
        valor: preview.valor,
        fecha_inicio_plan: ecuadorMidnightISO(preview.fechaInicio),
        fecha_fin_plan: ecuadorMidnightISO(preview.fechaFin),
        estado: 'A',
        usuario_creacion: usuario,
        // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales).
        // ecuadorNowNaiveISO (no new Date()): convención "naive Ecuador", ver ecuadorMidnightISO.
        fecha_creacion: ecuadorNowNaiveISO(),
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
          // Sin líneas en 0: un origen cuyo prorrateo redondea a 0 no viaja en el P3.
          if (Math.round(split.cantidad) <= 0) continue;
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
              linea_produccion: matchLineaProduccionEspuma(row.material, preview.centro) + sufijoNivelBom(split.nivel),
            };
            await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
            exitosos++;
          } catch (e) {
            console.warn(`[Respuesta ${etiqueta} Espuma] Falló material ${row.material} (padre ${split.codigoPadre}, centro ${preview.centro}):`, (e as Error).message);
            fallidos++;
          }
        }
      }

      const superados = await desactivarPlanesEspumaSuperados(preview.centro, preview.fechaInicio, nuevoCodigoPlanGrupo, esPFD);
      const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo centro desactivado(s).` : '';

      if (fallidos === 0) {
        return { mensaje: `${etiqueta} Centro ${preview.centro}: ${exitosos} materiales en Plan Grupo #${nuevoCodigoPlanGrupo}.${sufijoSuperados}`, huboError: false };
      }
      return { mensaje: `${etiqueta} Centro ${preview.centro}: ${exitosos} guardados, ${fallidos} fallaron (Plan Grupo #${nuevoCodigoPlanGrupo}).${sufijoSuperados}`, huboError: true };
    } catch (e) {
      return { mensaje: `${etiqueta} Centro ${preview.centro}: error al crear el Plan Grupo — ${(e as Error).message}`, huboError: true };
    }
  }, [getOrigenesProrrateoEspuma, desactivarPlanesEspumaSuperados, matchLineaProduccionEspuma]);

  // Confirmación del paso combinado: por cada centro de la vista previa, guarda el P3 y (si existe)
  // el PFD en secuencia — un centro/canal que falle no bloquea a los demás, se reporta por separado
  // en el mismo mensaje final.
  // Fase 2 del panel: el avance va al panel flotante (no a toasts) y al terminar se guarda el reporte
  // de cada centro (reportesPorGuardar), que cierra con "Ver reporte y enviar".
  const handleConfirmarRespuestaP3PFD = useCallback(async () => {
    if (!planPreviewP3PFD || planPreviewP3PFD.length === 0) return;
    const previews = planPreviewP3PFD;
    const nombrePlanta = (c: '1000' | '2000') => (c === '1000' ? 'Quito' : 'Guayaquil');
    setIsSavingPlanP3PFD(true);
    setPlanPreviewP3PFD(null);
    panelProgreso.iniciar('Corte Espuma — Respuesta P3 y reporte', [
      ...previews.map(({ centro }) => ({ id: `p3-${centro}`, etiqueta: `Guardando P3 · ${nombrePlanta(centro)}` })),
      { id: 'nec', etiqueta: 'Actualizando necesidades' },
      ...previews.map(({ centro }) => ({ id: `rep-${centro}`, etiqueta: `Guardando reporte · ${nombrePlanta(centro)}` })),
    ]);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';
      for (const { centro, p3 } of previews) {
        panelProgreso.actualizar(`p3-${centro}`, { estado: 'en_curso' });
        const resP3 = await guardarPlanGrupoEspuma(p3, usuario, false);
        panelProgreso.actualizar(`p3-${centro}`, { estado: resP3.huboError ? 'error' : 'ok', detalle: resP3.mensaje });
      }
      panelProgreso.actualizar('nec', { estado: 'en_curso' });
      await fetchNecesidadesPlanta();
      panelProgreso.actualizar('nec', { estado: 'ok' });
      // Sin fecha en "Evaluar Capacidad", el reporte se arma con la fecha del P3 (día de recuperación)
      // en vez de quedar en aviso (pedido del usuario 2026-10-03); una fecha ya elegida se respeta. Va
      // en el mismo render que setReportesPorGuardar, así el efecto ya ve el resumen con esa fecha.
      setSelectedDatesCapacidad(prev => {
        const next = { ...prev };
        previews.forEach(({ centro, p3 }) => {
          const planta = centro === '1000' ? 'UIO' : 'GYE';
          if (next[planta].size === 0 && p3.fechaInicio) next[planta] = new Set([p3.fechaInicio]);
        });
        return next;
      });
      // El reporte (capacidad + correo) no depende de que el P3 haya salido bien: se guarda igual.
      setReportesPorGuardar(previews.map(x => x.centro));
    } catch (e) {
      panelProgreso.actualizar('nec', { estado: 'error', detalle: (e as Error).message });
      previews.forEach(({ centro }) => panelProgreso.actualizar(`rep-${centro}`, { estado: 'omitido' }));
      panelProgreso.concluir(`Error al guardar la Respuesta P3: ${(e as Error).message}`);
    } finally {
      setIsSavingPlanP3PFD(false);
    }
  }, [planPreviewP3PFD, fetchNecesidadesPlanta, guardarPlanGrupoEspuma, panelProgreso]);

  // ------------------------------------------------------------------------------------------------
  // Exportar a SAP (InsertarSolicitudProduccionHB) — primer esquema, replicando el patrón ya
  // probado en Corte y Laminado (ver TacticalPlanCorteLaminadoSection: buildSolicitudProduccion/
  // handleExportTxt/handleConfirmarExportTxt), con las adaptaciones confirmadas con el usuario
  // 2026-09-22 para Corte Espuma:
  //   - Fuente: NO un plan de corridas recalculado en memoria (Espuma no tiene "reloj" de máquina
  //     por fila como Laminado) sino el PFD YA PERSISTIDO más reciente de ese centro. Cada
  //     DetalleTactico ya guardado de ese PlanGrupo es una línea del payload — ya viene separado por
  //     lote/actividad de origen (getOrigenesProrrateoEspuma se aplicó al guardar el PFD), así que
  //     un material manejado individual da 1 línea y uno por lotes da varias, sin adivinar.
  //   - CodigoOrdenExterna: el codigo_detalle_tactico de cada fila DIRECTO (no hace falta el
  //     emparejamiento por cantidad más cercana que usa Laminado, porque acá se itera la tabla ya
  //     persistida, no un recálculo en vivo que haya que cruzar contra ella).
  //   - CantidadPlanificada: en UN (cantidad_produccion_neta ya está en UN, ver
  //     respuestaSalidaRowsPorCentro) — no en Kg como Laminado.
  //   - Fechas/horas: sin reloj de máquina disponible, se usa la fecha_inicio_plan del PlanGrupo PFD
  //     (día hábil siguiente) a las 07:00 como FechaInicioProgramada/HoraInicioProgramada;
  //     FechaFin/HoraFinProgramada quedan vacíos hasta que exista una fuente real de programación por
  //     máquina para Corte Espuma.
  //   - ClaseOrden/Centro/Mandante: mismos valores que Laminado (ZCSQ/300), confirmado con el
  //     usuario — mismo ambiente SAP, Centro es el propio del PlanGrupo (1000 o 2000).
  // Pendiente de confirmar contra el comportamiento real de SAP en la primera prueba (documentado
  // para no perderlo, mismo criterio que dejó el checklist de Laminado):
  //   - Si PedidoComercial/PosicionPedido deben ir vacíos (MTS) o no aplican igual para Espuma.
  //   - Si el horario por defecto (07:00, sin fin) es aceptado por la clase ZCSQ o hace falta una
  //     fuente real de programación por máquina/turno.
  // ------------------------------------------------------------------------------------------------

  // PuestoTrabajo por material, misma fuente que ya carga Corte Espuma para Capacidad Operativa
  // (tiemposCatalogo, vía fetchTiemposCorteYLaminado -> tiemposEnsambladoByGrupoYCentroPR2) — no hace
  // falta pedir un endpoint nuevo, ya se sincroniza al cargar el módulo. Mismo criterio que
  // puestoTrabajoPorMaterial en TacticalPlanCorteLaminadoSection: primera fila que matchee el
  // material, sin distinguir centro (un material corre en el mismo puesto en cualquier centro).
  const puestoTrabajoPorMaterialEspuma = useMemo(() => {
    const map = new Map<string, string>();
    tiemposCatalogo.forEach((t) => {
      const code = cleanCode(getProp(t, ['CodMaterial', 'MATERIAL', 'Material']));
      const puesto = getProp(t, ['PuestoTrabajo']);
      if (code && puesto && !map.has(code)) map.set(code, puesto);
    });
    return map;
  }, [tiemposCatalogo]);

  // "Carruseles" (10 caracteres) excede el largo del campo en HANA (8): decisión del usuario
  // 2026-10-03 — se mantiene el valor del catálogo y TI ajusta el largo del campo.
  const resolvePuestoTrabajoEspuma = useCallback((material: string): string => {
    return puestoTrabajoPorMaterialEspuma.get(material) || '';
  }, [puestoTrabajoPorMaterialEspuma]);

  // VersionFabricacion: mismo endpoint genérico que Laminado (versionsFabricacionPorCentroYCodigoMaterial),
  // por-material, con reintentos — se pide solo para los materiales que realmente se van a exportar
  // (ver handleExportSap), no en la carga inicial del módulo.
  const fetchVersionConReintentosEspuma = useCallback(async (centro: string, material: string, intentos = 3): Promise<RawApiRow[]> => {
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const response = await serviciosService.versionsFabricacionPorCentroYCodigoMaterial(centro, material);
        return response.data || [];
      } catch (error) {
        if (intento === intentos) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * intento));
      }
    }
    return [];
  }, []);

  // Mismo patrón que fetchVersionesFabricacionLaminado: lotes pequeños en paralelo (no todo de una
  // vez, no uno por uno), con desambiguación por PuestoTrabajo cuando el material trae más de una
  // Hoja de Ruta.
  const fetchVersionesFabricacionEspuma = useCallback(async (centro: string, materiales: string[]): Promise<Map<string, { version: string; ambiguo: boolean }>> => {
    const resultado = new Map<string, { version: string; ambiguo: boolean }>();
    const CHUNK_SIZE = 5;
    for (let i = 0; i < materiales.length; i += CHUNK_SIZE) {
      const lote = materiales.slice(i, i + CHUNK_SIZE);
      const respuestas = await Promise.allSettled(lote.map(m => fetchVersionConReintentosEspuma(centro, m)));
      respuestas.forEach((r, idx) => {
        const material = lote[idx];
        const filas = r.status === 'fulfilled' ? r.value : [];
        if (filas.length === 0) return;
        if (filas.length === 1) {
          const version = getProp(filas[0], ['VERSION']);
          if (version) resultado.set(material, { version, ambiguo: false });
          return;
        }
        const puesto = puestoTrabajoPorMaterialEspuma.get(material)?.toUpperCase().trim() || '';
        const match = filas.find(f => getProp(f, ['GRUPOHOJARUTA']).toUpperCase().replace(/^HR-/, '') === puesto.replace(/^HR-/, ''));
        const version = getProp(match || filas[0], ['VERSION']);
        if (version) resultado.set(material, { version, ambiguo: !match });
      });
    }
    return resultado;
  }, [fetchVersionConReintentosEspuma, puestoTrabajoPorMaterialEspuma]);

  // Encuentra la Respuesta de Espuma más reciente y activa de ese centro (codigo_grupo 8 + "Espuma" +
  // centro). Desde 2026-10-03 es el P3 (= faltante, ya no se graba PFD); se aceptan PFD viejos para no
  // romper el ciclo en curso. Desempate por fecha_inicio_plan y luego codigo_plan_grupo (el más nuevo).
  const fetchUltimoPFDEspuma = useCallback(async (centro: '1000' | '2000'): Promise<{ plan: PlanGrupo; detalles: DetalleTactico[] } | null> => {
    const [planesRes, detallesRes] = await Promise.all([planGrupoService.getAll(), detalleTacticoService.getAll()]);
    const centroRegex = new RegExp(`centro\\s*${centro}`, 'i');
    const planesPFD = (planesRes.data || []).filter(p =>
      p.codigo_grupo === CODIGO_GRUPO_LAMINADO && p.estado === 'A' &&
      /espuma/i.test(String(p.valor || '')) && centroRegex.test(String(p.valor || '')) && /\bp3\b|pfd/i.test(String(p.valor || ''))
    );
    if (planesPFD.length === 0) return null;
    const planReciente = planesPFD.reduce<PlanGrupo>((mas, actual) => {
      const fechaActual = fechaLocalPlana(actual.fecha_inicio_plan);
      const fechaMas = fechaLocalPlana(mas.fecha_inicio_plan);
      if (fechaActual !== fechaMas) return fechaActual > fechaMas ? actual : mas;
      return actual.codigo_plan_grupo > mas.codigo_plan_grupo ? actual : mas;
    }, planesPFD[0]);
    const detalles = (detallesRes.data || []).filter(d => d.codigo_plan_grupo === planReciente.codigo_plan_grupo && d.estado === 'A');
    return { plan: planReciente, detalles };
  }, []);

  // Payload de InsertarSolicitudProduccionHB por MATERIAL del PFD ya persistido — ver el bloque de
  // comentarios más arriba para el detalle de cada supuesto. Un material puede tener varias líneas en
  // el PFD (una por plan de origen y por nivel BOM N1/N2, ver sufijoNivelBom), pero es el mismo
  // material físico: se consolidan en UNA sola orden (decisión del usuario 2026-09-29) — la
  // separación por nivel/origen queda en el PFD como trazabilidad, no en SAP. CodigoOrdenExterna
  // toma la primera línea; Observaciones lista las líneas consolidadas.
  const buildSolicitudProduccionEspuma = useCallback((
    lineas: DetalleTactico[],
    centro: '1000' | '2000',
    fechaInicioPlan: string,
    versiones: Map<string, { version: string; ambiguo: boolean }>,
    conversion?: ConversionProvisionalEspuma
  ): SolicitudProduccionHBPayload => {
    const d = lineas[0];
    const material = cleanCode(d.codigo_material);
    // Entero, como siempre salió del PFD (Math.round().toFixed(0) al grabar): la provisional puede
    // traer decimales (cantUnidadReal de una orden en KG).
    const cantidad = Math.round(conversion ? conversion.cantidadOrden : lineas.reduce((s, l) => s + parseQty(l.cantidad_produccion_neta), 0));
    // Si la orden incluye consumo de nivel 2 (lámina que va a un semielaborado, que se fabrica antes
    // que el PT), arranca un día hábil antes que la fecha del PFD (decisión del usuario 2026-09-29) —
    // nunca antes de hoy (exportar un PFD de ayer no debe mandar una fecha de inicio ya pasada).
    const tieneNivel2 = lineas.some(l => nivelBomDeLinea(l.linea_produccion) === 2);
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const fechaAdelantada = tieneNivel2 ? format(restarDiasHabiles(parseFechaLocal(fechaInicioPlan), 1), 'yyyy-MM-dd') : fechaInicioPlan;
    const fechaInicio = fechaAdelantada < hoy && fechaInicioPlan >= hoy ? hoy : fechaAdelantada;
    return {
      Mandante: '300',
      CodigoOrdenExterna: String(d.codigo_detalle_tactico),
      ClaseOrden: 'ZCSQ',
      Centro: centro,
      CodigoMaterial: material,
      CantidadPlanificada: cantidad,
      VersionFabricacion: versiones.get(material)?.version || '',
      PuestoTrabajo: resolvePuestoTrabajoEspuma(material),
      FechaFinProgramada: '',
      HoraFinProgramada: '',
      FechaInicioProgramada: fechaInicio.replace(/-/g, ''),
      HoraInicioProgramada: '070000',
      PedidoComercial: '',
      PosicionPedido: '',
      EstadoRegistro: '1',
      // Mismo texto fijo que ya cargaba sin problemas en SAP/HANA — el detalle de consolidación
      // (N1/N2, provisional convertida) se muestra en la vista previa, no se manda aquí, para no
      // arriesgar el largo del campo en el endpoint.
      Observaciones: 'Generado automático — Plan Táctico Corte Espuma (PFD)',
      EstadoCarga: '',
      NumeroOrdenSap: '',
      FechaProceso: '',
      HoraProceso: '',
      UsuarioProceso: 'APIUSR',
    };
  }, [resolvePuestoTrabajoEspuma, restarDiasHabiles]);

  // Paso 1: busca el PFD ya persistido de ese centro, resuelve Versión de Fabricación por material y
  // congela la vista previa editable — mismo criterio que handleExportTxt en Laminado (ninguno de los
  // dos recuperos bloquea el envío si falta: el payload sale con el campo en '' y se corrige a mano
  // en la tabla editable del diálogo).
  // Conversión de la provisional existente (sin servicio nuevo — el envío a SAP con
  // InsertarSolicitudProduccionHB ES la conversión; decisión del usuario 2026-09-29). Desde 2026-10-03
  // la provisional ya viaja DENTRO de la línea del P3 (aP3 = faltante + provisional, ver
  // respuestaSalidaRowsPorCentro), así que la orden = la cantidad del P3 tal cual (respeta "Editar
  // Plan") y CodigoOrdenExterna = su codigo_detalle_tactico. Esto solo DESGLOSA, para la vista previa,
  // cuánto de esa cantidad es la provisional que se convierte y cuánto es faltante nuevo.
  // Provisional "principal" (referencia) si hay varias: la que llega antes del día del PT (PT−1),
  // luego la de fecha fin más tardía, luego la de mayor cantidad.
  const resolverConversionProvisional = useCallback((centro: '1000' | '2000', material: string, cantidadP3: number): ConversionProvisionalEspuma => {
    const provisionales = provisionalesQueCubrenPorCentro[centro].get(material) || [];
    const provisionalQty = Math.min(cantidadP3, provisionales.reduce((s, o) => s + o.cantUnidadReal, 0));
    const principal = [...provisionales].sort((a, b) =>
      Number(!!a.llegaDiaPT) - Number(!!b.llegaDiaPT) || b.fechaFin.localeCompare(a.fechaFin) || b.cantUnidadReal - a.cantUnidadReal
    )[0]?.orden;
    const faltantePFD = Math.max(0, cantidadP3 - provisionalQty);
    if (cantidadP3 <= 0) return { faltantePFD: 0, provisionalQty: 0, cantidadOrden: 0, motivo: 'sin-orden' };
    if (provisionalQty <= 0) return { faltantePFD, provisionalQty: 0, cantidadOrden: cantidadP3, motivo: 'solo-faltante' };
    return { faltantePFD, provisionalQty, cantidadOrden: cantidadP3, principal, motivo: faltantePFD > 0 ? 'provisional+faltante' : 'provisional-completa' };
  }, [provisionalesQueCubrenPorCentro]);

  const handleExportSap = useCallback(async (centro: '1000' | '2000') => {
    if (resultadoRestaurado) { addNotification('warning', 'Plan cargado de un reporte guardado (solo consulta): sincroniza para generar el P3, editar planes o exportar a SAP con datos vigentes.'); return; }
    if (!datosCargados) {
      addNotification('warning', 'Sincroniza primero: el envío a SAP cruza el PFD con las órdenes provisionales vigentes.');
      return;
    }
    setIsValidandoExportSap(true);
    try {
      const ultimoPFD = await fetchUltimoPFDEspuma(centro);
      if (!ultimoPFD || ultimoPFD.detalles.length === 0) {
        addNotification('warning', `No hay un P3 guardado para el Centro ${centro}. Generá la Respuesta P3 primero (tab "Respuesta P3").`);
        return;
      }
      const { plan, detalles } = ultimoPFD;
      const fechaInicioPlan = fechaLocalPlana(plan.fecha_inicio_plan);
      // Una orden por material (ver buildSolicitudProduccionEspuma), con su provisional convertida
      // (ver resolverConversionProvisional). Material sin cantidad resultante → no genera orden.
      const porMaterial = new Map<string, DetalleTactico[]>();
      detalles.forEach(d => {
        const material = cleanCode(d.codigo_material);
        if (!porMaterial.has(material)) porMaterial.set(material, []);
        porMaterial.get(material)!.push(d);
      });
      const conConversion = Array.from(porMaterial.entries())
        .map(([material, lineas]) => ({
          lineas,
          conversion: resolverConversionProvisional(centro, material, lineas.reduce((s, l) => s + parseQty(l.cantidad_produccion_neta), 0)),
        }))
        .filter(g => g.conversion.cantidadOrden > 0);
      if (conConversion.length === 0) {
        addNotification('info', `El P3 #${plan.codigo_plan_grupo} del Centro ${centro} no tiene faltantes ni provisionales por convertir: no hay órdenes que crear en SAP.`);
        return;
      }
      const grupos = conConversion.map(g => g.lineas);
      const conversion = conConversion.map(g => g.conversion);
      const versiones = await fetchVersionesFabricacionEspuma(centro, grupos.map(g => cleanCode(g[0].codigo_material)));
      setExportSapPreview({ plan, centro, grupos, conversion });
      setExportSapPayloads(conConversion.map(g => buildSolicitudProduccionEspuma(g.lineas, centro, fechaInicioPlan, versiones, g.conversion)));
    } catch (e) {
      addNotification('error', `No se pudo completar la validación previa al envío: ${(e as Error).message}. Envío cancelado por seguridad.`);
    } finally {
      setIsValidandoExportSap(false);
    }
  }, [fetchUltimoPFDEspuma, fetchVersionesFabricacionEspuma, buildSolicitudProduccionEspuma, addNotification, datosCargados, resolverConversionProvisional, resultadoRestaurado]);

  const updateExportSapPayload = useCallback((index: number, field: keyof SolicitudProduccionHBPayload, value: string | number) => {
    setExportSapPayloads(prev => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const descripcionMaterial = useCallback((material: string): string =>
    materialDescMap.get(material) || descripcionesBomRef.current.get(material) || '', [materialDescMap]);

  const erroresExportSap = useMemo(() => (exportSapPayloads || []).reduce((n, p) =>
    n + SOLICITUD_PRODUCCION_FIELDS_ESPUMA.filter(f => errorCampoSapEspuma(p, f.key)).length, 0), [exportSapPayloads]);

  // Quitar una orden de la vista previa antes de enviar — mismo patrón que removeExportTxtRow de
  // Laminado (grupos/conversion van por índice, paralelos a los payloads).
  const removeExportSapRow = useCallback((index: number) => {
    setExportSapPreview(prev => prev ? { ...prev, grupos: prev.grupos.filter((_, i) => i !== index), conversion: prev.conversion.filter((_, i) => i !== index) } : prev);
    setExportSapPayloads(prev => prev ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const handleConfirmarExportSap = useCallback(async () => {
    const payloads = exportSapPayloads;
    if (!payloads || payloads.length === 0) return;
    setIsEnviandoSap(true);
    try {
      const resultados: { material: string; ok: boolean; mensaje: string }[] = [];
      // Secuencial, no en paralelo: cada línea crea una orden real en SAP/HANA — mismo criterio que
      // handleConfirmarExportTxt en Laminado, para poder rastrear cuál falló si el backend responde
      // fuera de orden.
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        try {
          const res = await serviciosService.insertarSolicitudProduccionHB(payload);
          resultados.push({ material: payload.CodigoMaterial, ok: !!res.data?.success, mensaje: res.data?.message || 'Sin mensaje' });
        } catch (e) {
          resultados.push({ material: payload.CodigoMaterial, ok: false, mensaje: (e as Error).message });
        }
      }
      const ok = resultados.filter(r => r.ok);
      const fallidos = resultados.filter(r => !r.ok);
      if (fallidos.length === 0) {
        addNotification('success', `${ok.length} orden(es) de producción enviada(s) a SAP correctamente.`);
      } else {
        addNotification('warning', `${ok.length} orden(es) ok, ${fallidos.length} con error: ${fallidos.map(f => `${f.material} (${f.mensaje})`).join(' | ')}`);
      }
      setExportSapPreview(null);
      setExportSapPayloads(null);
    } finally {
      setIsEnviandoSap(false);
    }
  }, [exportSapPayloads, addNotification]);

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
      setDiasLaborablesExtra(new Set(snap.diasLaborablesExtra || []));
      setNecesidadesPlantaData(snap.necesidadesPlantaData);
      setFertsP2Muebles(snap.fertsP2Muebles || []);
      setFertsPFF(snap.fertsPFF || []);
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
  // Panel flotante de progreso (ver PanelProgreso), tras confirmar fechas en handleSincronizarYGenerar:
  // Fecha evaluada → Datos SAP (x/9 consultas) → Necesidades planta (P2) → Necesidad PFF. La última fase corre en el efecto autoGenerarPendiente,
  // que es quien cierra el panel.
  const ejecutarSincronizacion = useCallback(async (noLaborables: DiasNoLaborables, laborablesExtra: DiasNoLaborables) => {
    setSyncStep('sincronizando');
    setPlanCargadoDe(null);
    setResultadoRestaurado(null);
    configRestaurada.current = null;
    const fmt = (d: Date) => format(d, 'dd/MM/yyyy');
    panelProgreso.iniciar('Corte Espuma — Sincronizar y generar', [
      { id: 'fecha', etiqueta: `Fecha evaluada: ${format(new Date(), 'EEE dd/MM/yyyy', { locale: es })}` },
      { id: 'sap', etiqueta: 'Sincronizando datos SAP' },
      { id: 'p2', etiqueta: `Necesidades planta (P2 del ${fmt(nextBusinessDayCal(new Date(), noLaborables, laborablesHorizonte(laborablesExtra)))})` },
      { id: 'pff', etiqueta: `Generando necesidades (PFF, PT ${fmt(addBusinessDaysCal(new Date(), DIAS_HABILES_PT_ENSAMBLADO, noLaborables, laborablesHorizonte(laborablesExtra)))})` },
    ]);
    panelProgreso.actualizar('fecha', { estado: 'ok' });
    try {
      setDiasNoLaborables(noLaborables);
      setDiasLaborablesExtra(laborablesExtra);

      const TOTAL_CONSULTAS_SAP = 9;
      let hechas = 0;
      const fallidas: string[] = [];
      panelProgreso.actualizar('sap', { estado: 'en_curso', progreso: { actual: 0, total: TOTAL_CONSULTAS_SAP } });
      panelProgreso.actualizar('p2', { estado: 'en_curso' });
      const [sapOk] = await Promise.all([
        fetchDataAsync((nombre, ok) => {
          hechas += 1;
          if (!ok) fallidas.push(nombre);
          panelProgreso.actualizar('sap', { progreso: { actual: hechas, total: TOTAL_CONSULTAS_SAP } });
        }).then(ok => {
          panelProgreso.actualizar('sap', ok
            ? { estado: fallidas.length > 0 ? 'aviso' : 'ok', detalle: fallidas.length > 0 ? `Sin respuesta: ${fallidas.join(', ')} — se siguió con datos vacíos.` : undefined }
            : { estado: 'error', detalle: 'La sincronización se cortó; revisa la consola o vuelve a intentar.' });
          return ok;
        }),
        fetchNecesidadesPlanta(noLaborables, laborablesExtra).then(
          () => panelProgreso.actualizar('p2', pasoPanelDiagnosticoP2(diagnosticoP2Ref.current)),
          e => { panelProgreso.actualizar('p2', { estado: 'error', detalle: (e as Error).message }); throw e; }
        ),
      ]);
      if (!sapOk) {
        panelProgreso.actualizar('pff', { estado: 'omitido' });
        panelProgreso.concluir();
        setSyncStep('idle');
        return;
      }
      // calcularNecesidadPFF hace su propia consulta fresca a planGrupoService/detalleTacticoService
      // (no depende de closures de fetchDataAsync), pero SÍ depende de materialDescMap/inventarioSAP
      // ya reflejados en el render — se dispara desde el efecto de más abajo (declarado después de
      // calcularNecesidadPFF), no acá directo, para no leer esas dependencias por closure vieja antes
      // de que el siguiente render las recalcule (mismo criterio que Corte y Laminado).
      setAutoGenerarPendiente(true);
    } catch (e) {
      panelProgreso.actualizar('pff', { estado: 'omitido' });
      panelProgreso.concluir(`Error al sincronizar: ${(e as Error).message}`);
      setSyncStep('idle');
    }
  }, [fetchDataAsync, fetchNecesidadesPlanta, panelProgreso]);

  // Botón "Sincronizar y Generar Necesidades": antes de tocar SAP, el panel muestra sobre qué fechas
  // se va a trabajar para confirmarlas. En Espuma la fecha NO se elige: sale de la regla (hoy → P2
  // hoy+1 hábil, PT hoy+2 hábiles), que también usa el tablero de Capacidad — decisión del usuario
  // 2026-10-02 (opción "mostrar para confirmar"; en Laminado sí se elige, ahí es filtro real).
  const handleSincronizarYGenerar = useCallback(async () => {
    let noLaborables: DiasNoLaborables;
    let laborablesExtra: DiasNoLaborables;
    try {
      ({ noLaborables, laborablesExtra } = await cargarDiasNoLaborables());
    } catch (e) {
      addNotification('error', `No se pudo cargar el calendario laboral: ${(e as Error).message}`);
      return;
    }
    const fmt = (d: Date) => format(d, 'EEE dd/MM/yyyy', { locale: es });
    panelProgreso.pedirFecha({
      titulo: 'Corte Espuma — Sincronizar y generar',
      fechaInicial: format(new Date(), 'yyyy-MM-dd'),
      fija: true,
      detalle: () => [
        { etiqueta: 'P2 (necesidad planta) del', valor: fmt(nextBusinessDayCal(new Date(), noLaborables, laborablesHorizonte(laborablesExtra))) },
        { etiqueta: 'PFF / P1 Ensamblado, PT del', valor: fmt(addBusinessDaysCal(new Date(), DIAS_HABILES_PT_ENSAMBLADO, noLaborables, laborablesHorizonte(laborablesExtra))) },
      ],
      onConfirmar: () => { void ejecutarSincronizacion(noLaborables, laborablesExtra); },
    });
  }, [panelProgreso, ejecutarSincronizacion, addNotification]);

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
      Object.keys(shifts).forEach(id => {
        // Máquina que no opera de noche (ej. LA02 en GYE): no se le aplica el turno Noche masivo.
        if (campo === 'night' && MACHINES_BY_PLANTA[planta].find(m => m.id === id)?.sinTurnoNoche) return;
        shifts[id] = { ...shifts[id], [campo]: valor };
      });
      return { ...prev, shifts };
    });
    const etiqueta = (campo === 'day' || campo === 'saturday' ? shiftOptions : nightShiftOptions).find(o => o.v === valor)?.l;
    const nombreCampo = campo === 'day' ? 'Día' : campo === 'saturday' ? 'Sábado' : 'Noche';
    addNotification('success', `Turno ${nombreCampo} → ${etiqueta} en todas las máquinas de ${planta}. Capacidad y ocupación recalculadas.`);
  }, [addNotification, shiftOptions, nightShiftOptions]);

  const renderMachineCol = (id: string, name: string, planta: 'UIO' | 'GYE', ocupacion: OcupacionMaquinaInfo) => {
    const config = planta === 'UIO' ? uioConfig.shifts[id] : gyeConfig.shifts[id];
    const plantaConfig = planta === 'UIO' ? uioConfig : gyeConfig;
    const machineDef = MACHINES_BY_PLANTA[planta].find(m => m.id === id);
    const proceso = machineDef?.proceso ?? 'carrusel';
    const sinTurnoNoche = machineDef?.sinTurnoNoche === true;
    // OP2/Ayudante: solo aplica a Carruseles de Quito (confirmado por el usuario 2026-09-18) — CNC y
    // Verticales operan con un solo operador. En Guayaquil tampoco: 2 laminadores cubren los 3
    // carruseles (ver MACHINES_BY_PLANTA.GYE), sin ayudante por máquina — un mismo laminador puede
    // quedar asignado a dos máquinas del turno.
    const tieneAyudante = proceso === 'carrusel' && planta === 'UIO';
    const labelOp1 = planta === 'GYE' && proceso === 'carrusel' ? '— LAMINADOR —' : '— OP1 —';
    const labelProceso = proceso === 'carrusel' ? 'Carruseles' : proceso === 'cnc' ? 'CNC' : 'Verticales';
    // Rendim. (%): mismo % que se edita a nivel de proceso en renderProcesoConfig, mostrado acá por
    // máquina para que el resumen "{Proceso} · {ID}" quede completo (pedido por el usuario, ver
    // esquema compartido). Vertical va fijo al 100%, no tiene input propio.
    const rendimPct = proceso === 'vertical' ? null : proceso === 'cnc' ? plantaConfig.performanceCNC : plantaConfig.performance;

    // "Ocupación Recurso" (ocupación por máquina): se había quitado porque cruzaba la carga con la
    // máquina usando `r.maquina === id || r.maquina.includes(id)`, y los IDs de esta configuración
    // (CR04, CR03, CNC01…) no son los códigos de máquina de SAP (HR-CAR01/03/04, HR-CTCNC, HR_V02,
    // HR_V03_1…) — mostraba 0.0% en casi todas las columnas. Ahora vuelve con el mapeo explícito
    // MACHINE_SAP_CODES_UIO (confirmado por el usuario 2026-09-18), calculado en renderDashboard y
    // recibido acá ya resuelto (ocupacion) porque este helper no tiene acceso a filasSeleccion.
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
          <div className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-slate-50/40">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-wide">{labelProceso} · {id}</p>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Rendim. (%)</span>
              <span className="text-[10px] font-black text-slate-700">{rendimPct !== null ? rendimPct : '100% fijo'}</span>
            </div>

            {ocupacion.estado === 'sin-fecha' || ocupacion.estado === 'sin-mapeo' ? (
              <div title={ocupacion.estado === 'sin-fecha' ? "Elige una fecha en 'Evaluar Capacidad' para calcular el detalle de este recurso." : "Esta máquina no tiene un código de Hoja de Ruta/Puesto de Trabajo SAP asociado (ver MACHINE_SAP_CODES_POR_PLANTA)."}>
                <p className="text-[8px] font-bold text-gray-400 uppercase">{ocupacion.estado === 'sin-fecha' ? 'Sin fecha' : 'Sin mapeo SAP'}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2" title="Suma real de tTotal de las órdenes cuya Hoja de Ruta/Puesto de Trabajo coincide con esta máquina (ver MACHINE_SAP_CODES_UIO), para la fecha elegida en 'Evaluar Capacidad'.">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Tiempo Proceso</span>
                  <span className="text-[10px] font-black text-slate-700">{ocupacion.horas.toFixed(1)}h</span>
                </div>
                <div className="flex items-center justify-between gap-2" title="Horas programadas (Día+Noche+Sábado) de este recurso, sin descontar paros ni rendimiento.">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Tiempo Máquina</span>
                  <span className="text-[10px] font-black text-slate-700">{ocupacion.tiempoMaquinaBruto.toFixed(1)}h</span>
                </div>
                <div
                  className={cn("flex items-center justify-between gap-2 rounded p-1 -mx-1", ocupacion.pct !== null && ocupacion.pct > 100 ? "bg-red-50" : "bg-emerald-50")}
                  title={`Ocupación Recurso = Tiempo Proceso / Tiempo Máquina. ${ocupacion.pct !== null ? `${ocupacion.horas.toFixed(2)}h de ${ocupacion.tiempoMaquinaBruto.toFixed(2)}h.` : 'Sin tiempo de máquina configurado para comparar.'}`}
                >
                  <span className={cn("text-[8px] font-bold uppercase tracking-wide", ocupacion.pct !== null && ocupacion.pct > 100 ? "text-red-700" : "text-emerald-700")}>Ocupación Recurso</span>
                  <span className={cn("text-[10px] font-black", ocupacion.pct !== null && ocupacion.pct > 100 ? "text-red-700" : "text-emerald-700")}>{ocupacion.pct !== null ? `${ocupacion.pct.toFixed(0)}%` : '—'}</span>
                </div>
              </>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Turno Día</p>
            <select value={config.day} onChange={e => updateConfig(planta, id, 'day', e.target.value)} className="w-full bg-white text-amber-700 font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200">
              {shiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={config.op1D} onChange={e => updateConfig(planta, id, 'op1D', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">{labelOp1}</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
            {tieneAyudante && (
              <select value={config.op2D} onChange={e => updateConfig(planta, id, 'op2D', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
                <option value="">— OP2 AYUD —</option>
                {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Turno Noche</p>
            {sinTurnoNoche ? (
              <p className="w-full bg-slate-100 text-slate-400 font-black text-[10px] uppercase rounded px-2 py-1.5 border border-gray-200 text-center" title="Esta máquina no se enciende en el turno noche (modelo operativo de la planta).">
                No opera de noche
              </p>
            ) : (
              <>
                <select value={config.night} onChange={e => updateConfig(planta, id, 'night', e.target.value)} className="w-full bg-white text-purple-700 font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200">
                  {nightShiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <select value={config.op1N} onChange={e => updateConfig(planta, id, 'op1N', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
                  <option value="">{labelOp1}</option>
                  {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
                </select>
              </>
            )}
            {tieneAyudante && !sinTurnoNoche && (
              <select value={config.op2N} onChange={e => updateConfig(planta, id, 'op2N', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
                <option value="">— OP2 AYUD —</option>
                {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
              </select>
            )}
          </div>
          {/* Turno Sábado: independiente de Turno Día, en VACÍO por defecto -- se suma aparte a la
              capacidad, no reemplaza el turno día normal (ver MachineShiftConfig.saturday). */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Turno Sábado</p>
            <select value={config.saturday} onChange={e => updateConfig(planta, id, 'saturday', e.target.value)} className="w-full bg-white text-amber-700 font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200">
              {shiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={config.op1S} onChange={e => updateConfig(planta, id, 'op1S', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
              <option value="">{labelOp1}</option>
              {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
            </select>
            {tieneAyudante && (
              <select value={config.op2S} onChange={e => updateConfig(planta, id, 'op2S', e.target.value)} className="w-full bg-white text-slate-700 text-[10px] rounded px-2 py-1 outline-none border border-gray-200">
                <option value="">— OP2 AYUD —</option>
                {operadoresCorte.map((op, i) => <option key={i} value={getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR'])}>{getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])}</option>)}
              </select>
            )}
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

    // El % de rendimiento de Carrusel y de CNC se editan por separado (config.performance /
    // config.performanceCNC); Vertical trabaja al 100% (confirmado por el usuario), solo se le
    // descuentan los paros del turno. Antes esta función solo distinguía vertical vs "el resto" y le
    // aplicaba el % de Carrusel también a CNC — mismo bug que ya se había corregido en el resumen del
    // correo (resumenReportePorPlanta), ahora alineado acá también.
    const rendimientoDe = (proceso: ProcesoCorte) =>
      proceso === 'vertical' ? 1 : proceso === 'cnc' ? config.performanceCNC / 100 : config.performance / 100;

    const horasDeMaquina = (id: string) => {
      const c = config.shifts[id];
      // Máquina apagada a propósito (sin demanda que la justifique): no aporta capacidad.
      if (!c || c.activa === false) return 0;
      const proceso = machines.find(m => m.id === id)?.proceso ?? 'carrusel';
      const hD = shiftOptions.find(o => o.v === c.day)?.h || 0;
      const hN = nightShiftOptions.find(o => o.v === c.night)?.h || 0;
      const hS = sabadoCuentaEnPlanta(planta) ? (shiftOptions.find(o => o.v === c.saturday)?.h || 0) : 0;
      return ((hD * (1 - c.paro1 / 100)) + (hN * (1 - c.paro2 / 100)) + (hS * (1 - c.paro3 / 100))) * rendimientoDe(proceso);
    };
    // Tiempo Máquina BRUTO por recurso (Día+Noche+Sábado, SIN paros ni rendimiento) — pedido por el
    // usuario para el recuadro "{Proceso} · {ID}" de cada máquina y para el panel agregado de abajo.
    const horasMaquinaBruto = (id: string) => {
      const c = config.shifts[id];
      if (!c || c.activa === false) return 0;
      const hD = shiftOptions.find(o => o.v === c.day)?.h || 0;
      const hN = nightShiftOptions.find(o => o.v === c.night)?.h || 0;
      const hS = sabadoCuentaEnPlanta(planta) ? (shiftOptions.find(o => o.v === c.saturday)?.h || 0) : 0;
      return hD + hN + hS;
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
        if (c.night === 'EMPTY' && !m.sinTurnoNoche) faltan.push(`${m.id} noche`);
        return faltan;
      });
      // Resumen corto del aviso: enumerar máquina por máquina daba un párrafo ilegible ("CR04 noche,
      // CR03 noche, CR01 noche…"). Basta con decir qué turno falta y en cuántas máquinas del proceso.
      const sinDia = machinesProceso.filter(m => config.shifts[m.id]?.day === 'EMPTY').length;
      const machinesConNoche = machinesProceso.filter(m => !m.sinTurnoNoche);
      const sinNoche = machinesConNoche.filter(m => config.shifts[m.id]?.night === 'EMPTY').length;
      const resumen = [
        sinDia > 0 ? `Día en ${sinDia} de ${machinesProceso.length}` : null,
        sinNoche > 0 ? `Noche en ${sinNoche} de ${machinesConNoche.length}` : null,
      ].filter(Boolean).join(' · ');
      return { lista, resumen };
    };

    // Capacidad Operativa se organiza por FECHA (una tarjeta por día) — "Nivel 1/2/3" es la
    // maquinaria interna que decide de dónde sale cada fecha y qué tan firme está, pero ya no es el
    // eje que ve el usuario (antes lo era, y resultó ilegible para alguien que no construyó el
    // código). Referencia de qué alimenta cada fecha:
    //   Necesidad "a tiempo" (antes Nivel 1): 3 fuentes con su propia fecha real de origen — P1/PFF
    //     hoy+2 días hábiles (DIAS_HABILES_PT_ENSAMBLADO), P2-Espumas Venta y P2-Muebles/
    //     Prensado hoy+1 día hábil exacto.
    //   Necesidad "red de seguridad" (antes Nivel 2, ver necesidadPFFNivel2Data): solo P1/PFF, para
    //     un plan que se quedó fechado hoy+1 en vez de hoy+2 (activo pero invisible para la necesidad
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
      // Remanente de CNC aplicado SOLO al total general de Carruseles (pedido por el usuario
      // 2026-09-19): en la operación real, cualquier material de carrusel puede terminar cortándose
      // en la CNC si el operador lo decide, pero no hay forma de saber de antemano CUÁL vino ese día
      // — a diferencia de CR01/CR03/CR04 (misma tecnología de corte), no se puede armar un mapa de
      // compatibilidad confiable por material/densidad para la CNC. En vez de sugerir movimientos
      // puntuales (como sí se hace entre carruseles, ver sugerenciasRedistribucionUIO), se suma el
      // tiempo que le SOBRA a la CNC (su capacidad neta menos lo que ya tiene ocupado ese día) como
      // colchón del total general — el recuadro propio de CNC no cambia, sigue mostrando su propia
      // capacidad/ocupación real.
      const cncRemanenteSeleccion = esCarrusel
        ? Math.max(0, Math.max(0, capacidadPorProceso.cnc * fechasSel.length - (fechaMtto
            ? machines.filter(m => m.proceso === 'cnc').reduce((s, m) => s + getMttoTimeParaFecha(m.id, planta, fechaMtto), 0)
            : 0)) - filasSeleccion.filter(x => esFilaCNC(x.row.maquina)).reduce((s, x) => s + x.row.tTotal, 0))
        : 0;
      const capSeleccionProceso = Math.max(0, cap * fechasSel.length - mttoProceso) + cncRemanenteSeleccion;
      const ocupacionPctProceso = capSeleccionProceso > 0 ? (ocupadoProceso / capSeleccionProceso) * 100 : null;

      // Reconciliación contra el desglose por máquina (ver ocupacionInfoMaquina/MACHINE_SAP_CODES_UIO):
      // la diferencia entre el total del proceso (por RESPONSABLE, siempre confiable) y la suma de lo
      // atribuido a máquinas específicas es horas con código de Hoja de Ruta ambiguo (HR-TACOS, que
      // comparte CR04/Vertical 3) o sin mapear (HR-CAR02 histórico, u orden sin campo MAQUINA) — no
      // desaparecen del total, solo no se pueden repartir por columna con certeza.
      const ocupadoAtribuidoMaquina = machines.filter(m => m.proceso === proceso).reduce((s, m) => {
        const info = ocupacionInfoMaquina(m.id);
        return s + (info.estado === 'ok' ? info.horas : 0);
      }, 0);
      const sinAtribuirProceso = Math.max(0, ocupadoProceso - ocupadoAtribuidoMaquina);
      // Qué códigos de Hoja de Ruta/Puesto de Trabajo explican esas horas sin atribuir — sirve para
      // identificar/confirmar el mapeo de una planta (pedido por el usuario 2026-09-28 para GYE): si
      // una máquina muestra 0h y aquí aparece un código con horas, ese es el código real a mapear.
      const codigosSinAtribuirProceso = Array.from(
        filasSeleccion
          .filter(x => (esCnc ? esFilaCNC(x.row.maquina) : respProceso.includes(x.row.responsable) && !esFilaCNC(x.row.maquina)))
          .filter(x => asignacionMaquinaOrden(planta, normalizarCodigoMaquina(x.row.maquina), x.row.material).length === 0)
          .reduce((acc, x) => {
            const codigo = normalizarCodigoMaquina(x.row.maquina) || '(sin código)';
            acc.set(codigo, (acc.get(codigo) || 0) + x.row.tTotal);
            return acc;
          }, new Map<string, number>())
      ).filter(([, h]) => h > 0.05).sort((a, b) => b[1] - a[1]);

      // Antes: tarjeta con 5 filas (Rendim/Tiempo Proceso/Tiempo Máquina/Capacidad/% Ocupación) — el
      // usuario pidió mover Rendim/Tiempo Proceso/Tiempo Máquina a un recuadro POR máquina (ver
      // renderMachineCol, sección "{Proceso} · {ID}") y dejar acá solo el agregado del grupo,
      // centrado bajo sus columnas: Capacidad Total y % Ocupación (ver esquema compartido).
      return (
        <div
          key={proceso}
          className={cn("flex justify-center p-3 border-t-2", bgClass)}
          style={{ flex: `${nEnGrupo} 1 0%` }}
        >
          <div className="w-full max-w-[13rem] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-[9px] font-black uppercase tracking-widest", colorClass)}>Capacidad Total {label} ({nMaquinas})</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black text-blue-700 tracking-tighter">{cap.toFixed(1)}h</span>
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
                {estimada && (
                  <span className="inline-flex cursor-help shrink-0" title="Verticales todavía no tiene máquinas cargadas con horario propio: se usa un estimado (un turno día de carrusel) como referencia.">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                )}
              </div>
            </div>

            {/* Remanente de CNC (pedido por el usuario 2026-09-19): solo suma al TOTAL general de
                Carruseles, nunca reasigna un material puntual (eso queda para
                sugerenciasRedistribucionUIO, entre CR01/CR03/CR04, donde sí se puede confiar en el
                histórico de densidad). Se muestra aparte para que quede claro que esas horas no son
                de los 3 carruseles — son espacio libre "prestado" de CNC ese día. */}
            {esCarrusel && cncRemanenteSeleccion > 0.05 && (
              <div className="flex items-center justify-between gap-2" title={`CNC tiene ${cncRemanenteSeleccion.toFixed(2)}h libres hoy (capacidad propia menos su ocupación real) — se suman al total general de Carruseles porque, en la práctica, el operador puede decidir cortar ahí cualquier material de carrusel. No se sugiere un material puntual: a diferencia de CR01/CR03/CR04 (misma tecnología), no hay forma confiable de saber cuál se cortaría en CNC de antemano.`}>
                <span className="text-[8px] font-bold text-amber-600/80 uppercase tracking-widest cursor-help">+ Remanente CNC</span>
                <span className="text-[10px] font-black text-amber-700">+{cncRemanenteSeleccion.toFixed(1)}h</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">% Ocupación</span>
              {fechasSel.length === 0 ? (
                <span className="text-[10px] font-bold text-slate-400">Sin fecha</span>
              ) : (
                <span
                  className={cn("text-base font-black tracking-tighter", ocupacionPctProceso !== null && ocupacionPctProceso > 100 ? "text-red-600" : "text-emerald-700")}
                  title={`${ocupadoProceso.toFixed(1)}h de ${capSeleccionProceso.toFixed(1)}h de capacidad · ${label.toLowerCase()}${esCarrusel && cncRemanenteSeleccion > 0.05 ? ` (incluye ${cncRemanenteSeleccion.toFixed(1)}h remanentes de CNC)` : ''}${sinAtribuirProceso > 0.05 ? ` · ${sinAtribuirProceso.toFixed(2)}h sin atribuir a una máquina específica` : ''}`}
                >
                  {ocupacionPctProceso !== null ? `${ocupacionPctProceso.toFixed(0)}%` : '—'}
                </span>
              )}
            </div>
            {fechasSel.length > 0 && codigosSinAtribuirProceso.length > 0 && (
              <div
                className="text-[8px] font-bold text-slate-400 uppercase leading-tight"
                title="Horas de órdenes cuyo código de Hoja de Ruta/Puesto de Trabajo no está asociado a ninguna máquina de esta planta. Cuentan en el % Ocupación del proceso, pero no en la tarjeta de ninguna máquina."
              >
                Sin mapeo: {codigosSinAtribuirProceso.map(([codigo, h]) => `${codigo} ${h.toFixed(1)}h`).join(' · ')}
              </div>
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

    // Ocupación real por máquina física (ver MACHINE_SAP_CODES_UIO) para la tarjeta de cada recurso
    // en renderMachineCol — mismo dataset (filasSeleccion) y misma métrica (tTotal) que ya usa
    // renderProcesoConfig para el % agregado por proceso, solo que acá se filtra por código de
    // máquina en vez de por responsable. Sin fecha seleccionada no hay nada que sumar todavía.
    const ocupacionInfoMaquina = (id: string): OcupacionMaquinaInfo => {
      if (fechasSel.length === 0) return { estado: 'sin-fecha' };
      if (!MACHINE_SAP_CODES_POR_PLANTA[planta][id]) return { estado: 'sin-mapeo' };
      // asignacionMaquinaOrden: HR exclusiva, material propio (LA02 GYE) o HR compartida (fracción).
      const horas = filasSeleccion.reduce((s, x) => {
        const asignada = asignacionMaquinaOrden(planta, normalizarCodigoMaquina(x.row.maquina), x.row.material).find(a => a.id === id);
        return s + (asignada ? x.row.tTotal * asignada.fraccion : 0);
      }, 0);
      const capNeta = horasDeMaquina(id);
      const tiempoMaquinaBruto = horasMaquinaBruto(id);
      // Ocupación Recurso (pedido por el usuario, ver recuadro "{Proceso} · {ID}" en renderMachineCol):
      // Tiempo Proceso / Tiempo Máquina BRUTO — no contra la capacidad neta (capNeta, que ya trae
      // rendimiento y paros descontados). Distinto criterio a propósito: acá se quiere ver qué tanto
      // del tiempo de reloj programado (crudo) se está usando de verdad.
      const pct = tiempoMaquinaBruto > 0 ? (horas / tiempoMaquinaBruto) * 100 : null;
      return { estado: 'ok', horas, capNeta, tiempoMaquinaBruto, pct };
    };

    // Sugerencias de redistribución entre carruseles (pedido por el usuario, ver
    // densidadCarruselesUIO/techoPctMaquina): cuando un carrusel supera su techo de capacidad
    // (restricción SAP Capacidad_Horas_HR-CARxx) se buscan sus órdenes de la fecha seleccionada cuya
    // densidad también se haya cortado antes en otro carrusel — se ordenan los candidatos por MÁS
    // capacidad libre primero y se sugiere mover ahí la orden completa; si ese candidato no tiene
    // espacio para la orden completa se prueba el siguiente ("looping", confirmado por el usuario).
    // Puramente informativo, igual que candidatosDiferir — no mueve nada solo. Solo Quito: mismo
    // alcance que densidadCarruselesUIO/MACHINE_SAP_CODES_UIO.
    const sugerenciasRedistribucionUIO = planta === 'UIO' && fechasSel.length > 0
      ? (() => {
          const machinesCarruselUIO = machines.filter(m => m.proceso === 'carrusel').map(m => m.id);
          const estado = new Map<string, { ocupado: number; techo: number }>();
          machinesCarruselUIO.forEach(id => {
            const info = ocupacionInfoMaquina(id);
            estado.set(id, {
              ocupado: info.estado === 'ok' ? info.horas : 0,
              techo: horasDeMaquina(id) * (techoPctMaquina(id) / 100),
            });
          });

          const sugerencias: { orden: string; material: string; descripcion: string; dens: string; horas: number; desde: string; hacia: string }[] = [];
          const sinCandidato: { orden: string; material: string; horas: number; desde: string }[] = [];

          machinesCarruselUIO.forEach(origenId => {
            const matcher = MACHINE_SAP_CODES_UIO[origenId];
            const ordenesOrigen = filasSeleccion
              .filter(x => matcher(normalizarCodigoMaquina(x.row.maquina)))
              .sort((a, b) => b.row.tTotal - a.row.tTotal);

            for (const { row } of ordenesOrigen) {
              const origen = estado.get(origenId)!;
              if (origen.ocupado <= origen.techo) break; // ya dentro de su techo, nada más que mover

              const candidatosDens = row.dens ? densidadCarruselesUIO.get(row.dens) : undefined;
              if (!candidatosDens) { sinCandidato.push({ orden: row.orden, material: row.material, horas: row.tTotal, desde: origenId }); continue; }

              const candidatos = machinesCarruselUIO
                .filter(id => id !== origenId && candidatosDens.has(id))
                .map(id => ({ id, libre: estado.get(id)!.techo - estado.get(id)!.ocupado }))
                .sort((a, b) => b.libre - a.libre);
              const destino = candidatos.find(c => c.libre >= row.tTotal);
              if (!destino) { sinCandidato.push({ orden: row.orden, material: row.material, horas: row.tTotal, desde: origenId }); continue; }

              sugerencias.push({ orden: row.orden, material: row.material, descripcion: row.descripcion, dens: row.dens, horas: row.tTotal, desde: origenId, hacia: destino.id });
              origen.ocupado -= row.tTotal;
              estado.get(destino.id)!.ocupado += row.tTotal;
            }
          });

          // Totales agregados de los 3 carruseles YA con la redistribución simulada (estado.ocupado
          // se fue actualizando en el loop de arriba) — pedido por el usuario para encadenar el
          // segundo paso (candidatos a diferir de Venta Externa, ver más abajo): ese panel debe
          // dispararse solo si la carga real de carruseles TODAVÍA excede su capacidad combinada
          // DESPUÉS de mover lo que se pudo entre ellos, no antes.
          const totalTecho = machinesCarruselUIO.reduce((s, id) => s + estado.get(id)!.techo, 0);
          const totalOcupadoPost = machinesCarruselUIO.reduce((s, id) => s + estado.get(id)!.ocupado, 0);

          return { sugerencias, sinCandidato, totalTecho, totalOcupadoPost };
        })()
      : { sugerencias: [], sinCandidato: [], totalTecho: 0, totalOcupadoPost: 0 };

    // Rebalanceo de capacidad, PASO 2 (el paso 1 es sugerenciasRedistribucionUIO, arriba): candidatos
    // a diferir de Venta Externa. Antes se disparaba con globalOccupancy > 100% (un agregado de TODA
    // la planta — carrusel+vertical+cnc — mezclando varios días). El usuario pidió encadenarlo:
    // en Quito, ahora se dispara solo si la carga real de los 3 carruseles (misma fecha elegida en
    // "Evaluar Capacidad") TODAVÍA excede su capacidad combinada (techo SAP) después de aplicar la
    // redistribución del paso 1 — si mover órdenes entre CR01/CR03/CR04 ya resolvió el exceso, no
    // hace falta proponer diferir nada de Venta Externa. Guayaquil no tiene esa redistribución por
    // máquina todavía (sin mapeo SAP confirmado), así que ahí se mantiene el criterio anterior.
    const excedeCapacidadCarruseles = planta === 'UIO'
      ? sugerenciasRedistribucionUIO.totalTecho > 0 && sugerenciasRedistribucionUIO.totalOcupadoPost > sugerenciasRedistribucionUIO.totalTecho
      : globalOccupancy > 100;
    const pctCarruselesPostRedistribucion = sugerenciasRedistribucionUIO.totalTecho > 0
      ? (sugerenciasRedistribucionUIO.totalOcupadoPost / sugerenciasRedistribucionUIO.totalTecho) * 100
      : 0;
    // Materiales de Venta Externa con holgura real todavía — su "Próx. Entrega" (ver
    // calcularEntregasVentaExterna) no ha vencido, así que cortarlos un poco más tarde no incumple al
    // cliente y libera horas de hoy. Ordenados de más a menos holgura. Puramente informativo: no
    // mueve ninguna fecha por sí solo, el planificador decide qué diferir — mismo criterio de "mostrar
    // el dato, no decidir por la persona" que el resto del módulo.
    const candidatosDiferir = excedeCapacidadCarruseles
      ? necesidadCapacidad
          .filter(r => r.proximaFechaEntrega && !r.atrasado)
          .map(r => ({ ...r, holguraDias: Math.round((new Date(r.proximaFechaEntrega!).getTime() - new Date(todayStr).getTime()) / 86400000) }))
          .filter(r => r.holguraDias > 0)
          .sort((a, b) => b.holguraDias - a.holguraDias)
      : [];
    const horasDiferibles = candidatosDiferir.reduce((s, r) => s + r.tTotal, 0);

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
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">Reporte de producción</p>
                    <p className="text-[10px] text-slate-400 mt-1">Gestión de tiempos y ocupación por proceso — {planta === 'UIO' ? 'Quito' : 'Guayaquil'}. Guarda el plan antes de exportar a SAP y envíalo después desde la vista previa.</p>
                  </div>
                  <ReportePlanTxtAcciones flujo={reporteFlujo[planta]} />
                  <p className="text-[9px] text-slate-400">Destinatarios precargados desde Grupo_Correos_Corte_Espuma — editables en la vista previa.</p>
                </PopoverContent>
              </Popover>
              <ReportePlanTxtVistaPrevia
                flujo={reporteFlujo[planta]}
                titulo={`Corte y Laminado [Carruseles] — ${planta === 'UIO' ? 'Quito' : 'Guayaquil'}`}
                destinatarios={destinatariosReporte}
                onDestinatariosChange={setDestinatariosReporte}
              />
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
        {/* Ventana del plan (ver turnosVentanaMaquina): cuándo empieza y termina la producción del
            plan evaluado — el mantenimiento de cada máquina se descuenta solo dentro de esos turnos. */}
        {ventanaPlanPorPlanta[planta] && (() => {
          const v = ventanaPlanPorPlanta[planta]!;
          return (
            <div
              className="mx-8 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-1.5"
              title="Desde la noche del día hábil anterior hasta el fin del turno día del plan, con los horarios de cada máquina. El MTTO de cada máquina solo resta si cae dentro de sus turnos."
            >
              <span className="text-[8px] font-black uppercase tracking-widest text-blue-700">Ejecución del plan de producción</span>
              <span className="text-[11px] font-black text-slate-700 tabular-nums">
                INICIO: <span className="text-blue-700">{fechaHoraEjecucion(v.inicio)}</span> ⇒ FIN: <span className="text-blue-700">{fechaHoraEjecucion(v.fin)}</span>
              </span>
              {machines.some(m => (config.shifts[m.id]?.saturday ?? 'EMPTY') !== 'EMPTY') && (
                sabadoCuentaEnPlanta(planta)
                  ? <span className="text-[9px] font-black text-emerald-700">Turno Sábado incluido</span>
                  : <span className="text-[9px] font-black text-amber-700">Turno Sábado activo, pero no cae en esta ventana: no suma horas</span>
              )}
            </div>
          );
        })()}
        {/* Aviso de calendario para el Turno Sábado (ver marcarDiaComoJornada en @/lib/dias-laborables):
            si alguna máquina de esta planta ya tiene Sábado activo, pero el sábado relevante (el
            elegido en "Evaluar Capacidad", o si no el próximo) no está marcado como Jornada en el
            calendario, P2/P3 lo seguirían tratando como no hábil pese a que aquí sí se le asignó
            capacidad -- mismo criterio que Corte y Laminado, ver [[sabado_dia_habil_condicional]]. */}
        {(() => {
          const algunaMaquinaConSabado = machines.some(m => {
            const s = config.shifts[m.id]?.saturday;
            return s && s !== 'EMPTY';
          });
          if (!algunaMaquinaConSabado) return null;
          const sabadosSeleccionados = fechasSel.filter(f => parseFechaLocal(f).getDay() === 6);
          const proximoSabado = (() => {
            const d = new Date();
            d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
            return format(d, 'yyyy-MM-dd');
          })();
          const sabadoObjetivo = sabadosSeleccionados.sort()[0] || proximoSabado;
          if (diasLaborablesExtra.has(sabadoObjetivo)) return null;
          return (
            <div className="mx-8 mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              <span className="text-[8px] font-bold text-amber-700 flex-1">
                El sábado {sabadoObjetivo} no está marcado como Jornada en el calendario — las fechas de P2/P3 lo seguirán saltando.
              </span>
              <button
                type="button"
                onClick={() => handleMarcarSabadoJornada(planta, sabadoObjetivo)}
                disabled={marcandoSabadoJornada[planta]}
                className="text-[8px] font-black uppercase bg-amber-600 text-white rounded-md px-2 py-1 whitespace-nowrap hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {marcandoSabadoJornada[planta] ? 'Marcando…' : 'Marcar como Jornada'}
              </button>
            </div>
          );
        })()}
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
            // Las máquinas que no operan de noche (sinTurnoNoche) no cuentan para el valor común de Noche.
            const valores = new Set(machines.filter(m => t.campo !== 'night' || !m.sinTurnoNoche).map(m => config.shifts[m.id]?.[t.campo]));
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
            <div className="flex items-center justify-center gap-2 py-1.5 border-b-2 border-cyan-300 bg-cyan-50/50" style={{ flex: `${machinesCarrusel.length} 1 0%` }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-700">Carruseles ({machinesCarrusel.length})</span>
              {/* Rendim. (%) se edita UNA vez por proceso (no por máquina) — vive acá, en la cabecera
                  del grupo, para no repetir el mismo control 3 veces en cada columna de máquina (esas
                  solo lo muestran de referencia, ver renderMachineCol). */}
              <span className="text-[8px] font-bold text-cyan-700/70 uppercase">Rend.</span>
              <input
                type="number"
                value={config.performance}
                onChange={e => {
                  const v = safeNum(e.target.value);
                  if (planta === 'UIO') setUioConfig({ ...uioConfig, performance: v });
                  else setGyeConfig({ ...gyeConfig, performance: v });
                }}
                className="w-12 bg-white border border-cyan-200 rounded px-1 py-0.5 text-[10px] font-black text-cyan-700 outline-none focus:border-cyan-500"
              />
            </div>
          )}
          {machinesCnc.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-1.5 border-b-2 border-amber-300 bg-amber-50/50" style={{ flex: `${machinesCnc.length} 1 0%` }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">CNC ({machinesCnc.length})</span>
              <span className="text-[8px] font-bold text-amber-700/70 uppercase">Rend.</span>
              <input
                type="number"
                value={config.performanceCNC}
                onChange={e => {
                  const v = safeNum(e.target.value);
                  if (planta === 'UIO') setUioConfig({ ...uioConfig, performanceCNC: v });
                  else setGyeConfig({ ...gyeConfig, performanceCNC: v });
                }}
                title="Editable aparte de Carruseles: los tiempos de corte en CNC dependen más de estimados que del catálogo real."
                className="w-12 bg-white border border-amber-200 rounded px-1 py-0.5 text-[10px] font-black text-amber-700 outline-none focus:border-amber-500"
              />
            </div>
          )}
          {machinesVertical.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-1.5 border-b-2 border-fuchsia-300 bg-fuchsia-50/50" style={{ flex: `${flexVertical} 1 0%` }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-700">Verticales ({machinesVertical.length})</span>
              <span className="text-[8px] font-bold text-fuchsia-700/70 uppercase">100% fijo</span>
            </div>
          )}
        </div>
        <div className="flex">
          {machinesCarrusel.length > 0 && (
            <div className="grid" style={{ flex: `${machinesCarrusel.length} 1 0%`, gridTemplateColumns: `repeat(${machinesCarrusel.length}, minmax(0, 1fr))` }}>
              {machinesCarrusel.map(m => renderMachineCol(m.id, m.n, planta, ocupacionInfoMaquina(m.id)))}
            </div>
          )}
          {machinesCnc.length > 0 && (
            <div className="grid border-l-2 border-amber-200" style={{ flex: `${machinesCnc.length} 1 0%`, gridTemplateColumns: `repeat(${machinesCnc.length}, minmax(0, 1fr))` }}>
              {machinesCnc.map(m => renderMachineCol(m.id, m.n, planta, ocupacionInfoMaquina(m.id)))}
            </div>
          )}
          {machinesVertical.length > 0 && (
            <div className="grid border-l-2 border-fuchsia-200" style={{ flex: `${flexVertical} 1 0%`, gridTemplateColumns: `repeat(${machinesVertical.length}, minmax(0, 1fr))` }}>
              {machinesVertical.map(m => renderMachineCol(m.id, m.n, planta, ocupacionInfoMaquina(m.id)))}
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
                <div className="w-2 h-2 rounded-full bg-amber-600" /> {planta === 'UIO' ? `Carruseles sobre capacidad tras redistribuir (${pctCarruselesPostRedistribucion.toFixed(0)}%)` : `${planta} sobre-ocupado (${globalOccupancy.toFixed(0)}%)`} — candidatos a diferir
              </h4>
              <span className="text-[9px] font-black uppercase text-amber-700">{horasDiferibles.toFixed(1)}h diferibles sin incumplir entrega</span>
            </div>
            <p className="text-[9px] text-amber-700/80 mb-3">
              {planta === 'UIO' && "Segundo paso: aunque ya se redistribuyó lo posible entre carruseles (ver sugerencia arriba), la carga combinada de CR01/CR03/CR04 sigue por encima de su capacidad. "}
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
                          title="Marca SOLO este material como diferido en Plan P2 - Venta Externa: al generar su P2 de Espumas sale del plan de hoy y va a un P2 DIFERIDO (PT un día hábil después), que este módulo recupera mañana. No cambia nada aquí."
                          onClick={() => {
                            // Diferido por material (2026-10-02): Venta Externa acumula los materiales y los
                            // graba en su P2 DIFERIDO (ver guardarP2Diferido allá); el resto del P2 no se mueve.
                            router.push(`/dashboard/opciones/tactica-venta-externa?tab=p2&centro=${planta === 'UIO' ? '1000' : '2000'}&material=${r.material}`);
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

        {/* Sugerencias de redistribución entre carruseles (pedido por el usuario, ver
            sugerenciasRedistribucionUIO más arriba): mismo criterio informativo que "candidatos a
            diferir" — no mueve nada solo. Solo aparece en Quito (Guayaquil no tiene el mapeo de
            máquina/densidad confirmado). */}
        {planta === 'UIO' && sugerenciasRedistribucionUIO.sugerencias.length > 0 && (
          <div className="border-t border-gray-100 bg-cyan-50/40 p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-600" /> Sugerencias de redistribución entre carruseles
              </h4>
              <span className="text-[9px] font-black uppercase text-cyan-700">{sugerenciasRedistribucionUIO.sugerencias.reduce((s, x) => s + x.horas, 0).toFixed(1)}h a mover</span>
            </div>
            <p className="text-[9px] text-cyan-700/80 mb-3">
              Estas órdenes están en un carrusel que superó su techo de capacidad (restricción SAP Capacidad_Horas_HR-CARxx). El carrusel sugerido ya ha cortado esta misma densidad antes (histórico de Órdenes FERT) y tiene espacio libre. No se mueve nada automáticamente — es solo una sugerencia para ajustar en SAP.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="text-[8px] font-black uppercase text-cyan-600/70 border-b border-cyan-200/60">
                  <tr>
                    <th className="py-1.5 pr-4">Material</th>
                    <th className="py-1.5 pr-4">Descripción</th>
                    <th className="py-1.5 pr-4 text-right">Densidad</th>
                    <th className="py-1.5 pr-4 text-right">Horas</th>
                    <th className="py-1.5 pr-4 text-right">De</th>
                    <th className="py-1.5 text-right">Hacia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-100/60 font-mono">
                  {sugerenciasRedistribucionUIO.sugerencias.map((s, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 pr-4 font-black text-cyan-900">{s.material}</td>
                      <td className="py-1.5 pr-4 font-sans normal-case text-cyan-800/80 truncate max-w-[240px]">{s.descripcion}</td>
                      <td className="py-1.5 pr-4 text-right text-cyan-700">{s.dens}</td>
                      <td className="py-1.5 pr-4 text-right font-black text-cyan-900">{s.horas.toFixed(2)}h</td>
                      <td className="py-1.5 pr-4 text-right text-cyan-700">{s.desde}</td>
                      <td className="py-1.5 text-right font-black text-emerald-700">→ {s.hacia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sugerenciasRedistribucionUIO.sinCandidato.length > 0 && (
                <p className="text-[8px] text-cyan-600/70 uppercase font-bold mt-2" title={sugerenciasRedistribucionUIO.sinCandidato.map(s => `${s.material} (${s.horas.toFixed(2)}h, desde ${s.desde})`).join(', ')}>
                  {sugerenciasRedistribucionUIO.sinCandidato.length} orden(es) sin candidato con espacio suficiente ({sugerenciasRedistribucionUIO.sinCandidato.reduce((s, x) => s + x.horas, 0).toFixed(1)}h) — pasa el cursor para ver el detalle.
                </p>
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
    showEntregaVentaExterna: boolean = false,
    // Capacidad instalada vs. necesidad (pedido por el usuario 2026-09-19): solo tiene sentido en
    // Necesidades Planta (el plan P1/PFF todavía no se ejecutó) — Provisionales/FERT ya son carga
    // real, que se compara contra capacidad en Capacidad Operativa, no acá.
    showCapacidadInstalada: boolean = false
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
      // Solo filas de NECESIDAD (orden "#<plan>", ver necesidadCapacidadMapper), cuya fecha es la del
      // PT. En una orden Provisional/FERT la FECHAFIN ya es la disponibilidad de la lámina tal cual la
      // da SAP ("Disponible p.pl.nec.") — restarle 1 día hábil la mostraba un día antes que SAP
      // (caso real 0144951612: SAP 24-sep, tabla 23-sep).
      if (!String(row.orden).startsWith('#')) return valor;
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

    // Capacidad instalada vs. necesidad (pedido por el usuario 2026-09-19, ver showCapacidadInstalada
    // arriba): cuánto de la capacidad instalada representaría cortar TODA esta necesidad del próximo
    // plan, antes de que se ejecute. Carrusel + CNC van en UN solo pool (mismo criterio que el
    // remanente de CNC en Capacidad Operativa): a nivel de plan todavía no se sabe qué material
    // específico terminaría en la CNC, solo que su responsable ya permite cualquiera de las dos. Los
    // responsables de este cálculo son los MISMOS que separan Carrusel/Vertical en Capacidad
    // Operativa (CARRUSEL_RESP/VERTICAL_RESP vía responsablesPorCentro) — no una clasificación nueva.
    //
    // Ventana de tiempo (corregido 2026-09-19 con el usuario): NO hay un selector de horario propio
    // en Necesidades Planta — el turno Día/Noche/Sábado es el MISMO config compartido
    // (uioConfig/gyeConfig) que se edita en Capacidad Operativa, así que capacidadInstaladaPorCentro
    // ya usa las Horas Efectivas reales (turno neto de paros+rendimiento). Este bloque (P1/PFF) SÍ
    // representa un solo día de producción (el siguiente día hábil, no un acumulado de varias
    // fechas) — la multiplicación por "días distintos en la data" que se probó antes era incorrecta
    // (las fechas individuales por fila varían por logística de material, no porque el plan cubra
    // varios días): se compara 1 día de necesidad contra 1 día de capacidad instalada, sin escalar.
    const capacidadVsNecesidad = showCapacidadInstalada && data.length > 0
      ? (() => {
          const CARRUSEL_RESP = responsablesPorCentro[centroBloque].carruseles;
          const VERTICAL_RESP = responsablesPorCentro[centroBloque].verticales;
          const necesidadCarruselCnc = data.filter(r => CARRUSEL_RESP.includes(r.responsable)).reduce((s, r) => s + r.tTotal, 0);
          const necesidadVertical = data.filter(r => VERTICAL_RESP.includes(r.responsable)).reduce((s, r) => s + r.tTotal, 0);
          const instalada = capacidadInstaladaPorCentro(centroBloque);
          const capCarruselCnc = instalada.carrusel + instalada.cnc;
          const capVertical = instalada.vertical;
          const necesidadTotal = necesidadCarruselCnc + necesidadVertical;
          const capTotal = capCarruselCnc + capVertical;
          return {
            carruselCnc: { necesidad: necesidadCarruselCnc, capacidad: capCarruselCnc, pct: capCarruselCnc > 0 ? (necesidadCarruselCnc / capCarruselCnc) * 100 : null },
            vertical: { necesidad: necesidadVertical, capacidad: capVertical, pct: capVertical > 0 ? (necesidadVertical / capVertical) * 100 : null },
            total: { necesidad: necesidadTotal, capacidad: capTotal, pct: capTotal > 0 ? (necesidadTotal / capTotal) * 100 : null },
          };
        })()
      : null;

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
            {capacidadVsNecesidad && (
              <>
                <div className="w-px self-stretch bg-slate-200" />
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-700" title="Capacidad instalada de un solo día (Horas Efectivas: turno neto de paros y rendimiento) — este bloque representa la necesidad de un día de producción (el siguiente día hábil), no un acumulado de varias fechas.">Capacidad instalada vs. necesidad (1 día)</span>
                {([
                  { l: 'Carrusel + CNC', d: capacidadVsNecesidad.carruselCnc },
                  { l: 'Verticales', d: capacidadVsNecesidad.vertical },
                ]).map(({ l, d }) => (
                  <div key={l} className="flex items-baseline gap-1.5" title={`${d.necesidad.toFixed(1)}h de necesidad de ${l.toLowerCase()}, contra ${d.capacidad.toFixed(1)}h de capacidad instalada (Horas Efectivas de 1 día).`}>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-600">{l}</span>
                    <span className="text-sm font-black tabular-nums text-slate-800">{d.necesidad.toFixed(1)}h</span>
                    <span className="text-[9px] font-bold text-slate-400">/ {d.capacidad.toFixed(1)}h</span>
                    <span className={cn("text-sm font-black tabular-nums", d.pct !== null && d.pct > 100 ? "text-red-600" : "text-emerald-700")}>
                      {d.pct !== null ? `${d.pct.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                ))}
                <div className="w-px self-stretch bg-slate-200" />
                {/* Total combinado (pedido por el usuario, ver esquema 2026-09-19): mezcla Carrusel+CNC
                    con Verticales en un solo %, algo que el resto del módulo evita a propósito (cada
                    proceso tiene su propia capacidad, mezclarlos diluye cuál es el que realmente está
                    saturado). Se muestra aparte, como referencia rápida de "para arriba o para abajo"
                    en general — las dos cifras de la izquierda siguen siendo las que dicen POR QUÉ. */}
                <div className="flex items-baseline gap-1.5" title={`${capacidadVsNecesidad.total.necesidad.toFixed(1)}h de necesidad total (todos los procesos), contra ${capacidadVsNecesidad.total.capacidad.toFixed(1)}h de capacidad instalada total. Referencia rápida: para el detalle por proceso usa las cifras de la izquierda.`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                  <span className={cn("text-sm font-black tabular-nums", capacidadVsNecesidad.total.pct !== null && capacidadVsNecesidad.total.pct > 100 ? "text-red-600" : "text-emerald-700")}>
                    {capacidadVsNecesidad.total.pct !== null ? `${capacidadVsNecesidad.total.pct.toFixed(0)}%` : '—'}
                  </span>
                </div>
              </>
            )}
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
                  <th
                    className="px-3 py-4 border-r border-gray-100 bg-cyan-50/50 text-cyan-700 uppercase"
                    title="Puesto de trabajo / Hoja de Ruta real de la orden (MAQUINA/RECURSO en SAP) — es el mismo dato que separa la capacidad por máquina en Capacidad Operativa (ver esFilaCNC/MACHINES_BY_PLANTA)."
                  >
                    Hoja Ruta / P. Trabajo
                  </th>
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
                        <td colSpan={8 + (showOrigen ? 1 : 0) + (showEntregaVentaExterna ? 2 : 0)}></td>
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
                          <td className="px-3 py-2 border-r border-slate-50 bg-cyan-50/30 text-cyan-700 font-black">{row.maquina || '—'}</td>
                          <td className="px-3 py-2 border-r border-slate-50 text-slate-600">{row.orden}</td>
                          <td
                            className={cn("px-3 py-2 text-slate-600 font-bold", (showOrigen || showEntregaVentaExterna) ? "border-r border-slate-50" : "")}
                            title={
                              row.origenArea?.startsWith('Ensamblado') && String(row.orden).startsWith('#')
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
                                  {row.llegaDiaPT && (
                                    <span className="text-[7px] text-orange-600 font-black uppercase mt-0.5" title="Su Fin Extr. (FECHAFIN) es el mismo día del PT de Ensamblado: cuenta como cobertura, pero llega después de la regla de 'un día hábil antes'.">
                                      ⚠ Llega el día del PT
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
      {planCargadoDe && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-left"
          title="Resumen recuperado del respaldo guardado junto al reporte: se muestra el resultado de ese momento, sin consultar SAP ni recalcular. Las acciones que graban (P2/P3/SAP) quedan bloqueadas hasta Sincronizar."
        >
          <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Plan cargado del reporte del <span className="font-black text-emerald-700">{format(parseFechaLocal(planCargadoDe.fechaObjetivo), 'EEE dd/MM/yyyy', { locale: es })}</span>
            {' '}(guardado {format(new Date(planCargadoDe.guardadoEn), 'dd/MM HH:mm')}) — <span className="font-black text-emerald-700">solo consulta</span>, tal cual se guardó; <span className="font-black text-blue-700">Sincronizar</span> trae datos vigentes y habilita generar y enviar.
          </p>
        </div>
      )}
      {!datosCargados && !isLoading && !planCargadoDe && (
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
        {/* Pestañas visibles = las de acción del flujo (mismo criterio que Venta Externa / Laminado,
            pedido del usuario 2026-10-03). Provisionales, Órdenes FERT y Validar Stock (solo consulta/
            auditoría: la data cruda de SAP, ver sus TabsContent más abajo) quedan OCULTAS pero su
            contenido se conserva para consultas internas: para volver a mostrarlas basta agregarlas a
            esta lista y subir grid-cols. */}
        <TabsList className="grid grid-cols-4 h-11 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200 mb-8">
          {[ { v: 'resumen', l: 'Capacidad Operativa', i: LayoutDashboard }, { v: 'necesidadesPlanta', l: 'Necesidades Planta', i: Database }, { v: 'respuestaP3', l: 'Respuesta P3', i: Save }, { v: 'mantenimiento', l: 'Mantenimiento SAP', i: Wrench },
          ].map(tab => (
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
              <Button
                onClick={verificarBomP2Muebles}
                disabled={isVerificandoBomP2 || necesidadesPlantaLoading || isCalculandoPFF || fertsP2Muebles.length + fertsPFF.length === 0}
                variant="outline"
                className="rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                title={fertsP2Muebles.length + fertsPFF.length === 0 ? 'No hay FERT de origen cargados (P2 Muebles / P1-PFF Ensamblado)' : `Explota el BOM de los FERT del P2 ESPUMA MUEBLES (${fertsP2Muebles.length}) y del P1/PFF de Ensamblado (${fertsPFF.length}) y compara la lámina resultante contra la necesidad registrada (solo lectura)`}
              >
                {isVerificandoBomP2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isVerificandoBomP2 ? `Explotando BOM ${verificacionBomP2Progreso.current}/${verificacionBomP2Progreso.total}` : 'Verificar BOM · P2/PFF'}
              </Button>
            </div>
            {verificacionBomP2 && (
              <div className="bg-white border border-emerald-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">Verificación BOM · P2 Muebles / P1-PFF Ensamblado</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Cantidad de cada FERT del plan × CANTIDAD_ACUMULADA de cada línea del BOM que llega a un componente de corte. Se suman todas las líneas (nivel 1 = directa del FERT, nivel 2+ = vía semielaborado); solo se descarta la fila corrupta de SAP (relación directa con acumulada ≠ unitaria). Clic en una fila para ver las líneas.
                    </p>
                    {verificacionBomP2Errores.length > 0 && (
                      <p className="text-[9px] text-red-700 mt-1">Error al consultar el BOM de: <span className="font-mono">{verificacionBomP2Errores.join(', ')}</span></p>
                    )}
                  </div>
                  <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setVerificacionBomP2(null)}><X className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-left text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="py-1.5 pr-2">Centro</th>
                        <th className="py-1.5 pr-2">Origen · Plan</th>
                        <th className="py-1.5 pr-2">Componente</th>
                        <th className="py-1.5 pr-2">Descripción</th>
                        <th className="py-1.5 pr-2 text-right">Necesidad registrada</th>
                        <th className="py-1.5 pr-2 text-right">BOM · nivel 1</th>
                        <th className="py-1.5 pr-2 text-right">BOM · nivel 2+</th>
                        <th className="py-1.5 pr-2 text-right">BOM · total</th>
                        <th className="py-1.5 pr-2 text-right">Dif. registrada − BOM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verificacionBomP2.map(f => {
                        const key = `${f.centro}|${f.codigoPlanGrupo}|${f.componente}`;
                        const dif = f.p2Registrado - f.bomSumaLineas;
                        const abierto = verificacionBomP2Abierto === key;
                        return (
                          <React.Fragment key={key}>
                            <tr className="border-b border-slate-50 cursor-pointer hover:bg-slate-50" onClick={() => setVerificacionBomP2Abierto(abierto ? null : key)}>
                              <td className="py-1.5 pr-2">{f.centro}</td>
                              <td className="py-1.5 pr-2">{f.origen} · #{f.codigoPlanGrupo}</td>
                              <td className="py-1.5 pr-2 font-mono">{f.componente}</td>
                              <td className="py-1.5 pr-2">{f.descripcion}</td>
                              <td className="py-1.5 pr-2 text-right font-bold">{f.p2Registrado.toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>
                              <td className="py-1.5 pr-2 text-right">{f.bomNivel1.toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>
                              <td className="py-1.5 pr-2 text-right">{f.bomNivel2.toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>
                              <td className="py-1.5 pr-2 text-right font-bold">{f.bomSumaLineas.toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>
                              <td className={cn("py-1.5 pr-2 text-right font-black", Math.abs(dif) < 0.001 ? "text-emerald-600" : "text-red-600")}>{dif.toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>
                            </tr>
                            {abierto && (
                              <tr>
                                <td colSpan={9} className="bg-slate-50/70 px-3 py-2">
                                  {f.lineas.length === 0 ? (
                                    <p className="text-[9px] text-slate-400">Ningún FERT de este plan lleva este componente en su BOM — la necesidad registrada no sale de estos FERT.</p>
                                  ) : (
                                    <table className="w-full text-[9px]">
                                      <thead>
                                        <tr className="text-left text-slate-400 uppercase">
                                          <th className="pr-2">FERT</th><th className="pr-2 text-right">Cant. FERT</th><th className="pr-2 text-right">Nivel SAP</th><th className="pr-2">Nivel BOM</th><th className="pr-2">Material padre</th>
                                          <th className="pr-2 text-right">Cant. unitaria</th><th className="pr-2 text-right">Cant. acumulada</th><th className="pr-2">Unidad</th><th className="pr-2 text-right">Consumo</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {f.lineas.map((l, i) => (
                                          <tr key={i} className={cn(!l.valida && "line-through opacity-50")} title={l.valida ? undefined : 'Descartada: relación directa con el FERT con acumulada ≠ unitaria (fila corrupta de SAP)'}>
                                            <td className="pr-2 font-mono">{l.fert}</td><td className="pr-2 text-right">{l.cantidadFert}</td><td className="pr-2 text-right">{l.nivel}</td><td className="pr-2">{l.nivelBom === 1 ? 'N1 directa' : 'N2+ vía semielab.'}</td><td className="pr-2 font-mono">{l.materialPadre || '—'}</td>
                                            <td className="pr-2 text-right">{l.cantUnitaria}</td><td className="pr-2 text-right">{l.cantAcumulada}</td><td className="pr-2">{l.unidad}</td><td className="pr-2 text-right font-bold">{l.consumo.toLocaleString('es-EC', { maximumFractionDigits: 3 })}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                  {renderAuditTable(necesidadCapacidadUIO, 'Necesidades Planta — Capacidad Quito', true, 'Código Plan Grupo', 'Grupo Origen', true, true, true)}
                  {renderAuditTable(necesidadCapacidadGYE, 'Necesidades Planta — Capacidad Guayaquil', true, 'Código Plan Grupo', 'Grupo Origen', true, true, true)}
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="respuestaP3" className="animate-in fade-in duration-300 space-y-8 text-left">
            <div className="flex items-center justify-end gap-3">
              <Button
                onClick={handleAbrirRespuestaP3PFDTodos}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                title="Genera y previsualiza en un solo paso la Respuesta P3 (cobertura) y el PFD (faltante a fabricar) de ambos centros — antes eran dos botones/diálogos separados."
              >
                <Save className="w-4 h-4" /> Generar Respuesta · P3 (Ambos Centros)
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
                        title="Corrige un P3 ya guardado (cantidades, agregar/quitar material) sin esperar al ciclo del día siguiente."
                      >
                        {isLoadingEditPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Editar Plan
                      </Button>
                      <Button
                        onClick={() => handleAbrirRespuestaP3PFD(centro)}
                        disabled={rows.length === 0}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                        title="Genera y previsualiza en un solo paso la Respuesta P3 (cobertura) y el PFD (faltante a fabricar) de este centro."
                      >
                        <Save className="w-4 h-4" /> Generar Respuesta · P3 {nombrePlanta}
                      </Button>
                      <Button
                        onClick={() => handleExportSap(centro)}
                        disabled={isValidandoExportSap}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                        title="Envía a SAP (InsertarSolicitudProduccionHB) el P3 ya guardado más reciente de este centro — una orden por material. Generá la Respuesta P3 primero si todavía no existe."
                      >
                        {isValidandoExportSap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Exportar a SAP · PFD {nombrePlanta}
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
                          <th className="px-4 py-3 border-r border-gray-100 bg-indigo-50/40 text-indigo-700" title="Órdenes FERT programadas de hoy en adelante. Informativo: no cuentan como cobertura (se liberaron para el plan anterior), salvo Venta Externa con la FERT liberada al PT de su P2 — ahí se indica cuánto cubre.">FERT vigente</th>
                          <th className="px-4 py-3 border-r border-gray-100 font-black bg-yellow-50/50 text-yellow-700">Cubierto (UN)</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-orange-50/40 text-orange-700">Faltante (UN)</th>
                          <th className="px-4 py-3 border-r border-gray-100 font-black bg-orange-50/60 text-orange-800" title="Lo que se graba en el P3 y sale a SAP: faltante + provisional del material (la provisional se convierte en orden).">Respuesta P3 (UN)</th>
                          <th className="px-4 py-3 border-r border-gray-100 bg-slate-50/40 text-slate-500" title="Órdenes FERT programadas de hoy hacia atrás: pertenecen a un ciclo de P2 ya ejecutado. NO cubren este P2; se muestran como referencia y alimentan la carga en curso de Capacidad Operativa.">FERT ciclo anterior</th>
                          <th className="px-4 py-3 border-r border-gray-100">Fuente</th>
                          <th className="px-4 py-3 border-r border-gray-100">Estado</th>
                          <th className="px-4 py-3">Plan(es) Grupo Origen (P2)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                        {rows.length === 0 ? (
                          <tr><td colSpan={13} className="py-16 text-slate-300 uppercase font-black tracking-widest italic opacity-50 text-center">Sin materiales de Necesidades Planta para este centro</td></tr>
                        ) : rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors font-mono text-[10px]">
                            <td className="px-4 py-3 border-r border-slate-50 text-left text-indigo-600 font-black">{row.material}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-left font-sans normal-case">{row.descripcion}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-slate-500">{formatNum(row.necesidad, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-amber-700 bg-amber-50/20">{formatNum(row.stock, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-sky-700 bg-sky-50/20">{formatNum(row.provisional, 0)}</td>
                            <td className="px-4 py-3 border-r border-slate-50 text-indigo-700 bg-indigo-50/20">
                              {formatNum(row.fertVigente, 0)}
                              {row.fertCubre > 0 && <div className="text-[8px] font-black uppercase text-indigo-500" title="FERT liberada al PT del P2 de Venta Externa: cuenta como cobertura">cubre {formatNum(row.fertCubre, 0)}</div>}
                            </td>
                            <td className="px-4 py-3 border-r border-slate-50 text-slate-900 font-black bg-yellow-50">{formatNum(row.cubierto, 0)}</td>
                            <td className={cn("px-4 py-3 border-r border-slate-50 font-black bg-orange-50/20", row.faltante > 0 ? "text-orange-700" : "text-slate-300")}>{formatNum(row.faltante, 0)}</td>
                            <td className={cn("px-4 py-3 border-r border-slate-50 font-black bg-orange-50/40", row.aP3 > 0 ? "text-orange-800" : "text-slate-300")}>{formatNum(row.aP3, 0)}</td>
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

          <TabsContent value="debugStock" className="animate-in fade-in duration-300 space-y-4 text-left">
            <div className="flex items-center justify-between px-2 flex-wrap gap-3">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 bg-slate-600 rounded-xl text-white shadow-lg"><Info className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Validar Stock — Data Cruda</h3>
                  <p className="text-[10px] font-bold text-slate-400">Tal cual la devuelve /InventarioAnioActual (inventarioSAP), sin pasar por el filtro de ALMACENES_STOCK_POR_CENTRO. Solo lectura/auditoría — no afecta el plan.</p>
                </div>
              </div>
              <Input
                value={debugStockQuery}
                onChange={(e) => setDebugStockQuery(e.target.value)}
                placeholder="Buscar por material..."
                className="max-w-[240px] h-9 text-xs"
              />
            </div>
            {(() => {
              const q = cleanCode(debugStockQuery) || debugStockQuery.trim().toUpperCase();
              if (q) {
                const totalUIO = stockUnidadesPorMaterialPorCentro['1000']?.get(q) || 0;
                const totalGYE = stockUnidadesPorMaterialPorCentro['2000']?.get(q) || 0;
                return (
                  <div className="flex items-center gap-3 px-2">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">Stock computado Centro 1000: {totalUIO} UN</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">Stock computado Centro 2000: {totalGYE} UN</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 rounded-full px-3 py-1" title="Suma solo las filas cuyo Almacén está en ALMACENES_STOCK_POR_CENTRO para ese centro (columna 'Bodega esperada' abajo).">= suma de las filas con Bodega esperada ✓ de ese centro</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
              <div className="overflow-x-auto max-h-[600px] relative text-center">
                <table className="w-full border-collapse text-center font-sans text-[10px]">
                  <thead className="bg-gray-50 uppercase font-bold tracking-widest text-[8px] text-gray-400 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-5 border-r border-gray-100">Material (limpio)</th>
                      <th className="px-4 py-5 border-r border-gray-100">Material (crudo)</th>
                      <th className="px-4 py-5 border-r border-gray-100">Centro</th>
                      <th className="px-4 py-5 border-r border-gray-100">Almacén</th>
                      <th className="px-4 py-5 border-r border-gray-100 bg-amber-50 text-amber-700">Bodega esperada</th>
                      <th className="px-4 py-5 border-r border-gray-100 bg-emerald-50 text-emerald-700">Libre Utilización</th>
                      <th className="px-6 py-5 text-left">Fila completa (JSON)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-[11px] font-black text-slate-700">
                    {(() => {
                      const q = cleanCode(debugStockQuery) || debugStockQuery.trim().toUpperCase();
                      const rows = inventarioSAP.filter((inv) => {
                        if (!q) return true;
                        const codigo = getProp(inv, ['MATERIAL', 'Material', 'CodMaterial', 'MATERIAL_ID', 'CODIGO']);
                        return cleanCode(codigo).includes(q) || codigo.toUpperCase().includes(q);
                      });
                      if (rows.length === 0) {
                        return <tr><td colSpan={7} className="py-24 text-slate-300 font-black uppercase tracking-widest italic text-center">Sin filas en inventarioSAP{q ? ` para "${debugStockQuery}"` : ''}</td></tr>;
                      }
                      return rows.map((inv, i) => {
                        const materialCrudo = getProp(inv, ['MATERIAL', 'Material', 'CodMaterial', 'MATERIAL_ID', 'CODIGO']);
                        const centro = String(getProp(inv, ['CENTRO', 'Centro', 'centro'])).trim();
                        const almacen = String(getProp(inv, ['ALMACEN', 'Almacen'])).trim();
                        const almacenesEsperados = ALMACENES_STOCK_POR_CENTRO[centro as '1000' | '2000'];
                        const esperado = !!almacenesEsperados?.includes(almacen);
                        const libreUtilizacion = getProp(inv, ['LIBREUTILIZACION']);
                        return (
                          <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 font-mono text-blue-700 text-center font-black">{extractMaterialInfo(inv).code}</td>
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 font-mono text-slate-500 text-center">{materialCrudo || '—'}</td>
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 font-mono text-slate-600 text-center">{centro || '—'}</td>
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 font-mono text-slate-600 text-center">{almacen || '—'}</td>
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 bg-amber-50/20 text-center">
                              {esperado ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-black"><CheckCircle2 className="w-3.5 h-3.5" /> Sí</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-500 font-black"><AlertCircle className="w-3.5 h-3.5" /> No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 border-r border-dashed border-gray-100 font-mono text-emerald-700 bg-emerald-50/20 text-center font-black">{libreUtilizacion || '0'}</td>
                            <td className="px-6 py-3 text-left font-mono text-[9px] text-slate-400 whitespace-pre-wrap break-all">{JSON.stringify(inv)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={planPreviewP3PFD !== null} onOpenChange={(open) => { if (!open && !isSavingPlanP3PFD) setPlanPreviewP3PFD(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Respuesta P3 — Corte Espuma</DialogTitle>
            <DialogDescription>
              Revisa los datos que se van a grabar antes de continuar — se crea UN registro por centro: la Respuesta P3 con lo que se fabrica: faltante (Necesidad P2 − Stock − Provisional − FERT de VE al PT) + la provisional del material, que se convierte en orden al exportar a SAP. Lo cubierto con stock o FERT no se graba. Es el mismo P3 que lee Exportar a SAP y que concilia Venta Externa. Esta acción crea registros nuevos en producción.
            </DialogDescription>
          </DialogHeader>
          {planPreviewP3PFD && (
            <div className="space-y-8 text-left text-sm">
              {planPreviewP3PFD.map((preview, idx) => (
                <div key={preview.centro} className={cn(idx > 0 && 'pt-8 border-t border-slate-100')}>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800 mb-3">Centro {preview.centro}</h4>

                  <div className="space-y-3">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-full px-3 py-1">P3 — Faltante a fabricar</span>
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div><span className="font-black text-slate-500 text-[10px] uppercase block">Valor Plan</span>{preview.p3.valor}</div>
                      <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Respuesta</span>{preview.p3.fechaInicio}</div>
                    </div>
                    <div>
                      <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">
                        Materiales a fabricar ({preview.p3.rows.length})
                        {preview.p3.cubiertos ? <span className="normal-case font-bold text-emerald-700"> · {preview.p3.cubiertos} cubierto(s) con stock/FERT: no se graban</span> : null}
                      </span>
                      {preview.p3.rows.length === 0 && (
                        <p className="text-[11px] text-emerald-700 font-bold px-1 mb-2">Todo el P2 está cubierto: se graba solo la cabecera del P3 (sin líneas) como constancia de respuesta del ciclo.</p>
                      )}
                      <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                        <table className="w-full text-[11px] border-collapse">
                          <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left">Material</th>
                              <th className="px-3 py-2 text-right">Necesidad P2</th>
                              <th className="px-3 py-2 text-right">Stock</th>
                              <th className="px-3 py-2 text-right">Provisional</th>
                              <th className="px-3 py-2 text-right">Cubierto</th>
                              <th className="px-3 py-2 text-right font-black text-orange-700" title="Faltante + provisional del material (se convierte al exportar a SAP)">Respuesta P3 (se graba)</th>
                              <th className="px-3 py-2 text-left">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {preview.p3.rows.map((row, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-left font-mono">{row.material}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-400">{formatNum(row.necesidad, 0)}</td>
                                <td className="px-3 py-2 text-right font-mono text-amber-700">{formatNum(row.stock, 0)}</td>
                                <td className="px-3 py-2 text-right font-mono text-sky-700">{formatNum(row.provisional, 0)}</td>
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
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanPreviewP3PFD(null)} disabled={isSavingPlanP3PFD}>Cancelar</Button>
            <Button onClick={handleConfirmarRespuestaP3PFD} disabled={isSavingPlanP3PFD} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSavingPlanP3PFD ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSavingPlanP3PFD ? 'Guardando...' : 'Confirmar y Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportSapPreview !== null} onOpenChange={(open) => { if (!open && !isEnviandoSap) { setExportSapPreview(null); setExportSapPayloads(null); } }}>
        <DialogContent className="max-w-[96vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar envío a SAP — P3 Corte Espuma {exportSapPreview ? `(Centro ${exportSapPreview.centro})` : ''}</DialogTitle>
            <DialogDescription>
              Revisa y edita si hace falta las órdenes de producción exactas que se van a crear en SAP/HANA (InsertarSolicitudProduccionHB) antes de enviarlas — cada celda es el campo real del payload, tal cual se manda. Sale del P3 #{exportSapPreview?.plan.codigo_plan_grupo} ya guardado: Cod. Orden Externa = codigo_detalle_tactico de la línea del material y Cant. Planificada = su cantidad. Esta acción no se puede deshacer desde acá.
            </DialogDescription>
          </DialogHeader>
          {exportSapPreview && exportSapPayloads && (
            <div className="space-y-4 text-left text-sm">
              <div>
                <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Órdenes a crear ({exportSapPayloads.length})</span>
                <div className="border border-slate-100 rounded-xl overflow-auto max-h-[400px]">
                  <table className="text-[11px] border-collapse">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 w-8" aria-label="Quitar" />
                        <th className="px-2 py-2 text-left whitespace-nowrap">Descripción</th>
                        {SOLICITUD_PRODUCCION_FIELDS_ESPUMA.map(f => (
                          <th key={f.key} className="px-2 py-2 text-left whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {exportSapPayloads.map((payload, i) => (
                        <tr key={`${exportSapPreview.grupos[i]?.[0]?.codigo_detalle_tactico}-${i}`}>
                          <td className="px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => removeExportSapRow(i)}
                              disabled={isEnviandoSap}
                              title="Quitar esta orden del envío a SAP"
                              aria-label={`Quitar ${payload.CodigoMaterial} del envío`}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                          <td className="px-2 py-1 truncate max-w-[180px]" title={descripcionMaterial(payload.CodigoMaterial)}>{descripcionMaterial(payload.CodigoMaterial) || '—'}</td>
                          {SOLICITUD_PRODUCCION_FIELDS_ESPUMA.map(f => {
                            const error = errorCampoSapEspuma(payload, f.key);
                            return (
                              <td key={f.key} className="px-1 py-1">
                                <Input
                                  type={f.type === 'number' ? 'number' : 'text'}
                                  value={payload[f.key] ?? ''}
                                  onChange={(e) => updateExportSapPayload(i, f.key, f.type === 'number' ? (Number(e.target.value) || 0) : e.target.value)}
                                  disabled={isEnviandoSap}
                                  title={error || undefined}
                                  className={cn("h-7 text-[10px] font-mono px-1.5", f.key === 'Observaciones' ? 'w-48' : 'w-24', error && "border-red-400 bg-red-50")}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {erroresExportSap > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-red-600">
                    {erroresExportSap} campo(s) en rojo: completa los obligatorios (Cod. Orden Externa, Material, Cantidad, Versión) o quita la fila con ✕ antes de enviar.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setExportSapPreview(null); setExportSapPayloads(null); }} disabled={isEnviandoSap}>Cancelar</Button>
            <Button onClick={handleConfirmarExportSap} disabled={isEnviandoSap || erroresExportSap > 0 || !exportSapPayloads || exportSapPayloads.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isEnviandoSap ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} {isEnviandoSap ? 'Enviando…' : 'Confirmar y Enviar a SAP'}
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
                      <td className="px-3 py-2 font-mono">{fechaLocalPlana(p.fecha_inicio_plan) || '—'}</td>
                      <td className="px-3 py-2 font-mono">{fechaLocalPlana(p.fecha_fin_plan) || '—'}</td>
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
                          <td className="px-3 py-2 font-mono">
                            {row.material}
                            {row.nivel && <span className="ml-1 text-[8px] font-black text-indigo-600" title={row.nivel === 1 ? 'Nivel 1: directa del FERT' : 'Nivel 2+: vía semielaborado'}>N{row.nivel}</span>}
                          </td>
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
      <PanelProgreso panel={panelProgreso} />
    </div>
  );
};
