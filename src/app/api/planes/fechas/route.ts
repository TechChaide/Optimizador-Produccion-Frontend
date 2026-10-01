import { NextRequest, NextResponse } from 'next/server';
import { esSegmentoValido, listarFechasPlanes } from '@/lib/server/planes-archivos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/planes/fechas?grupo=<nombre del grupo>&centro=1000 — fechas objetivo con plan .txt guardado (más reciente primero)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const grupo = searchParams.get('grupo');
  const centro = searchParams.get('centro');

  if (!esSegmentoValido(grupo) || !esSegmentoValido(centro)) {
    return NextResponse.json({ message: 'Parámetros inválidos: se requiere grupo y centro.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await listarFechasPlanes(grupo, centro) });
  } catch (error) {
    console.error('Error listando planes:', error);
    return NextResponse.json({ message: `Error al listar los planes: ${(error as Error).message}` }, { status: 500 });
  }
}
