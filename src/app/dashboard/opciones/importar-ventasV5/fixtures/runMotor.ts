/**
 * Runner del motor rediseñado contra los fixtures.
 *
 * Cómo ejecutar (desde la raíz del proyecto):
 *   npx tsx src/app/dashboard/opciones/importar-ventasV5/fixtures/runMotor.ts
 *
 * (Si no tenés tsx instalado:  npm install -g tsx)
 *
 * Salida:
 *  - Muestra en consola, para cada fixture:
 *      - Las anticipaciones planeadas por la Pasada 2
 *      - Tabla del ledger semanal generado por el motor rediseñado
 *      - Comparación contra los resultados esperados del fixture
 */

import { TODOS_LOS_FIXTURES } from './index';
import { runMotorRediseñado, type LedgerRow } from './motorRediseñado';
import type { FixtureExpectedRow } from './fixtureTypes';

function pad(str: string, n: number): string {
  if (str.length >= n) return str.slice(0, n);
  return str + ' '.repeat(n - str.length);
}

function num(n: number, width = 6): string {
  return pad(String(n), width);
}

function formatLedger(rows: LedgerRow[]): string {
  const lines: string[] = [];
  lines.push(
    pad('Mat', 5) + pad('Cen', 5) + pad('Sem', 5) +
    pad('Prod', 7) + pad('Tras→', 7) + pad('Tras←', 7) +
    pad('Desp', 7) + pad('StkReg', 8) + pad('StkRes', 8) +
    pad('StkFis', 8) + pad('Backlog', 8),
  );
  lines.push('-'.repeat(85));
  // Ordenar por semana, luego centro, luego material
  const sorted = [...rows].sort((a, b) => {
    if (a.semana !== b.semana) return a.semana - b.semana;
    if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
    return a.material.localeCompare(b.material);
  });
  for (const r of sorted) {
    lines.push(
      pad(r.material, 5) + pad(r.centro, 5) + pad(String(r.semana), 5) +
      num(r.produccion, 7) + num(r.trasladoSaliente, 7) + num(r.trasladoEntrante, 7) +
      num(r.despachosVentas, 7) + num(r.stockFinalRegular, 8) + num(r.stockReservado, 8) +
      num(r.stockFinalFisico, 8) + num(r.backlogFinal, 8),
    );
  }
  return lines.join('\n');
}

function compararLedger(
  reales: LedgerRow[],
  esperados: FixtureExpectedRow[],
): { coincidencias: number; diferencias: string[] } {
  const difs: string[] = [];
  let ok = 0;
  for (const esp of esperados) {
    const real = reales.find(
      (r) => r.material === esp.material && r.centro === esp.centro && r.semana === esp.semana,
    );
    if (!real) {
      difs.push(
        `  ❌ Esperado ${esp.material}|${esp.centro}|sem${esp.semana} no encontrado en resultados`,
      );
      continue;
    }
    const errores: string[] = [];
    if (real.produccion !== esp.produccion)
      errores.push(`prod ${real.produccion}≠${esp.produccion}`);
    if (real.trasladoSaliente !== esp.trasladoSaliente)
      errores.push(`tras→ ${real.trasladoSaliente}≠${esp.trasladoSaliente}`);
    if (real.trasladoEntrante !== esp.trasladoEntrante)
      errores.push(`tras← ${real.trasladoEntrante}≠${esp.trasladoEntrante}`);
    if (real.despachosVentas !== esp.despachosVentas)
      errores.push(`desp ${real.despachosVentas}≠${esp.despachosVentas}`);
    if (real.stockFinalRegular !== esp.stockFinalRegular)
      errores.push(`stkReg ${real.stockFinalRegular}≠${esp.stockFinalRegular}`);
    if (real.stockReservado !== esp.stockReservado)
      errores.push(`stkRes ${real.stockReservado}≠${esp.stockReservado}`);
    if (real.backlogFinal !== esp.backlogFinal)
      errores.push(`back ${real.backlogFinal}≠${esp.backlogFinal}`);

    if (errores.length === 0) {
      ok++;
    } else {
      difs.push(
        `  ⚠ ${esp.material}|${esp.centro}|sem${esp.semana}: ${errores.join(', ')}`,
      );
    }
  }
  return { coincidencias: ok, diferencias: difs };
}

function main() {
  console.log('═'.repeat(85));
  console.log('  EJECUCIÓN DEL MOTOR REDISEÑADO CONTRA FIXTURES');
  console.log('═'.repeat(85));

  for (const { fixture, expected } of TODOS_LOS_FIXTURES) {
    console.log('\n\n' + '═'.repeat(85));
    console.log(`  FIXTURE: ${fixture.nombre}`);
    console.log(`  ${fixture.descripcion}`);
    console.log('═'.repeat(85));

    const result = runMotorRediseñado(fixture);

    // Mostrar anticipaciones
    if (result.anticipaciones.length > 0) {
      console.log('\n  ANTICIPACIONES PLANEADAS:');
      for (const ant of result.anticipaciones) {
        console.log(
          `    ${ant.material}: ${ant.uds} uds | sem ${ant.semanaOrigen} → sem ${ant.semanaTarget} | ${ant.destino}`,
        );
      }
    } else {
      console.log('\n  ANTICIPACIONES: ninguna (no necesarias)');
    }

    // Mostrar ledger generado
    console.log('\n  LEDGER GENERADO POR EL MOTOR REDISEÑADO:');
    console.log(formatLedger(result.ledger));

    // Comparar con resultados esperados
    if (expected.motorRediseñado.length > 0) {
      console.log('\n  COMPARACIÓN CONTRA RESULTADOS ESPERADOS:');
      const { coincidencias, diferencias } = compararLedger(result.ledger, expected.motorRediseñado);
      console.log(
        `    ✓ ${coincidencias} de ${expected.motorRediseñado.length} filas coinciden exactamente`,
      );
      if (diferencias.length > 0) {
        console.log('    Diferencias encontradas:');
        for (const d of diferencias) console.log(d);
      }
    } else {
      console.log('\n  (Sin resultados esperados definidos para comparar)');
    }

    // Notas comparativas
    if (expected.notasComparacion.length > 0) {
      console.log('\n  NOTAS DEL FIXTURE:');
      for (const n of expected.notasComparacion) {
        console.log(`    • ${n}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(85));
  console.log('  EJECUCIÓN COMPLETADA');
  console.log('═'.repeat(85));
}

main();
