import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { environment } from '@/environments/environments.prod';
import { toFechaEcuador } from '@/lib/fecha-ecuador';

// Respaldo en .txt de los planes (Plan Táctico Forros → Resumen + Plan Final) en la carpeta
// compartida de red. Corre en el servidor de Next.js (el navegador no puede escribir en una ruta
// UNC), así que el proceso de Node debe tener acceso a `ruta_planes`. En Docker/Linux la ruta UNC
// no existe: se monta el recurso compartido (CIFS) y se apunta con la variable RUTA_PLANES.
//
// Estructura: {ruta_planes}\{AÑO}\{MES}\{GRUPO}\{CENTRO}\{fecha_objetivo}.txt
//  - AÑO/MES: fecha ACTUAL (hora Ecuador) del momento del guardado, no la fecha objetivo. MES va
//    por nombre (Octubre).
//  - Un re-guardado de la misma fecha objetivo no pisa el anterior: el archivo previo se renombra
//    a {fecha_objetivo}__{HHmmss}.txt, así queda el historial completo de días/versiones pasadas.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.RUTA_PLANES || environment.ruta_planes;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// {MES} va por nombre (no número), con el mismo formato que ya usan las carpetas de Muebles en la
// carpeta compartida: 2026\Octubre\FORROS\1000.
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_MAYUS = MESES.map(m => m.toUpperCase());

// Solo caracteres seguros para nombre de carpeta — evita path traversal ("..", "\", "/").
const limpiarSegmento = (v: unknown): string =>
  String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, '_');

const leerDirectorios = async (dir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
};

// Todas las carpetas {AÑO}\{MES}\{GRUPO}\{CENTRO} existentes. El plan de una fecha objetivo puede
// estar en el mes anterior (se guarda el 30/09 para el 01/10), por eso se recorren todas.
const carpetasGrupoCentro = async (grupo: string, centro: string): Promise<string[]> => {
  const carpetas: string[] = [];
  for (const anio of (await leerDirectorios(BASE)).filter(d => /^\d{4}$/.test(d))) {
    // Acepta también carpetas numéricas ("10") de los primeros guardados, antes del nombre de mes.
    for (const mes of (await leerDirectorios(path.join(BASE, anio))).filter(d => MESES_MAYUS.includes(d.toUpperCase()) || /^\d{2}$/.test(d))) {
      carpetas.push(path.join(BASE, anio, mes, grupo, centro));
    }
  }
  return carpetas;
};

// Bloque final del .txt con el estado completo del plan en JSON (ver construirTxtPlan en
// TacticalPlanForrosSection) — permite la función inversa: restaurar el plan en pantalla.
const SNAPSHOT_INICIO = '### SNAPSHOT-JSON-INICIO';
const SNAPSHOT_FIN = '### SNAPSHOT-JSON-FIN';

const separarSnapshot = (texto: string): { contenido: string; snapshot: any | null } => {
  const ini = texto.indexOf(SNAPSHOT_INICIO);
  if (ini < 0) return { contenido: texto, snapshot: null };
  const desdeJson = texto.indexOf('\n', ini) + 1;
  const fin = texto.indexOf(SNAPSHOT_FIN, desdeJson);
  let snapshot: any = null;
  try {
    snapshot = JSON.parse(texto.slice(desdeJson, fin < 0 ? undefined : fin).trim());
  } catch {
    // Bloque editado a mano/corrupto: se muestra el texto, pero no se puede restaurar.
  }
  return { contenido: texto.slice(0, ini).trimEnd(), snapshot };
};

const hhmmssEcuador = (d: Date): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(d).replace(/:/g, '');

// POST { fechaObjetivo, grupo, centro, contenido } → guarda el .txt
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fechaObjetivo = String(body.fechaObjetivo || '');
    const grupo = limpiarSegmento(body.grupo);
    const centro = limpiarSegmento(body.centro);
    const contenido = String(body.contenido ?? '');
    if (!FECHA_REGEX.test(fechaObjetivo) || !grupo || !centro || !contenido) {
      return NextResponse.json({ message: 'Parámetros inválidos: fechaObjetivo (YYYY-MM-DD), grupo, centro y contenido son obligatorios.' }, { status: 400 });
    }

    const ahora = new Date();
    const [anio, mesNum] = toFechaEcuador(ahora).split('-');
    const mes = MESES[Number(mesNum) - 1];
    const carpeta = path.join(BASE, anio, mes, grupo, centro);
    await fs.mkdir(carpeta, { recursive: true });

    const archivo = path.join(carpeta, `${fechaObjetivo}.txt`);
    let versionAnterior: string | null = null;
    try {
      await fs.access(archivo);
      versionAnterior = path.join(carpeta, `${fechaObjetivo}__${hhmmssEcuador(ahora)}.txt`);
      await fs.rename(archivo, versionAnterior);
    } catch {
      // No existía: primer guardado de esa fecha objetivo en esta carpeta.
    }

    // BOM para que el Bloc de notas/Excel en Windows abran bien las tildes.
    await fs.writeFile(archivo, '﻿' + contenido, 'utf8');
    return NextResponse.json({ message: 'Archivo guardado', ruta: archivo, versionAnterior });
  } catch (error: any) {
    return NextResponse.json({ message: `No se pudo guardar el archivo: ${error.message}` }, { status: 500 });
  }
}

// GET ?grupo=&centro=&fecha=YYYY-MM-DD → contenido legible del {fecha}.txt (el más reciente si hay
//                                        varios) + `snapshot` (estado JSON para restaurar, o null)
// GET ?grupo=&centro=                  → lista de fechas objetivo disponibles
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const grupo = limpiarSegmento(params.get('grupo'));
    const centro = limpiarSegmento(params.get('centro'));
    const fecha = params.get('fecha') || '';
    if (!grupo || !centro) {
      return NextResponse.json({ message: 'Parámetros grupo y centro son obligatorios.' }, { status: 400 });
    }
    const carpetas = await carpetasGrupoCentro(grupo, centro);

    if (!fecha) {
      const fechas = new Set<string>();
      for (const carpeta of carpetas) {
        try {
          (await fs.readdir(carpeta))
            .map(f => /^(\d{4}-\d{2}-\d{2})\.txt$/.exec(f)?.[1])
            .forEach(f => f && fechas.add(f));
        } catch { /* carpeta sin archivos */ }
      }
      return NextResponse.json({ fechas: Array.from(fechas).sort().reverse() });
    }

    if (!FECHA_REGEX.test(fecha)) {
      return NextResponse.json({ message: 'Fecha inválida (YYYY-MM-DD).' }, { status: 400 });
    }
    let encontrado: { ruta: string; mtime: Date } | null = null;
    for (const carpeta of carpetas) {
      const ruta = path.join(carpeta, `${fecha}.txt`);
      try {
        const st = await fs.stat(ruta);
        if (!encontrado || st.mtime > encontrado.mtime) encontrado = { ruta, mtime: st.mtime };
      } catch { /* no existe en esta carpeta */ }
    }
    if (!encontrado) {
      return NextResponse.json({ message: `No existe un plan guardado para ${fecha}.` }, { status: 404 });
    }
    const { contenido, snapshot } = separarSnapshot((await fs.readFile(encontrado.ruta, 'utf8')).replace(/^﻿/, ''));
    return NextResponse.json({ ruta: encontrado.ruta, fechaModificacion: encontrado.mtime, contenido, snapshot });
  } catch (error: any) {
    return NextResponse.json({ message: `No se pudo leer el archivo: ${error.message}` }, { status: 500 });
  }
}
