// Constantes utilizadas en los componentes de importar-ventasV2

export const MONTH_NUMBERS: { [key: string]: number } = {
  'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
  'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
};

export const MONTH_NAMES: { [key: number]: string } = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

export const VISIBLE_COLUMNS = [
  'Mes', 'CodMaterial', 'Centro', 'CentroFabricacion', 'RespCtrlProd', 
  'ClaseAprovisionam', 'UnidadesProyectado', 'StockActual', 'StockSeguridad', 
  'Sector', 'LineaFabricacion'
];
