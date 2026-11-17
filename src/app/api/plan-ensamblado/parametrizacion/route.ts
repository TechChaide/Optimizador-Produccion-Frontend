import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { environment } from '@/environments/environments.prod';

// Persiste/recupera la parametrización editable de "Rev Capacidad" (Horas T1/T2, Rendimientos
// L1/L2/L3/L5 y Puestos T1/T2 por Línea+Puesto) en un .txt dentro de la ruta de red `ruta_planes`,
// para poder reconstruir esa pantalla al reabrir una fecha objetivo que ya tiene un plan guardado.
//
// Ruta del archivo: {ruta_planes}/{año fecha objetivo}/{mes fecha objetivo}/{grupo}/{centro}/{fecha objetivo}.txt
// El año/mes se derivan de la FECHA OBJETIVO (no de la fecha en que se guarda): así la lectura puede
// calcular la ruta exacta a partir de (grupo, centro, fechaObjetivo) sin tener que buscar en carpetas.
export const dynamic = 'force-dynamic';

const FECHA_OBJETIVO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Evita path traversal / caracteres inválidos en nombres de carpeta de Windows.
const sanitizeSegment = (value: unknown): string =>
  String(value ?? '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);

function buildFilePath(grupo: string, centro: string, fechaObjetivo: string): string {
  const anio = fechaObjetivo.slice(0, 4);
  const mesNumero = Number(fechaObjetivo.slice(5, 7));
  const mes = NOMBRES_MES[mesNumero - 1] || fechaObjetivo.slice(5, 7);
  return path.join(
    environment.ruta_planes,
    anio,
    mes,
    sanitizeSegment(grupo),
    sanitizeSegment(centro),
    `${fechaObjetivo}.txt`,
  );
}

interface PuestoParametrizacion {
  linea: string;
  puesto: string;
  puestosT1: number;
  puestosT2: number;
}

interface ParametrizacionCapacidad {
  grupo: string;
  centro: string;
  fechaObjetivo: string;
  horasT1: number;
  horasT2: number;
  rendimientos: { L1: number; L2: number; L3: number; L5: number };
  puestos: PuestoParametrizacion[];
}

function construirContenidoTxt(data: ParametrizacionCapacidad): string {
  const lineas = [
    `GRUPO=${data.grupo}`,
    `CENTRO=${data.centro}`,
    `FECHA_OBJETIVO=${data.fechaObjetivo}`,
    `GUARDADO=${new Date().toISOString()}`,
    `HORAS_T1=${data.horasT1}`,
    `HORAS_T2=${data.horasT2}`,
    `REND_L1=${data.rendimientos.L1}`,
    `REND_L2=${data.rendimientos.L2}`,
    `REND_L3=${data.rendimientos.L3}`,
    `REND_L5=${data.rendimientos.L5}`,
    'LINEA|PUESTO|PUESTOS_T1|PUESTOS_T2',
  ];
  data.puestos.forEach(p => {
    lineas.push(`${p.linea}|${p.puesto}|${p.puestosT1}|${p.puestosT2}`);
  });
  return lineas.join('\r\n') + '\r\n';
}

function parseContenidoTxt(contenido: string): ParametrizacionCapacidad {
  const lineas = contenido.split(/\r?\n/).filter(l => l.length > 0);
  const campos: Record<string, string> = {};
  const puestos: PuestoParametrizacion[] = [];
  let enTablaPuestos = false;

  lineas.forEach(linea => {
    if (linea.trim() === 'LINEA|PUESTO|PUESTOS_T1|PUESTOS_T2') {
      enTablaPuestos = true;
      return;
    }
    if (enTablaPuestos) {
      const [l, p, t1, t2] = linea.split('|');
      if (l && p) puestos.push({ linea: l, puesto: p, puestosT1: Number(t1) || 0, puestosT2: Number(t2) || 0 });
      return;
    }
    const idx = linea.indexOf('=');
    if (idx === -1) return;
    campos[linea.slice(0, idx)] = linea.slice(idx + 1);
  });

  return {
    grupo: campos.GRUPO || '',
    centro: campos.CENTRO || '',
    fechaObjetivo: campos.FECHA_OBJETIVO || '',
    horasT1: Number(campos.HORAS_T1) || 0,
    horasT2: Number(campos.HORAS_T2) || 0,
    rendimientos: {
      L1: Number(campos.REND_L1) || 1,
      L2: Number(campos.REND_L2) || 1,
      L3: Number(campos.REND_L3) || 1,
      L5: Number(campos.REND_L5) || 1,
    },
    puestos,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { grupo, centro, fechaObjetivo, horasT1, horasT2, rendimientos, puestos } = body || {};

    if (!grupo || !centro || !fechaObjetivo || !FECHA_OBJETIVO_REGEX.test(fechaObjetivo)) {
      return NextResponse.json({ message: 'grupo, centro y fechaObjetivo (YYYY-MM-DD) son requeridos' }, { status: 400 });
    }
    if (!Array.isArray(puestos)) {
      return NextResponse.json({ message: 'puestos debe ser un arreglo' }, { status: 400 });
    }

    const filePath = buildFilePath(grupo, centro, fechaObjetivo);
    const contenido = construirContenidoTxt({
      grupo, centro, fechaObjetivo,
      horasT1: Number(horasT1) || 0,
      horasT2: Number(horasT2) || 0,
      rendimientos: {
        L1: Number(rendimientos?.L1) || 1,
        L2: Number(rendimientos?.L2) || 1,
        L3: Number(rendimientos?.L3) || 1,
        L5: Number(rendimientos?.L5) || 1,
      },
      puestos,
    });

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contenido, 'utf-8');

    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    return NextResponse.json({ message: `Error al guardar el plan: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const grupo = searchParams.get('grupo') || '';
    const centro = searchParams.get('centro') || '';
    const fechaObjetivo = searchParams.get('fechaObjetivo') || '';

    if (!grupo || !centro || !fechaObjetivo || !FECHA_OBJETIVO_REGEX.test(fechaObjetivo)) {
      return NextResponse.json({ message: 'grupo, centro y fechaObjetivo (YYYY-MM-DD) son requeridos' }, { status: 400 });
    }

    const filePath = buildFilePath(grupo, centro, fechaObjetivo);
    let contenido: string;
    try {
      contenido = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({ found: false });
      }
      throw err;
    }

    return NextResponse.json({ found: true, data: parseContenidoTxt(contenido) });
  } catch (error) {
    return NextResponse.json({ message: `Error al leer el plan: ${(error as Error).message}` }, { status: 500 });
  }
}
