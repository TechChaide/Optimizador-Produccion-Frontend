'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, ClipboardCheck, Mail, Send } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useResumenCapacidad } from '@/hooks/useProgTiemposCapacidad';
import { usePlanFinalData } from '@/hooks/usePlanFinalData';
import { useAppContext } from '@/context/AppProvider';
import { serviciosService, type SolicitudProduccionHBPayload } from '@/services/servicios.service';
import type { Restriccion } from '@/types/interfaces';

const CENTROS = ['1000', '2000'];
const NOMBRE_CENTRO: Record<string, string> = { '1000': 'Quito', '2000': 'Guayaquil' };

// Clase de Orden por Centro — únicamente las de programación "hacia adelante" (confirmado por el
// usuario, ver doc "CHD-EF AUTOMATIZAR GENERACION DE ORDENES DE PRODUCCION"): ZCSQ/ZCSG son
// "Orden de fab. MTS" (contra stock), las únicas clases "hacia adelante" de Colchones que NO
// requieren Pedido Comercial/Posición — dato que Plan Final no tiene. Las MTO de Colchones
// (ZCCQ/ZCOQ, "hacia atrás") quedan fuera de alcance por esa misma decisión.
const CLASE_ORDEN_POR_CENTRO: Record<string, string> = { '1000': 'ZCSQ', '2000': 'ZCSG' };
const MANDANTE = '300';
const HORA_INICIO_DEFAULT = '080000';

interface ResumenPlanFinalTabSectionProps {
  restrictions?: Restriccion[];
}

export const ResumenPlanFinalTabSection: React.FC<ResumenPlanFinalTabSectionProps> = ({ restrictions = [] }) => {
  const resumen = useResumenCapacidad();
  // "Enviar a SAP" necesita el detalle por Material (Centro+Línea+Puesto+Material+Cantidad+OrdFab),
  // que "Resumen Plan Final" no tiene (aquí solo se ve el agregado por Línea+Puesto) — se reusa la
  // misma fuente que ya alimenta "Plan Final" en vez de duplicar esa lógica.
  const { rows: planFinalRows, diaProgramacion } = usePlanFinalData();
  const { addNotification } = useAppContext();
  const [selectedCenter, setSelectedCenter] = useState('1000');
  const [isSendingReporte, setIsSendingReporte] = useState(false);
  const [isSendingSap, setIsSendingSap] = useState(false);
  const [sapProgress, setSapProgress] = useState({ enviadas: 0, total: 0 });
  const [isSapDialogOpen, setIsSapDialogOpen] = useState(false);
  // TEMPORAL: checkbox para pruebas — ignora la exclusión de filas que ya tienen OrdFab asignado.
  // Riesgo real: con esto activo se pueden reenviar a SAP materiales que YA tienen una orden de
  // fabricación, duplicándola. Quitar este checkbox cuando termine la etapa de pruebas.
  const [ignorarOrdFab, setIgnorarOrdFab] = useState(false);

  const rowsByCenter = useMemo(() => CENTROS.reduce<Record<string, typeof resumen>>((groups, center) => {
    groups[center] = resumen.filter(row => row.centro === center);
    return groups;
  }, {}), [resumen]);

  // Destinatarios del correo — restricción "CORREOS_DESTINO" (grupo Ensamblado, Parámetros → Grupos
  // → Restricciones), mismo patrón que "CORREOS_PLAN" en Forros: sin UI de captura nueva, se
  // crea/edita allá. Se acepta "&" o "," como separador.
  const correosDestino = useMemo(() => {
    const destinatarios: string[] = [];
    restrictions
      .filter(r => r.nombre_restriccion.toUpperCase().trim() === 'CORREOS_DESTINO')
      .forEach(r => {
        r.valor_restriccion.split(/[&,]/).forEach(v => {
          const clean = v.trim();
          if (clean && !destinatarios.includes(clean)) destinatarios.push(clean);
        });
      });
    return destinatarios;
  }, [restrictions]);

  // Bloque de tabla por Centro — misma tabla que se muestra en pantalla (Linea / Puesto Trabajo /
  // Total cantidad / Puestos T1 / Puestos T2 / % ocupación).
  const construirTablaCentroHtml = (center: string): string => {
    const rows = rowsByCenter[center] || [];
    const filasHtml = rows.map((row, idx) => `
      <tr${idx % 2 === 1 ? ' style="background:#fafafa;"' : ''}>
        <td style="padding:8px 10px;font-size:11px;font-weight:700;color:#111827;border-bottom:1px solid #f3f4f6;">${row.linea}</td>
        <td style="padding:8px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;">${row.puesto}</td>
        <td align="right" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4338ca;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${row.totalCantidad.toLocaleString('es-EC')}</td>
        <td align="right" style="padding:8px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${row.puestosT1}</td>
        <td align="right" style="padding:8px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${row.puestosT2}</td>
        <td align="right" style="padding:8px 10px;font-size:11px;font-weight:700;color:${row.ocupacion > 100 ? '#dc2626' : '#7c3aed'};border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${row.ocupacion.toFixed(1)}%</td>
      </tr>`).join('');

    return `
    <td style="padding:18px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Centro ${center} · ${NOMBRE_CENTRO[center] || center}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Linea</td>
          <td style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Puesto Trabajo</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Total cantidad</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Puestos T1</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Puestos T2</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">% Ocupación</td>
        </tr>
        ${filasHtml || `<tr><td colspan="6" style="padding:20px;text-align:center;font-size:11px;color:#9ca3af;font-style:italic;">Sin datos de Rev Capacidad para este centro.</td></tr>`}
      </table>
    </td>`;
  };

  // Cuerpo del correo — un único envío con la tabla de TODOS los centros (Quito y Guayaquil), uno
  // debajo del otro, mismo formato de plantilla ya usado en los demás reportes de Planificación
  // Táctica (Espuma, Corte y Laminado).
  const construirReporteHtmlResumen = (): string => {
    const fechaLabel = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    const tablasHtml = CENTROS.map(center => `<tr>${construirTablaCentroHtml(center)}</tr>`).join('');

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td style="background:#4338ca;padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">CHAIDE Y CHAIDE</td>
          <td align="right" style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#c7d2fe;">Planificación de Producción</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:26px 28px 6px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Ensamblado · Todos los centros · Reporte diario</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827;">Resumen Plan Final — Revisión de Capacidad</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${fechaLabel} · Correo automático, no responder</p>
    </td>
  </tr>
  ${tablasHtml}
  <tr>
    <td style="padding:22px 28px 28px;">
      <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
        Este correo fue generado automáticamente por el Optimizador de Producción, favor no responder.
        Para dudas sobre estos datos, contacta a Planificación Táctica.
      </p>
    </td>
  </tr>
</table>`;
  };

  const handleEnviarReporte = async () => {
    if (correosDestino.length === 0) {
      addNotification('warning', 'No hay destinatarios configurados. Crea la restricción "CORREOS_DESTINO" (grupo Ensamblado) en Parámetros → Grupos → Restricciones, con los correos separados por "&" o ",".');
      return;
    }
    setIsSendingReporte(true);
    try {
      const resultado = await serviciosService.enviarCorreo({
        destino: correosDestino.join(','),
        asunto: `Reporte de producción — Resumen Plan Final [Ensamblado]-[Todos los centros]`,
        cuerpo: construirReporteHtmlResumen(),
        nota: 'Este correo fue generado automáticamente, favor no responder.',
      });
      addNotification('success', `${resultado.message} — ${resultado.destinatarios.join(', ')}`);
    } catch (error) {
      addNotification('error', `Error al enviar el reporte: ${(error as Error).message}`);
    } finally {
      setIsSendingReporte(false);
    }
  };

  // Filas realmente enviables a SAP (de AMBOS centros, mismo criterio "envío unificado" que el
  // correo): solo las que en "Plan Final" muestran "-" en la columna OrdFab (es decir, r.ordFab
  // vacío — mismo criterio que `row.ordFab || '-'` en PlanFinalTabSection). Si ya tienen un OrdFab
  // real asignado, se excluyen para no duplicar la orden en SAP. NO se filtra por Puesto Trabajo
  // resuelto ("N/D"): ese campo va vacío en el payload (SAP lo resuelve por su cuenta).
  const filasEnviablesSap = useMemo(
    () => planFinalRows.filter(r =>
      r.codigoMaterial &&
      r.cantidad > 0 &&
      (ignorarOrdFab || !r.ordFab)
    ),
    [planFinalRows, ignorarOrdFab]
  );

  // Diagnóstico visible de por qué el botón "Enviar a SAP" puede seguir deshabilitado: el botón usa
  // disabled:pointer-events-none (ver button.tsx), así que el "title" NUNCA se dispara en hover
  // mientras está deshabilitado — sin este texto no hay forma de ver la causa real.
  const sapDiagnostico = useMemo(() => {
    let sinMaterialOCantidad = 0, yaConOrdFab = 0;
    planFinalRows.forEach(r => {
      if (!r.codigoMaterial || !(r.cantidad > 0)) sinMaterialOCantidad++;
      else if (!ignorarOrdFab && r.ordFab) yaConOrdFab++;
    });
    return { total: planFinalRows.length, sinMaterialOCantidad, yaConOrdFab };
  }, [planFinalRows, ignorarOrdFab]);

  const construirSolicitudSap = (row: typeof planFinalRows[number], usuarioProceso: string): SolicitudProduccionHBPayload => {
    const fechaInicio = String(diaProgramacion || '').replace(/-/g, ''); // YYYY-MM-DD -> AAAAMMDD
    return {
      Mandante: MANDANTE,
      CodigoOrdenExterna: String(row.codigoDetalleTactico),
      ClaseOrden: CLASE_ORDEN_POR_CENTRO[row.centro] || '',
      Centro: row.centro,
      CodigoMaterial: row.codigoMaterial,
      CantidadPlanificada: row.cantidad,
      VersionFabricacion: '',
      // Puesto de Trabajo va vacío a propósito (indicación del usuario): SAP lo resuelve por su
      // cuenta, no se envía el valor calculado localmente en Plan Final.
      PuestoTrabajo: '',
      FechaFinProgramada: '',
      HoraFinProgramada: '',
      FechaInicioProgramada: fechaInicio,
      HoraInicioProgramada: HORA_INICIO_DEFAULT,
      PedidoComercial: '',
      PosicionPedido: '',
      EstadoRegistro: '1',
      Observaciones: '',
      EstadoCarga: '',
      NumeroOrdenSap: '',
      FechaProceso: '',
      HoraProceso: '',
      UsuarioProceso: usuarioProceso,
    };
  };

  // Envía UNA solicitud por fila, en secuencia (no en paralelo: son órdenes reales en SAP, evitar
  // saturar el endpoint y poder reportar avance/errores fila por fila).
  const handleEnviarSap = async () => {
    if (filasEnviablesSap.length === 0) {
      addNotification('warning', 'No hay filas válidas para enviar (revisa Material y Cantidad).');
      return;
    }
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const usuarioProceso = user?.codigo_empleado || '';

    setIsSendingSap(true);
    setSapProgress({ enviadas: 0, total: filasEnviablesSap.length });
    const errores: string[] = [];
    let exitosas = 0;

    for (let i = 0; i < filasEnviablesSap.length; i++) {
      const row = filasEnviablesSap[i];
      try {
        const resultado = await serviciosService.insertarSolicitudProduccionHB(construirSolicitudSap(row, usuarioProceso));
        if (resultado?.data?.success) {
          exitosas++;
        } else {
          errores.push(`${row.centro}|${row.codigoMaterial}: ${resultado?.data?.message || 'Sin confirmación de éxito'}`);
        }
      } catch (err) {
        errores.push(`${row.centro}|${row.codigoMaterial}: ${(err as Error).message}`);
      }
      setSapProgress({ enviadas: i + 1, total: filasEnviablesSap.length });
    }

    setIsSendingSap(false);
    if (errores.length === 0) {
      addNotification('success', `${exitosas} solicitud(es) de producción enviada(s) a SAP correctamente.`);
      setIsSapDialogOpen(false);
    } else {
      addNotification('error', `${exitosas} enviada(s), ${errores.length} con error. Detalle: ${errores.slice(0, 5).join(' | ')}${errores.length > 5 ? '…' : ''}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <ClipboardCheck className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Resumen Plan final</h3>
            <p className="text-xs text-gray-500 mt-1">Resumen visual de “Rev Capacidad”.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* TEMPORAL — quitar al terminar pruebas: ignora la exclusión de filas con OrdFab ya
              asignado. Riesgo real de duplicar órdenes en SAP si se envía con esto activo. */}
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer select-none" title="Temporal: permite reenviar a SAP materiales que ya tienen OrdFab asignado. Riesgo de duplicar órdenes.">
            <input
              type="checkbox"
              checked={ignorarOrdFab}
              onChange={(e) => setIgnorarOrdFab(e.target.checked)}
              className="w-3.5 h-3.5 accent-amber-600"
            />
            Ignorar OrdFab (temporal)
          </label>
          {/* Destinatarios en la restricción "CORREOS_DESTINO" (grupo Ensamblado) — sin UI de captura
              nueva, se crea/edita en Parámetros → Grupos → Restricciones. */}
          <Button
            onClick={handleEnviarReporte}
            disabled={isSendingReporte}
            title={correosDestino.length > 0 ? `Destinatarios: ${correosDestino.join(', ')}` : 'Sin destinatarios — crea la restricción CORREOS_DESTINO'}
            variant="outline"
            size="sm"
            className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
          >
            {isSendingReporte ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />} Enviar correo
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={filasEnviablesSap.length === 0 || isSendingSap}
            onClick={() => setIsSapDialogOpen(true)}
            className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
          >
            {isSendingSap ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {isSendingSap ? `Enviando ${sapProgress.enviadas}/${sapProgress.total}...` : 'Enviar a SAP'}
          </Button>
        </div>
      </div>

      {/* El botón deshabilitado usa pointer-events-none, así que su "title" nunca se ve en hover —
          este texto es la única forma de saber por qué sigue bloqueado. */}
      {filasEnviablesSap.length === 0 && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {sapDiagnostico.total === 0
            ? 'No hay filas para enviar a SAP: "Plan Final" no tiene registros para el Día programación actual (revisa la pestaña Plan Final / Prog Tiempos).'
            : `No hay filas enviables a SAP de ${sapDiagnostico.total} en Plan Final: ${sapDiagnostico.yaConOrdFab} ya tienen OrdFab asignado, ${sapDiagnostico.sinMaterialOCantidad} sin Material/Cantidad válidos.`}
        </p>
      )}

      <Dialog open={isSapDialogOpen} onOpenChange={(open) => { if (!isSendingSap) setIsSapDialogOpen(open); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-red-700">Confirmar envío a SAP</DialogTitle>
            <DialogDescription>
              Se crearán <span className="font-bold text-slate-800">{filasEnviablesSap.length}</span> orden(es) de producción reales en SAP
              (Clase Orden {[...new Set(filasEnviablesSap.map(r => CLASE_ORDEN_POR_CENTRO[r.centro]))].join(' / ')}), para la fecha{' '}
              <span className="font-bold text-slate-800">{diaProgramacion || '—'}</span>. Revisa el detalle antes de confirmar — esta acción no se puede deshacer desde aquí.
            </DialogDescription>
          </DialogHeader>

          {ignorarOrdFab && (
            <p className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 -mt-2">
              "Ignorar OrdFab (temporal)" está activo: se pueden reenviar materiales que YA tienen una orden de fabricación, duplicándola en SAP.
            </p>
          )}

          {planFinalRows.length !== filasEnviablesSap.length && (
            <p className="text-[11px] text-amber-600 -mt-2">
              {planFinalRows.length - filasEnviablesSap.length} fila(s) de Plan Final se omiten (sin Material/Cantidad válidos, o ya tienen OrdFab asignado).
            </p>
          )}

          <div className="flex-1 overflow-auto border rounded-lg">
            <table className="min-w-full text-xs border-collapse">
              <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-600 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Centro</th>
                  <th className="px-3 py-2 text-left border-b">Línea</th>
                  <th className="px-3 py-2 text-left border-b">Puesto Trabajo (ref.)</th>
                  <th className="px-3 py-2 text-left border-b">Material</th>
                  <th className="px-3 py-2 text-right border-b bg-indigo-50/30 text-indigo-700">Cantidad</th>
                  <th className="px-3 py-2 text-left border-b bg-red-50/30 text-red-700">Clase Orden</th>
                  <th className="px-3 py-2 text-left border-b">Cod. Orden Externa</th>
                  <th className="px-3 py-2 text-left border-b">Fecha/Hora Inicio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filasEnviablesSap.map((row, idx) => (
                  <tr key={`${row.codigoDetalleTactico}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-bold text-gray-700">{row.centro}</td>
                    <td className="px-3 py-2 text-gray-500">{row.linea}</td>
                    <td className="px-3 py-2 text-gray-700">{row.puestoTrabajo}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">{row.codigoMaterial}</td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-700 font-mono">{row.cantidad.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono font-bold text-red-700">{CLASE_ORDEN_POR_CENTRO[row.centro] || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{row.codigoDetalleTactico}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{String(diaProgramacion || '').replace(/-/g, '')} {HORA_INICIO_DEFAULT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" disabled={isSendingSap} onClick={() => setIsSapDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarSap}
              disabled={isSendingSap}
              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest h-9"
            >
              {isSendingSap ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {isSendingSap ? `Enviando ${sapProgress.enviadas}/${sapProgress.total}...` : 'Confirmar Envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={selectedCenter} onValueChange={setSelectedCenter} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          {CENTROS.map(center => (
            <TabsTrigger key={center} value={center} className="px-6 py-2 text-xs font-bold uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              Centro {center}
            </TabsTrigger>
          ))}
        </TabsList>

        {CENTROS.map(center => {
          const rows = rowsByCenter[center];
          return (
            <TabsContent key={center} value={center}>
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border-collapse">
                    <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left border">Linea</th>
                        <th className="px-4 py-3 text-left border">Puesto Trabajo</th>
                        <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/30">Total cantidad</th>
                        <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/50">Puestos T1</th>
                        <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/50">Puestos T2</th>
                        <th className="px-4 py-3 text-right border text-violet-700 bg-violet-50/30">% ocupación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length > 0 ? rows.map((row, index) => (
                        <tr key={`${row.linea}-${row.puesto}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-gray-700 border">{row.linea}</td>
                          <td className="px-4 py-2.5 text-gray-600 border">{row.puesto}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-indigo-700 border font-mono">{row.totalCantidad.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-indigo-700 border font-mono">{row.puestosT1}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-indigo-700 border font-mono">{row.puestosT2}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-violet-700 border font-mono">{row.ocupacion.toFixed(1)}%</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Cargando datos de Rev Capacidad...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};
