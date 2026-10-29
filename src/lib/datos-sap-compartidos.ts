/**
 * Datos SAP compartidos entre los módulos tácticos (Corte Espuma, Laminado, Venta Externa y
 * Formulación).
 *
 * Problema que resuelve (usuario 2026-10-08): cada módulo, al sincronizar, descargaba por su cuenta
 * las mismas consultas grandes de SAP (provisionales y FERT de 20 000 filas, inventario, cubo de
 * inventarios de 50 000, mantenimientos, KPI...). Pasar de un módulo a otro repetía toda la descarga.
 *
 * Qué se comparte: SOLO la respuesta cruda del servicio, tal cual llega. Cada módulo sigue filtrando
 * y calculando con su propia lógica, así que la generación (P2/P3, capacidad) y lo que muestran los
 * tableros no cambian. Cada lector recibe su propia copia (structuredClone): si un módulo modifica una
 * fila, no altera lo que ve otro.
 *
 * Vigencia: los datos se reusan hasta que el usuario pulse "Actualizar datos SAP" (refrescarDatosSap)
 * o hasta que se envíen órdenes a SAP (se refrescan FERT y provisionales, que son las que cambian).
 * Qué se vuelve a consultar y cuándo (usuario 2026-10-12): FERT y provisionales en CADA sincronización
 * (refrescarAlSincronizar: son las únicas que cambian en el día); Cubo de inventarios UNA vez al día y
 * Mantenimientos UNA vez por semana (se cargan al final del miércoles o el jueves: el jueves se consultan
 * en cada sincronización y de viernes a miércoles se usa la última copia del jueves), ambos en el navegador
 * (cache-diaria) — "Actualizar datos SAP" no los vuelve a pedir. El resto se comparte en la sesión.
 * Una respuesta vacía o con error no se guarda: la próxima lectura vuelve a pedirla.
 *
 * Plan Grupo y Detalle Táctico (tablas propias, no SAP) solo se comparten por unos segundos, para no
 * descargarlas varias veces dentro del mismo flujo; cualquier guardado o borrado las invalida
 * (plangrupo.service / detalletactico.service llaman a marcarCambioTablasPropias).
 */
import { serviciosService } from '@/services/servicios.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { leerVersionTablasPropias } from '@/lib/tablas-propias-version';
import type { DetalleTactico } from '@/types/interfaces';
import { leerDiario, guardarDiario, periodoDesdeJueves, esJuevesHoy } from '@/lib/cache-diaria';

export type ClaveDatoSap =
  | 'provisionales'
  | 'fert'
  | 'inventario'
  | 'cuboInventarios'
  | 'habilidades'
  | 'mantenimientos'
  | 'kpiLooper'
  | 'kpiCarruseles'
  | 'pendientesTotales'
  // tiemposEnsambladoByGrupoYCentroPR2 por Centro+Grupo (ej. 'tiemposPR2:1000:8', que piden Corte
  // Espuma y Laminado por igual).
  | `tiemposPR2:${string}`;

type ClaveDato = ClaveDatoSap | 'planGrupo' | 'detalleTactico';

interface Entrada {
  promesa: Promise<unknown>;
  // Hora en que llegó la respuesta (null mientras se descarga).
  momento: number | null;
  // Versión de Plan Grupo / Detalle Táctico al pedirla (ver tablas-propias-version).
  versionTablas: number;
}

// Tablas propias que solo se comparten dentro de un mismo flujo.
const VIGENCIA_TABLAS_PROPIAS_MS = 20_000;
const CLAVES_TABLAS_PROPIAS: ClaveDato[] = ['planGrupo', 'detalleTactico'];

const entradas = new Map<ClaveDato, Entrada>();
const oyentes = new Set<() => void>();
let version = 0;

const notificar = () => {
  version++;
  oyentes.forEach(o => o());
};

const respuestaVacia = (r: unknown): boolean => {
  const cuerpo = r as { data?: unknown } | null | undefined;
  const data = cuerpo?.data as { data?: unknown } | unknown[] | undefined;
  const filas = Array.isArray(data) ? data : (data as { data?: unknown })?.data;
  return !Array.isArray(filas) || filas.length === 0;
};

const copia = <T,>(r: T): T => (typeof structuredClone === 'function' ? structuredClone(r) : JSON.parse(JSON.stringify(r)));

const compartir = <T,>(clave: ClaveDato, pedir: () => Promise<T>): Promise<T> => {
  const actual = entradas.get(clave);
  const vencida = !!actual && CLAVES_TABLAS_PROPIAS.includes(clave) && (
    actual.versionTablas !== leerVersionTablasPropias()
    || (actual.momento !== null && Date.now() - actual.momento > VIGENCIA_TABLAS_PROPIAS_MS)
  );
  if (actual && !vencida) return actual.promesa.then(r => copia(r as T));

  const entrada: Entrada = { promesa: Promise.resolve(), momento: null, versionTablas: leerVersionTablasPropias() };
  entrada.promesa = pedir().then(
    r => {
      if (entradas.get(clave) === entrada) {
        if (respuestaVacia(r)) entradas.delete(clave);
        else entrada.momento = Date.now();
        notificar();
      }
      return r;
    },
    e => {
      if (entradas.get(clave) === entrada) { entradas.delete(clave); notificar(); }
      throw e;
    }
  );
  entradas.set(clave, entrada);
  return entrada.promesa.then(r => copia(r as T));
};

// Plan Grupo / Detalle Táctico se bajan completos (el backend no filtra) y la descarga es larga: un
// corte de red ("NetworkError ..." / "Failed to fetch", TypeError de fetch) se reintenta una vez
// tras 2 s (12-10, Generar P2 de Venta Externa). Un error HTTP del servidor no se reintenta.
const conReintentoRed = <T,>(pedir: () => Promise<T>) => (): Promise<T> =>
  pedir().catch(e => {
    if (!(e instanceof TypeError)) throw e;
    console.warn('[datos compartidos] Corte de red, reintentando una vez:', e.message);
    return new Promise<T>((ok, mal) => setTimeout(() => pedir().then(ok, mal), 2000));
  });

// Cubo de inventarios en páginas (2026-10-12): de una sola vez eran ~51 MB, que por el servidor publicado
// se cortaban ("Sin respuesta: Cubo de inventarios"), y además pedía 50 000 filas cuando hay ~53 000
// (totalRegistros): se perdían ~3 000. Ahora: página 1, luego el resto de a 2 en paralelo, cada una con
// reintento ante corte de red; la respuesta conserva la forma de antes ({ data, length, totalRegistros }).
const FILAS_PAGINA_CUBO = 10000;
const CLAVE_CUBO_DIARIO = 'cuboInventarios';
// v2 (2026-10-28): el SP sp_Get_MantenimientosPreventivosAgendados cambió de estructura; la copia
// semanal guardada con la estructura vieja deja de leerse y se vuelve a descargar.
const CLAVE_MTTO_SEMANAL = 'mantenimientos-v2';
// Datos con su propia vigencia (día / semana): ni "Actualizar datos SAP" ni la hora del chip los toman.
const CLAVES_PERIODICAS: ClaveDato[] = ['cuboInventarios', 'mantenimientos'];
type RespuestaCubo = Awaited<ReturnType<typeof serviciosService.getCuboInventarios>>;
const descargarCuboPaginado = async (): Promise<RespuestaCubo> => {
  const pagina = (p: number) => conReintentoRed(() => serviciosService.getCuboInventarios(p, FILAS_PAGINA_CUBO))();
  const primera = await pagina(1);
  const filas = [...((primera.data as unknown[]) || [])];
  const total = Number((primera as { totalRegistros?: number }).totalRegistros) || filas.length;
  const paginas = Array.from({ length: Math.max(0, Math.ceil(total / FILAS_PAGINA_CUBO) - 1) }, (_, i) => i + 2);
  for (let i = 0; i < paginas.length; i += 2) {
    const lote = await Promise.all(paginas.slice(i, i + 2).map(p => pagina(p)));
    lote.forEach(r => filas.push(...((r.data as unknown[]) || [])));
  }
  return { ...primera, data: filas, length: filas.length } as RespuestaCubo;
};

/** Consultas SAP compartidas — mismas firmas y respuestas que serviciosService. */
export const sapCompartido = {
  ordenesProvisionales: () => compartir('provisionales', () => serviciosService.OrdenesProvisionalesPaginados(1, 20000)),
  ordenesFert: () => compartir('fert', () => serviciosService.getOrdenesFert(1, 20000)),
  inventarioAnioActual: () => compartir('inventario', () => serviciosService.getInventarioAñoActual()),
  cuboInventarios: () => compartir('cuboInventarios', async () => {
    const guardado = await leerDiario<RespuestaCubo>(CLAVE_CUBO_DIARIO);
    if (guardado) return guardado.valor;
    const r = await descargarCuboPaginado();
    if (Array.isArray(r?.data) && r.data.length > 0) void guardarDiario(CLAVE_CUBO_DIARIO, r);
    return r;
  }),
  cuboHabilidadesOP: () => compartir('habilidades', () => serviciosService.getCuboHabilidadesOP()),
  mantenimientosPreventivos: () => compartir('mantenimientos', async () => {
    const periodo = periodoDesdeJueves();
    // El jueves la carga semanal puede llegar en cualquier momento: se consulta siempre y se guarda la
    // última; de viernes a miércoles se usa esa copia.
    const guardado = esJuevesHoy() ? null : await leerDiario<Awaited<ReturnType<typeof serviciosService.ListarMantenimientoPreventivosProgramados>>>(CLAVE_MTTO_SEMANAL, periodo);
    if (guardado) return guardado.valor;
    const r = await serviciosService.ListarMantenimientoPreventivosProgramados();
    if (!respuestaVacia(r)) void guardarDiario(CLAVE_MTTO_SEMANAL, r, periodo);
    return r;
  }),
  kpiMaestroLooper: () => compartir('kpiLooper', () => serviciosService.getKPIMaestroLooper()),
  kpiMaestroCarruseles: () => compartir('kpiCarruseles', () => serviciosService.getKPIMaestroCarruseles()),
  pendientesTotales: () => compartir('pendientesTotales', () => serviciosService.getPendientesTotales(1, 20000)),
  tiemposEnsambladoPR2: (centro: string, codigoGrupo: number) =>
    compartir(`tiemposPR2:${centro}:${codigoGrupo}`, () => serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(centro, codigoGrupo)),
  planGrupos: () => compartir('planGrupo', conReintentoRed(() => planGrupoService.getAll())),
  detallesTacticos: () => compartir('detalleTactico', conReintentoRed(() => detalleTacticoService.getAll())),
};

/**
 * Detalles activos de los planes indicados, uno por plan con /detalle_tactico/plan_grupo/:codigo (sin
 * bajar la tabla completa). Si ese endpoint falla (p. ej. 404 en un backend que todavía no lo tiene
 * desplegado), filtra la descarga completa: mismo resultado, solo más lento.
 */
export const detallesDePlanes = async (codigos: number[]): Promise<DetalleTactico[]> => {
  const unicos = Array.from(new Set(codigos.filter(c => Number.isInteger(c) && c > 0)));
  if (unicos.length === 0) return [];
  try {
    const respuestas = await Promise.all(unicos.map(c => detalleTacticoService.getByPlanGrupo(c)));
    return respuestas.flatMap(r => r.data || []);
  } catch (e) {
    console.warn('[detalle_tactico/plan_grupo] No disponible, se usa la tabla completa:', (e as Error).message);
    const set = new Set(unicos);
    const todos = (await sapCompartido.detallesTacticos()).data || [];
    return todos.filter(d => d.estado === 'A' && set.has(d.codigo_plan_grupo));
  }
};

/**
 * Descarta lo guardado para que la próxima lectura vaya a SAP. Sin claves = todos los datos SAP
 * ("Actualizar datos SAP"); las tablas propias se descartan siempre.
 */
export const refrescarDatosSap = (claves?: ClaveDatoSap[]): void => {
  // Cubo (diario) y mantenimientos (semanal): solo se descartan si se piden explícito.
  const aBorrar: ClaveDato[] = claves ? [...claves, ...CLAVES_TABLAS_PROPIAS] : Array.from(entradas.keys()).filter(c => !CLAVES_PERIODICAS.includes(c));
  aBorrar.forEach(c => entradas.delete(c));
  notificar();
};

/**
 * Al iniciar CADA sincronización de un módulo (usuario 2026-10-12): FERT y provisionales son las únicas
 * consultas que cambian durante el día, así que siempre se vuelven a pedir; el resto se reusa.
 */
// El jueves también el mantenimiento: su carga semanal puede llegar ese día (ver mantenimientosPreventivos).
export const refrescarAlSincronizar = (): void => refrescarDatosSap(esJuevesHoy() ? ['fert', 'provisionales', 'mantenimientos'] : ['fert', 'provisionales']);

/** Hora del dato SAP más antiguo en uso (null si no hay nada descargado). */
export const momentoDatosSap = (): Date | null => {
  let min: number | null = null;
  entradas.forEach((e, clave) => {
    // Cubo y mantenimientos tienen su propia vigencia: no marcan la hora ("Actualizar" no los refresca).
    if (CLAVES_TABLAS_PROPIAS.includes(clave) || CLAVES_PERIODICAS.includes(clave) || e.momento === null) return;
    if (min === null || e.momento < min) min = e.momento;
  });
  return min === null ? null : new Date(min);
};

/**
 * Hora en que llegó un dato puntual (null si no está descargado). La usan los cálculos que comparan
 * lo pendiente en SAP contra el tiempo que queda del turno: lo pendiente es el de esa hora, no el
 * del clic en Sincronizar.
 */
export const momentoDato = (clave: ClaveDatoSap): Date | null => {
  const m = entradas.get(clave)?.momento;
  return m ? new Date(m) : null;
};

export const suscribirDatosSap =(oyente: () => void): (() => void) => {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
};

export const versionDatosSap = (): number => version;
