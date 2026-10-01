// Solo servidor (rutas /api/planes): lectura/escritura de los Planes Diarios de "Plan Táctico Muebles"
// como archivos .txt en la carpeta compartida `ruta_planes`, clasificados por
//   <ruta_planes>\<AAAA>\<Nombre del mes>\<Nombre del grupo>\<centro>\<AAAA-MM-DD>.txt
// donde año/mes salen de la fecha objetivo del plan (así la ruta completa de un plan se puede armar
// solo con fecha_objetivo + grupo + centro, sin depender de cuándo se guardó).
import { promises as fs } from 'fs';
import path from 'path';
import { environment } from '@/environments/environments.prod';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Se permite sobrescribir la ruta por variable de entorno del proceso (p. ej. en Docker, donde la ruta
// UNC de Windows no existe y la carpeta compartida se monta como volumen).
export const getRutaPlanes = (): string => {
  const ruta = process.env.RUTA_PLANES || process.env.ruta_planes || environment.ruta_planes;
  if (!ruta) throw new Error('No está configurada la ruta de planes (ruta_planes).');
  return ruta;
};

export const esFechaValida = (fecha: unknown): fecha is string =>
  typeof fecha === 'string' && FECHA_REGEX.test(fecha) && !Number.isNaN(new Date(`${fecha}T00:00:00`).getTime());

// grupo/centro terminan siendo nombres de carpeta (el grupo es su nombre, p. ej. "MUEBLES"): se aceptan
// letras (con tildes), dígitos, espacios, "_", "-" y "."; nunca separadores de ruta ni ".." para que no
// se pueda escapar de `ruta_planes`, ni espacios/puntos al inicio o final (Windows no los admite).
export const esSegmentoValido = (valor: unknown): valor is string =>
  typeof valor === 'string'
  && /^[\p{L}\p{N} _.-]+$/u.test(valor)
  && !valor.includes('..')
  && valor === valor.trim()
  && !valor.endsWith('.');

const getNombreMes = (fecha: string): string => MESES[Number(fecha.slice(5, 7)) - 1];

export const getCarpetaPlan = (fecha: string, grupo: string, centro: string): string =>
  path.join(getRutaPlanes(), fecha.slice(0, 4), getNombreMes(fecha), grupo, centro);

export const getRutaArchivoPlan = (fecha: string, grupo: string, centro: string): string =>
  path.join(getCarpetaPlan(fecha, grupo, centro), `${fecha}.txt`);

export const escribirPlan = async (fecha: string, grupo: string, centro: string, contenido: unknown): Promise<string> => {
  const carpeta = getCarpetaPlan(fecha, grupo, centro);
  await fs.mkdir(carpeta, { recursive: true });
  const archivo = path.join(carpeta, `${fecha}.txt`);
  await fs.writeFile(archivo, JSON.stringify(contenido, null, 2), 'utf8');
  return archivo;
};

export const leerPlan = async (fecha: string, grupo: string, centro: string): Promise<unknown | null> => {
  try {
    const texto = await fs.readFile(getRutaArchivoPlan(fecha, grupo, centro), 'utf8');
    return JSON.parse(texto);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

const listarSubcarpetas = async (carpeta: string): Promise<string[]> => {
  try {
    const entradas = await fs.readdir(carpeta, { withFileTypes: true });
    return entradas.filter(e => e.isDirectory()).map(e => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

// Recorre <ruta_planes>\<AAAA>\<Mes>\<grupo>\<centro> y devuelve todas las fechas objetivo con plan
// guardado, de la más reciente a la más antigua.
export const listarFechasPlanes = async (grupo: string, centro: string): Promise<string[]> => {
  const base = getRutaPlanes();
  const fechas: string[] = [];
  for (const anio of (await listarSubcarpetas(base)).filter(a => /^\d{4}$/.test(a))) {
    for (const mes of (await listarSubcarpetas(path.join(base, anio))).filter(m => MESES.includes(m))) {
      const carpeta = path.join(base, anio, mes, grupo, centro);
      let archivos: string[] = [];
      try {
        archivos = await fs.readdir(carpeta);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      archivos.forEach(a => {
        const fecha = a.replace(/\.txt$/i, '');
        if (a.toLowerCase().endsWith('.txt') && FECHA_REGEX.test(fecha)) fechas.push(fecha);
      });
    }
  }
  return fechas.sort((a, b) => b.localeCompare(a));
};
