/**
 * Distribución automática del pedido de forros entre talleres (PLAN SUBCONTRATACIÓN del Excel ALM).
 *
 * Mecánica del Excel (filas 2-7 de la hoja):
 *   ponderado_t = personas_t × peso_t
 *   objetivo_t  = costo total del pedido (USD) × ponderado_t ÷ Σ ponderado     (fila 3 "SEMANAL")
 *   desviación  = USD asignado al taller − objetivo_t                          (fila 2)
 * El planificador llena la matriz forro × taller a mano hasta dejar la desviación en ~0, solo en los
 * talleres marcados con X en Matriz_cod_tela. Aquí se hace lo mismo con una regla voraz:
 *   1. Lo ya asignado (a mano) se respeta; solo se reparte lo que falta de cada forro.
 *   2. Orden: prioridad A → B → C → sin prioridad; dentro, primero los forros con menos talleres
 *      habilitados (los más restringidos) y luego los de mayor valor.
 *   3. Cada forro va entero al taller habilitado con más USD por llenar (objetivo − asignado).
 *      Solo se parte si su valor supera ese hueco: se entrega el hueco en múltiplos del paquete y el
 *      resto sigue con el siguiente taller. Ninguna parte queda por debajo del mínimo por taller.
 *   4. Agrupar por tela (aprovechar el corte): los forros de una misma tela se reparten seguidos,
 *      primero los grupos más restringidos por la matriz y luego de mayor a menor valor. Cada forro va primero a un taller que ya tiene esa tela si le
 *      cabe al menos una parte mínima; si la tela es nueva, al taller donde entra todo lo que queda
 *      del grupo con el menor sobrante (mejor ajuste); si no entra en ninguno, al de más hueco.
 *      Dentro del grupo se mantiene el orden por prioridad.
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
  minimoPorTaller: number; // parte mínima cuando se divide un forro (UN)
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

export const objetivosPorTaller = (talleres: TallerDistribucion[], costoTotal: number): Map<string, number> => {
  const suma = talleres.reduce((s, t) => s + Math.max(0, t.ponderado), 0);
  return new Map(talleres.map(t => [t.nombre, suma > 0 ? (costoTotal * Math.max(0, t.ponderado)) / suma : 0]));
};

export const resumenPorTaller = (
  forros: ForroDistribucion[],
  talleres: TallerDistribucion[],
  asignacion: Asignacion,
): ResumenTaller[] => {
  const costoTotal = forros.reduce((s, f) => s + f.cantidad * f.precio, 0);
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
  forros: ForroDistribucion[],
  talleres: TallerDistribucion[],
  previa: Asignacion,
  p: ParametrosDistribucion = PARAMETROS_DISTRIBUCION_DEFECTO,
): Asignacion => {
  const paquete = Math.max(1, Math.round(p.paquete));
  const minimo = Math.max(paquete, Math.round(p.minimoPorTaller));
  // Forros sin precio cuentan con el precio medio para no quedar fuera del reparto.
  const conPrecio = forros.filter(f => f.precio > 0);
  const precioMedio = conPrecio.length ? conPrecio.reduce((s, f) => s + f.precio, 0) / conPrecio.length : 1;
  const precioDe = (f: ForroDistribucion) => (f.precio > 0 ? f.precio : precioMedio);

  const costoTotal = forros.reduce((s, f) => s + f.cantidad * precioDe(f), 0);
  const objetivos = objetivosPorTaller(talleres, costoTotal);
  const nombres = talleres.map(t => t.nombre);

  const res: Asignacion = {};
  const asignadoUsd = new Map(nombres.map(n => [n, 0]));
  const telaDe = new Map(forros.map(f => [f.codigo, normalizarTela(f.tela)]));
  const telasEn = new Map(nombres.map(n => [n, new Set<string>()]));
  const sumar = (forro: string, taller: string, q: number, precio: number) => {
    if (q <= 0) return;
    res[forro] = res[forro] ?? {};
    res[forro][taller] = (res[forro][taller] ?? 0) + q;
    asignadoUsd.set(taller, (asignadoUsd.get(taller) ?? 0) + q * precio);
    const tela = telaDe.get(forro);
    if (tela) telasEn.get(taller)?.add(tela);
  };
  // 1. Lo asignado a mano se conserva (hasta la cantidad del forro).
  forros.forEach(f => {
    let resto = f.cantidad;
    Object.entries(previa[f.codigo] ?? {}).forEach(([t, q]) => {
      if (!nombres.includes(t) || resto <= 0) return;
      const tomado = Math.min(q, resto);
      sumar(f.codigo, t, tomado, precioDe(f));
      resto -= tomado;
    });
  });

  const habilitados = (f: ForroDistribucion) => nombres.filter(n => !f.talleres || f.talleres.includes(n));
  const hueco = (t: string) => (objetivos.get(t) ?? 0) - (asignadoUsd.get(t) ?? 0);
  const rango = (f: ForroDistribucion) => ORDEN_PRIORIDAD[f.prioridad ?? ''] ?? 3;
  const valor = (f: ForroDistribucion) => f.cantidad * precioDe(f);
  const porForro = (a: ForroDistribucion, b: ForroDistribucion) =>
    rango(a) - rango(b) || habilitados(a).length - habilitados(b).length || valor(b) - valor(a);
  let orden = [...forros].sort(porForro);
  if (p.agruparPorTela) {
    // Un grupo por tela; los forros sin tela quedan solos.
    const grupos = new Map<string, ForroDistribucion[]>();
    orden.forEach(f => {
      const clave = telaDe.get(f.codigo) || `#${f.codigo}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
    });
    const valorGrupo = (g: ForroDistribucion[]) => g.reduce((s, f) => s + valor(f), 0);
    // Primero los grupos con forros más restringidos por la matriz (si quedan al final ya no hay hueco).
    const restriccion = (g: ForroDistribucion[]) => Math.min(...g.map(f => habilitados(f).length));
    orden = [...grupos.values()].sort((a, b) => restriccion(a) - restriccion(b) || valorGrupo(b) - valorGrupo(a)).flat();
  }
  // USD que falta repartir de cada tela (para el mejor ajuste del grupo).
  const pendienteTela = new Map<string, number>();
  forros.forEach(f => {
    const tela = telaDe.get(f.codigo);
    if (!tela) return;
    const asignado = Object.values(res[f.codigo] ?? {}).reduce((s, q) => s + q, 0);
    pendienteTela.set(tela, (pendienteTela.get(tela) ?? 0) + Math.max(0, f.cantidad - asignado) * precioDe(f));
  });
  const capacidadUnDe = (t: string, precio: number) => Math.floor(Math.max(0, hueco(t)) / precio / paquete) * paquete;
  const elegirDestino = (f: ForroDistribucion, candidatos: string[], resto: number, precio: number): string => {
    const tela = telaDe.get(f.codigo);
    if (p.agruparPorTela && tela) {
      const conTela = candidatos.filter(t => telasEn.get(t)?.has(tela) && capacidadUnDe(t, precio) >= Math.min(resto, minimo));
      if (conTela.length) return conTela.sort((a, b) => hueco(b) - hueco(a))[0];
      const grupoUsd = pendienteTela.get(tela) ?? 0;
      const entran = candidatos.filter(t => hueco(t) >= grupoUsd);
      if (entran.length) return entran.sort((a, b) => hueco(a) - hueco(b))[0];
    }
    return [...candidatos].sort((a, b) => hueco(b) - hueco(a))[0];
  };

  // 2-3. Reparto voraz de lo pendiente.
  orden.forEach(f => {
    const precio = precioDe(f);
    let resto = f.cantidad - Object.values(res[f.codigo] ?? {}).reduce((s, q) => s + q, 0);
    const candidatos = habilitados(f);
    if (candidatos.length === 0) return;
    while (resto > 0) {
      const destino = elegirDestino(f, candidatos, resto, precio);
      const capacidadUn = capacidadUnDe(destino, precio);
      const tela = telaDe.get(f.codigo);
      // Entra todo, o lo que falta es menor que dos partes mínimas, o el hueco no alcanza una parte:
      // va completo al taller elegido.
      const parte = capacidadUn >= resto || resto < 2 * minimo || capacidadUn < minimo ? resto : Math.min(capacidadUn, resto - minimo);
      sumar(f.codigo, destino, parte, precio);
      if (tela) pendienteTela.set(tela, (pendienteTela.get(tela) ?? 0) - parte * precio);
      resto -= parte;
    }
  });
  return res;
};
