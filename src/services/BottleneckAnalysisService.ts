
/**
 * BottleneckAnalysisService
 * 
 * Servicio centralizado para agrupación y análisis.
 * Corregido para preservar el stock máximo en agregaciones de Clase F.
 */

import type { TiempoCanonResult, TransferNeed, BottleneckDataRow } from '@/app/dashboard/opciones/importar-ventasV2/components/types';
import { normalizeMaterialCode } from '@/app/dashboard/opciones/importar-ventasV2/components/utils';

export interface Center2000Analysis {
  filteredData: BottleneckDataRow[];
  dataEX: BottleneckDataRow[];
  dataF: BottleneckDataRow[];
  transferNeedsEX: TransferNeed[];
  transferNeedsF: TransferNeed[];
  transferNeedsConsolidated: TransferNeed[];
  computedDataEX: BottleneckDataRow[];
}

export interface Center1000Analysis {
  filteredData: BottleneckDataRow[];
  datosEnriquecidos: BottleneckDataRow[];
  transferNeeds: TransferNeed[];
  computedData: BottleneckDataRow[];
  exportSheet: BottleneckDataRow[];
}

class BottleneckAnalysisService {
  private static instance: BottleneckAnalysisService;
  private cache: { center2000: Center2000Analysis | null; center1000: Center1000Analysis | null; lastDataSignature: string } = {
    center2000: null,
    center1000: null,
    lastDataSignature: ''
  };

  private constructor() {}

  public static getInstance(): BottleneckAnalysisService {
    if (!BottleneckAnalysisService.instance) {
      BottleneckAnalysisService.instance = new BottleneckAnalysisService();
    }
    return BottleneckAnalysisService.instance;
  }

  private generateDataSignature(data: BottleneckDataRow[]): string {
    return `${data.length}_${data[0]?.CodMaterial || 'empty'}`;
  }

  private isCacheValid(data: BottleneckDataRow[]): boolean {
    const signature = this.generateDataSignature(data);
    return this.cache.lastDataSignature === signature;
  }

  private safeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public analyzeCenter2000(data: BottleneckDataRow[], tiemposCanon: TiempoCanonResult[]): Center2000Analysis {
    if (!this.isCacheValid(data)) this.clearCache();
    if (this.cache.center2000) return this.cache.center2000;

    const filteredData = data.filter(row => String(row.Centro || '').trim() === '2000');

    // AGRUPACIÓN POR MATERIAL PARA EVITAR DUPLICADOS
    const porMaterial = new Map<string, BottleneckDataRow>();
    filteredData.forEach(row => {
      const code = normalizeMaterialCode(row.CodMaterial ?? '');
      const mes = String(row.Mes);
      const key = `${code}|${mes}`;

      if (!porMaterial.has(key)) {
        porMaterial.set(key, { ...row, UnidadesProyectado: 0, StockActual: 0, StockSeguridad: 0 });
      }
      const agg = porMaterial.get(key)!;
      agg.UnidadesProyectado = this.safeNumber(agg.UnidadesProyectado) + this.safeNumber(row.UnidadesProyectado);
      agg.StockActual = Math.max(this.safeNumber(agg.StockActual), this.safeNumber(row.StockActual));
      agg.StockSeguridad = Math.max(this.safeNumber(agg.StockSeguridad), this.safeNumber(row.StockSeguridad));
    });

    const dataEX: BottleneckDataRow[] = [];
    const dataF: BottleneckDataRow[] = [];
    const transferNeedsF: TransferNeed[] = [];

    porMaterial.forEach(row => {
      const clase = String(row.ClaseAprovisionam || '').trim().toUpperCase();
      if (clase === 'E' || clase === 'X') {
        dataEX.push(row);
      } else if (clase === 'F') {
        dataF.push(row);
        const up = this.safeNumber(row.UnidadesProyectado);
        const sa = this.safeNumber(row.StockActual);
        const ss = this.safeNumber(row.StockSeguridad);
        const nec = Math.max(0, up - sa + ss);
        if (nec > 0) {
          transferNeedsF.push({
            CodMaterial: normalizeMaterialCode(row.CodMaterial ?? ''),
            mes: String(row.Mes ?? ''),
            necesidadTraslado: nec
          });
        }
      }
    });

    const result: Center2000Analysis = {
      filteredData: Array.from(porMaterial.values()),
      dataEX,
      dataF,
      transferNeedsEX: [],
      transferNeedsF,
      transferNeedsConsolidated: [...transferNeedsF],
      computedDataEX: []
    };

    this.cache.center2000 = result;
    this.cache.lastDataSignature = this.generateDataSignature(data);
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public analyzeCenter1000(data: BottleneckDataRow[], tiemposCanon: TiempoCanonResult[], traslados: TransferNeed[]): Center1000Analysis {
    if (!this.isCacheValid(data)) this.clearCache();
    if (this.cache.center1000) return this.cache.center1000;

    const filteredData = data.filter(row => {
      const cFab = String(row.CentroFabricacion || '').trim();
      const cDem = String(row.Centro || '').trim();
      // Centro 1000 debe evaluar su propia demanda (centro demandante 1000).
      // La demanda de centro 2000 que fabrica en 1000 entra por la vía de traslados.
      return cDem === '1000' || (cDem === '' && cFab === '1000');
    });

    // AGRUPACIÓN POR MATERIAL
    const porMaterial = new Map<string, BottleneckDataRow>();
    filteredData.forEach(row => {
      const code = normalizeMaterialCode(row.CodMaterial ?? '');
      const mes = String(row.Mes);
      const key = `${code}|${mes}`;

      if (!porMaterial.has(key)) {
        porMaterial.set(key, { ...row, UnidadesProyectado: 0, StockActual: 0, StockSeguridad: 0 });
      }
      const agg = porMaterial.get(key)!;
      agg.UnidadesProyectado = this.safeNumber(agg.UnidadesProyectado) + this.safeNumber(row.UnidadesProyectado);
      agg.StockActual = Math.max(this.safeNumber(agg.StockActual), this.safeNumber(row.StockActual));
      agg.StockSeguridad = Math.max(this.safeNumber(agg.StockSeguridad), this.safeNumber(row.StockSeguridad));
    });

    const result: Center1000Analysis = {
      filteredData: Array.from(porMaterial.values()),
      datosEnriquecidos: [],
      transferNeeds: [],
      computedData: [],
      exportSheet: []
    };

    this.cache.center1000 = result;
    this.cache.lastDataSignature = this.generateDataSignature(data);
    return result;
  }

  public clearCache(): void {
    this.cache = { center2000: null, center1000: null, lastDataSignature: '' };
  }
}

export const bottleneckAnalysisService = BottleneckAnalysisService.getInstance();
