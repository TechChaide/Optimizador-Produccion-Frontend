import type { PlanGrupo } from '@/types/interfaces';

// El grupo 3 genera su respuesta P2 en dos PlanGrupo separados según el destino:
//   "Plan Táctico - Centro 1000 - P2 - ESPUMA MUEBLES"    → Corte Espuma
//   "Plan Táctico - Centro 1000 - P2 - LAMINA CILINDRICA" → Corte y Laminado
// Cada módulo recupera solo el suyo, así no carga necesidad ajena ni responde P3 por ella. Para el
// grupo 3 se exige su sufijo; en cualquier otro grupo solo se descarta el P2 marcado explícitamente
// para el otro módulo (el resto de reglas por grupo, ej. Venta Externa Espumas/Rollos, siguen en
// cada módulo).
export const CODIGO_GRUPO_P2_MUEBLES = 3;

const P2_SUFIJO_ESPUMA = /espuma\s*muebles/i;
const P2_SUFIJO_LAMINADO = /l[aá]mina\s*cil[ií]ndrica/i;

export const esP2ParaModulo = (
  pg: Pick<PlanGrupo, 'codigo_grupo' | 'valor'>,
  modulo: 'ESPUMA' | 'LAMINADO'
): boolean => {
  const valor = String(pg.valor || '');
  const propio = modulo === 'ESPUMA' ? P2_SUFIJO_ESPUMA : P2_SUFIJO_LAMINADO;
  const ajeno = modulo === 'ESPUMA' ? P2_SUFIJO_LAMINADO : P2_SUFIJO_ESPUMA;
  if (pg.codigo_grupo === CODIGO_GRUPO_P2_MUEBLES) return propio.test(valor);
  return !ajeno.test(valor);
};
