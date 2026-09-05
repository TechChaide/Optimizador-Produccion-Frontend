"use client";

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { materialesBalanceoService } from '@/services/materialesBalanceo.service';
import type { Grupo } from '@/types/interfaces';

interface MaterialesBalanceoCargaMasivaModalProps {
  grupo: Grupo | null;
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface FilaImportada {
  fila: number;
  codigo_material: number;
  porc_minimo_balanceo: number;
  porc_maximo_balanceo: number;
  prioridad: number;
  estado: string;
  error?: string;
}

const formatDateForSQLServer = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

const TEMPLATE_HEADERS = ['Codigo Material', 'Porc Minimo', 'Porc Maximo', 'Prioridad', 'Estado'];

function parseRows(rawRows: any[]): FilaImportada[] {
  return rawRows.map((row, idx) => {
    const codigo_material = Number(row['Codigo Material'] ?? row['codigo_material']);
    const porc_minimo_balanceo = Number(row['Porc Minimo'] ?? row['porc_minimo_balanceo'] ?? 0);
    const porc_maximo_balanceo = Number(row['Porc Maximo'] ?? row['porc_maximo_balanceo'] ?? 0);
    const prioridad = Number(row['Prioridad'] ?? row['prioridad'] ?? 1);
    const estadoRaw = String(row['Estado'] ?? row['estado'] ?? 'A').trim().toUpperCase();
    const estado = estadoRaw.startsWith('A') ? 'A' : 'I';

    let error: string | undefined;
    if (!codigo_material || Number.isNaN(codigo_material)) {
      error = 'Código de material inválido.';
    } else if (Number.isNaN(porc_minimo_balanceo) || Number.isNaN(porc_maximo_balanceo)) {
      error = 'Porcentajes inválidos.';
    } else if (porc_minimo_balanceo > porc_maximo_balanceo) {
      error = 'El % mínimo no puede ser mayor al % máximo.';
    }

    return {
      fila: idx + 2,
      codigo_material,
      porc_minimo_balanceo,
      porc_maximo_balanceo,
      prioridad: Number.isNaN(prioridad) ? 1 : prioridad,
      estado,
      error,
    };
  });
}

export default function MaterialesBalanceoCargaMasivaModal({
  grupo,
  isOpen,
  onClose,
  onImported,
}: Readonly<MaterialesBalanceoCargaMasivaModalProps>) {
  const [filas, setFilas] = useState<FilaImportada[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const user = globalThis.window
    ? JSON.parse(globalThis.window.localStorage.getItem('user') || '{}')
    : {};

  const resetState = () => {
    setFilas([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      [20007201, 0, 100, 1, 'A'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiales Balanceo');
    XLSX.writeFile(wb, 'Plantilla_Materiales_Balanceo.xlsx');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
      const parsed = parseRows(rawRows);
      setFilas(parsed);

      if (parsed.length === 0) {
        toast({ title: 'Archivo vacío', description: 'No se encontraron filas para importar.', variant: 'destructive' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
      toast({ title: 'Error al leer archivo', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsReadingFile(false);
    }
  };

  const filasValidas = filas.filter((f) => !f.error);
  const filasConError = filas.filter((f) => f.error);

  const handleImportar = async () => {
    if (!grupo || filasValidas.length === 0) return;
    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const fila of filasValidas) {
      try {
        const data: any = {
          codigo_grupo: grupo.codigo_grupo,
          codigo_material: fila.codigo_material,
          porc_minimo_balanceo: fila.porc_minimo_balanceo,
          porc_maximo_balanceo: fila.porc_maximo_balanceo,
          prioridad: fila.prioridad,
          estado: fila.estado,
          usuario_modificacion: user?.name || 'admin',
          fecha_modificacion: formatDateForSQLServer(new Date()),
        };
        await materialesBalanceoService.save(data);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsProcessing(false);
    toast({
      title: failCount === 0 ? 'Éxito' : 'Importación parcial',
      description: `${successCount} material(es) importado(s) correctamente${failCount > 0 ? `, ${failCount} con error.` : '.'}`,
      variant: failCount === 0 ? 'default' : 'destructive',
    });

    resetState();
    onImported();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Carga Masiva de Materiales de Balanceo: {grupo?.nombre_grupo}
          </DialogTitle>
          <DialogDescription>Centro: {grupo?.centro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">
              Descargue la plantilla, complete los materiales de balanceo y súbala nuevamente. Columnas esperadas: {TEMPLATE_HEADERS.join(', ')}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate} disabled={isProcessing}>
              <Download className="mr-2 h-4 w-4" />
              Descargar Plantilla
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isReadingFile}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {isReadingFile ? 'Leyendo...' : 'Seleccionar Archivo'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing || isReadingFile}
            />
          </div>

          {filas.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Badge className="bg-green-600">{filasValidas.length} válidas</Badge>
                  {filasConError.length > 0 && (
                    <Badge variant="destructive">{filasConError.length} con error</Badge>
                  )}
                </div>
                <div className="rounded-md border max-h-[40vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fila</TableHead>
                        <TableHead>Código Material</TableHead>
                        <TableHead className="text-center">% Mínimo</TableHead>
                        <TableHead className="text-center">% Máximo</TableHead>
                        <TableHead className="text-center">Prioridad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Validación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filas.map((fila) => (
                        <TableRow key={fila.fila} className={fila.error ? 'bg-red-50' : ''}>
                          <TableCell>{fila.fila}</TableCell>
                          <TableCell className="font-medium">{fila.codigo_material || '-'}</TableCell>
                          <TableCell className="text-center">{fila.porc_minimo_balanceo}%</TableCell>
                          <TableCell className="text-center">{fila.porc_maximo_balanceo}%</TableCell>
                          <TableCell className="text-center">{fila.prioridad}</TableCell>
                          <TableCell>{fila.estado === 'A' ? 'Activo' : 'Inactivo'}</TableCell>
                          <TableCell className="text-red-600 text-xs">{fila.error || 'OK'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleImportar} disabled={isProcessing || filasValidas.length === 0}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              `Importar ${filasValidas.length} material(es)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
