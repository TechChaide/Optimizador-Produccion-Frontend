import { NextRequest, NextResponse } from 'next/server';
import { escribirPlan, esFechaValida, esSegmentoValido, getRutaArchivoPlan, leerPlan } from '@/lib/server/planes-archivos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/planes?fecha=AAAA-MM-DD&grupo=<nombre del grupo>&centro=1000
// Busca <ruta_planes>\<AAAA>\<Mes>\<grupo>\<centro>\<fecha>.txt y devuelve su contenido (snapshot JSON).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get('fecha');
  const grupo = searchParams.get('grupo');
  const centro = searchParams.get('centro');

  if (!esFechaValida(fecha) || !esSegmentoValido(grupo) || !esSegmentoValido(centro)) {
    return NextResponse.json({ message: 'Parámetros inválidos: se requiere fecha (AAAA-MM-DD), grupo y centro.' }, { status: 400 });
  }

  try {
    const data = await leerPlan(fecha, grupo, centro);
    if (data === null) {
      return NextResponse.json({ message: `No existe plan para ${fecha}.`, ruta: getRutaArchivoPlan(fecha, grupo, centro) }, { status: 404 });
    }
    return NextResponse.json({ data, ruta: getRutaArchivoPlan(fecha, grupo, centro) });
  } catch (error) {
    console.error('Error leyendo plan:', error);
    return NextResponse.json({ message: `Error al leer el plan: ${(error as Error).message}` }, { status: 500 });
  }
}

// POST /api/planes  body: { fecha, grupo, centro, contenido }
// Crea (o sobrescribe) el .txt del plan de esa fecha objetivo.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Cuerpo JSON inválido.' }, { status: 400 });
  }

  const fecha = body?.fecha;
  const grupo = body?.grupo != null ? String(body.grupo) : null;
  const centro = body?.centro != null ? String(body.centro) : null;

  if (!esFechaValida(fecha) || !esSegmentoValido(grupo) || !esSegmentoValido(centro) || body?.contenido == null) {
    return NextResponse.json({ message: 'Parámetros inválidos: se requiere fecha (AAAA-MM-DD), grupo, centro y contenido.' }, { status: 400 });
  }

  try {
    const ruta = await escribirPlan(fecha, grupo, centro, body.contenido);
    return NextResponse.json({ ruta });
  } catch (error) {
    console.error('Error escribiendo plan:', error);
    return NextResponse.json({ message: `Error al guardar el plan: ${(error as Error).message}` }, { status: 500 });
  }
}
