/**
 * Planes tácticos en TXT — mismo contenido que el correo "Reporte de producción" de cada módulo,
 * escrito como texto plano en la carpeta compartida `environment.ruta_planes` (o RUTA_PLANES).
 *
 * Estructura de carpetas (la arma la API `/api/planes-txt`, nunca el navegador):
 *
 *   {ruta_planes}/{año actual}/{mes actual}/{proceso}/{centro}/{módulo}/{fecha_objetivo}.TXT
 *   ej. \\192.168.7.51\...\Optimizador-Produccion\2026\10\Corte y Laminado\1000\Laminado\2026-10-02.TXT
 *
 * Año/mes son los de la GENERACIÓN (hora Ecuador), no los de la fecha objetivo: un plan generado el
 * 30/09 para el 01/10 queda en 2026/09. Por eso la búsqueda (GET) prueba el mes de la fecha objetivo
 * y el anterior cuando no se le pasan año/mes. El módulo va como carpeta propia porque los 4 módulos
 * comparten proceso y centro: sin ella, Laminado y Corte Espuma del mismo día se pisarían el archivo.
 * Regenerar el plan para la misma fecha objetivo sobrescribe el archivo (queda la última versión).
 *
 * Este archivo lo importan tanto la API (Node) como los componentes (navegador): las constantes y
 * la ruta relativa son isomórficas; htmlReporteATexto/guardarPlanTxt/obtenerPlanTxt solo corren en
 * el navegador (DOMParser, fetch relativo).
 */
import { environment } from '@/environments/environments.prod';
import { toFechaHoraEcuador } from '@/lib/fecha-ecuador';

export const PROCESO_PLANES_TXT = 'Corte y Laminado';

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

/** Segmentos de carpeta + nombre de archivo, relativos a ruta_planes (sin unir: cada lado usa su `path`). */
export const segmentosPlanTxt = (p: { anio: string; mes: string; modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string }): string[] => [
  p.anio,
  p.mes,
  PROCESO_PLANES_TXT,
  p.centro,
  MODULOS_PLAN_TXT[p.modulo].carpeta,
  `${p.fechaObjetivo}.TXT`,
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
    `Proceso: ${PROCESO_PLANES_TXT}`,
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
export const guardarPlanTxt = async (p: { modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string; html: string; asunto?: string }): Promise<ResultadoGuardarPlanTxt> => {
  const contenido = armarContenidoPlanTxt({ ...p, cuerpo: htmlReporteATexto(p.html) });
  const res = await fetch(urlApiPlanesTxt(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modulo: p.modulo, centro: p.centro, fechaObjetivo: p.fechaObjetivo, contenido, html: p.html }),
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
}

/** Recupera un plan TXT (y su foto de correo) por módulo + centro + fecha objetivo (año/mes opcionales). */
export const obtenerPlanTxt = async (p: CriteriosPlanTxt): Promise<PlanTxtRecuperado> => {
  const res = await fetch(`${urlApiPlanesTxt()}?${qsPlanTxt(p, 'json')}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `No se pudo recuperar el TXT (HTTP ${res.status})`);
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

/** Cuerpo de correo a partir del TXT, cuando el plan no tiene foto HTML: texto monoespaciado. */
export const txtACorreoHtml = (contenido: string): string => {
  const esc = contenido.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:1.45;color:#111827;white-space:pre;">${esc}</pre>`;
};
