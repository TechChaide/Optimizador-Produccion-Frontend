/**
 * Planes tácticos en TXT — mismo contenido que el correo "Reporte de producción" de cada módulo,
 * escrito como texto plano en la carpeta compartida `environment.ruta_planes` (o RUTA_PLANES).
 *
 * Estructura de carpetas (la arma la API `/api/planes-txt`, nunca el navegador) — MISMA convención
 * que ya usan en la carpeta compartida los planes de Muebles, FORROS y Ensamblado (otros módulos,
 * fuera de este repo): año / mes en letras / proceso / centro / fecha.txt, extensión en minúscula.
 *
 *   {ruta_planes}/{año actual}/{Mes actual}/{proceso}/{centro}/{fecha_objetivo}.txt
 *   ej. \\192.168.7.51\...\Optimizador-Produccion\2026\Octubre\Corte Espuma\1000\2026-10-02.txt
 *       (al lado, mientras no se envía: 2026-10-02.correo.html — ver api/planes-txt)
 *
 * El "proceso" es el módulo (Laminado, Corte Espuma, Venta Espuma, Formulacion), igual que Muebles
 * o Ensamblado en los otros: así cada módulo tiene su carpeta y no se pisan archivos del mismo día.
 * "Corte y Laminado" (departamento SAP que agrupa los 4) queda solo en el encabezado del TXT.
 *
 * Año/mes son los de la GENERACIÓN (hora Ecuador), no los de la fecha objetivo: un plan generado el
 * 30/09 para el 01/10 queda en 2026/Septiembre. Por eso la búsqueda (GET) prueba el mes de la fecha
 * objetivo y el anterior cuando no se le pasan año/mes. Regenerar el plan para la misma fecha
 * objetivo sobrescribe el archivo (queda la última versión).
 *
 * Este archivo lo importan tanto la API (Node) como los componentes (navegador): las constantes y
 * la ruta relativa son isomórficas; htmlReporteATexto/guardarPlanTxt/obtenerPlanTxt solo corren en
 * el navegador (DOMParser, fetch relativo).
 */
import { environment } from '@/environments/environments.prod';
import { toFechaHoraEcuador } from '@/lib/fecha-ecuador';

export const DEPARTAMENTO_PLANES_TXT = 'Corte y Laminado';

// Mismos nombres de carpeta que los planes existentes (2026\Agosto, 2026\Septiembre, 2026\Octubre...).
const MESES_CARPETA = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const MODULOS_PLAN_TXT = {
  'laminado': { carpeta: 'Laminado', titulo: 'Plan Táctico Laminado' },
  'corte-espuma': { carpeta: 'Corte Espuma', titulo: 'Plan Táctico Corte Espuma' },
  'venta-espuma': { carpeta: 'Venta Espuma', titulo: 'Plan Táctico Venta Espuma' },
  'formulacion': { carpeta: 'Formulacion', titulo: 'Plan Táctico Formulación' },
} as const;

export type ModuloPlanTxt = keyof typeof MODULOS_PLAN_TXT;
export type CentroPlanTxt = '1000' | '2000';

export const CENTROS_PLAN_TXT: readonly CentroPlanTxt[] = ['1000', '2000'];

export const esModuloPlanTxt = (v: unknown): v is ModuloPlanTxt =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODULOS_PLAN_TXT, v);

export const esCentroPlanTxt = (v: unknown): v is CentroPlanTxt =>
  typeof v === 'string' && (CENTROS_PLAN_TXT as readonly string[]).includes(v);

export const esFechaPlanTxt = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/**
 * Segmentos de carpeta + nombre de archivo, relativos a ruta_planes (sin unir: cada lado usa su
 * `path`). `mes` llega en número '01'..'12' (así lo maneja la API) y se escribe en letras.
 */
export const segmentosPlanTxt = (p: { anio: string; mes: string; modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string }): string[] => [
  p.anio,
  MESES_CARPETA[Number(p.mes) - 1],
  MODULOS_PLAN_TXT[p.modulo].carpeta,
  p.centro,
  `${p.fechaObjetivo}.txt`,
];

// ---------------------------------------------------------------------------------------------
// HTML del correo -> texto plano
// ---------------------------------------------------------------------------------------------
// Los correos se arman con tablas de maquetación anidadas (estilos inline). Regla de conversión:
//   - tabla "hoja" (sin tablas dentro) = tabla de datos -> grilla ASCII con columnas alineadas
//     (si tiene una sola columna, se vuelca como líneas de texto sin bordes);
//   - tabla con tablas dentro = maquetación -> se recorre celda por celda, en orden;
//   - text-transform uppercase/capitalize del estilo inline se respeta (encabezados, fechas).
// Así el TXT sigue automáticamente cualquier cambio futuro del correo, sin duplicar la lógica de
// armado del reporte en cada módulo.

type Transformacion = 'none' | 'uppercase' | 'capitalize';

const transformacionDe = (el: Element, heredada: Transformacion): Transformacion => {
  const m = /text-transform\s*:\s*(uppercase|capitalize|none)/i.exec(el.getAttribute('style') || '');
  return m ? (m[1].toLowerCase() as Transformacion) : heredada;
};

const aplicarTransformacion = (texto: string, t: Transformacion): string => {
  if (t === 'uppercase') return texto.toUpperCase();
  // En los correos capitalize solo se usa sobre fechas largas ("miércoles 1 de octubre..."): en
  // texto plano se pone mayúscula a la primera letra, no a cada palabra ("De Octubre De").
  if (t === 'capitalize') return texto.replace(/^(\s*)(\p{L})/u, (_, s: string, c: string) => s + c.toUpperCase());
  return texto;
};

const ETIQUETAS_BLOQUE = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL']);

const estaOculto = (el: Element) => /display\s*:\s*none/i.test(el.getAttribute('style') || '');

class Lineas {
  lineas: string[] = [];
  private actual = '';
  texto(t: string) { this.actual += t; }
  cortar() {
    const l = this.actual.replace(/[\s\u00a0]+/g, ' ').trim();
    if (l) this.lineas.push(l);
    this.actual = '';
  }
  blanco() {
    this.cortar();
    if (this.lineas.length && this.lineas[this.lineas.length - 1] !== '') this.lineas.push('');
  }
  bloque(ls: string[]) {
    this.cortar();
    this.lineas.push(...ls);
  }
}

const recorrer = (nodo: Node, out: Lineas, t: Transformacion) => {
  if (nodo.nodeType === Node.TEXT_NODE) {
    out.texto(aplicarTransformacion(nodo.textContent || '', t));
    return;
  }
  if (nodo.nodeType !== Node.ELEMENT_NODE) return;
  const el = nodo as Element;
  if (estaOculto(el) || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return;
  const tEl = transformacionDe(el, t);

  if (el.tagName === 'BR') { out.cortar(); return; }
  if (el.tagName === 'TABLE') {
    out.blanco();
    if (el.querySelector('table')) {
      Array.from((el as HTMLTableElement).rows).forEach(fila => {
        Array.from(fila.cells).forEach(celda => {
          celda.childNodes.forEach(h => recorrer(h, out, transformacionDe(celda, tEl)));
          out.cortar();
        });
        out.blanco();
      });
    } else {
      out.bloque(tablaHojaATexto(el as HTMLTableElement, tEl));
    }
    out.blanco();
    return;
  }
  const esBloque = ETIQUETAS_BLOQUE.has(el.tagName);
  if (esBloque) out.cortar();
  el.childNodes.forEach(h => recorrer(h, out, tEl));
  if (esBloque) out.cortar();
};

interface CeldaTxt { lineas: string[]; span: number; alinear: 'left' | 'right' | 'center'; }

const tablaHojaATexto = (tabla: HTMLTableElement, t: Transformacion): string[] => {
  const filas: CeldaTxt[][] = Array.from(tabla.rows).map(fila => Array.from(fila.cells).map(celda => {
    const out = new Lineas();
    const tc = transformacionDe(celda, t);
    celda.childNodes.forEach(h => recorrer(h, out, tc));
    out.cortar();
    const al = (celda.getAttribute('align') || '').toLowerCase();
    return {
      lineas: out.lineas.filter(l => l !== ''),
      span: Math.max(1, celda.colSpan || 1),
      alinear: al === 'right' ? 'right' : al === 'center' ? 'center' : 'left',
    } as CeldaTxt;
  })).filter(f => f.some(c => c.lineas.length > 0));
  if (filas.length === 0) return [];

  const nCols = Math.max(...filas.map(f => f.reduce((s, c) => s + c.span, 0)));
  if (nCols <= 1) return filas.flatMap(f => f.flatMap(c => c.lineas));
  // Una sola fila de celdas de una línea = encabezado de sección (título | dato a la derecha): va
  // en una línea, sin grilla. Las tarjetas de totales (etiqueta + valor) sí quedan en grilla.
  if (filas.length === 1 && filas[0].every(c => c.lineas.length <= 1)) {
    return [filas[0].map(c => c.lineas[0] || '').filter(Boolean).join(' · ')];
  }

  const anchos = new Array<number>(nCols).fill(0);
  const anchoCelda = (c: CeldaTxt) => Math.max(0, ...c.lineas.map(l => l.length));
  filas.forEach(f => {
    let col = 0;
    f.forEach(c => { if (c.span === 1 && col < nCols) anchos[col] = Math.max(anchos[col], anchoCelda(c)); col += c.span; });
  });
  // Celdas con colspan: si su texto no cabe en las columnas que cubre, se ensancha la última.
  filas.forEach(f => {
    let col = 0;
    f.forEach(c => {
      if (c.span > 1) {
        const fin = Math.min(nCols, col + c.span);
        const disponible = anchos.slice(col, fin).reduce((s, a) => s + a, 0) + 3 * (fin - col - 1);
        if (anchoCelda(c) > disponible) anchos[fin - 1] += anchoCelda(c) - disponible;
      }
      col += c.span;
    });
  });

  const borde = '+' + anchos.map(a => '-'.repeat(a + 2)).join('+') + '+';
  const alinear = (txt: string, ancho: number, al: CeldaTxt['alinear']) => {
    if (al === 'right') return txt.padStart(ancho);
    if (al === 'center') { const izq = Math.floor((ancho - txt.length) / 2); return (' '.repeat(Math.max(0, izq)) + txt).padEnd(ancho); }
    return txt.padEnd(ancho);
  };
  const renderFila = (f: CeldaTxt[]): string[] => {
    const alto = Math.max(1, ...f.map(c => c.lineas.length));
    const salida: string[] = [];
    for (let i = 0; i < alto; i++) {
      let col = 0;
      const partes: string[] = [];
      f.forEach(c => {
        const fin = Math.min(nCols, col + c.span);
        const ancho = anchos.slice(col, fin).reduce((s, a) => s + a, 0) + 3 * (fin - col - 1);
        partes.push(alinear(c.lineas[i] || '', ancho, c.alinear));
        col += c.span;
      });
      // Filas con menos celdas que columnas (no pasa en los correos actuales, por si acaso).
      while (col < nCols) { partes.push(''.padEnd(anchos[col])); col++; }
      salida.push('| ' + partes.join(' | ') + ' |');
    }
    return salida;
  };

  // Separador de encabezado solo si la primera fila es de títulos (en los correos, los
  // encabezados de columna siempre llevan text-transform:uppercase).
  const primeraEsEncabezado = filas.length > 1 && Array.from(tabla.rows[0]?.cells || [])
    .every(c => transformacionDe(c, 'none') === 'uppercase');

  const res = [borde];
  filas.forEach((f, i) => {
    res.push(...renderFila(f));
    if (i === 0 && primeraEsEncabezado) res.push(borde);
  });
  res.push(borde);
  return res;
};

/** Convierte el HTML de un correo de reporte en texto plano legible (solo navegador). */
export const htmlReporteATexto = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = new Lineas();
  doc.body.childNodes.forEach(n => recorrer(n, out, 'none'));
  out.cortar();
  while (out.lineas[0] === '') out.lineas.shift();
  while (out.lineas[out.lineas.length - 1] === '') out.lineas.pop();
  return out.lineas.join('\n');
};

/** Encabezado común del TXT + cuerpo del reporte. */
export const armarContenidoPlanTxt = (p: { modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string; asunto?: string; cuerpo: string }): string => {
  const titulo = `OPTIMIZADOR DE PRODUCCIÓN — ${MODULOS_PLAN_TXT[p.modulo].titulo.toUpperCase()}`;
  const meta = [
    `Departamento: ${DEPARTAMENTO_PLANES_TXT}`,
    `Proceso: ${MODULOS_PLAN_TXT[p.modulo].carpeta}`,
    `Centro: ${p.centro}`,
    `Fecha objetivo: ${p.fechaObjetivo}`,
    `Generado: ${toFechaHoraEcuador(new Date()).replace('T', ' ')} (hora Ecuador)`,
  ];
  const linea = '='.repeat(Math.max(titulo.length, 72));
  return [linea, titulo, ...(p.asunto ? [p.asunto] : []), ...meta, linea, '', p.cuerpo, ''].join('\n');
};

const urlApiPlanesTxt = () => `${environment.basePath}/api/planes-txt`;

export interface ResultadoGuardarPlanTxt { ok: true; ruta: string; }

/**
 * Convierte el HTML del reporte a TXT y lo escribe vía la API en la carpeta compartida, junto con
 * la foto HTML del correo (ver route.ts). Devuelve la ruta completa del TXT; lanza Error con el
 * mensaje de la API si falla.
 */
// Respaldo del módulo grande (ej. Corte Espuma guarda sus datos SAP completos): se comprime con gzip
// en el navegador (CompressionStream) y viaja en base64; la API lo guarda como {fecha}.estado.json.gz.
// Los respaldos chicos siguen en JSON plano (legible en la carpeta compartida).
const UMBRAL_COMPRIMIR_ESTADO = 512 * 1024;

const aBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const deBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

const gzipBase64 = async (texto: string): Promise<string> => {
  const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
  return aBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
};
const gunzipBase64 = async (b64: string): Promise<string> => {
  const bytes = deBase64(b64);
  const stream = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
};

export const guardarPlanTxt = async (p: { modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string; html: string; asunto?: string; estado?: unknown }): Promise<ResultadoGuardarPlanTxt> => {
  const contenido = armarContenidoPlanTxt({ ...p, cuerpo: htmlReporteATexto(p.html) });
  const estadoJson = p.estado !== undefined && p.estado !== null ? JSON.stringify(p.estado) : null;
  const comprimir = !!estadoJson && estadoJson.length > UMBRAL_COMPRIMIR_ESTADO && typeof CompressionStream !== 'undefined';
  const respaldo = comprimir ? { estadoGz: await gzipBase64(estadoJson!) } : { estado: p.estado ?? null };
  const res = await fetch(urlApiPlanesTxt(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modulo: p.modulo, centro: p.centro, fechaObjetivo: p.fechaObjetivo, contenido, html: p.html, ...respaldo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `No se pudo guardar el TXT (HTTP ${res.status})`);
  return data as ResultadoGuardarPlanTxt;
};

type CriteriosPlanTxt = { modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string; anio?: string; mes?: string };

const qsPlanTxt = (p: CriteriosPlanTxt, formato: 'json' | 'meta') => {
  const qs = new URLSearchParams({ modulo: p.modulo, centro: p.centro, fecha: p.fechaObjetivo, formato });
  if (p.anio) qs.set('anio', p.anio);
  if (p.mes) qs.set('mes', p.mes);
  return qs.toString();
};

export interface PlanTxtRecuperado {
  ruta: string;
  /** ISO de la última escritura del TXT (= momento del último "Guardar reporte"). */
  modificado: string;
  contenido: string;
  /** Foto HTML del correo al guardar; null si el plan se guardó sin ella (versión anterior). */
  html: string | null;
  /** Respaldo del módulo ({fecha}.estado.json) para recargar lo planificado en pantalla; null si no hay. */
  estado: unknown | null;
}

/** Recupera un plan TXT (y su foto de correo) por módulo + centro + fecha objetivo (año/mes opcionales). */
export const obtenerPlanTxt = async (p: CriteriosPlanTxt): Promise<PlanTxtRecuperado> => {
  const res = await fetch(`${urlApiPlanesTxt()}?${qsPlanTxt(p, 'json')}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `No se pudo recuperar el TXT (HTTP ${res.status})`);
  // Respaldo comprimido: se descomprime acá para que el resto de la app reciba siempre `estado`.
  if (typeof data?.estadoGz === 'string' && data.estadoGz && typeof DecompressionStream !== 'undefined') {
    try {
      data.estado = JSON.parse(await gunzipBase64(data.estadoGz));
    } catch {
      data.estado = null; // ilegible: el reporte se revisa/envía igual, solo no se carga en el módulo
    }
  }
  delete data.estadoGz;
  return data as PlanTxtRecuperado;
};

/** ¿Ya hay un plan guardado para estos criterios? null si no existe; lanza Error si la carpeta no responde. */
export const consultarPlanTxt = async (p: CriteriosPlanTxt): Promise<{ ruta: string; modificado: string } | null> => {
  const res = await fetch(`${urlApiPlanesTxt()}?${qsPlanTxt(p, 'meta')}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `No se pudo consultar el TXT (HTTP ${res.status})`);
  return data as { ruta: string; modificado: string };
};

/**
 * Último plan guardado entre varias fechas objetivo candidatas (la más reciente que exista), con su
 * respaldo. Lo usan los módulos al abrirse sin datos de la sesión (ej. tras recargar la página) para
 * mostrar el plan vigente hasta que se sincronice uno nuevo. null si no hay ninguno o la carpeta no
 * responde: es una carga de cortesía, nunca bloquea el módulo.
 */
export const buscarUltimoPlanTxt = async (p: { modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechas: string[] }): Promise<(PlanTxtRecuperado & { fechaObjetivo: string }) | null> => {
  const fechas = [...new Set(p.fechas)].sort().reverse();
  const metas = await Promise.all(fechas.map(f => consultarPlanTxt({ modulo: p.modulo, centro: p.centro, fechaObjetivo: f }).catch(() => null)));
  const fecha = fechas.find((_, i) => metas[i]);
  if (!fecha) return null;
  try {
    const plan = await obtenerPlanTxt({ modulo: p.modulo, centro: p.centro, fechaObjetivo: fecha });
    return { ...plan, fechaObjetivo: fecha };
  } catch {
    return null;
  }
};

/**
 * Plan vigente al abrir un módulo sin datos de la sesión (usuario 2026-10-06 en Laminado, extendido a
 * los 4 módulos el 2026-10-08): el último reporte con respaldo entre hoy−5 y hoy+3, buscando en los
 * centros dados y quedándose con la fecha objetivo más reciente (a igual fecha, el último guardado).
 */
export const buscarPlanVigente = async (modulo: ModuloPlanTxt, centros: CentroPlanTxt[]): Promise<(PlanTxtRecuperado & { fechaObjetivo: string }) | null> => {
  const hoy = new Date();
  const fechas = Array.from({ length: 9 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 3 - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const planes = await Promise.all(centros.map(centro => buscarUltimoPlanTxt({ modulo, centro, fechas })));
  return planes
    .filter((p): p is PlanTxtRecuperado & { fechaObjetivo: string } => !!p?.estado)
    .sort((a, b) => b.fechaObjetivo.localeCompare(a.fechaObjetivo) || String(b.modificado).localeCompare(String(a.modificado)))[0] ?? null;
};

/** Borra la foto HTML del correo (nunca el TXT). Se usa tras un envío exitoso; lanza Error si falla. */
export const eliminarFotoCorreoPlanTxt = async (p: CriteriosPlanTxt): Promise<void> => {
  const res = await fetch(`${urlApiPlanesTxt()}?${qsPlanTxt(p, 'json')}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `No se pudo limpiar la foto del correo (HTTP ${res.status})`);
  }
};
