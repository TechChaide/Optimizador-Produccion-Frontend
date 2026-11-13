/**
 * Distribución automática del pedido de forros entre talleres (PLAN SUBCONTRATACIÓN del Excel ALM).
 *
 * Mecánica del Excel (filas 2-7 de la hoja):
 *   ponderado_t = personas_t × peso_t
 *   objetivo_t  = costo total del pedido (USD) × ponderado_t ÷ Σ ponderado     (fila 3 "SEMANAL")
 *   desviación  = USD asignado al taller − objetivo_t                          (fila 2)
 * El planificador llena la matriz forro × taller a mano hasta dejar la desviación en ~0, solo en los
 * talleres marcados con X en Matriz_cod_tela. Aquí:
 *   0. Lo ya asignado (a mano) se respeta; solo se reparte lo que falta de cada forro.
 *      Los forros sin ningún taller en la matriz (40002xxx, compra directa) no entran al costo total
 *      ni al reparto: inflaban el objetivo de todos sin poder asignarse.
 *   1. Llenado sin pasar el objetivo: cada forro va al taller habilitado con más hueco (con "Agrupar
 *      por tela", primero al que ya tiene su tela y, si la tela es nueva, al que le cabe todo el grupo
 *      con menor sobrante). Si no cabe entero, la referencia se COMPARTE entre talleres: cada uno
 *      recibe lo que le cabe (múltiplos del paquete, nunca menos del mínimo) y lo demás pasa al
 *      siguiente.
 *   2. Sobrante (lo que no cupo por restricciones de matriz o redondeo): en partes del mínimo, cada
 *      parte al taller habilitado que queda más cerca de su objetivo. Así el exceso se reparte
 *      en vez de caer entero en un taller.
 * Orden: con tela, primero los grupos más restringidos por la matriz y luego de mayor valor; sin
 * tela, prioridad A → B → C, más restringidos y mayor valor. Talleres con 0 personas solo reciben un
 * forro si la matriz no permite otro.
 */

export interface TallerDistribucion {
  nombre: string;
  ponderado: number; // personas × peso
}

export interface ForroDistribucion {
  codigo: string;
  cantidad: number; // pedido final (UN)
  precio: number; // USD por unidad (mano de obra del taller)
  prioridad: string | null;
  talleres?: string[]; // habilitados por la matriz; sin matriz = todos
  tela?: string;
}

export interface ParametrosDistribucion {
  paquete: number; // las partes se redondean a este múltiplo (UN)
  minimoPorTaller: number; // parte mínima cuando se comparte un forro (UN)
  agruparPorTela: boolean;
}

export const PARAMETROS_DISTRIBUCION_DEFECTO: ParametrosDistribucion = { paquete: 10, minimoPorTaller: 50, agruparPorTela: true };

// "TELA VELVETFLEX GRIS " y "TELA  GROWING UP" vienen con espacios de más en el Excel.
export const normalizarTela = (tela?: string): string => (tela ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

export type Asignacion = Record<string, Record<string, number>>;

export interface ResumenTaller {
  nombre: string;
  porcentaje: number;
  objetivoUsd: number;
  asignadoUsd: number;
  desviacionUsd: number;
  unidades: number;
}

const ORDEN_PRIORIDAD: Record<string, number> = { A: 0, B: 1, C: 2 };

/** Talleres que la matriz permite para el forro (sin matriz = todos; lista vacía = ninguno). */
export const talleresDeForro = (f: ForroDistribucion, talleres: string[]): string[] =>
  !f.talleres ? talleres : talleres.filter(t => f.talleres!.includes(t));

/** Forros que algún taller puede hacer: los únicos que cuentan para el objetivo. */
export const forrosRepartibles = (forros: ForroDistribucion[], talleres: TallerDistribucion[]): ForroDistribucion[] => {
  const nombres = talleres.map(t => t.nombre);
  return forros.filter(f => f.cantidad > 0 && talleresDeForro(f, nombres).length > 0);
};

export const objetivosPorTaller = (talleres: TallerDistribucion[], costoTotal: number): Map<string, number> => {
  const suma = talleres.reduce((s, t) => s + Math.max(0, t.ponderado), 0);
  return new Map(talleres.map(t => [t.nombre, suma > 0 ? (costoTotal * Math.max(0, t.ponderado)) / suma : 0]));
};

export const resumenPorTaller = (
  forros: ForroDistribucion[],
  talleres: TallerDistribucion[],
  asignacion: Asignacion,
): ResumenTaller[] => {
  const costoTotal = forrosRepartibles(forros, talleres).reduce((s, f) => s + f.cantidad * f.precio, 0);
  const objetivos = objetivosPorTaller(talleres, costoTotal);
  const suma = talleres.reduce((s, t) => s + Math.max(0, t.ponderado), 0);
  return talleres.map(t => {
    let unidades = 0;
    let asignadoUsd = 0;
    forros.forEach(f => {
      const q = asignacion[f.codigo]?.[t.nombre] ?? 0;
      unidades += q;
      asignadoUsd += q * f.precio;
    });
    const objetivoUsd = objetivos.get(t.nombre) ?? 0;
    return {
      nombre: t.nombre,
      porcentaje: suma > 0 ? Math.max(0, t.ponderado) / suma : 0,
      objetivoUsd,
      asignadoUsd,
      desviacionUsd: asignadoUsd - objetivoUsd,
      unidades,
    };
  });
};

export const distribuirPedido = (
  forrosTodos: ForroDistribucion[],
  talleres: TallerDistribucion[],
  previa: Asignacion,
  p: ParametrosDistribucion = PARAMETROS_DISTRIBUCION_DEFECTO,
): Asignacion => {
  const paquete = Math.max(1, Math.round(p.paquete));
  const minimo = Math.max(paquete, Math.ceil(Math.max(1, p.minimoPorTaller) / paquete) * paquete);
  const nombres = talleres.map(t => t.nombre);
  const conPersonal = new Set(talleres.filter(t => t.ponderado > 0).map(t => t.nombre));
  const forros = forrosRepartibles(forrosTodos, talleres);

  // El objetivo usa el precio real (igual que el resumen); para ubicar un forro sin precio se usa el medio.
  const conPrecio = forros.filter(f => f.precio > 0);
  const precioMedio = conPrecio.length ? conPrecio.reduce((s, f) => s + f.precio, 0) / conPrecio.length : 1;
  const precioDe = (f: ForroDistribucion) => (f.precio > 0 ? f.precio : precioMedio);
  const objetivos = objetivosPorTaller(talleres, forros.reduce((s, f) => s + f.cantidad * f.precio, 0));

  const res: Asignacion = {};
  const asignadoUsd = new Map(nombres.map(n => [n, 0]));
  const telaDe = new Map(forros.map(f => [f.codigo, normalizarTela(f.tela)]));
  const telasEn = new Map(nombres.map(n => [n, new Set<string>()]));
  const pendienteTela = new Map<string, number>();
  const sumar = (f: ForroDistribucion, taller: string, q: number) => {
    if (q <= 0) return;
    res[f.codigo] = res[f.codigo] ?? {};
    res[f.codigo][taller] = (res[f.codigo][taller] ?? 0) + q;
    asignadoUsd.set(taller, (asignadoUsd.get(taller) ?? 0) + q * f.precio);
    const tela = telaDe.get(f.codigo);
    if (tela) {
      telasEn.get(taller)?.add(tela);
      if (pendienteTela.has(tela)) pendienteTela.set(tela, (pendienteTela.get(tela) ?? 0) - q * precioDe(f));
    }
  };
  const asignadoForro = (f: ForroDistribucion) => Object.values(res[f.codigo] ?? {}).reduce((s, q) => s + q, 0);

  // 0. Lo asignado a mano se conserva (hasta la cantidad del forro).
  forros.forEach(f => {
    let resto = f.cantidad;
    Object.entries(previa[f.codigo] ?? {}).forEach(([t, q]) => {
      if (!nombres.includes(t) || resto <= 0) return;
      const tomado = Math.min(q, resto);
      sumar(f, t, tomado);
      resto -= tomado;
    });
  });

  // Talleres candidatos: los de la matriz con personal; si la matriz solo deja talleres sin personal, esos.
  const habilitados = (f: ForroDistribucion) => {
    const m = talleresDeForro(f, nombres);
    const conGente = m.filter(t => conPersonal.has(t));
    return conGente.length ? conGente : m;
  };
  const hueco = (t: string) => (objetivos.get(t) ?? 0) - (asignadoUsd.get(t) ?? 0);
  const cabeUn = (t: string, precio: number) => Math.floor(Math.max(0, hueco(t)) / precio / paquete) * paquete;

  const rango = (f: ForroDistribucion) => ORDEN_PRIORIDAD[f.prioridad ?? ''] ?? 3;
  const valor = (f: ForroDistribucion) => f.cantidad * precioDe(f);
  let orden = [...forros].sort((a, b) =>
    rango(a) - rango(b) || habilitados(a).length - habilitados(b).length || valor(b) - valor(a));
  if (p.agruparPorTela) {
    const grupos = new Map<string, ForroDistribucion[]>();
    orden.forEach(f => {
      const clave = telaDe.get(f.codigo) || `#${f.codigo}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
    });
    const valorGrupo = (g: ForroDistribucion[]) => g.reduce((s, f) => s + valor(f), 0);
    const restriccion = (g: ForroDistribucion[]) => Math.min(...g.map(f => habilitados(f).length));
    orden = [...grupos.values()].sort((a, b) => restriccion(a) - restriccion(b) || valorGrupo(b) - valorGrupo(a)).flat();
    forros.forEach(f => {
      const tela = telaDe.get(f.codigo);
      if (tela) pendienteTela.set(tela, (pendienteTela.get(tela) ?? 0) + Math.max(0, f.cantidad - asignadoForro(f)) * precioDe(f));
    });
  }

  const elegir = (f: ForroDistribucion, candidatos: string[], resto: number, precio: number): string => {
    const tela = telaDe.get(f.codigo);
    if (p.agruparPorTela && tela) {
      const conTela = candidatos.filter(t => telasEn.get(t)?.has(tela) && cabeUn(t, precio) >= Math.min(resto, minimo));
      if (conTela.length) return conTela.sort((a, b) => hueco(b) - hueco(a))[0];
      const grupoUsd = pendienteTela.get(tela) ?? 0;
      const entran = candidatos.filter(t => hueco(t) >= grupoUsd);
      if (entran.length) return entran.sort((a, b) => hueco(a) - hueco(b))[0];
    }
    return [...candidatos].sort((a, b) => hueco(b) - hueco(a))[0];
  };

  // 1. Llenado sin pasar el objetivo; la referencia se comparte entre talleres si no cabe en uno.
  orden.forEach(f => {
    const precio = precioDe(f);
    let resto = f.cantidad - asignadoForro(f);
    const descartados = new Set<string>();
    while (resto > 0) {
      const candidatos = habilitados(f).filter(t => !descartados.has(t));
      if (candidatos.length === 0) break;
      const t = elegir(f, candidatos, resto, precio);
      let parte = Math.min(cabeUn(t, precio), resto);
      if (parte < Math.min(resto, minimo)) {
        descartados.add(t);
        continue;
      }
      // Lo que quedaría es menos que una parte mínima: este taller cede una parte mínima completa al
      // siguiente si aún le queda otra; si no, se queda con todo (exceso < 1 parte).
      if (resto - parte > 0 && resto - parte < minimo) parte = parte - (minimo - (resto - parte)) >= minimo ? resto - minimo : resto;
      sumar(f, t, parte);
      resto -= parte;
    }
  });

  // 2. Sobrante: en partes del mínimo, cada una al taller que queda más cerca de su objetivo.
  orden.forEach(f => {
    const precio = precioDe(f);
    let resto = f.cantidad - asignadoForro(f);
    const candidatos = habilitados(f);
    while (resto > 0 && candidatos.length) {
      const parte = resto < 2 * minimo ? resto : minimo;
      const t = [...candidatos].sort((a, b) =>
        Math.abs(parte * precio - hueco(a)) - Math.abs(parte * precio - hueco(b))
        || (p.agruparPorTela && telasEn.get(b)?.has(telaDe.get(f.codigo) ?? '') ? 1 : 0)
          - (p.agruparPorTela && telasEn.get(a)?.has(telaDe.get(f.codigo) ?? '') ? 1 : 0))[0];
      sumar(f, t, parte);
      resto -= parte;
    }
  });
  return res;
};
