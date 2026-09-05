/**
 * @fileOverview Motor de Optimización de Producción (MILP)
 * Utiliza glpk.js (WebAssembly) para balanceo de carga en el cliente.
 */

import GLPK from 'glpk.js';

/**
 * Interface para los materiales de entrada
 */
export interface MaterialInput {
  id: string;
  nombre: string;
  tiempoArmado: number;   // en minutos por unidad
  tiempoCerrado: number;  // en minutos por unidad
  tipo: 'fijo' | 'ajustable';
  cantidadFija?: number;  // obligatorio si tipo es 'fijo'
  minimo?: number;        // obligatorio si tipo es 'ajustable'
  maximo?: number;        // obligatorio si tipo es 'ajustable'
}

/**
 * Parámetros de configuración del optimizador
 */
export interface OptimizerParams {
  numArmadores: number;
  numCerradores: number;
  jornadaHoras: number;   // T (ej. 8 horas)
  alpha: number;          // Peso para minimizar brecha |T_A - T_C|
  beta: number;           // Peso para maximizar utilización (minimizar tiempo ocioso)
}

/**
 * Resultado de la optimización
 */
export interface OptimizationResult {
  success: boolean;
  message: string;
  plan?: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    tiempoArmadoTotal: number; // minutos
    tiempoCerradoTotal: number; // minutos
  }>;
  stats?: {
    tiempoFinalArmadores: number; // minutos
    tiempoFinalCerradores: number; // minutos
    brechaMinutos: number;
    utilizacionArmado: number; // %
    utilizacionCerrado: number; // %
    valorObjetivo: number;
  };
  errorDetails?: {
    requiredExtraTimeMin?: number;
    requiredExtraStaff?: number;
  };
}

/**
 * Función principal de optimización
 */
export async function optimizarLote(
  materiales: MaterialInput[],
  params: OptimizerParams
): Promise<OptimizationResult> {
  // 1. Inicialización de GLPK
  const glpk = await (GLPK as any)();

  // 2. Unidades: Convertir jornada a minutos
  const T_min = params.jornadaHoras * 60;
  
  // 3. Separar materiales
  const materialesFijos = materiales.filter(m => m.tipo === 'fijo');
  const materialesAjustables = materiales.filter(m => m.tipo === 'ajustable');

  // 4. Validación de factibilidad inicial (Carga Fija)
  let cargaFijaArmado = 0;
  let cargaFijaCerrado = 0;
  
  materialesFijos.forEach(m => {
    const qty = m.cantidadFija || 0;
    cargaFijaArmado += m.tiempoArmado * qty;
    cargaFijaCerrado += m.tiempoCerrado * qty;
  });

  const tiempoFijoArmadores = cargaFijaArmado / params.numArmadores;
  const tiempoFijoCerradores = cargaFijaCerrado / params.numCerradores;

  if (tiempoFijoArmadores > T_min || tiempoFijoCerradores > T_min) {
    const exceso = Math.max(tiempoFijoArmadores - T_min, tiempoFijoCerradores - T_min);
    return {
      success: false,
      message: "Factibilidad fallida: El lote FIJO excede la capacidad de la jornada.",
      errorDetails: {
        requiredExtraTimeMin: Math.ceil(exceso),
        requiredExtraStaff: Math.ceil(exceso / (T_min / params.numArmadores)) // Estimación simple
      }
    };
  }

  // 5. Definición del modelo MILP
  // Variables: 
  // x_i para cada material ajustable (enteros)
  // z para el valor absoluto (continuo)
  
  const lp: any = {
    name: 'BalanceoProduccion',
    objective: {
      direction: glpk.GLP_MIN,
      name: 'obj',
      vars: [
        { name: 'z', coef: params.alpha }
      ]
    },
    vars: [
      { name: 'z', lb: 0, ub: T_min, type: glpk.GLP_CV } // Variable para |T_A - T_C|
    ],
    constraints: []
  };

  // Añadir variables de decisión x_i (cantidades ajustables)
  materialesAjustables.forEach((m, index) => {
    const varName = `x_${index}`;
    lp.vars.push({
      name: varName,
      lb: m.minimo || 0,
      ub: m.maximo || 1000,
      type: glpk.GLP_IV // Variable entera
    });

    // Añadir coeficientes beta a la función objetivo
    // Objetivo: Maximizar T_A + T_C es equivalente a Minimizar -(T_A + T_C)
    // Coeficiente de x_i = -beta * (a_i/N_A + c_i/N_C)
    const coef = -params.beta * ( (m.tiempoArmado / params.numArmadores) + (m.tiempoCerrado / params.numCerradores) );
    lp.objective.vars.push({ name: varName, coef: coef });
  });

  // RESTRICCIONES DE TIEMPO MÁXIMO (T_A <= T y T_C <= T)
  // T_A = (CargaFijaA + sum(a_i * x_i)) / N_A <= T
  // sum(a_i * x_i) <= T*N_A - CargaFijaA
  
  const coefsArmado = materialesAjustables.map((m, i) => ({ name: `x_${i}`, coef: m.tiempoArmado }));
  lp.constraints.push({
    name: 'LimiteArmado',
    vars: coefsArmado,
    lb: 0,
    ub: (T_min * params.numArmadores) - cargaFijaArmado
  });

  const coefsCerrado = materialesAjustables.map((m, i) => ({ name: `x_${i}`, coef: m.tiempoCerrado }));
  lp.constraints.push({
    name: 'LimiteCerrado',
    vars: coefsCerrado,
    lb: 0,
    ub: (T_min * params.numCerradores) - cargaFijaCerrado
  });

  // RESTRICCIONES PARA LINEALIZAR VALOR ABSOLUTO z >= |T_A - T_C|
  // 1. T_A - T_C <= z  =>  T_A - T_C - z <= 0
  // 2. T_C - T_A <= z  =>  T_C - T_A - z <= 0

  const diffCoefs1 = materialesAjustables.map((m, i) => ({
    name: `x_${i}`,
    coef: (m.tiempoArmado / params.numArmadores) - (m.tiempoCerrado / params.numCerradores)
  }));
  diffCoefs1.push({ name: 'z', coef: -1 });

  lp.constraints.push({
    name: 'Abs1',
    vars: diffCoefs1,
    ub: (cargaFijaCerrado / params.numCerradores) - (cargaFijaArmado / params.numArmadores)
  });

  const diffCoefs2 = materialesAjustables.map((m, i) => ({
    name: `x_${i}`,
    coef: (m.tiempoCerrado / params.numCerradores) - (m.tiempoArmado / params.numArmadores)
  }));
  diffCoefs2.push({ name: 'z', coef: -1 });

  lp.constraints.push({
    name: 'Abs2',
    vars: diffCoefs2,
    ub: (cargaFijaArmado / params.numArmadores) - (cargaFijaCerrado / params.numCerradores)
  });

  // 6. Resolver
  const options = {
    presolve: true,
    cb: {
      call: (msg: any) => console.debug('GLPK:', msg),
      iteration: 10
    }
  };

  const res = glpk.solve(lp, options);

  // 7. Procesar resultados
  if (res.result.status === glpk.GLP_OPT || res.result.status === glpk.GLP_FEAS) {
    const solution = res.result.vars;
    
    const finalPlan = materiales.map(m => {
      let finalQty = m.tipo === 'fijo' ? (m.cantidadFija || 0) : 0;
      if (m.tipo === 'ajustable') {
        const index = materialesAjustables.findIndex(ma => ma.id === m.id);
        finalQty = Math.round(solution[`x_${index}`] || 0);
      }
      return {
        id: m.id,
        nombre: m.nombre,
        cantidad: finalQty,
        tiempoArmadoTotal: finalQty * m.tiempoArmado,
        tiempoCerradoTotal: finalQty * m.tiempoCerrado
      };
    });

    const totalArmado = finalPlan.reduce((sum, item) => sum + item.tiempoArmadoTotal, 0);
    const totalCerrado = finalPlan.reduce((sum, item) => sum + item.tiempoCerradoTotal, 0);
    
    const tFinalA = totalArmado / params.numArmadores;
    const tFinalC = totalCerrado / params.numCerradores;

    return {
      success: true,
      message: "Optimización exitosa",
      plan: finalPlan,
      stats: {
        tiempoFinalArmadores: Number(tFinalA.toFixed(2)),
        tiempoFinalCerradores: Number(tFinalC.toFixed(2)),
        brechaMinutos: Number(Math.abs(tFinalA - tFinalC).toFixed(2)),
        utilizacionArmado: Number(((tFinalA / T_min) * 100).toFixed(1)),
        utilizacionCerrado: Number(((tFinalC / T_min) * 100).toFixed(1)),
        valorObjetivo: res.result.objVal
      }
    };
  } else {
    return {
      success: false,
      message: "No se pudo encontrar una solución óptima para los parámetros definidos."
    };
  }
}

/**
 * EJEMPLO DE USO:
 * 
 * const materiales = [
 *   { id: 'M1', nombre: 'Colchón Premium', tiempoArmado: 15, tiempoCerrado: 10, tipo: 'fijo', cantidadFija: 20 },
 *   { id: 'M2', nombre: 'Base Estándar', tiempoArmado: 8, tiempoCerrado: 12, tipo: 'ajustable', minimo: 10, maximo: 50 }
 * ];
 * 
 * const params = { numArmadores: 4, numCerradores: 2, jornadaHoras: 8, alpha: 10, beta: 1 };
 * 
 * optimizarLote(materiales, params).then(console.log);
 */
