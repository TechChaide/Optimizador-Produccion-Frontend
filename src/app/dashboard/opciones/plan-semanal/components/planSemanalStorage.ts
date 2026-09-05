import type { PlanSemanalInput } from './types';

const WRAPPER_KEY = '__ps_gzip_v1';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Serializa el payload del Plan Semanal para localStorage (gzip + base64 si el navegador lo permite). */
export async function stringifyPlanInputForStorage(input: PlanSemanalInput): Promise<string> {
  const json = JSON.stringify(input);
  if (typeof CompressionStream === 'undefined') {
    return json;
  }
  try {
    const enc = new TextEncoder().encode(json);
    const stream = new Blob([enc]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    const b64 = uint8ToBase64(new Uint8Array(buf));
    return JSON.stringify({ [WRAPPER_KEY]: true, b64 });
  } catch {
    return json;
  }
}

/** Lee y parsea `ps_input_data`: soporta JSON plano (legacy) o envoltorio gzip. */
export async function parsePlanInputFromStorage(raw: string | null): Promise<PlanSemanalInput | null> {
  if (!raw) return null;
  let outer: unknown;
  try {
    outer = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!outer || typeof outer !== 'object') return null;
  const o = outer as Record<string, unknown>;
  if (o[WRAPPER_KEY] === true && typeof o.b64 === 'string') {
    if (typeof DecompressionStream === 'undefined') return null;
    try {
      const bytes = base64ToUint8(o.b64);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const text = await new Response(stream).text();
      return JSON.parse(text) as PlanSemanalInput;
    } catch {
      return null;
    }
  }
  return outer as PlanSemanalInput;
}
