/**
 * Reposición de protectores subcontratados (Programación Táctica Subcontratación). Replica el Excel
 * "SS y PP Forros protectores" (2026-11-16). A diferencia de los forros de almohada, el plan NO sale de
 * órdenes: solo repone stock hasta cubrir SS y PP del protector FERT (lo que el taller entrega).
 *
 *  CALCULO SS-PP (por FERT, salidas 601 de MB51 — la consulta PP_MB51_HIS del Excel):
 *    demanda semanal = CEILING(Σ salidas de la ventana ÷ semanas, 5)        (col AB; Excel divide ÷ 20)
 *    diario          = semanal ÷ 5                                          (BD)
 *    σ diaria        = diario × 1.5                                         (BF, aproximación del Excel)
 *    reposición      = diario × LT + σ diaria × LT × Z                      (BI; LT 5, Z 1.96)
 *    SS              = CEILING(semanal × 3, paquete)                        (Z)
 *    PP              = reposición ÷ 2 + SS                                  (AA)
 *  REV PED COMPRAS:
 *    stock           = libre utilización FERT en 1001 + 1008 (centro 1000) + 2001 (centro 2000)
 *    stock final     = stock + pedidos de compra abiertos del FERT (ME2N)
 *    PP/SS           = SS + PP ÷ 2                                          (K)
 *    pedido          = stock final < PP/SS ? CEILING(PP/SS − stock final, paquete) : 0
 *
 * Diferencias con el Excel: el Excel pide 1 paquete (col M) y su "Stock final" quedó como solicitud − PP/SS;
 * aquí se pide el faltante redondeado al paquete para cubrir PP/SS. Sin paquete (Tabla2 en 0) no hay
 * pedido sugerido, igual que el Excel.
 */

export const ALMACENES_PROTECTOR: { centro: string; almacen: string }[] = [
  { centro: '1000', almacen: '1001' },
  { centro: '1000', almacen: '1008' },
  { centro: '2000', almacen: '2001' },
];

export interface ParametrosProtector {
  semanas: number;
  leadTimeDias: number;
  z: number;
  semanasSs: number;
}

export const PARAMETROS_PROTECTOR_DEFECTO: ParametrosProtector = {
  semanas: 20,
  leadTimeDias: 5,
  z: 1.96,
  semanasSs: 3,
};

export interface MovimientoProtector {
  fecha: Date;
  cantidad: number; // unidades despachadas (601 positivo, 602 resta)
}

export interface ResultadoSsPpProtector {
  semanal: number[]; // salidas por semana, de la más antigua a la más reciente
  semanasConSalida: number;
  totalVentana: number;
  demandaSemanal: number;
  diario: number;
  reposicion: number;
  ss: number;
  pp: number;
  ppss: number;
}

const lunesDe = (d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const techo = (v: number, multiplo: number): number => (multiplo > 0 ? Math.ceil(v / multiplo - 1e-9) * multiplo : 0);

/** Semanas completas (lunes a domingo) antes de la semana de `hoy`. */
export const calcularSsPpProtector = (
  movs: MovimientoProtector[],
  paquete: number,
  p: ParametrosProtector,
  hoy = new Date(),
): ResultadoSsPpProtector => {
  const fin = lunesDe(hoy);
  const inicio = new Date(fin);
  inicio.setDate(inicio.getDate() - 7 * p.semanas);
  const semanal = Array.from({ length: p.semanas }, () => 0);
  movs.forEach(m => {
    if (m.fecha < inicio || m.fecha >= fin) return;
    const idx = Math.floor((lunesDe(m.fecha).getTime() - inicio.getTime()) / (7 * 86400000));
    if (idx >= 0 && idx < p.semanas) semanal[idx] += m.cantidad;
  });
  const totalVentana = Math.max(0, semanal.reduce((s, v) => s + v, 0));
  const demandaSemanal = techo(totalVentana / p.semanas, 5);
  const diario = demandaSemanal / 5;
  const reposicion = diario * p.leadTimeDias + diario * 1.5 * p.leadTimeDias * p.z;
  const ss = techo(demandaSemanal * p.semanasSs, paquete);
  const pp = reposicion / 2 + ss;
  return {
    semanal,
    semanasConSalida: semanal.filter(v => v > 0).length,
    totalVentana,
    demandaSemanal,
    diario,
    reposicion,
    ss,
    pp,
    ppss: ss + pp / 2,
  };
};

export interface ResultadoReposicionProtector {
  stockFinal: number;
  faltante: number;
  pedido: number;
  coberturaDias: number | null;
}

export const calcularReposicionProtector = (
  e: { stock: number; transito: number; ppss: number; diario: number; paquete: number },
): ResultadoReposicionProtector => {
  const stockFinal = e.stock + e.transito;
  const faltante = Math.max(0, e.ppss - stockFinal);
  const pedido = faltante > 0 ? techo(faltante, e.paquete) : 0;
  const coberturaDias = e.diario > 0 ? Math.round(stockFinal / e.diario) : null;
  return { stockFinal, faltante, pedido, coberturaDias };
};
