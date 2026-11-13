/**
 * Reposición de forros de almohada (Programación Táctica Subcontratación). Replica el Excel
 * "Planificación_Forros_ALM_26" (2026-11-12):
 *
 *  CALCULO SS-PP (por forro, consumos MB51 de las últimas N semanas):
 *    consumo semanal  = |Σ consumo| ÷ semanas CON consumo      (COUNTIF(<0), no todas las semanas)
 *    consumo diario   = semanal ÷ 5
 *    σ diaria         = STDEV(semanas con consumo) ÷ 5
 *    SS               = σ diaria × LT × Z                       (LT = 5 días, Z = 1.96; sin raíz de LT)
 *    PP               = consumo diario × LT + SS
 *    temporada        = PP y SS × 1.25
 *  REV PED COMPRAS:
 *    necesidad semana = Σ pendiente de las órdenes FERT del forro con fecha ≤ fecha de corte
 *    stock final      = stock 1014 (libre utilización) + pedidos en tránsito − necesidad
 *    PP/SS            = PP + SS ÷ 2
 *    pedido           = PP/SS < stock final ? 0 : lote mínimo
 *    cobertura (días) = stock final ÷ consumo diario
 *
 * Diferencia con el Excel: si el forro no tiene lote mínimo, el pedido es el faltante (PP/SS − stock
 * final) en vez de 0, para no esconder la falta.
 */

export const ALMACEN_FORROS_ALMOHADA = '1014';
export const CENTRO_ALMOHADAS = '1000';

export interface ParametrosSsPp {
  semanas: number;
  leadTimeDias: number;
  z: number;
  factorTemporada: number;
}

export const PARAMETROS_SS_PP_DEFECTO: ParametrosSsPp = {
  semanas: 14,
  leadTimeDias: 5,
  z: 1.96,
  factorTemporada: 1.25,
};

export interface MovimientoForro {
  fecha: Date;
  // Unidades consumidas (positivo = consumo; una reversa 262 resta).
  cantidad: number;
}

export interface ResultadoSsPp {
  semanal: number[]; // consumo por semana, de la más antigua a la más reciente
  semanasConConsumo: number;
  consumoSemanal: number;
  consumoDiario: number;
  desvSemanal: number;
  ss: number;
  pp: number;
}

const lunesDe = (d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  return x;
};

const desviacionMuestral = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};

/** Semanas completas (lunes a domingo) que terminan antes de la semana de `hoy`. */
export const calcularSsPp = (movs: MovimientoForro[], p: ParametrosSsPp, hoy = new Date()): ResultadoSsPp => {
  const finVentana = lunesDe(hoy); // excluye la semana en curso (incompleta)
  const inicio = new Date(finVentana);
  inicio.setDate(inicio.getDate() - 7 * p.semanas);
  const semanal = Array.from({ length: p.semanas }, () => 0);
  movs.forEach(m => {
    if (m.fecha < inicio || m.fecha >= finVentana) return;
    const idx = Math.floor((lunesDe(m.fecha).getTime() - inicio.getTime()) / (7 * 86400000));
    if (idx >= 0 && idx < p.semanas) semanal[idx] += m.cantidad;
  });
  const conConsumo = semanal.filter(v => v > 0);
  const consumoSemanal = conConsumo.length ? conConsumo.reduce((s, v) => s + v, 0) / conConsumo.length : 0;
  const consumoDiario = consumoSemanal / 5;
  const desvSemanal = desviacionMuestral(conConsumo);
  const ssBase = (desvSemanal / 5) * p.leadTimeDias * p.z;
  const ppBase = consumoDiario * p.leadTimeDias + ssBase;
  return {
    semanal,
    semanasConConsumo: conConsumo.length,
    consumoSemanal,
    consumoDiario,
    desvSemanal,
    ss: ssBase * p.factorTemporada,
    pp: ppBase * p.factorTemporada,
  };
};

export interface EntradaReposicion {
  necesidad: number;
  stock: number;
  transito: number;
  ss: number;
  pp: number;
  consumoDiario: number;
  loteMin: number;
}

export interface ResultadoReposicion {
  stockFinal: number;
  ppss: number;
  faltante: number;
  pedido: number;
  coberturaDias: number | null;
  // El faltante supera el lote mínimo: el pedido del Excel (1 lote) no alcanza.
  excedeLote: boolean;
}

export const calcularReposicion = (e: EntradaReposicion): ResultadoReposicion => {
  const stockFinal = e.stock + e.transito - e.necesidad;
  const ppss = e.pp + e.ss / 2;
  const faltante = Math.max(0, ppss - stockFinal);
  // Sin consumo histórico (PP/SS = 0) solo se pide si la necesidad deja el stock en negativo.
  const pide = ppss >= stockFinal && (ppss > 0 || stockFinal < 0);
  const pedido = !pide ? 0 : e.loteMin > 0 ? e.loteMin : Math.ceil(faltante);
  const coberturaDias = e.consumoDiario > 0 ? Math.round(stockFinal / e.consumoDiario) : null;
  return { stockFinal, ppss, faltante, pedido, coberturaDias, excedeLote: pide && e.loteMin > 0 && faltante > e.loteMin };
};
