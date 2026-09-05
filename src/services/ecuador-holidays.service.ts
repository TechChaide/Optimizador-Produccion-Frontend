// Servicio para integrar feriados de Ecuador
// Utiliza la API pública de feriados

interface Holiday {
  date: string;
  name: string;
  type: string;
}

export const ecuadorHolidaysService = {
  /**
   * Obtiene los feriados de Ecuador para un año específico
   * Utiliza API pública de feriados ecuatorianos
   */
  async getHolidaysForYear(year: number): Promise<Holiday[]> {
    try {
      // API pública de feriados de Ecuador
      // https://www.feriados.com.ec/ o similar
      // Para este ejemplo, usaremos una API pública conocida
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/EC`);
      
      if (!response.ok) {
        throw new Error('No se pudieron obtener los feriados');
      }
      
      const data = await response.json();

      // La API de Nager.Date devuelve `localName` (nombre en idioma local)
      // y `name` (nombre en inglés). Preferimos `localName` para mostrar
      // los feriados en español cuando esté disponible.
      return data.map((holiday: any) => ({
        date: holiday.date,
        name: holiday.localName || holiday.name,
        type: 'feriado',
      }));
    } catch (error) {
      console.error('Error al obtener feriados de Ecuador:', error);
      return getDefaultEcuadorHolidays(year);
    }
  },

  /**
   * Obtiene los feriados de Ecuador para un rango de fechas
   */
  async getHolidaysForRange(startDate: Date, endDate: Date): Promise<Holiday[]> {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    
    const allHolidays: Holiday[] = [];
    
    for (const year of years) {
      const holidays = await this.getHolidaysForYear(year);
      allHolidays.push(...holidays);
    }
    
    // Filtrar por rango de fechas
    return allHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= startDate && holidayDate <= endDate;
    });
  }
};

/**
 * Feriados fijos de Ecuador (como fallback)
 * Incluye feriados fijos e incluye una función para calcular feriados móviles
 */
function getDefaultEcuadorHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [
    // Feriados fijos
    { date: `${year}-01-01`, name: 'Año Nuevo', type: 'feriado' },
    { date: `${year}-05-01`, name: 'Día del Trabajo', type: 'feriado' },
    { date: `${year}-07-24`, name: 'Natalicio de Simón Bolívar', type: 'feriado' },
    { date: `${year}-08-10`, name: 'Independencia de Guayaquil', type: 'feriado' },
    { date: `${year}-10-09`, name: 'Independencia de Cuenca', type: 'feriado' },
    { date: `${year}-10-12`, name: 'Colón descubre América', type: 'feriado' },
    { date: `${year}-11-01`, name: 'Día de Difuntos', type: 'feriado' },
    { date: `${year}-11-11`, name: 'Independencia de Latacunga', type: 'feriado' },
    { date: `${year}-12-06`, name: 'Fundación de Quito', type: 'feriado' },
    { date: `${year}-12-25`, name: 'Navidad', type: 'feriado' },
    
    // Feriados móviles - Carnaval (viernes y sábado antes del miércoles de ceniza)
    ...getCarnavalDates(year),
    
    // Feriados móviles - Pascua (viernes santo, domingo de resurrección)
    ...getPascuaDates(year),
  ];
  
  return holidays;
}

/**
 * Calcula las fechas de Carnaval (viernes y sábado antes del miércoles de ceniza)
 */
function getCarnavalDates(year: number): Holiday[] {
  const { month: easterMonth, day: easterDay } = getEasterDateComponents(year);
  
  // Crear fecha de Pascua y restar 49 días
  const easterDate = new Date(year, easterMonth - 1, easterDay);
  const carnavalSaturday = new Date(easterDate);
  carnavalSaturday.setDate(carnavalSaturday.getDate() - 49);
  
  const carnavalFriday = new Date(carnavalSaturday);
  carnavalFriday.setDate(carnavalFriday.getDate() - 1);
  
  return [
    { 
      date: formatDateToUTC(carnavalFriday), 
      name: 'Carnaval (Viernes)', 
      type: 'feriado' 
    },
    { 
      date: formatDateToUTC(carnavalSaturday), 
      name: 'Carnaval (Sábado)', 
      type: 'feriado' 
    },
  ];
}

/**
 * Calcula las fechas de Pascua (Viernes Santo, Domingo de Resurrección)
 */
function getPascuaDates(year: number): Holiday[] {
  const { month: easterMonth, day: easterDay } = getEasterDateComponents(year);
  
  const easterDate = new Date(year, easterMonth - 1, easterDay);
  
  const vierneSanto = new Date(easterDate);
  vierneSanto.setDate(vierneSanto.getDate() - 2);
  
  const sabadoDeGloria = new Date(easterDate);
  sabadoDeGloria.setDate(sabadoDeGloria.getDate() - 1);
  
  return [
    { 
      date: formatDateToUTC(vierneSanto), 
      name: 'Viernes Santo', 
      type: 'feriado' 
    },
    { 
      date: formatDateToUTC(sabadoDeGloria), 
      name: 'Sábado de Gloria', 
      type: 'feriado' 
    },
  ];
}

/**
 * Formatea una Date a string YYYY-MM-DD usando UTC para evitar problemas de timezone
 */
function formatDateToUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Algoritmo de Computus para calcular la fecha de Pascua
 * Devuelve mes y día como números
 */
function getEasterDateComponents(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return { month, day };
}

/**
 * Algoritmo de Computus para calcular la fecha de Pascua
 * (Domingo de Resurrección)
 */
function getEasterDate(year: number): Date {
  const { month, day } = getEasterDateComponents(year);
  return new Date(year, month - 1, day);
}
