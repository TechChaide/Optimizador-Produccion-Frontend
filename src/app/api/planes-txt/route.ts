import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { environment } from '@/environments/environments.prod';
import { getFechaEcuadorHoy } from '@/lib/fecha-ecuador';
import {
  esCentroPlanTxt, esFechaPlanTxt, esModuloPlanTxt, segmentosPlanTxt,
  type CentroPlanTxt, type ModuloPlanTxt,
} from '@/lib/planes-txt';

// API de planes tácticos en TXT (ver src/lib/planes-txt.ts para la estructura de carpetas).
//   POST /api/planes-txt   { modulo, centro, fechaObjetivo, contenido, html?, estado? | estadoGz? }  -> escribe/sobrescribe
//   GET  /api/planes-txt?modulo=&centro=&fecha=[&anio=&mes=][&formato=json|meta][&descargar=1]
//   GET  /api/planes-txt?diagnostico=1   -> qué carpeta usa el servidor y si puede escribir en ella
//   DELETE /api/planes-txt?modulo=&centro=&fecha=  -> borra solo la foto del correo (tras enviar)
// `html` es la foto del correo tal como se veía al guardar: se escribe al lado del TXT como
// {fecha}.correo.html para que el envío posterior (después de crear las FERT en SAP) mande
// exactamente lo guardado, con el formato del correo, sin recalcular nada. Es temporal: se borra
// cuando el envío sale bien (el correo ya queda en la bandeja de entrada). formato=meta solo
// confirma si existe (ruta + fecha de modificación), sin leer el contenido.
// `estado` es el respaldo del módulo (lo planificado: turnos, corridas, ajustes manuales) para volver
// a cargarlo en pantalla desde "Recuperar y revisar" — {fecha}.estado.json. A diferencia de la foto
// del correo, NO se borra al enviar: es el registro de lo que se planificó. `estadoGz` es el mismo
// respaldo comprimido (gzip en base64, lo arma el navegador) para módulos que guardan sus datos SAP
// completos (Corte Espuma) — se escribe como {fecha}.estado.json.gz y se devuelve igual, en base64.
// La ruta en disco se arma SOLO con valores validados contra listas cerradas (módulo, centro) y
// formatos fijos (fecha, año, mes): el cliente nunca manda segmentos de ruta libres.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTENIDO = 2 * 1024 * 1024;

// RUTA_PLANES permite apuntar a un recurso SMB montado cuando el servidor corre en Linux/Docker,
// donde una ruta UNC (\\servidor\recurso) no se puede abrir directamente.
const raizPlanes = () => process.env.RUTA_PLANES?.trim() || environment.ruta_planes;

// La raíz NUNCA se crea, solo se verifica. Dos fallas silenciosas que esto evita:
//  - En Linux, "\\192.168.7.51\..." no es una ruta de red sino un nombre de carpeta relativo (la
//    barra invertida es un carácter válido): mkdir recursive la crearía DENTRO del contenedor, el
//    guardado respondería OK y los archivos se perderían en el siguiente despliegue.
//  - Si el recurso SMB no quedó montado, el punto de montaje existe vacío o no existe: crearlo
//    escribiría en el disco local del servidor en vez de la carpeta compartida.
const verificarRaiz = async (): Promise<string | null> => {
  const raiz = raizPlanes();
  if (process.platform !== 'win32' && raiz.startsWith('\\\\')) {
    return `el servidor corre en ${process.platform} y no puede abrir la ruta de red ${raiz}. Hay que montar la carpeta compartida en el servidor y definir la variable RUTA_PLANES con la ruta montada.`;
  }
  try {
    const st = await fs.stat(raiz);
    if (!st.isDirectory()) return `la ruta raíz ${raiz} no es una carpeta`;
  } catch {
    return `la carpeta raíz ${raiz} no existe o no es accesible desde el servidor (¿recurso compartido sin montar o sin permisos?)`;
  }
  return null;
};

const rutaPlan = (p: { anio: string; mes: string; modulo: ModuloPlanTxt; centro: CentroPlanTxt; fechaObjetivo: string }) =>
  path.join(raizPlanes(), ...segmentosPlanTxt(p));

const rutaHtml = (rutaTxt: string) => rutaTxt.replace(/\.txt$/, '.correo.html');
const rutaEstado = (rutaTxt: string) => rutaTxt.replace(/\.txt$/, '.estado.json');
const rutaEstadoGz = (rutaTxt: string) => rutaTxt.replace(/\.txt$/, '.estado.json.gz');
// El respaldo comprimido puede traer los datos SAP completos del módulo: tope propio, más amplio.
const MAX_ESTADO_GZ = 30 * 1024 * 1024;

const errorFs =(e: unknown, accion: string) => {
  const err = e as NodeJS.ErrnoException;
  const detalle = err?.code === 'EACCES' || err?.code === 'EPERM'
    ? 'sin permisos sobre la carpeta compartida'
    : err?.code === 'ENOENT' || err?.code === 'ENOTDIR'
      ? 'la carpeta compartida no es accesible desde el servidor'
      : err?.message || 'error desconocido';
  return NextResponse.json({ error: `No se pudo ${accion} el plan TXT: ${detalle}`, codigo: err?.code }, { status: 500 });
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }
  const { modulo, centro, fechaObjetivo, contenido, html, estado, estadoGz } = body;
  if (!esModuloPlanTxt(modulo)) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
  if (!esCentroPlanTxt(centro)) return NextResponse.json({ error: 'Centro inválido (1000 o 2000)' }, { status: 400 });
  if (!esFechaPlanTxt(fechaObjetivo)) return NextResponse.json({ error: 'fechaObjetivo inválida (yyyy-MM-dd)' }, { status: 400 });
  if (typeof contenido !== 'string' || !contenido.trim()) return NextResponse.json({ error: 'Contenido vacío' }, { status: 400 });
  if (contenido.length > MAX_CONTENIDO) return NextResponse.json({ error: 'Contenido demasiado grande' }, { status: 413 });
  if (html !== undefined && (typeof html !== 'string' || html.length > MAX_CONTENIDO)) return NextResponse.json({ error: 'html inválido o demasiado grande' }, { status: 400 });
  const estadoJson = estado !== undefined && estado !== null ? JSON.stringify(estado) : null;
  if (estadoJson !== null && (typeof estado !== 'object' || estadoJson.length > MAX_CONTENIDO)) return NextResponse.json({ error: 'estado inválido o demasiado grande' }, { status: 400 });
  if (estadoGz !== undefined && estadoGz !== null && (typeof estadoGz !== 'string' || estadoGz.length > MAX_ESTADO_GZ || !/^[A-Za-z0-9+/=]+$/.test(estadoGz))) {
    return NextResponse.json({ error: 'estadoGz inválido o demasiado grande' }, { status: 400 });
  }
  const estadoGzBuf = typeof estadoGz === 'string' && estadoGz ? Buffer.from(estadoGz, 'base64') : null;

  // Año/mes de la GENERACIÓN en hora Ecuador (no de la fecha objetivo, ver planes-txt.ts).
  const errorRaiz = await verificarRaiz();
  if (errorRaiz) return NextResponse.json({ error: `No se pudo guardar el plan TXT: ${errorRaiz}` }, { status: 500 });
  const [anio, mes] = getFechaEcuadorHoy().split('-');
  const ruta = rutaPlan({ anio, mes, modulo, centro, fechaObjetivo });
  try {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    // BOM + CRLF: el archivo se abre en Windows (Bloc de notas) desde la carpeta compartida; sin
    // BOM las tildes/ñ se ven corruptas en editores que no asumen UTF-8.
    await fs.writeFile(ruta, '﻿' + contenido.replace(/\r?\n/g, '\r\n'), 'utf8');
    // Sin html en este guardado se borra la foto anterior: si quedara, el envío mandaría un
    // correo de otro momento que ya no coincide con el TXT recién escrito.
    if (typeof html === 'string' && html.trim()) await fs.writeFile(rutaHtml(ruta), html, 'utf8');
    else await fs.rm(rutaHtml(ruta), { force: true });
    // Mismo criterio: un respaldo de otro guardado no debe quedar junto a un TXT que no le corresponde.
    // Un solo respaldo por plan: el comprimido o el plano, nunca los dos (el viejo se borra).
    if (estadoGzBuf) await fs.writeFile(rutaEstadoGz(ruta), estadoGzBuf);
    else await fs.rm(rutaEstadoGz(ruta), { force: true });
    if (estadoJson !== null && !estadoGzBuf) await fs.writeFile(rutaEstado(ruta), estadoJson, 'utf8');
    else await fs.rm(rutaEstado(ruta), { force: true });
  } catch (e) {
    return errorFs(e, 'guardar');
  }
  return NextResponse.json({ ok: true, ruta });
}

const mesAnterior = (anio: string, mes: string) => {
  const m = Number(mes) - 1;
  return m === 0 ? { anio: String(Number(anio) - 1), mes: '12' } : { anio, mes: String(m).padStart(2, '0') };
};

// GET ?diagnostico=1 — para verificar un despliegue: muestra qué raíz usa el servidor y prueba
// escribir/borrar un archivo temporal en ella (no toca ningún plan).
const diagnostico = async () => {
  const raiz = raizPlanes();
  const errorRaiz = await verificarRaiz();
  let escribible = false;
  let errorEscritura: string | null = null;
  if (!errorRaiz) {
    const prueba = path.join(raiz, `.prueba-escritura-${process.pid}-${Date.now()}`);
    try {
      await fs.writeFile(prueba, 'ok', 'utf8');
      await fs.rm(prueba, { force: true });
      escribible = true;
    } catch (e) {
      errorEscritura = (e as NodeJS.ErrnoException)?.code || (e as Error)?.message || 'error desconocido';
    }
  }
  const ok = !errorRaiz && escribible;
  return NextResponse.json({
    ok,
    plataforma: process.platform,
    raiz,
    origen: process.env.RUTA_PLANES?.trim() ? 'variable RUTA_PLANES' : 'environment.ruta_planes',
    accesible: !errorRaiz,
    escribible,
    error: errorRaiz || (errorEscritura ? `sin permiso de escritura (${errorEscritura})` : null),
  }, { status: ok ? 200 : 500 });
};

// Criterios de búsqueda comunes a GET y DELETE -> rutas candidatas del TXT, o la respuesta de error.
const rutasCandidatas = async (q: URLSearchParams, accion: string): Promise<{ rutas: string[] } | { respuesta: NextResponse }> => {
  const modulo = q.get('modulo');
  const centro = q.get('centro');
  const fecha = q.get('fecha') || q.get('fechaObjetivo');
  const anio = q.get('anio');
  const mes = q.get('mes');
  const malo = (error: string) => ({ respuesta: NextResponse.json({ error }, { status: 400 }) });
  if (!esModuloPlanTxt(modulo)) return malo('Módulo inválido');
  if (!esCentroPlanTxt(centro)) return malo('Centro inválido (1000 o 2000)');
  if (!esFechaPlanTxt(fecha)) return malo('fecha inválida (yyyy-MM-dd)');
  if (anio && !/^\d{4}$/.test(anio)) return malo('anio inválido (yyyy)');
  if (mes && !/^(0[1-9]|1[0-2])$/.test(mes)) return malo('mes inválido (01-12)');

  // Sin esto, una raíz inaccesible respondía 404 "no existe" y el botón quedaba en "Guardar
  // reporte" como si no hubiera nada guardado, en vez de avisar que la carpeta no responde.
  const errorRaiz = await verificarRaiz();
  if (errorRaiz) return { respuesta: NextResponse.json({ error: `No se pudo ${accion} el plan TXT: ${errorRaiz}` }, { status: 500 }) };

  // Sin año/mes explícitos: el plan se genera antes de su fecha objetivo, así que puede estar en el
  // mes de esa fecha o en el anterior (generado el 30/09 para el 01/10).
  const [fAnio, fMes] = fecha.split('-');
  const candidatos = anio && mes
    ? [{ anio, mes }]
    : [{ anio: fAnio, mes: fMes }, mesAnterior(fAnio, fMes)];
  return { rutas: candidatos.map(c => rutaPlan({ ...c, modulo, centro, fechaObjetivo: fecha })) };
};

// DELETE ?modulo=&centro=&fecha=  -> borra SOLO la foto del correo ({fecha}.correo.html), nunca el
// TXT. Se llama después de un envío exitoso: el correo ya quedó en la bandeja de entrada, en la
// carpeta compartida queda únicamente el TXT (decisión del usuario).
export async function DELETE(req: NextRequest) {
  const r = await rutasCandidatas(req.nextUrl.searchParams, 'limpiar');
  if ('respuesta' in r) return r.respuesta;
  for (const ruta of r.rutas) {
    try {
      await fs.stat(ruta);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
      return errorFs(e, 'limpiar');
    }
    try {
      await fs.rm(rutaHtml(ruta), { force: true });
    } catch (e) {
      return errorFs(e, 'limpiar');
    }
    return NextResponse.json({ ok: true, ruta });
  }
  return NextResponse.json({ error: 'No existe un plan TXT para esos criterios', buscado: r.rutas }, { status: 404 });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('diagnostico') === '1') return diagnostico();
  const r = await rutasCandidatas(q, 'consultar');
  if ('respuesta' in r) return r.respuesta;
  const rutas = r.rutas;

  const formato = q.get('formato');
  for (const ruta of rutas) {
    if (formato === 'meta') {
      try {
        const st = await fs.stat(ruta);
        // fotoCorreo: false = ya se envió (la foto se borra tras un envío exitoso), ver estado-dia.ts.
        const fotoCorreo = await fs.stat(rutaHtml(ruta)).then(() => true, () => false);
        return NextResponse.json({ ruta, modificado: st.mtime.toISOString(), fotoCorreo });
      } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
        return errorFs(e, 'consultar');
      }
    }
    let contenido: string;
    let modificado: string;
    try {
      contenido = await fs.readFile(ruta, 'utf8');
      modificado = (await fs.stat(ruta)).mtime.toISOString();
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
      return errorFs(e, 'leer');
    }
    contenido = contenido.replace(/^﻿/, '');
    if (formato === 'json') {
      const html = await fs.readFile(rutaHtml(ruta), 'utf8').catch(() => null);
      // Respaldo ausente o ilegible = null: el reporte se revisa/envía igual, solo no se carga en el módulo.
      const estadoGz = await fs.readFile(rutaEstadoGz(ruta)).then(b => b.toString('base64')).catch(() => null);
      const estado = estadoGz ? null : await fs.readFile(rutaEstado(ruta), 'utf8').then(t => JSON.parse(t) as unknown).catch(() => null);
      return NextResponse.json({ ruta, modificado, contenido, html, estado, estadoGz });
    }
    const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8', 'X-Ruta-Plan': encodeURI(ruta) };
    if (q.get('descargar') === '1') headers['Content-Disposition'] = `attachment; filename="${path.basename(ruta)}"`;
    return new NextResponse('﻿' + contenido, { status: 200, headers });
  }
  return NextResponse.json({ error: 'No existe un plan TXT para esos criterios', buscado: rutas }, { status: 404 });
}
