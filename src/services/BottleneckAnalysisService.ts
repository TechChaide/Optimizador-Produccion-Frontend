
/**
 * BottleneckAnalysisService
 * 
 * Servicio centralizado para agrupación y análisis.
 * Corregido para preservar el stock máximo en agregaciones de Clase F.
 */

import { dataStore } from './DataStore';
import type { TiempoCanonResult, TransferNeed } from '@/app/dashboard/opciones/importar-ventasV2/components/types';
import { normalizeMaterialCode } from '@/app/dashboard/opciones/importar-ventasV2/components/utils';

export interface Center2000Analysis {
  filteredData: any[];
  dataEX: any[];
  dataF: any[];
  transferNeedsEX: TransferNeed[];
  transferNeedsF: TransferNeed[];
  transferNeedsConsolidated: TransferNeed[];
  computedDataEX: any[];
}

export interface Center1000Analysis {
  filteredData: any[];
  datosEnriquecidos: any[];
  transferNeeds: TransferNeed[];
  computedData: any[];
  exportSheet: any[];
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

  private generateDataSignature(data: any[]): string {
    return `${data.length}_${data[0]?.CodMaterial || 'empty'}`;
  }

  private isCacheValid(data: any[]): boolean {
    const signature = this.generateDataSignature(data);
    return this.cache.lastDataSignature === signature;
  }

  private safeNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  public analyzeCenter2000(data: any[], tiemposCanon: TiempoCanonResult[]): Center2000Analysis {
    if (!this.isCacheValid(data)) this.clearCache();
    if (this.cache.center2000) return this.cache.center2000;

    const filteredData = data.filter(row => String(row.Centro || '').trim() === '2000');
    
    // AGRUPACIÓN POR MATERIAL PARA EVITAR DUPLICADOS
    const porMaterial = new Map<string, any>();
    filteredData.forEach(row => {
      const code = normalizeMaterialCode(row.CodMaterial);
      const mes = String(row.Mes);
      const key = `${code}|${mes}`;
      
      if (!porMaterial.has(key)) {
        porMaterial.set(key, { ...row, UnidadesProyectado: 0, StockActual: 0, StockSeguridad: 0 });
      }
      const agg = porMaterial.get(key)!;
      agg.UnidadesProyectado += this.safeNumber(row.UnidadesProyectado);
      agg.StockActual = Math.max(agg.StockActual, this.safeNumber(row.StockActual));
      agg.StockSeguridad = Math.max(agg.StockSeguridad, this.safeNumber(row.StockSeguridad));
    });

    const dataEX: any[] = [];
    const dataF: any[] = [];
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

  public analyzeCenter1000(data: any[], tiemposCanon: TiempoCanonResult[], traslados: TransferNeed[]): Center1000Analysis {
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
    const porMaterial = new Map<string, any>();
    filteredData.forEach(row => {
      const code = normalizeMaterialCode(row.CodMaterial);
      const mes = String(row.Mes);
      const key = `${code}|${mes}`;
      
      if (!porMaterial.has(key)) {
        porMaterial.set(key, { ...row, UnidadesProyectado: 0, StockActual: 0, StockSeguridad: 0 });
      }
      const agg = porMaterial.get(key)!;
      agg.UnidadesProyectado += this.safeNumber(row.UnidadesProyectado);
      agg.StockActual = Math.max(agg.StockActual, this.safeNumber(row.StockActual));
      agg.StockSeguridad = Math.max(agg.StockSeguridad, this.safeNumber(row.StockSeguridad));
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
