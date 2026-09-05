'use client';

import React, { useMemo } from 'react';
import type { SaturdayProposalByMonth } from './saturdayPlannerV4';

interface Props {
  centros: string[];
  proposal: SaturdayProposalByMonth;
  systemIdentifiedSatKeys: Set<string>;
  draftByCenter: Record<string, Set<string>>;
  committedByCenter: Record<string, Set<string>>;
  /** Minutos que aporta un sabado activo (= horasExtrasFin * 60). */
  satMinutos: number;
  /** Si hay diferencia entre borrador y confirmacion. */
  selectionDirty: boolean;
  /** Centros sin ningun sabado seleccionado en lo confirmado. */
  centrosPendientes: string[];
  onToggle: (centro: string, satKey: string) => void;
  onApplyProposal: (centro: string) => void;
  onConfirm: () => void;
}

export const SaturdayWeeklyEditor: React.FC<Props> = ({
  centros,
  proposal,
  systemIdentifiedSatKeys,
  draftByCenter,
  committedByCenter,
  satMinutos,
  selectionDirty,
  centrosPendientes,
  onToggle,
  onApplyProposal,
  onConfirm,
}) => {
  const months = useMemo(() => Array.from(proposal.entries()), [proposal]);

  if (centros.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic p-3 border border-gray-200 rounded">
        Selecciona al menos un centro y pulsa Cargar IV4 para ver semanas con sabado.
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic p-3 border border-gray-200 rounded">
        Aun no hay meses con propuesta de sabados (carga tiempos canonicos).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[11px] text-gray-700">
          Cada sabado activado aporta <strong>+{satMinutos} min</strong> a la semana.
          Las marcadas como <strong className="text-indigo-700">Identificada</strong> son las que el sistema
          eligio para la propuesta automatica; puedes activar otras adicionales o desactivar.
        </p>
        <button
          type="button"
          disabled={!selectionDirty && centrosPendientes.length === 0}
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          title={
            selectionDirty
              ? 'Confirma el borrador y recalcula motor + ledger'
              : 'Recalcula con la seleccion actual (util tras Cargar IV4)'
          }
        >
          Confirmar seleccion y recalcular
        </button>
      </div>

      {centrosPendientes.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
          Centros sin sabado seleccionado: <strong>{centrosPendientes.join(', ')}</strong>.
          Aplica la propuesta o marca al menos una semana en el borrador y confirma.
        </div>
      )}

      {centros.map(centro => {
        const draftSat = draftByCenter[centro] ?? new Set<string>();
        const committedSat = committedByCenter[centro] ?? new Set<string>();
        const totalSemActivas = draftSat.size;
        const minutosAgregados = totalSemActivas * satMinutos;
        return (
          <div key={centro} className="border border-amber-200 bg-amber-50 rounded p-3">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="text-xs font-semibold text-amber-900">
                Centro {centro}
                <span className="ml-2 font-normal text-amber-800">
                  Borrador: {totalSemActivas} sabado(s) - +{minutosAgregados} min total
                </span>
              </div>
              <button
                type="button"
                onClick={() => onApplyProposal(centro)}
                className="text-xs px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                title="Une la propuesta automatica con tu seleccion manual de este centro"
              >
                Aplicar propuesta
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {months.map(([month, cfg]) => (
                <div key={`${centro}-${month}`} className="border border-amber-200 bg-white rounded p-2">
                  <div className="text-[11px] font-semibold text-amber-900 mb-1">
                    {month} - Requeridos: {cfg.required} de {cfg.satKeys.length} disponibles
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cfg.satKeys.length === 0 ? (
                      <span className="text-[10px] text-amber-700">Sin sabados disponibles.</span>
                    ) : (
                      cfg.satKeys.map(sk => {
                        const identified = systemIdentifiedSatKeys.has(sk);
                        const enDraft = draftSat.has(sk);
                        const enConfirmado = committedSat.has(sk);
                        const dirtyCell = enDraft !== enConfirmado;
                        return (
                          <button
                            key={`${centro}-${sk}`}
                            type="button"
                            onClick={() => onToggle(centro, sk)}
                            title={
                              `${sk}` +
                              (identified ? ' - Identificada por el sistema' : '') +
                              (enDraft ? ` - Aporta +${satMinutos} min` : '') +
                              (dirtyCell ? ' - Sin confirmar' : '')
                            }
                            className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] rounded border transition-colors ${
                              enDraft
                                ? 'bg-amber-300 border-amber-600 text-amber-900'
                                : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100'
                            } ${identified ? 'ring-1 ring-indigo-500 ring-offset-1' : ''} ${
                              dirtyCell ? 'outline outline-1 outline-orange-500' : ''
                            }`}
                          >
                            <span className="leading-tight">{sk}</span>
                            <span className="text-[8px] text-gray-700">
                              {enDraft ? `+${satMinutos}` : '-'}
                            </span>
                            {identified && (
                              <span className="text-[7px] font-semibold text-indigo-900">Identificada</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
