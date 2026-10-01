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
//   POST /api/planes-txt   { modulo, centro, fechaObjetivo, contenido, html? }  -> escribe/sobrescribe
//   GET  /api/planes-txt?modulo=&centro=&fecha=[&anio=&mes=][&formato=json|meta][&descargar=1]
//   GET  /api/planes-txt?diagnostico=1   -> qué carpeta usa el servidor y si puede escribir en ella
// `html` es la foto del correo tal como se veía al guardar: se escribe al lado del TXT como
// {fecha}.correo.html para que el envío posterior (después de crear las FERT en SAP) mande
// exactamente lo guardado, con el formato del correo, sin recalcular nada. formato=meta solo
// confirma si existe (ruta + fecha de modificación), sin leer el contenido.
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

const rutaHtml = (rutaTxt: string) => rutaTxt.replace(/\.TXT$/, '.correo.html');

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
  const { modulo, centro, fechaObjetivo, contenido, html } = body;
  if (!esModuloPlanTxt(modulo)) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
  if (!esCentroPlanTxt(centro)) return NextResponse.json({ error: 'Centro inválido (1000 o 2000)' }, { status: 400 });
  if (!esFechaPlanTxt(fechaObjetivo)) return NextResponse.json({ error: 'fechaObjetivo inválida (yyyy-MM-dd)' }, { status: 400 });
  if (typeof contenido !== 'string' || !contenido.trim()) return NextResponse.json({ error: 'Contenido vacío' }, { status: 400 });
  if (contenido.length > MAX_CONTENIDO) return NextResponse.json({ error: 'Contenido demasiado grande' }, { status: 413 });
  if (html !== undefined && (typeof html !== 'string' || html.length > MAX_CONTENIDO)) return NextResponse.json({ error: 'html inválido o demasiado grande' }, { status: 400 });

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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('diagnostico') === '1') return diagnostico();
  const modulo = q.get('modulo');
  const centro = q.get('centro');
  const fecha = q.get('fecha') || q.get('fechaObjetivo');
  const anio = q.get('anio');
  const mes = q.get('mes');
  if (!esModuloPlanTxt(modulo)) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
  if (!esCentroPlanTxt(centro)) return NextResponse.json({ error: 'Centro inválido (1000 o 2000)' }, { status: 400 });
  if (!esFechaPlanTxt(fecha)) return NextResponse.json({ error: 'fecha inválida (yyyy-MM-dd)' }, { status: 400 });
  if (anio && !/^\d{4}$/.test(anio)) return NextResponse.json({ error: 'anio inválido (yyyy)' }, { status: 400 });
  if (mes && !/^(0[1-9]|1[0-2])$/.test(mes)) return NextResponse.json({ error: 'mes inválido (01-12)' }, { status: 400 });

  // Sin año/mes explícitos: el plan se genera antes de su fecha objetivo, así que puede estar en el
  // mes de esa fecha o en el anterior (generado el 30/09 para el 01/10).
  const [fAnio, fMes] = fecha.split('-');
  const candidatos = anio && mes
    ? [{ anio, mes }]
    : [{ anio: fAnio, mes: fMes }, mesAnterior(fAnio, fMes)];
  const rutas = candidatos.map(c => rutaPlan({ ...c, modulo, centro, fechaObjetivo: fecha }));

  // Sin esto, una raíz inaccesible respondía 404 "no existe" y el botón quedaba en "Guardar
  // reporte" como si no hubiera nada guardado, en vez de avisar que la carpeta no responde.
  const errorRaiz = await verificarRaiz();
  if (errorRaiz) return NextResponse.json({ error: `No se pudo consultar el plan TXT: ${errorRaiz}` }, { status: 500 });

  const formato = q.get('formato');
  for (const ruta of rutas) {
    if (formato === 'meta') {
      try {
        const st = await fs.stat(ruta);
        return NextResponse.json({ ruta, modificado: st.mtime.toISOString() });
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
      return NextResponse.json({ ruta, modificado, contenido, html });
    }
    const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8', 'X-Ruta-Plan': encodeURI(ruta) };
    if (q.get('descargar') === '1') headers['Content-Disposition'] = `attachment; filename="${path.basename(ruta)}"`;
    return new NextResponse('﻿' + contenido, { status: 200, headers });
  }
  return NextResponse.json({ error: 'No existe un plan TXT para esos criterios', buscado: rutas }, { status: 404 });
}
