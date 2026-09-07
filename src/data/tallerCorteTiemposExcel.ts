// Archivo generado a partir de 'C:\Proyectos\KPI-TC\KPI-TC-Temp.xlsx' (hoja 'KPIMaestroTallerCostura'),
// entregado por el usuario el 2026-08-18 como fuente TEMPORAL de tiempos unitarios de cosido del Taller
// de Corte, mientras TI lo integra al backend (ver TacticalPlanTallerCorteSection.tsx). La columna
// "Tiempo" del Excel viene en SEGUNDOS por unidad; aquí ya se convirtió a MINUTOS (tiempoMin = segundos
// / 60). Para actualizar: pedir un nuevo Excel y volver a generar este archivo (mismo formato de
// columnas: CodMaterial, Material, Categoria, GrupoMaterial, Tela, ColorTela, Tiempo).

export interface TallerCorteTiempoExcel {
    codigo: string;
    descripcion: string;
    tiempoMin: number;
}

export const TALLER_CORTE_TIEMPOS_EXCEL: TallerCorteTiempoExcel[] = [
  {
    "codigo": "20005789",
    "descripcion": "FORRO COJIN FLANIGAN HIBISCUS 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20005792",
    "descripcion": "FORRO COJIN FLANIGAN MERLOT 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20005799",
    "descripcion": "FORRO COJIN ARGO AZUL 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20005803",
    "descripcion": "FORRO COJIN ARGO TURQUEZA 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20006956",
    "descripcion": "ANTIFAZ DE DESCANSO ROSA",
    "tiempoMin": 1.64
  },
  {
    "codigo": "20006959",
    "descripcion": "ANTIFAZ DE DESCANSO AQCUA MARINA",
    "tiempoMin": 1.64
  },
  {
    "codigo": "20006960",
    "descripcion": "ANTIFAZ DE DESCANSO AZUL",
    "tiempoMin": 1.64
  },
  {
    "codigo": "20006961",
    "descripcion": "ANTIFAZ DE DESCANSO GRIS",
    "tiempoMin": 1.64
  },
  {
    "codigo": "20006962",
    "descripcion": "ANTIFAZ DE DESCANSO NEGRO",
    "tiempoMin": 1.64
  },
  {
    "codigo": "20009267",
    "descripcion": "FORRO COJIN VINTAGE NEGRO 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009271",
    "descripcion": "FORRO COJIN VINTAGE HUMO 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009275",
    "descripcion": "FORRO COJIN EPIC OC_ANO 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009277",
    "descripcion": "FORRO COJIN  EPIC TIERRA 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009279",
    "descripcion": "FORRO COJIN EPIC ARENA 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009281",
    "descripcion": "FORRO COJIN EPIC BRUMA 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009283",
    "descripcion": "FORRO COJIN EPIC OTO_209_O 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009287",
    "descripcion": "FORRO COJIN STONE COBRE 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009289",
    "descripcion": "FORRO COJIN STONE PLATA 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009294",
    "descripcion": "FORRO COJIN STONE MARMOL 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20009850",
    "descripcion": "FORRO COJIN ARGO TERRACOTA 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20010500",
    "descripcion": "ANTIFAZ DE DESCANSO MASTEPACK X 12",
    "tiempoMin": 1.64
  },
  {
    "codigo": "20011028",
    "descripcion": "FORRO COJIN VINTAGE BEIGE 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "20011029",
    "descripcion": "FORRO COJIN EPIC BEIGE 45X45",
    "tiempoMin": 5
  },
  {
    "codigo": "30001929",
    "descripcion": "FORRO FOAM 070 TELA PROPIA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30005842",
    "descripcion": "FORRO BENCH MARROQN BEIGE 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30005849",
    "descripcion": "FORRO CAB CAPRI 115X50 TAPIZ BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005850",
    "descripcion": "FORRO CAB CAPRI 115X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005851",
    "descripcion": "FORRO CAB CAPRI 115X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005854",
    "descripcion": "FORRO CAB CAPRI 115X050X008 MARROQ CF",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005859",
    "descripcion": "FORRO CAB CAPRI TAPIZ BEIGE 145X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005860",
    "descripcion": "FORRO CAB CAPRI 145X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005861",
    "descripcion": "FORRO CAB CAPRI 145X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005862",
    "descripcion": "FORRO CAB CAPRI 145X050X008 MARROQ BG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005863",
    "descripcion": "FORRO CAB CAPRI 145X050X008 MARROQ CF",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005869",
    "descripcion": "FORRO CAB CAPRI MARROQUI NEGRO 145X050",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005878",
    "descripcion": "FORRO CAB CAPRI TAPIZ BEIGE 170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005879",
    "descripcion": "FORRO CAB CAPRI 170X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005880",
    "descripcion": "FORRO CAB CAPRI 170X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005881",
    "descripcion": "FORRO CAB CAPRI 170X050X008 MARROQ BG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005882",
    "descripcion": "FORRO CAB CAPRI 170X050X008 MARROQ CF",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005887",
    "descripcion": "FORRO CAB CAPRI MARROQUI NEGRO 170X050",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005894",
    "descripcion": "FORRO CAB CAPRI 210X50 TAPIZ BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005895",
    "descripcion": "FORRO CAB CAPRI TAPIZ CHOCO 210X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005896",
    "descripcion": "FORRO CAB CAPRI 210X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005897",
    "descripcion": "FORRO CAB CAPRI 210X050X008 MARROQ BG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005915",
    "descripcion": "FORRO CAMA FLOREN MARROQ BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005916",
    "descripcion": "FORRO CAMA FLOREN MARROQ BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005919",
    "descripcion": "FORRO CAMA FLOREN MARROQ CAFE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005921",
    "descripcion": "FORRO CAMA FLOREN MARROQ CAFE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005949",
    "descripcion": "FORRO CAMA FLOREN MARROQUI NEGRO 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005953",
    "descripcion": "FORRO CAMA VERONA MARROQ BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005954",
    "descripcion": "FORRO CAMA VERONA MARROQ BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005955",
    "descripcion": "FORRO CAMA VERONA MARROQ BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005958",
    "descripcion": "FORRO CAMA VERONA MARROQ CAFE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30005985",
    "descripcion": "FORRO OTTOMAN AEGEAN 70X50X45",
    "tiempoMin": 30
  },
  {
    "codigo": "30005988",
    "descripcion": "FORRO OTTOMAN TAPIZ GRIS 70X50X45",
    "tiempoMin": 30
  },
  {
    "codigo": "30005990",
    "descripcion": "FORRO OTTOMAN 70 DESERT",
    "tiempoMin": 30
  },
  {
    "codigo": "30005991",
    "descripcion": "FORRO OTTOMAN 70 DRACCO CAPUCCINO",
    "tiempoMin": 30
  },
  {
    "codigo": "30005992",
    "descripcion": "FORRO OTTOMAN MARROQ BEIGE 70X50X45",
    "tiempoMin": 30
  },
  {
    "codigo": "30006002",
    "descripcion": "FORRO OTTOMAN 70 SUNSET",
    "tiempoMin": 30
  },
  {
    "codigo": "30006003",
    "descripcion": "FORRO FOAM 105 TAPIZ MARFIL",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30006004",
    "descripcion": "FORRO FOAM 135 TAPIZ MARFIL",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30006005",
    "descripcion": "FORRO FOAM 070 TAPIZ MARFIL",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30006006",
    "descripcion": "FORRO FOAM 105 TAPIZ VERDE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30006007",
    "descripcion": "FORRO FOAM 135 TAPIZ VERDE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30006008",
    "descripcion": "FORRO FOAM 070 TAPIZ VERDE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30006029",
    "descripcion": "FORRO MALIBU 105 TAPIZ VERDE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30006030",
    "descripcion": "FORRO MALIBU 135 TAPIZ VERDE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30006041",
    "descripcion": "FORRO SOFA MALIBU SULTRY ARENA 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30006050",
    "descripcion": "FORRO SOFA MANCHESTER MARROQ BEIGE 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30006058",
    "descripcion": "FORRO SOFA MATISSE MARROQ BEIGE 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006076",
    "descripcion": "FORRO MILANO 105 TAPIZ MARFIL",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30006078",
    "descripcion": "FORRO MILANO 105 TAPIZ VERDE",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30006093",
    "descripcion": "FORRO SPRING 105 TAPIZ MARFIL",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006095",
    "descripcion": "FORRO SPRING 105 TAPIZ VERDE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006096",
    "descripcion": "FORRO SPRING 105 DRACCO CAPUCCINO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006098",
    "descripcion": "FORRO SOFA SPRING MARROQ BEIGE 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006099",
    "descripcion": "FORRO SOFA SPRING MARROQ CAFE 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006102",
    "descripcion": "FORRO SPRING 105 PYCCA AZUL",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006103",
    "descripcion": "FORRO SOFA SPRING MENTA 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006106",
    "descripcion": "FORRO SPRING 105 VERANO AEGEAN",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006461",
    "descripcion": "FORRO MIRAGE 105 TAPIZ MARFIL",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30006465",
    "descripcion": "FORRO MIRAGE 105 TAPIZ VERDE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30006466",
    "descripcion": "FORRO SOFA MIRAGE MARROQ BIEGE 105",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30006473",
    "descripcion": "FORRO MIRAGE AEGEAN 135",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30006557",
    "descripcion": "FORRO BENCH 115 CONFIGURABLE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30006558",
    "descripcion": "FORRO OTTOMAN 70 CONFIGURABLE",
    "tiempoMin": 30
  },
  {
    "codigo": "30006559",
    "descripcion": "FORRO FOAM 070 CONFIGURABLE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30006560",
    "descripcion": "FORRO FOAM 105 CONFIGURABLE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30006561",
    "descripcion": "FORRO FOAM 135 CONFIGURABLE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30006562",
    "descripcion": "FORRO MALIBU 105 CONFIGURABLE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30006563",
    "descripcion": "FORRO MALIBU 135 CONFIGURABLE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30006564",
    "descripcion": "FORRO MATISSE 105 CONFIGURABLE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006565",
    "descripcion": "FORRO MILANO 105 CONFIGURABLE",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30006566",
    "descripcion": "FORRO MIRAGE 105 CONFIGURABLE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30006567",
    "descripcion": "FORRO MIRAGE 135 CONFIGURABLE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30006568",
    "descripcion": "FORRO SPRING 105 CONFIGURABLE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006569",
    "descripcion": "FORRO MIAMI 105 CONFIGURABLE",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30006570",
    "descripcion": "FORRO MANCHESTER 105 CONFIGURABLE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30006591",
    "descripcion": "FORRO SOFA MANCHESTER SULTRY ARENA 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30006595",
    "descripcion": "FORRO MIRAGE 135 TAPIZ MARFIL",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30006596",
    "descripcion": "FORRO MIRAGE 135 TAPIZ VERDE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30006600",
    "descripcion": "FORRO SOFA MIRAGE SULTRY ARENA 135",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30006615",
    "descripcion": "FORRO MASCOTAS PERRITO D1 76X48X15",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30006617",
    "descripcion": "FORRO MATISSE AEGEAN 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006621",
    "descripcion": "FORRO MATISSE 105 TAPIZ MARFIL",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006625",
    "descripcion": "FORRO SOFA MATISSE SULTRY ARENA 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006627",
    "descripcion": "FORRO SOFA MATISSE MARROQUI NEGRO 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006628",
    "descripcion": "FORRO MATISSE 105 SUNSET",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30006629",
    "descripcion": "FORRO CAB CAPRI MARROQUI NEGRO 115X050",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006633",
    "descripcion": "FORRO SPRING 105 SUNSET VERANO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006767",
    "descripcion": "FORRO MANCHESTER 105 TAPIZ VERDE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30006790",
    "descripcion": "FORRO SPRING 105 TELA PROPIA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30006793",
    "descripcion": "FORRO CAMA NAPOLES ARGO BEIGE 105",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30006798",
    "descripcion": "FORRO CAMA NAPOLES ARGO BEIGE 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30006803",
    "descripcion": "FORRO CAMA NAPOLES ARGO BEIGE 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30006808",
    "descripcion": "FORRO CAMA NAPOLES ARGO BEIGE 200",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30006813",
    "descripcion": "FORRO CAMA FLOREN 105 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006814",
    "descripcion": "FORRO CAMA FLOREN 135 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006815",
    "descripcion": "FORRO CAMA FLOREN TAPIZ CHOCOLATE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006816",
    "descripcion": "FORRO CAMA FLOREN 200 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006817",
    "descripcion": "FORRO CAMA FLOREN ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006818",
    "descripcion": "FORRO CAMA FLOREN ARGO AZUL  135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006819",
    "descripcion": "FORRO CAMA FLOREN ARGO AZUL  160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006820",
    "descripcion": "FORRO CAMA FLOREN ARGO AZUL 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006821",
    "descripcion": "FORRO CAMA FLOREN ARGO BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006822",
    "descripcion": "FORRO CAMA FLOREN ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006823",
    "descripcion": "FORRO CAMA FLOREN ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006824",
    "descripcion": "FORRO CAMA FLOREN ARGO BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006825",
    "descripcion": "FORRO CAMA VERONA 105 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006826",
    "descripcion": "FORRO CAMA VERONA 135 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006827",
    "descripcion": "FORRO CAMA VERONA 160 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006828",
    "descripcion": "FORRO CAMA VERONA ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006829",
    "descripcion": "FORRO CAMA VERONA ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006830",
    "descripcion": "FORRO CAMA VERONA ARGO AZUL 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006831",
    "descripcion": "FORRO CAMA VERONA 105 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006832",
    "descripcion": "FORRO CAMA VERONA ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006833",
    "descripcion": "FORRO CAMA VERONA ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30006929",
    "descripcion": "FORRO MASCOTAS RAYAS D2 76X48X15",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30007058",
    "descripcion": "FORRO CAMA NAPOLES MARROQUI NEGRO 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30007059",
    "descripcion": "FORRO CAMA NAPOLES MARROQUI NEGRO 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30007095",
    "descripcion": "FORRO MIRAGE 120 CONFIGURABLE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30007256",
    "descripcion": "FORRO CAMA TOSCANA 115 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007258",
    "descripcion": "FORRO CAMA TOSCANA 115 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007260",
    "descripcion": "FORRO CAMA TOSCANA ARGO AZUL 115",
    "tiempoMin": 5.24
  },
  {
    "codigo": "30007293",
    "descripcion": "FORRO CAMA TOSCANA ARGO BEIGE 145",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30007296",
    "descripcion": "FORRO CAMA TOSCANA 145 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007299",
    "descripcion": "FORRO CAMA TOSCANA ARGO AZUL 145",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30007320",
    "descripcion": "FORRO CAMA TOSCANA 170 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007322",
    "descripcion": "FORRO CAMA TOSCANA TAPIZ CHOCOLATE 170",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30007325",
    "descripcion": "FORRO CAMA TOSCANA 170 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007346",
    "descripcion": "FORRO CAMA TOSCANA 210 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007348",
    "descripcion": "FORRO CAMA TOSCANA 210 TAPIZ CHOCOLATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007350",
    "descripcion": "FORRO CAMA TOSCANA 210 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007531",
    "descripcion": "FORRO CAB CAPRI 145X72 TAPIZ BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007532",
    "descripcion": "FORRO CAB CAPRI TAPIZ PLOMO 145X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007533",
    "descripcion": "FORRO CAB CAPRI TAPIZ CHOCO 145X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007534",
    "descripcion": "FORRO CAB CAPRI TAPIZ BEIGE 170X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007535",
    "descripcion": "FORRO CAB CAPRI 170X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007536",
    "descripcion": "FORRO CAB CAPRI TAPIZ CHOCO 170X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007537",
    "descripcion": "FORRO CAB CAPRI TAPIZ BEIGE 210X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007538",
    "descripcion": "FORRO CAB CAPRI 210X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007539",
    "descripcion": "FORRO CAB CAPRI TAPIZ CHOCO 210X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007555",
    "descripcion": "FORRO BENCH 145 TAPIZ VERDE",
    "tiempoMin": 35
  },
  {
    "codigo": "30007556",
    "descripcion": "FORRO BENCH 145 TAPIZ MARFIL",
    "tiempoMin": 35
  },
  {
    "codigo": "30007613",
    "descripcion": "FORRO BUTACA ROMA CONFIGURABLE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30007680",
    "descripcion": "FORRO CAB CAPRI TAPIZ AZUL 115X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007681",
    "descripcion": "FORRO CAB CAPRI TAPIZ CAF CLARO 115X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007682",
    "descripcion": "FORRO CAB CAPRI 145X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007683",
    "descripcion": "FORRO CAB CAPRI 145X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007684",
    "descripcion": "FORRO CAB CAPRI TAPIZ AZUL 170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007685",
    "descripcion": "FORRO CAB CAPRI TAPIZ CAF CLARO 170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007686",
    "descripcion": "FORRO CAB CAPRI 170X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007687",
    "descripcion": "FORRO CAB CAPRI TAPIZ CAF CLARO 170X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007688",
    "descripcion": "FORRO CAB CAPRI TAPIZ AZUL 210X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007689",
    "descripcion": "FORRO CAB CAPRI TAPIZ CAF CLARO 210X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007700",
    "descripcion": "FORRO CAB CAPRI TAPIZ AZUL 210X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007701",
    "descripcion": "FORRO CAB CAPRI 210X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007704",
    "descripcion": "FORRO CAB CAPRI 145X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007705",
    "descripcion": "FORRO CAB CAPRI 145X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30007776",
    "descripcion": "FORRO VELADOR PALERMO TAPIZ VERDE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30007777",
    "descripcion": "FORRO VELADOR PALERMO TAPIZ MARFIL",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30007781",
    "descripcion": "FORRO VELADOR PALERMO TAPIZ BEIGE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30007782",
    "descripcion": "FORRO VELADOR PALERMO MARROQUI NEGRO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30007821",
    "descripcion": "PTBO FORRO OTTOMAN REDONDO TAPIZ CAFE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007823",
    "descripcion": "FORRO OTTOMAN REDONDO TAPIZ VERDE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007824",
    "descripcion": "FORRO OTTOMAN REDONDO TAPIZ MARFIL",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007826",
    "descripcion": "FORRO OTTOMAN REDONDO TAPIZ PLOMO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007827",
    "descripcion": "FORRO OTTOMAN REDONDO TAPIZ CHOCOLATE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007828",
    "descripcion": "FORRO OTTOMAN REDONDO TAPIZ BEIGE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007829",
    "descripcion": "FORRO OTTOMAN REDONDO TAPIZ AEGEAN",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30007852",
    "descripcion": "FORRO BUTACA ROMA TAPIZ VERDE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30007853",
    "descripcion": "FORRO BUTACA ROMA TAPIZ MARFIL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30007857",
    "descripcion": "FORRO BUTACA ROMA TAPIZ AEGEAN",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30008030",
    "descripcion": "FORRO MIAMI 105 TAPIZ MARFIL",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30008175",
    "descripcion": "FORRO BENCH 115 TAPIZ PLOMO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008177",
    "descripcion": "FORRO BENCH 115 TAPIZ BEIGE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008178",
    "descripcion": "FORRO BENCH TAPIZ CHOCOLATE 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008179",
    "descripcion": "FORRO BENCH 145 TAPIZ PLOMO",
    "tiempoMin": 35
  },
  {
    "codigo": "30008180",
    "descripcion": "FORRO BENCH 145 TAPIZ BEIGE",
    "tiempoMin": 35
  },
  {
    "codigo": "30008181",
    "descripcion": "FORRO BENCH 145 TAPIZ CHOCOLATE",
    "tiempoMin": 35
  },
  {
    "codigo": "30008182",
    "descripcion": "FORRO OTTOMAN 70 TAPIZ BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30008183",
    "descripcion": "FORRO OTTOMAN 70 TAPIZ PLOMO",
    "tiempoMin": 30
  },
  {
    "codigo": "30008184",
    "descripcion": "FORRO OTTOMAN 70 TAPIZ CHOCOLATE",
    "tiempoMin": 30
  },
  {
    "codigo": "30008372",
    "descripcion": "TAPA T. FALSO NEGRO BASE DUO A105X190",
    "tiempoMin": 9
  },
  {
    "codigo": "30008373",
    "descripcion": "TAPA T. FALSO NEGRO BASE DUO A135X190",
    "tiempoMin": 11.57
  },
  {
    "codigo": "30008826",
    "descripcion": "TAPA T. FALSO NEGRO BASE DUO A160X200",
    "tiempoMin": 13.72
  },
  {
    "codigo": "30008976",
    "descripcion": "FORRO BENCH FLANIGAN FUDGE 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008977",
    "descripcion": "FORRO BENCH 145 FLANIGAN FUDGE",
    "tiempoMin": 35
  },
  {
    "codigo": "30008979",
    "descripcion": "FORRO BENCH FLANIGAN GRAIN 145X50X45",
    "tiempoMin": 35
  },
  {
    "codigo": "30008980",
    "descripcion": "FORRO BENCH FLANIGAN HIBISCUS 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008981",
    "descripcion": "FORRO BENCH FLANIGAN HIBISCUS 145X50X45",
    "tiempoMin": 35
  },
  {
    "codigo": "30008982",
    "descripcion": "FORRO BENCH FLANIGAN MERLOT 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008983",
    "descripcion": "FORRO BENCH FLANIGAN MERLOT 145X50X45",
    "tiempoMin": 35
  },
  {
    "codigo": "30008986",
    "descripcion": "FORRO BENCH FLANIGAN TANGELO 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008987",
    "descripcion": "FORRO BENCH 145 FLANIGAN TANGELO",
    "tiempoMin": 35
  },
  {
    "codigo": "30008988",
    "descripcion": "FORRO BENCH 115 FLANIGAN TIDEWATER",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008989",
    "descripcion": "FORRO BENCH FLANIGAN TIDEWATER 145X50X45",
    "tiempoMin": 35
  },
  {
    "codigo": "30008994",
    "descripcion": "FORRO BENCH MAYM SILT 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30008995",
    "descripcion": "FORRO BENCH MAYM SILT 145X50X45",
    "tiempoMin": 35
  },
  {
    "codigo": "30008996",
    "descripcion": "FORRO BENCH MAYM STUCCO 115X50X45",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30009001",
    "descripcion": "FORRO BUTACA ROMA FLANIGAN FUDGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30009003",
    "descripcion": "FORRO BUTACA ROMA FLANIGAN HIBISCUS",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30009004",
    "descripcion": "FORRO BUTACA ROMA FLANIGAN MERLOT",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30009006",
    "descripcion": "FORRO BUTACA ROMA FLANIGAN TANGELO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30009007",
    "descripcion": "FORRO BUTACA ROMA FLANIGAN TIDEWATER",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30009010",
    "descripcion": "FORRO BUTACA ROMA MAYM SILT",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30009028",
    "descripcion": "FORRO CAB CAPRI MAYM SILT 145X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009029",
    "descripcion": "FORRO CAB CAPRI MAYM SILT 170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009030",
    "descripcion": "FORRO CAB CAPRI MAYM SILT 210X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009031",
    "descripcion": "FORRO CAB CAPRI MAYM SILT 145X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009035",
    "descripcion": "FORRO CAB CAPRI MAYM STUCCO 145X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009036",
    "descripcion": "FORRO CAB CAPRI MAYM STUCCO 170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009037",
    "descripcion": "FORRO CAB CAPRI MAYM STUCCO 210X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009038",
    "descripcion": "FORRO CAB CAPRI MAYM STUCCO 145X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009039",
    "descripcion": "FORRO CAB CAPRI MAYM STUCCO 170X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009040",
    "descripcion": "FORRO CAB CAPRI MAYM STUCCO 210X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009071",
    "descripcion": "FORRO CAMA FLOREN MAYM SILT 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009072",
    "descripcion": "FORRO CAMA FLOREN MAYM SILT 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009073",
    "descripcion": "PTBO FORRO CAMA FLOREN 160 MAYM SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009074",
    "descripcion": "FORRO CAMA FLOREN MAYM SILT 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009075",
    "descripcion": "FORRO CAMA FLOREN MAYM STUCCO 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009076",
    "descripcion": "FORRO CAMA FLOREN MAYM STUCCO 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009077",
    "descripcion": "FORRO CAMA FLOREN MAYM STUCCO 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009078",
    "descripcion": "FORRO CAMA FLOREN MAYM STUCCO 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009081",
    "descripcion": "FORRO CAMA FLOREN MAYM TWILIGHT 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009092",
    "descripcion": "FORRO CAMA NAPOLES MAYM SILT 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30009093",
    "descripcion": "FORRO CAMA NAPOLES MAYM SILT 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30009095",
    "descripcion": "FORRO CAMA NAPOLES MAYM STUCCO 105",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30009096",
    "descripcion": "FORRO CAMA NAPOLES MAYM STUCCO 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30009097",
    "descripcion": "FORRO CAMA NAPOLES MAYM STUCCO 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30009098",
    "descripcion": "FORRO CAMA NAPOLES MAYM STUCCO 200",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30009112",
    "descripcion": "FORRO CAMA TOSCANA MAYM SILT 145",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30009114",
    "descripcion": "FORRO CAMA TOSCANA MAYM SILT 210",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30009116",
    "descripcion": "FORRO CAMA TOSCANA MAYM STUCCO 145",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30009117",
    "descripcion": "FORRO CAMA TOSCANA MAYM STUCCO 170",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30009118",
    "descripcion": "FORRO CAMA TOSCANA MAYM STUCCO 210",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30009129",
    "descripcion": "FORRO CAMA VERONA MAYM SILT 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009130",
    "descripcion": "FORRO CAMA VERONA MAYM SILT 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009131",
    "descripcion": "FORRO CAMA VERONA MAYM SILT 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009133",
    "descripcion": "FORRO CAMA VERONA MAYM STUCCO 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009134",
    "descripcion": "FORRO CAMA VERONA MAYM STUCCO 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30009141",
    "descripcion": "FORRO FOAM LYRICAL CHARCOAL 070",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30009142",
    "descripcion": "FORRO FOAM LYRICAL CHARCOAL 105",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30009143",
    "descripcion": "FORRO FOAM LYRICAL CHARCOAL 135",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30009147",
    "descripcion": "FORRO FOAM LYRICAL SIERRA 070",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30009148",
    "descripcion": "FORRO FOAM 105 LYRICAL SIERRA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30009149",
    "descripcion": "FORRO FOAM LYRICAL SIERRA 135",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30009153",
    "descripcion": "FORRO MALIBU 105 MENTA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009155",
    "descripcion": "FORRO MALIBU FLANIGAN FUDGE 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009156",
    "descripcion": "FORRO MALIBU FLANIGAN FUDGE 135",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009157",
    "descripcion": "FORRO MALIBU FLANIGAN GRAIN 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009159",
    "descripcion": "FORRO MALIBU FLANIGAN HIBISCUS 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009160",
    "descripcion": "FORRO MALIBU FLANIGAN HIBISCUS 135",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009161",
    "descripcion": "FORRO MALIBU FLANIGAN MERLOT 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009162",
    "descripcion": "FORRO MALIBU FLANIGAN MERLOT 135",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009165",
    "descripcion": "FORRO MALIBU FLANIGAN TANGELO 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009166",
    "descripcion": "FORRO MALIBU FLANIGAN TANGELO 135",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009167",
    "descripcion": "FORRO MALIBU FLANIGAN TIDEWATER 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009168",
    "descripcion": "FORRO MALIBU 135 FLANIGAN TIDEWATER",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009173",
    "descripcion": "FORRO MALIBU MAYM SILT 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009174",
    "descripcion": "FORRO MALIBU MAYM SILT 135",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009175",
    "descripcion": "FORRO MALIBU MAYM STUCCO 105",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30009176",
    "descripcion": "FORRO MALIBU MAYM STUCCO 135",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30009180",
    "descripcion": "FORRO MANCHESTER FLANIGAN FUDGE 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009182",
    "descripcion": "FORRO MANCHESTER 105 FLANIGAN HIBISCUS",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009183",
    "descripcion": "FORRO MANCHESTER FLANIGAN MERLOT 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009185",
    "descripcion": "FORRO MANCHESTER FLANIGAN TANGELO 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009186",
    "descripcion": "FORRO MANCHESTER 105 FLANIGAN TIDEWATER",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009189",
    "descripcion": "FORRO MANCHESTER MAYM SILT 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009190",
    "descripcion": "FORRO MANCHESTER MAYM STUCCO 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30009193",
    "descripcion": "FORRO MATISSE FLANIGAN FUDGE 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009195",
    "descripcion": "FORRO MATISSE FLANIGAN HIBISCUS 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009196",
    "descripcion": "FORRO MATISSE FLANIGAN MERLOT 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009198",
    "descripcion": "FORRO MATISSE FLANIGAN TANGELO 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009199",
    "descripcion": "FORRO MATISSE FLANIGAN TIDEWATER 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009201",
    "descripcion": "FORRO MATISSE 105 MENTA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009202",
    "descripcion": "FORRO MATISSE MAYM SILT 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009203",
    "descripcion": "FORRO MATISSE MAYM STUCCO 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30009206",
    "descripcion": "FORRO MIAMI FLANIGAN FUDGE 105",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009207",
    "descripcion": "FORRO MIAMI FLANIGAN GRAIN 105",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009208",
    "descripcion": "FORRO MIAMI FLANIGAN HIBISCUS 105",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009209",
    "descripcion": "FORRO MIAMI 105 FLANIGAN MERLOT",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009211",
    "descripcion": "FORRO MIAMI FLANIGAN TANGELO 105",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009212",
    "descripcion": "FORRO MIAMI 105 FLANIGAN TIDEWATER",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009215",
    "descripcion": "FORRO MIAMI MAYM SILT 105",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30009219",
    "descripcion": "FORRO MILANO FLANIGAN FUDGE 105",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30009221",
    "descripcion": "FORRO MILANO FLANIGAN HIBISCUS 105",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30009222",
    "descripcion": "FORRO MILANO FLANIGAN MERLOT 105",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30009224",
    "descripcion": "FORRO MILANO FLANIGAN TANGELO 105",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30009225",
    "descripcion": "FORRO MILANO 105 FLANIGAN TIDEWATER",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30009228",
    "descripcion": "FORRO MILANO MAYM SILT 105",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30009234",
    "descripcion": "FORRO MIRAGE FLANIGAN FUDGE 105",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30009235",
    "descripcion": "FORRO MIRAGE FLANIGAN FUDGE 120",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30009236",
    "descripcion": "FORRO MIRAGE FLANIGAN FUDGE 135",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009240",
    "descripcion": "FORRO MIRAGE FLANIGAN HIBISCUS 105",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30009241",
    "descripcion": "FORRO MIRAGE 120 FLANIGAN HIBISCUS",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30009242",
    "descripcion": "FORRO MIRAGE 135 FLANIGAN HIBISCUS",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009243",
    "descripcion": "FORRO MIRAGE FLANIGAN MERLOT 105",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30009244",
    "descripcion": "FORRO MIRAGE 120 FLANIGAN MERLOT",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30009245",
    "descripcion": "FORRO MIRAGE 135 FLANIGAN MERLOT",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009249",
    "descripcion": "FORRO MIRAGE 105 FLANIGAN TANGELO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30009250",
    "descripcion": "FORRO MIRAGE 120 FLANIGAN TANGELO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30009251",
    "descripcion": "FORRO MIRAGE FLANIGAN TANGELO 135",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009252",
    "descripcion": "FORRO MIRAGE 105 FLANIGAN TIDEWATER",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30009253",
    "descripcion": "FORRO MIRAGE 120 FLANIGAN TIDEWATER",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30009254",
    "descripcion": "FORRO MIRAGE 135 FLANIGAN TIDEWATER",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009263",
    "descripcion": "FORRO MIRAGE MAYM SILT 135",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009265",
    "descripcion": "FORRO MIRAGE MAYM STUCCO 120",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30009266",
    "descripcion": "FORRO MIRAGE MAYM STUCCO 135",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30009276",
    "descripcion": "FORRO OTTOMAN 70 FLANIGAN FUDGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30009278",
    "descripcion": "FORRO OTTOMAN 70 FLANIGAN HIBISCUS",
    "tiempoMin": 30
  },
  {
    "codigo": "30009279",
    "descripcion": "FORRO OTTOMAN FLANIGAN MERLOT 70X50X45",
    "tiempoMin": 30
  },
  {
    "codigo": "30009281",
    "descripcion": "FORRO OTTOMAN 70 FLANIGAN TANGELO",
    "tiempoMin": 30
  },
  {
    "codigo": "30009282",
    "descripcion": "FORRO OTTOMAN 70 FLANIGAN TIDEWAT",
    "tiempoMin": 30
  },
  {
    "codigo": "30009285",
    "descripcion": "PTBO FORRO OTTOMAN 70 MAYMOUNT SILT",
    "tiempoMin": 30
  },
  {
    "codigo": "30009289",
    "descripcion": "FORRO OTTOMAN REDONDO FLANIGAN FUDGE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30009291",
    "descripcion": "FORRO OTTOMAN REDONDO FLANIGAN HIBISCUS",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30009292",
    "descripcion": "FORRO OTTOMAN REDONDO FLANIGAN MERLOT",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30009294",
    "descripcion": "FORRO OTTOMAN REDONDO FLANIGAN TANGELO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30009295",
    "descripcion": "FORRO OTTOMAN REDONDO FLANIGAN TIDEWATER",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30009307",
    "descripcion": "FORRO SPRING FLANIGAN FUDGE 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009309",
    "descripcion": "FORRO SPRING FLANIGAN HIBISCUS 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009310",
    "descripcion": "FORRO SPRING 105 FLANIGAN MERLOT",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009312",
    "descripcion": "FORRO SPRING FLANIGAN TANGELO 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009313",
    "descripcion": "FORRO SPRING 105 FLANIGAN TIDEWATER",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009316",
    "descripcion": "FORRO SPRING MAYM SILT 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009317",
    "descripcion": "FORRO SPRING MAYM STUCCO 105",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30009321",
    "descripcion": "FORRO VELADOR FLOREN MAYM SILT",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30009322",
    "descripcion": "FORRO VELADOR FLOREN MAYM STUCCO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30009326",
    "descripcion": "FORRO VELADOR PALERMO MAYM SILT",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009327",
    "descripcion": "FORRO VELADOR PALERMO MAYM STUCCO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009331",
    "descripcion": "FORRO VELADOR PALERMO FLANIGAN FUDGE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009332",
    "descripcion": "FORRO VELADOR PALERMO FLANIGAN GRAIN",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009333",
    "descripcion": "FORRO VELADOR PALERMO FLANIGAN HIBISCUS",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009334",
    "descripcion": "FORRO VELADOR PALERMO FLANIGAN MERLOT",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009336",
    "descripcion": "FORRO VELADOR PALERMO FLANIGAN TANGELO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30009337",
    "descripcion": "FORRO VELADOR PALERMO FLANIGAN TIDEWATER",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30010157",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN FUDGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010158",
    "descripcion": "FORRO CAMA FLOREN 135 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010159",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN FUDGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010160",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN FUDGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010165",
    "descripcion": "FORRO CAMA FLOREN 105 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010166",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN HIBISCUS 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010167",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN HIBISCUS 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010168",
    "descripcion": "FORRO CAMA FLOREN 200 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010169",
    "descripcion": "FORRO CAMA FLOREN 105 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010170",
    "descripcion": "FORRO CAMA FLOREN 135 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010171",
    "descripcion": "FORRO CAMA FLOREN 160 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010172",
    "descripcion": "FORRO CAMA FLOREN 200 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010177",
    "descripcion": "FORRO CAMA FLOREN 105 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010178",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN TANGELO 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010179",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN TANGELO 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010180",
    "descripcion": "FORRO CAMA FLOREN 200 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010181",
    "descripcion": "FORRO CAMA FLOREN 105 FLANIGAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010182",
    "descripcion": "FORRO CAMA FLOREN 135 FLANIGAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010183",
    "descripcion": "FORRO CAMA FLOREN 160 FLANIGAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010184",
    "descripcion": "FORRO CAMA FLOREN FLANIGAN TIDEWATER 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010189",
    "descripcion": "FORRO CAMA NAPOLES FLANIGAN FUDGE 105",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30010190",
    "descripcion": "FORRO CAMA NAPOLES FLANIGAN FUDGE 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30010191",
    "descripcion": "FORRO CAMA NAPOLES FLANIGAN FUDGE 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30010192",
    "descripcion": "FORRO CAMA NAPOLES 200 FLANIGAN FUDGE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30010195",
    "descripcion": "FORRO CAMA NAPOLES FLANIGAN GRAIN 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30010197",
    "descripcion": "FORRO CAMA NAPOLES 105 FLANIGAN HIBISCUS",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30010198",
    "descripcion": "FORRO CAMA NAPOLES FLANIGAN HIBISCUS 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30010199",
    "descripcion": "FORRO CAMA NAPOLES 160 FLANIGAN HIBISCUS",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30010200",
    "descripcion": "FORRO CAMA NAPOLES 200 FLANIGAN HIBISCUS",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30010201",
    "descripcion": "FORRO CAMA NAPOLES 105 FLANIGAN MERLOT",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30010202",
    "descripcion": "FORRO CAMA NAPOLES FLANIGAN MERLOT 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30010203",
    "descripcion": "FORRO CAMA NAPOLES 160 FLANIGAN MERLOT",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30010204",
    "descripcion": "FORRO CAMA NAPOLES 200 FLANIGAN MERLOT",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30010209",
    "descripcion": "FORRO CAMA NAPOLES ARGO AZUL 105",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30010210",
    "descripcion": "FORRO CAMA NAPOLES ARGO AZUL 135",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30010211",
    "descripcion": "FORRO CAMA NAPOLES ARGO AZUL 160",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30010212",
    "descripcion": "FORRO CAMA NAPOLES ARGO AZUL 200",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30010213",
    "descripcion": "FORRO CAMA NAPOLES 105 FLANIGAN TIDEWATE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30010214",
    "descripcion": "FORRO CAMA NAPOLES 135 FLANIGAN TIDEWATE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30010215",
    "descripcion": "FORRO CAMA NAPOLES 160 FLANIGAN TIDEWATE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30010216",
    "descripcion": "FORRO CAMA NAPOLES 200 FLANIGAN TIDEWATE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30010221",
    "descripcion": "FORRO CAMA TOSCANA 115 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010222",
    "descripcion": "FORRO CAMA TOSCANA 145 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010223",
    "descripcion": "FORRO CAMA TOSCANA FLANIGAN FUDGE 170",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30010224",
    "descripcion": "FORRO CAMA TOSCANA 210 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010229",
    "descripcion": "FORRO CAMA TOSCANA 115 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010230",
    "descripcion": "FORRO CAMA TOSCANA FLANIGAN HIBISCUS 145",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30010231",
    "descripcion": "FORRO CAMA TOSCANA 170 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010232",
    "descripcion": "FORRO CAMA TOSCANA 210 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010233",
    "descripcion": "FORRO CAMA TOSCANA 115 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010234",
    "descripcion": "FORRO CAMA TOSCANA 145 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010235",
    "descripcion": "FORRO CAMA TOSCANA 170 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010236",
    "descripcion": "FORRO CAMA TOSCANA 210 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010241",
    "descripcion": "FORRO CAMA TOSCANA 115 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010242",
    "descripcion": "FORRO CAMA TOSCANA 145 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010243",
    "descripcion": "FORRO CAMA TOSCANA 170 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010244",
    "descripcion": "FORRO CAMA TOSCANA 210 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010245",
    "descripcion": "FORRO CAMA TOSCANA 115 FLANIGAN TIDEWATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010246",
    "descripcion": "FORRO CAMA TOSCANA 145 FLANIGAN TIDEWATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010247",
    "descripcion": "FORRO CAMA TOSCANA 170 FLANIGAN TIDEWATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010248",
    "descripcion": "FORRO CAMA TOSCANA 210 FLANIG TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010252",
    "descripcion": "FORRO CAMA VERONA 105 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010253",
    "descripcion": "FORRO CAMA VERONA FLANIGAN FUDGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010254",
    "descripcion": "FORRO CAMA VERONA FLANIGAN FUDGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010258",
    "descripcion": "FORRO CAMA VERONA FLANIGAN HIBISCUS 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010259",
    "descripcion": "FORRO CAMA VERONA FLANIGAN HIBISCUS 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010260",
    "descripcion": "FORRO CAMA VERONA FLANIGAN HIBISCUS 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010261",
    "descripcion": "FORRO CAMA VERONA 105 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010262",
    "descripcion": "FORRO CAMA VERONA FLANIGAN MERLOT 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010263",
    "descripcion": "FORRO CAMA VERONA FLANIGAN MERLOT 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010267",
    "descripcion": "FORRO CAMA VERONA FLANIGAN TANGELO 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010268",
    "descripcion": "FORRO CAMA VERONA FLANIGAN TANGELO 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010269",
    "descripcion": "FORRO CAMA VERONA 160 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010270",
    "descripcion": "FORRO CAMA VERONA 105 FLANIGAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010271",
    "descripcion": "FORRO CAMA VERONA 135 FLANIGAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010272",
    "descripcion": "FORRO CAMA VERONA 160 FLANIGAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010274",
    "descripcion": "FORRO VELADOR FLOREN FLANIGAN FUDGE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30010276",
    "descripcion": "FORRO VELADOR FLORENCIA FLANI HIBISCUS",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30010277",
    "descripcion": "FORRO VELADOR FLOREN FLANIGAN MERLOT",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30010279",
    "descripcion": "FORRO VELADOR FLORENCIA FLANI TANGELO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30010280",
    "descripcion": "FORRO VELADOR FLORENCIA FLANI TIDEWATER",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30010615",
    "descripcion": "FORRO CAB CAPRI FLANI FUDGE 115X50X88",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010616",
    "descripcion": "FORRO CAB CAPRI 115X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010620",
    "descripcion": "FORRO CAB CAPRI FLANI FUDGE 145X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010621",
    "descripcion": "FORRO CAB CAPRI FLANI HIBISCUS 145X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010624",
    "descripcion": "FORRO CAB CAPRI FLANI FUDGE 145X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010625",
    "descripcion": "FORRO CAB CAPRI FLANI HIBISCUS 145X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010628",
    "descripcion": "FORRO CAB CAPRI 145X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010629",
    "descripcion": "FORRO CAB CAPRI 145X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010630",
    "descripcion": "FORRO CAB CAPRI 145X72 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010632",
    "descripcion": "FORRO CAB CAPRI FLANI FUDGE 170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010633",
    "descripcion": "FORRO CAB CAPRI FLANI HIBISCUS  170X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010636",
    "descripcion": "FORRO CAB CAPRI 170X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010637",
    "descripcion": "FORRO CAB CAPRI 170X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010640",
    "descripcion": "FORRO CAB CAPRI 170X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010641",
    "descripcion": "FORRO CAB CAPRI 170X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010642",
    "descripcion": "FORRO CAB CAPRI 170X72 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010644",
    "descripcion": "FORRO CAB CAPRI FLANI FUDGE 210X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010645",
    "descripcion": "FORRO CAB CAPRI 210X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010648",
    "descripcion": "FORRO CAB CAPRI 210X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010649",
    "descripcion": "FORRO CAB CAPRI FLANI HIBISCUS  210X72X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010652",
    "descripcion": "FORRO CAB CAPRI 210X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010653",
    "descripcion": "FORRO CAB CAPRI 210X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010654",
    "descripcion": "FORRO CAB CAPRI 210X72 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010733",
    "descripcion": "FORRO CAB CAPRI 115X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010734",
    "descripcion": "FORRO CAB CAPRI 115X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010735",
    "descripcion": "FORRO CAB CAPRI 115X50 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010736",
    "descripcion": "FORRO CAB CAPRI 145X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010737",
    "descripcion": "FORRO CAB CAPRI FLANI MERLOT 145X50X8",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010738",
    "descripcion": "FORRO CAB CAPRI 145X50 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010739",
    "descripcion": "FORRO CAB CAPRI 170X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010740",
    "descripcion": "FORRO CAB CAPRI 170X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010741",
    "descripcion": "FORRO CAB CAPRI 170X50 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010742",
    "descripcion": "FORRO CAB CAPRI 210X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010743",
    "descripcion": "FORRO CAB CAPRI 210X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010744",
    "descripcion": "FORRO CAB CAPRI 210X50 FLANI TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30010772",
    "descripcion": "FORRO FOAM 070 FLANIGAN FUDGE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30011116",
    "descripcion": "FORRO COJIN CILINDRO INTERNO",
    "tiempoMin": 8
  },
  {
    "codigo": "30011129",
    "descripcion": "FORRO COJIN CILINDRO LYRICAL SIERRA",
    "tiempoMin": 8
  },
  {
    "codigo": "30011136",
    "descripcion": "FORRO COJIN CILINDRO LYRICAL CHARCOAL",
    "tiempoMin": 8
  },
  {
    "codigo": "30011151",
    "descripcion": "FORRO COJIN CILINDRO MAYMOUNT STUCCO",
    "tiempoMin": 8
  },
  {
    "codigo": "30011154",
    "descripcion": "FORRO COJIN CILINDRO MAYMOUNT SILT",
    "tiempoMin": 8
  },
  {
    "codigo": "30011163",
    "descripcion": "FORRO COJIN CILINDRICO FLANIGA TIDEWATER",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011166",
    "descripcion": "FORRO COJIN CILINDRO FLANIGAN TANGELO",
    "tiempoMin": 8
  },
  {
    "codigo": "30011174",
    "descripcion": "FORRO COJIN CILINDRO FLANIGAN MERLOT",
    "tiempoMin": 8
  },
  {
    "codigo": "30011177",
    "descripcion": "FORRO COJIN CILINDRO FLANIGAN HIBISCUS",
    "tiempoMin": 8
  },
  {
    "codigo": "30011183",
    "descripcion": "FORRO COJIN CILINDRO FLANIGAN FUDGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30011203",
    "descripcion": "FORRO COJIN CILINDRO MENTA",
    "tiempoMin": 8
  },
  {
    "codigo": "30011211",
    "descripcion": "FORRO COJIN CILINDRO MARROQUI NEGRO",
    "tiempoMin": 8
  },
  {
    "codigo": "30011217",
    "descripcion": "FORRO COJIN CILINDRO MARROQUI CAFE",
    "tiempoMin": 8
  },
  {
    "codigo": "30011220",
    "descripcion": "FORRO COJIN CILINDRO AEGEAN",
    "tiempoMin": 8
  },
  {
    "codigo": "30011297",
    "descripcion": "FORRO PROTECTOR CHN. AC AZUL 080X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011298",
    "descripcion": "FORRO PROTECTOR CHN. AC AZUL 090X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011299",
    "descripcion": "FORRO PROTECTOR CHN. AC AZUL 105X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011300",
    "descripcion": "FORRO PROTECTOR CHN. AC AZUL 135X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011301",
    "descripcion": "FORRO PROTECTOR CHN. AC AZUL 160X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011302",
    "descripcion": "FORRO PROTECTOR CHN. AC AZUL 200X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011303",
    "descripcion": "FORRO PROTECTOR CHN. AC BLANCO 080X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011304",
    "descripcion": "FORRO PROTECTOR CHN. AC BLANCO 090X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011305",
    "descripcion": "FORRO PROTECTOR CHN. AC BLANCO 105X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011306",
    "descripcion": "FORRO PROTECTOR CHN. AC BLANCO 135X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011307",
    "descripcion": "FORRO PROTECTOR CHN. AC BLANCO 160X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011308",
    "descripcion": "FORRO PROTECTOR CHN. AC BLANCO 200X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011309",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 080X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011310",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 090X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011311",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 105X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011312",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 135X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011313",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 160X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011314",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 200X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011315",
    "descripcion": "FORRO PROTECTOR CHN. AC GRIS 080X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011316",
    "descripcion": "FORRO PROTECTOR CHN. AC GRIS 090X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011317",
    "descripcion": "FORRO PROTECTOR CHN. AC GRIS 105X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011318",
    "descripcion": "FORRO PROTECTOR CHN. AC GRIS 135X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011319",
    "descripcion": "FORRO PROTECTOR CHN. AC GRIS 160X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011320",
    "descripcion": "FORRO PROTECTOR CHN. AC GRIS 200X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30011333",
    "descripcion": "FORRO ANTIFAZ DESCANSO AZUL",
    "tiempoMin": 1.64
  },
  {
    "codigo": "30011515",
    "descripcion": "FORRO COJIN INTERNO EUROPIA CAB 70X20",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011516",
    "descripcion": "FORRO COJIN INTERNO EUROPIA ESP 70X60",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011526",
    "descripcion": "FORRO RECLINABLE_160_ EUROPIA MAY SILT",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011538",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P FLA TANGELO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011539",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P FLA MERLOT",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011540",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P FLA TIDEWATE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011542",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P FLA FUDGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011544",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P FLA HIBISCUS",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011554",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P FLA TANGELO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011555",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P FLA MERLOT",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011556",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P FLA TIDEWATER",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011558",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P FLA FUDGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011560",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P FLA HIBISCUS",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011716",
    "descripcion": "FORRO INT COJIN TAPIZ AEGEAN 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011719",
    "descripcion": "FORRO INT COJIN FLANIGAN TANGELO 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011720",
    "descripcion": "FORRO INT COJIN 45X45 FLANIGAN TIDEWATER",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011756",
    "descripcion": "FORRO INT COJIN 45X45 VERDE",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011773",
    "descripcion": "FORRO INT COJIN FLANIGAN HIBISCUS 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011774",
    "descripcion": "FORRO INT COJIN FLANIGAN MERLOT 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011775",
    "descripcion": "FORRO INT COJIN FLANIGAN FUDGE 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011776",
    "descripcion": "FORRO INT COJIN ARGO BEIGE 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011777",
    "descripcion": "FORRO INT COJIN ARGO AZUL 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011778",
    "descripcion": "FORRO INT COJIN 45X45 ARGO CHOCOLATE",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011779",
    "descripcion": "FORRO INT COJIN 45X45 ARGO GRIS",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011780",
    "descripcion": "FORRO INT COJIN ARGO TURQUEZA 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011789",
    "descripcion": "FORRO INT COJIN  FLANIGAN MERLOT 56X27",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011794",
    "descripcion": "FORRO INT COJIN ARGO AZUL 56X27",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30011798",
    "descripcion": "FORRO OTTOMAN ZAPATERA  INTERNO BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011799",
    "descripcion": "FORRO OTTOMAN ZAPATERA  INTERNO GRIS",
    "tiempoMin": 1.67
  },
  {
    "codigo": "30011800",
    "descripcion": "FORRO OTTOMAN ZAPATERA  INTERNO AZUL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30011801",
    "descripcion": "FORRO OTTOMAN ZAPATERA  INTERNO CAFE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30012193",
    "descripcion": "TAPA T. FALSO NEGRO CAM FLOR/NAP 105",
    "tiempoMin": 2.3
  },
  {
    "codigo": "30012216",
    "descripcion": "TAPA T. FALSO NEGRO CAM FLOR/NAP 135",
    "tiempoMin": 2.61
  },
  {
    "codigo": "30012264",
    "descripcion": "TAPA T. FALSO NEGRO CAM FLOR/NAP 160",
    "tiempoMin": 2.75
  },
  {
    "codigo": "30012286",
    "descripcion": "TAPA T. FALSO NEGRO CAM FLOR/NAP 200",
    "tiempoMin": 3.2
  },
  {
    "codigo": "30012518",
    "descripcion": "FORRO CAMA FLOREN 105 CONFIG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012519",
    "descripcion": "FORRO CAMA FLOREN 135 CONFIG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012520",
    "descripcion": "FORRO CAMA FLOREN 160 CONFIG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012521",
    "descripcion": "FORRO CAMA FLOREN 200 CONFIG",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012530",
    "descripcion": "FORRO SPRING 105 CONFIGURABLE RESIFLEX",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30012541",
    "descripcion": "FORRO COJIN INTER RECLI APOYABRAZO",
    "tiempoMin": 2.5
  },
  {
    "codigo": "30012542",
    "descripcion": "FORRO COJIN INTER RECLI APOYAPIES",
    "tiempoMin": 2.5
  },
  {
    "codigo": "30012543",
    "descripcion": "FORRO COJIN INTER CLOUD ESPALDAR SUP",
    "tiempoMin": 5
  },
  {
    "codigo": "30012544",
    "descripcion": "FORRO COJIN INTER LIFT ESPALDAR SUP",
    "tiempoMin": 5
  },
  {
    "codigo": "30012575",
    "descripcion": "TAPA T. FALSO NEGRO SPRING",
    "tiempoMin": 6.46
  },
  {
    "codigo": "30012588",
    "descripcion": "TAPA T. FALSO NEGRO MATISSE",
    "tiempoMin": 4.29
  },
  {
    "codigo": "30012622",
    "descripcion": "TAPA T. FALSO NEGRO MANCHESTER",
    "tiempoMin": 10
  },
  {
    "codigo": "30012665",
    "descripcion": "TAPA T. FALSO NEGRO MIAMI",
    "tiempoMin": 4.58
  },
  {
    "codigo": "30012701",
    "descripcion": "FORRO ALM CAB EXTERNO BRUMA 105",
    "tiempoMin": 20.59
  },
  {
    "codigo": "30012702",
    "descripcion": "FORRO ALM CAB EXTERNO BRUMA 135",
    "tiempoMin": 22.58
  },
  {
    "codigo": "30012703",
    "descripcion": "FORRO ALM CAB EXTERNO MIEL 105",
    "tiempoMin": 20.59
  },
  {
    "codigo": "30012704",
    "descripcion": "FORRO ALM CAB EXTERNO MIEL 135",
    "tiempoMin": 22.58
  },
  {
    "codigo": "30012712",
    "descripcion": "FORRO COLCHONETA SOFA MIRAGE 105",
    "tiempoMin": 10
  },
  {
    "codigo": "30012713",
    "descripcion": "FORRO COLCHONETA SOFA MIRAGE 120",
    "tiempoMin": 12
  },
  {
    "codigo": "30012714",
    "descripcion": "FORRO COLCHONETA SOFA MIRAGE 135",
    "tiempoMin": 13
  },
  {
    "codigo": "30012723",
    "descripcion": "FORRO CAMA MILOS 105 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012724",
    "descripcion": "FORRO CAMA MILOS 105 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012726",
    "descripcion": "FORRO CAMA MILOS 105 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012727",
    "descripcion": "FORRO CAMA MILOS 105 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012728",
    "descripcion": "FORRO CAMA MILOS 105 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012731",
    "descripcion": "FORRO CAMA MILOS 105 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012735",
    "descripcion": "FORRO CAMA MILOS  ARGO BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012736",
    "descripcion": "FORRO CAMA MILOS 105 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012737",
    "descripcion": "FORRO CAMA MILOS  ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012739",
    "descripcion": "FORRO CAMA MILOS 135 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012740",
    "descripcion": "FORRO CAMA MILOS 135 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012742",
    "descripcion": "FORRO CAMA MILOS 135 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012743",
    "descripcion": "FORRO CAMA MILOS 135 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012744",
    "descripcion": "FORRO CAMA MILOS 135 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012746",
    "descripcion": "FORRO CAMA MILOS 135 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012751",
    "descripcion": "FORRO CAMA MILOS  ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012752",
    "descripcion": "FORRO CAMA MILOS 135 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012753",
    "descripcion": "FORRO CAMA MILOS  ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012771",
    "descripcion": "FORRO CAMA MILOS 160 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012772",
    "descripcion": "FORRO CAMA MILOS 160 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012774",
    "descripcion": "FORRO CAMA MILOS 160 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012775",
    "descripcion": "FORRO CAMA MILOS 160 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012776",
    "descripcion": "FORRO CAMA MILOS 160 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012778",
    "descripcion": "FORRO CAMA MILOS 160 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012779",
    "descripcion": "FORRO CAMA MILOS 160 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012782",
    "descripcion": "FORRO CAMA MILOS 160 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012783",
    "descripcion": "FORRO CAMA MILOS  ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012784",
    "descripcion": "FORRO CAMA MILOS 160 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012785",
    "descripcion": "FORRO CAMA MILOS  ARGO AZUL 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012803",
    "descripcion": "FORRO CAMA MILOS 200 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012804",
    "descripcion": "FORRO CAMA MILOS 200 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012806",
    "descripcion": "FORRO CAMA MILOS 200 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012807",
    "descripcion": "FORRO CAMA MILOS 200 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012808",
    "descripcion": "FORRO CAMA MILOS 200 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012810",
    "descripcion": "FORRO CAMA MILOS 200 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012815",
    "descripcion": "FORRO CAMA MILOS 200 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012816",
    "descripcion": "FORRO CAMA MILOS 200 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012817",
    "descripcion": "FORRO CAMA MILOS 200 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012818",
    "descripcion": "FORRO CAMA LISBOA 105 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012819",
    "descripcion": "FORRO CAMA LISBOA 105 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012820",
    "descripcion": "FORRO CAMA LISBOA 105 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012822",
    "descripcion": "FORRO CAMA LISBOA 105 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012823",
    "descripcion": "FORRO CAMA LISBOA 105 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012824",
    "descripcion": "FORRO CAMA LISBOA 105 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012831",
    "descripcion": "FORRO CAMA LISBOA 105 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012832",
    "descripcion": "FORRO CAMA LISBOA 105 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012833",
    "descripcion": "FORRO CAMA LISBOA 105 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012834",
    "descripcion": "FORRO CAMA LISBOA 135 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012835",
    "descripcion": "FORRO CAMA LISBOA 135 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012836",
    "descripcion": "FORRO CAMA LISBOA 135 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012838",
    "descripcion": "FORRO CAMA LISBOA 135 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012839",
    "descripcion": "FORRO CAMA LISBOA 135 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012840",
    "descripcion": "FORRO CAMA LISBOA 135 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012843",
    "descripcion": "FORRO CAMA LISBOA 135 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012847",
    "descripcion": "FORRO CAMA LISBOA  ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012848",
    "descripcion": "FORRO CAMA LISBOA 135 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012849",
    "descripcion": "FORRO CAMA LISBOA  ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012863",
    "descripcion": "FORRO CAMA BOSTON 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012864",
    "descripcion": "FORRO CAMA BOSTON 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012865",
    "descripcion": "FORRO CAMA BOSTON 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012867",
    "descripcion": "FORRO CAMA LISBOA 160 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012868",
    "descripcion": "FORRO CAMA LISBOA 160 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012870",
    "descripcion": "FORRO CAMA LISBOA 160 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012871",
    "descripcion": "FORRO CAMA LISBOA 160 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012872",
    "descripcion": "FORRO CAMA LISBOA 160 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012879",
    "descripcion": "FORRO CAMA LISBOA  ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012880",
    "descripcion": "FORRO CAMA LISBOA 160 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012881",
    "descripcion": "FORRO CAMA LISBOA 160 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012899",
    "descripcion": "FORRO CAMA LISBOA 200 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012900",
    "descripcion": "FORRO CAMA LISBOA 200 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012902",
    "descripcion": "FORRO CAMA LISBOA 200 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012903",
    "descripcion": "FORRO CAMA LISBOA 200 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012904",
    "descripcion": "FORRO CAMA LISBOA 200 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012909",
    "descripcion": "FORRO CAMA LISBOA 200 MARR CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012911",
    "descripcion": "FORRO CAMA LISBOA  ARGO BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012912",
    "descripcion": "FORRO CAMA LISBOA 200 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012913",
    "descripcion": "FORRO CAMA LISBOA 200 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012914",
    "descripcion": "FORRO CAMA CRETA 105 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012915",
    "descripcion": "FORRO CAMA CRETA 105 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012916",
    "descripcion": "FORRO CAMA CRETA 105 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012918",
    "descripcion": "FORRO CAMA CRETA 105 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012919",
    "descripcion": "FORRO CAMA CRETA 105 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012920",
    "descripcion": "FORRO CAMA CRETA 105 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012922",
    "descripcion": "FORRO CAMA CRETA 105 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012926",
    "descripcion": "FORRO CAMA CRETA 105 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012927",
    "descripcion": "FORRO CAMA CRETA  ARGO BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012928",
    "descripcion": "FORRO CAMA CRETA 105 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012929",
    "descripcion": "FORRO CAMA CRETA  ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012930",
    "descripcion": "FORRO CAMA CRETA 135 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012931",
    "descripcion": "FORRO CAMA CRETA 135 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012932",
    "descripcion": "FORRO CAMA CRETA 135 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012934",
    "descripcion": "FORRO CAMA CRETA 135 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012935",
    "descripcion": "FORRO CAMA CRETA 135 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012936",
    "descripcion": "FORRO CAMA CRETA 135 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012938",
    "descripcion": "FORRO CAMA CRETA 135 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012939",
    "descripcion": "FORRO CAMA CRETA 135 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012942",
    "descripcion": "FORRO CAMA CRETA 135 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012943",
    "descripcion": "FORRO CAMA CRETA  ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012944",
    "descripcion": "FORRO CAMA CRETA 135 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012945",
    "descripcion": "FORRO CAMA CRETA  ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012959",
    "descripcion": "FORRO CAMA BOSTON 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012960",
    "descripcion": "FORRO CAMA BOSTON 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012961",
    "descripcion": "FORRO CAMA BOSTON 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012975",
    "descripcion": "FORRO CAMA BOSTON 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012976",
    "descripcion": "FORRO CAMA BOSTON 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012977",
    "descripcion": "FORRO CAMA BOSTON 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012979",
    "descripcion": "FORRO CAMA CRETA 160 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012980",
    "descripcion": "FORRO CAMA CRETA 160 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012982",
    "descripcion": "FORRO CAMA CRETA 160 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012983",
    "descripcion": "FORRO CAMA CRETA 160 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012984",
    "descripcion": "FORRO CAMA CRETA 160 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012986",
    "descripcion": "FORRO CAMA CRETA 160 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012987",
    "descripcion": "FORRO CAMA CRETA 160 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012990",
    "descripcion": "FORRO CAMA CRETA 160 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012991",
    "descripcion": "FORRO CAMA CRETA  ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012992",
    "descripcion": "FORRO CAMA CRETA 160 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012993",
    "descripcion": "FORRO CAMA CRETA  ARGO AZUL 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012995",
    "descripcion": "FORRO CAMA CRETA 200 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012996",
    "descripcion": "FORRO CAMA CRETA 200 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012998",
    "descripcion": "FORRO CAMA CRETA 200 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30012999",
    "descripcion": "FORRO CAMA CRETA 200 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013000",
    "descripcion": "FORRO CAMA CRETA 200 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013002",
    "descripcion": "FORRO CAMA CRETA 200 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013003",
    "descripcion": "FORRO CAMA CRETA 200 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013005",
    "descripcion": "FORRO CAMA CRETA 200 MARR CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013006",
    "descripcion": "FORRO CAMA CRETA 200 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013007",
    "descripcion": "FORRO CAMA CRETA  ARGO BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013008",
    "descripcion": "FORRO CAMA CRETA 200 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013009",
    "descripcion": "FORRO CAMA CRETA  ARGO AZUL 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013011",
    "descripcion": "FORRO CAMA LONDRES 105 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013012",
    "descripcion": "FORRO CAMA LONDRES 105 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013014",
    "descripcion": "FORRO CAMA LONDRES 105 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013015",
    "descripcion": "FORRO CAMA LONDRES 105 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013016",
    "descripcion": "FORRO CAMA LONDRES 105 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013018",
    "descripcion": "FORRO CAMA LONDRES 105 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013019",
    "descripcion": "FORRO CAMA LONDRES 105 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013022",
    "descripcion": "FORRO CAMA LONDRES 105 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013023",
    "descripcion": "FORRO CAMA LONDRES  ARGO BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013024",
    "descripcion": "FORRO CAMA LONDRES 105 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013025",
    "descripcion": "FORRO CAMA LONDRES  ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013026",
    "descripcion": "FORRO CAMA LONDRES 135 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013027",
    "descripcion": "FORRO CAMA LONDRES 135 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013028",
    "descripcion": "FORRO CAMA LONDRES 135 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013030",
    "descripcion": "FORRO CAMA LONDRES 135 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013031",
    "descripcion": "FORRO CAMA LONDRES 135 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013032",
    "descripcion": "FORRO CAMA LONDRES 135 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013034",
    "descripcion": "FORRO CAMA LONDRES 135 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013035",
    "descripcion": "FORRO CAMA LONDRES 135 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013038",
    "descripcion": "FORRO CAMA LONDRES 135 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013039",
    "descripcion": "FORRO CAMA LONDRES  ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013040",
    "descripcion": "FORRO CAMA LONDRES 135 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013041",
    "descripcion": "FORRO CAMA LONDRES  ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013055",
    "descripcion": "FORRO CAMA BOSTON 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013056",
    "descripcion": "FORRO CAMA BOSTON 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013057",
    "descripcion": "FORRO CAMA BOSTON 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013058",
    "descripcion": "FORRO CAMA LONDRES 160 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013059",
    "descripcion": "FORRO CAMA LONDRES 160 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013060",
    "descripcion": "FORRO CAMA LONDRES 160 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013062",
    "descripcion": "FORRO CAMA LONDRES 160 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013063",
    "descripcion": "FORRO CAMA LONDRES 160 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013064",
    "descripcion": "FORRO CAMA LONDRES 160 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013066",
    "descripcion": "FORRO CAMA LONDRES 160 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013070",
    "descripcion": "FORRO CAMA LONDRES 160 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013071",
    "descripcion": "FORRO CAMA LONDRES  ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013072",
    "descripcion": "FORRO CAMA LONDRES 160 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013073",
    "descripcion": "FORRO CAMA LONDRES 160 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013076",
    "descripcion": "FORRO CAMA BOSTON 105 VINTAGE CAPPUCHINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013077",
    "descripcion": "FORRO CAMA BOSTON 135 VINTAGE CAPPUCHINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013078",
    "descripcion": "FORRO CAMA BOSTON 160 VINTAGE CAPPUCHINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013079",
    "descripcion": "FORRO CAMA BOSTON 200 VINTAGE CAPPUCHINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013080",
    "descripcion": "FORRO CAMA BOSTON 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013081",
    "descripcion": "FORRO CAMA BOSTON 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013082",
    "descripcion": "FORRO CAMA BOSTON 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013083",
    "descripcion": "FORRO CAMA BOSTON 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013084",
    "descripcion": "FORRO CAMA BOSTON 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013085",
    "descripcion": "FORRO CAMA BOSTON 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013086",
    "descripcion": "FORRO CAMA BOSTON 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013087",
    "descripcion": "FORRO CAMA BOSTON 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013088",
    "descripcion": "FORRO CAMA BOSTON 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013089",
    "descripcion": "FORRO CAMA BOSTON 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013090",
    "descripcion": "FORRO CAMA LONDRES 200 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013091",
    "descripcion": "FORRO CAMA LONDRES 200 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013092",
    "descripcion": "FORRO CAMA LONDRES 200 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013094",
    "descripcion": "FORRO CAMA LONDRES 200 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013095",
    "descripcion": "FORRO CAMA LONDRES 200 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013096",
    "descripcion": "FORRO CAMA LONDRES 200 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013099",
    "descripcion": "FORRO CAMA LONDRES 200 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013102",
    "descripcion": "FORRO CAMA LONDRES 200 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013103",
    "descripcion": "FORRO CAMA LONDRES  ARGO BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013104",
    "descripcion": "FORRO CAMA LONDRES 200 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013105",
    "descripcion": "FORRO CAMA LONDRES  ARGO AZUL 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013107",
    "descripcion": "FORRO CAMA BARU 105 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013108",
    "descripcion": "FORRO CAMA BARU 105 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013110",
    "descripcion": "FORRO CAMA BARU 105 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013111",
    "descripcion": "FORRO CAMA BARU 105 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013112",
    "descripcion": "FORRO CAMA BARU 105 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013114",
    "descripcion": "FORRO CAMA BARU 105 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013115",
    "descripcion": "FORRO CAMA BARU 105 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013118",
    "descripcion": "FORRO CAMA BARU 105 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013119",
    "descripcion": "FORRO CAMA BARU  ARGO BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013120",
    "descripcion": "FORRO CAMA BARU 105 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013121",
    "descripcion": "FORRO CAMA BARU  ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013123",
    "descripcion": "FORRO CAMA BARU 135 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013124",
    "descripcion": "FORRO CAMA BARU 135 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013126",
    "descripcion": "FORRO CAMA BARU 135 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013127",
    "descripcion": "FORRO CAMA BARU 135 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013128",
    "descripcion": "FORRO CAMA BARU 135 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013130",
    "descripcion": "FORRO CAMA BARU 135 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013131",
    "descripcion": "FORRO CAMA BARU 135 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013134",
    "descripcion": "FORRO CAMA BARU 135 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013135",
    "descripcion": "FORRO CAMA BARU  ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013136",
    "descripcion": "FORRO CAMA BARU 135 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013137",
    "descripcion": "FORRO CAMA BARU  ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013138",
    "descripcion": "FORRO CAMA BOSTON 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013139",
    "descripcion": "FORRO CAMA BOSTON 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013140",
    "descripcion": "FORRO CAMA BOSTON 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013141",
    "descripcion": "FORRO CAMA BOSTON 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013142",
    "descripcion": "FORRO CAMA BOSTON 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013143",
    "descripcion": "FORRO CAMA BOSTON 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013144",
    "descripcion": "FORRO CAMA BOSTON 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013145",
    "descripcion": "FORRO CAMA BOSTON 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013146",
    "descripcion": "FORRO CAMA BOSTON 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013147",
    "descripcion": "FORRO CAMA BOSTON 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013148",
    "descripcion": "FORRO CAMA BOSTON 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013149",
    "descripcion": "FORRO CAMA BOSTON 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013150",
    "descripcion": "FORRO CAMA BOSTON 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013151",
    "descripcion": "FORRO CAMA BOSTON 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013152",
    "descripcion": "FORRO CAMA BOSTON 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013153",
    "descripcion": "FORRO CAMA BOSTON 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013154",
    "descripcion": "FORRO CAMA BARU 160 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013155",
    "descripcion": "FORRO CAMA BARU 160 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013156",
    "descripcion": "FORRO CAMA BARU 160 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013158",
    "descripcion": "FORRO CAMA BARU 160 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013159",
    "descripcion": "FORRO CAMA BARU 160 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013160",
    "descripcion": "FORRO CAMA BARU 160 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013162",
    "descripcion": "FORRO CAMA BARU 160 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013163",
    "descripcion": "FORRO CAMA BARU 160 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013166",
    "descripcion": "FORRO CAMA BARU 160 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013167",
    "descripcion": "FORRO CAMA BARU  ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013168",
    "descripcion": "FORRO CAMA BARU 160 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013169",
    "descripcion": "FORRO CAMA BARU  ARGO AZUL 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013170",
    "descripcion": "FORRO CAMA BOSTON 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013171",
    "descripcion": "FORRO CAMA BOSTON 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013172",
    "descripcion": "FORRO CAMA BOSTON 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013173",
    "descripcion": "FORRO CAMA BOSTON 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013174",
    "descripcion": "FORRO CAMA BOSTON 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013175",
    "descripcion": "FORRO CAMA BOSTON 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013176",
    "descripcion": "FORRO CAMA BOSTON 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013177",
    "descripcion": "FORRO CAMA BOSTON 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013178",
    "descripcion": "FORRO CAMA BOSTON 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013179",
    "descripcion": "FORRO CAMA BOSTON 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013180",
    "descripcion": "FORRO CAMA BOSTON 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013181",
    "descripcion": "FORRO CAMA BOSTON 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013182",
    "descripcion": "FORRO CAMA BOSTON 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013183",
    "descripcion": "FORRO CAMA BOSTON 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013184",
    "descripcion": "FORRO CAMA BOSTON 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013185",
    "descripcion": "FORRO CAMA BOSTON 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013187",
    "descripcion": "FORRO CAMA BARU 200 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013188",
    "descripcion": "FORRO CAMA BARU 200 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013190",
    "descripcion": "FORRO CAMA BARU 200 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013191",
    "descripcion": "FORRO CAMA BARU 200 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013192",
    "descripcion": "FORRO CAMA BARU 200 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013198",
    "descripcion": "FORRO CAMA BARU 200 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013199",
    "descripcion": "FORRO CAMA BARU  ARGO BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013200",
    "descripcion": "FORRO CAMA BARU 200 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013201",
    "descripcion": "FORRO CAMA BARU  ARGO AZUL 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013203",
    "descripcion": "FORRO CAMA BERLIN 105 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013204",
    "descripcion": "FORRO CAMA BERLIN 105 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013206",
    "descripcion": "FORRO CAMA BERLIN 105 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013207",
    "descripcion": "FORRO CAMA BERLIN 105 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013208",
    "descripcion": "FORRO CAMA BERLIN 105 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013211",
    "descripcion": "FORRO CAMA BERLIN 105 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013215",
    "descripcion": "FORRO CAMA BERLIN  ARGO BEIGE 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013216",
    "descripcion": "FORRO CAMA BERLIN 105 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013217",
    "descripcion": "FORRO CAMA BERLIN  ARGO AZUL 105",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013218",
    "descripcion": "FORRO CAMA BERLIN 135 FLAN GRAIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013219",
    "descripcion": "FORRO CAMA BERLIN 135 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013220",
    "descripcion": "FORRO CAMA BERLIN 135 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013222",
    "descripcion": "FORRO CAMA BERLIN 135 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013223",
    "descripcion": "FORRO CAMA BERLIN 135 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013224",
    "descripcion": "FORRO CAMA BERLIN 135 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013226",
    "descripcion": "FORRO CAMA BERLIN 135 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013227",
    "descripcion": "FORRO CAMA BERLIN 135 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013231",
    "descripcion": "FORRO CAMA BERLIN  ARGO BEIGE 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013232",
    "descripcion": "FORRO CAMA BERLIN 135 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013233",
    "descripcion": "FORRO CAMA BERLIN  ARGO AZUL 135",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013234",
    "descripcion": "FORRO CAMA BOSTON 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013235",
    "descripcion": "FORRO CAMA BOSTON 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013236",
    "descripcion": "FORRO CAMA BOSTON 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013237",
    "descripcion": "FORRO CAMA BOSTON 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013238",
    "descripcion": "FORRO CAMA BOSTON 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013239",
    "descripcion": "FORRO CAMA BOSTON 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013240",
    "descripcion": "FORRO CAMA BOSTON 105 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013241",
    "descripcion": "FORRO CAMA BOSTON 135 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013242",
    "descripcion": "FORRO CAMA BOSTON 160 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013243",
    "descripcion": "FORRO CAMA BOSTON 200 FLANIGAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013244",
    "descripcion": "FORRO CAMA BOSTON 105 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013245",
    "descripcion": "FORRO CAMA BOSTON 135 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013246",
    "descripcion": "FORRO CAMA BOSTON 160 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013247",
    "descripcion": "FORRO CAMA BOSTON 200 FLANIGAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013248",
    "descripcion": "FORRO CAMA BOSTON 105 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013249",
    "descripcion": "FORRO CAMA BOSTON 135 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013251",
    "descripcion": "FORRO CAMA BERLIN 160 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013252",
    "descripcion": "FORRO CAMA BERLIN 160 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013254",
    "descripcion": "FORRO CAMA BERLIN 160 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013255",
    "descripcion": "FORRO CAMA BERLIN 160 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013256",
    "descripcion": "FORRO CAMA BERLIN 160 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013258",
    "descripcion": "FORRO CAMA BERLIN 160 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013259",
    "descripcion": "FORRO CAMA BERLIN 160 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013262",
    "descripcion": "FORRO CAMA BERLIN 160 MARR BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013263",
    "descripcion": "FORRO CAMA BERLIN  ARGO BEIGE 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013264",
    "descripcion": "FORRO CAMA BERLIN 160 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013265",
    "descripcion": "FORRO CAMA BERLIN  ARGO AZUL 160",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013266",
    "descripcion": "FORRO CAMA BOSTON 160 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013267",
    "descripcion": "FORRO CAMA BOSTON 200 FLANIGAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013268",
    "descripcion": "FORRO CAMA BOSTON 105 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013269",
    "descripcion": "FORRO CAMA BOSTON 135 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013270",
    "descripcion": "FORRO CAMA BOSTON 160 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013271",
    "descripcion": "FORRO CAMA BOSTON 200 FLANIGAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013283",
    "descripcion": "FORRO CAMA BERLIN 200 FLAN FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013284",
    "descripcion": "FORRO CAMA BERLIN 200 FLAN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013286",
    "descripcion": "FORRO CAMA BERLIN 200 FLAN TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013287",
    "descripcion": "FORRO CAMA BERLIN 200 FLAN MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013288",
    "descripcion": "FORRO CAMA BERLIN 200 FLAN TIDEWATER",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013290",
    "descripcion": "FORRO CAMA BERLIN 200 MAY SILT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013291",
    "descripcion": "FORRO CAMA BERLIN 200 MAY STUCCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013295",
    "descripcion": "FORRO CAMA BERLIN  ARGO BEIGE 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013296",
    "descripcion": "FORRO CAMA BERLIN 200 DUNC CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013297",
    "descripcion": "FORRO CAMA BERLIN  ARGO AZUL 200",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30013299",
    "descripcion": "FORRO CAMA PRAGA 115 FLAN FUDGE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013300",
    "descripcion": "FORRO CAMA PRAGA 115 FLAN HIBISCUS",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013302",
    "descripcion": "FORRO CAMA PRAGA 115 FLAN TANGELO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013303",
    "descripcion": "FORRO CAMA PRAGA 115 FLAN MERLOT",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013304",
    "descripcion": "FORRO CAMA PRAGA 115 FLAN TIDEWATER",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013311",
    "descripcion": "FORRO CAMA PRAGA 115 ARGO BEIGE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013312",
    "descripcion": "FORRO CAMA PRAGA 115 DUNC CHOCO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013313",
    "descripcion": "FORRO CAMA PRAGA 115 ARGO AZUL",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30013315",
    "descripcion": "FORRO CAMA PRAGA 145 FLAN FUDGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013316",
    "descripcion": "FORRO CAMA PRAGA 145 FLAN HIBISCUS",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013318",
    "descripcion": "FORRO CAMA PRAGA 145 FLAN TANGELO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013319",
    "descripcion": "FORRO CAMA PRAGA 145 FLAN MERLOT",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013320",
    "descripcion": "FORRO CAMA PRAGA 145 FLAN TIDEWATER",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013323",
    "descripcion": "FORRO CAMA PRAGA 145 MAY STUCCO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013327",
    "descripcion": "FORRO CAMA PRAGA  ARGO BEIGE 145",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013328",
    "descripcion": "FORRO CAMA PRAGA 145 DUNC CHOCO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013329",
    "descripcion": "FORRO CAMA PRAGA  ARGO AZUL 145",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30013347",
    "descripcion": "FORRO CAMA PRAGA 170 FLAN FUDGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30013348",
    "descripcion": "FORRO CAMA PRAGA 170 FLAN HIBISCUS",
    "tiempoMin": 8
  },
  {
    "codigo": "30013350",
    "descripcion": "FORRO CAMA PRAGA 170 FLAN TANGELO",
    "tiempoMin": 8
  },
  {
    "codigo": "30013351",
    "descripcion": "FORRO CAMA PRAGA 170 FLAN MERLOT",
    "tiempoMin": 8
  },
  {
    "codigo": "30013352",
    "descripcion": "FORRO CAMA PRAGA 170 FLAN TIDEWATER",
    "tiempoMin": 8
  },
  {
    "codigo": "30013354",
    "descripcion": "FORRO CAMA PRAGA 170 MAY SILT",
    "tiempoMin": 8
  },
  {
    "codigo": "30013358",
    "descripcion": "FORRO CAMA PRAGA 170 MARR BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30013359",
    "descripcion": "FORRO CAMA PRAGA  ARGO BEIGE 170",
    "tiempoMin": 8
  },
  {
    "codigo": "30013360",
    "descripcion": "FORRO CAMA PRAGA 170 DUNC CHOCO",
    "tiempoMin": 8
  },
  {
    "codigo": "30013361",
    "descripcion": "FORRO CAMA PRAGA 170 ARGO AZUL",
    "tiempoMin": 8
  },
  {
    "codigo": "30013379",
    "descripcion": "FORRO CAMA PRAGA 210 FLAN FUDGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013380",
    "descripcion": "FORRO CAMA PRAGA 210 FLAN HIBISCUS",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013382",
    "descripcion": "FORRO CAMA PRAGA 210 FLAN TANGELO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013383",
    "descripcion": "FORRO CAMA PRAGA 210 FLAN MERLOT",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013384",
    "descripcion": "FORRO CAMA PRAGA 210 FLAN TIDEWATER",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013386",
    "descripcion": "FORRO CAMA PRAGA 210 MAY SILT",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013387",
    "descripcion": "FORRO CAMA PRAGA 210 MAY STUCCO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013390",
    "descripcion": "FORRO CAMA PRAGA 210 MARR BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013391",
    "descripcion": "FORRO CAMA PRAGA  ARGO BEIGE 210",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013392",
    "descripcion": "FORRO CAMA PRAGA 210 DUNC CHOCO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013393",
    "descripcion": "FORRO CAMA PRAGA  ARGO AZUL 210",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30013395",
    "descripcion": "FORRO SOFA LIFT RECLINE  MAY SILT",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014127",
    "descripcion": "TAPA T. FALSO NEGRO CAM TOSCA /PRAGA 115",
    "tiempoMin": 2.88
  },
  {
    "codigo": "30014149",
    "descripcion": "TAPA T. FALSO NEGRO CAM TOSCA/PRAGA 145",
    "tiempoMin": 3.03
  },
  {
    "codigo": "30014171",
    "descripcion": "TAPA T. FALSO NEGRO CAM TOSCA/PRAGA 170",
    "tiempoMin": 3.16
  },
  {
    "codigo": "30014195",
    "descripcion": "TAPA T. FALSO NEGRO CAM TOSCA/PRAGA 210",
    "tiempoMin": 3.36
  },
  {
    "codigo": "30014221",
    "descripcion": "TAPA T. FALSO NEGRO CAMA VERONA 105",
    "tiempoMin": 2.38
  },
  {
    "codigo": "30014243",
    "descripcion": "TAPA T. FALSO NEGRO CAMA VERONA 135",
    "tiempoMin": 3.05
  },
  {
    "codigo": "30014265",
    "descripcion": "TAPA T. FALSO NEGRO CAMA VERONA 160",
    "tiempoMin": 3.62
  },
  {
    "codigo": "30014279",
    "descripcion": "FORRO COJIN INTER LIFT ESPALDAR INF",
    "tiempoMin": 5
  },
  {
    "codigo": "30014282",
    "descripcion": "FORRO COJIN INTER CLOUD ESPALDAR INF",
    "tiempoMin": 5
  },
  {
    "codigo": "30014283",
    "descripcion": "FORRO COJIN INTER CLOUD PIES",
    "tiempoMin": 2
  },
  {
    "codigo": "30014325",
    "descripcion": "FORRO BENCH AREZZO 70 FLAN FUDGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014326",
    "descripcion": "FORRO BENCH AREZZO 70 FLAN HIBISCUS",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014328",
    "descripcion": "FORRO BENCH AREZZO 70 FLAN TANGELO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014329",
    "descripcion": "FORRO BENCH AREZZO 70 FLAN MERLOT",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014330",
    "descripcion": "FORRO BENCH AREZZO 70 FLAN TIDEWATER",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014337",
    "descripcion": "FORRO BENCH AREZZO 70 DUNCANO BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014338",
    "descripcion": "FORRO BENCH AREZZO DUNC CHOCOLATE 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014339",
    "descripcion": "FORRO BENCH AREZZO 70 DUNCANO PLOMO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30014341",
    "descripcion": "FORRO BENCH MARSELLA FLAN FUDGE 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014342",
    "descripcion": "FORRO BENCH MARSELLA FLAN HIBISCUS 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014343",
    "descripcion": "FORRO BENCH MARSELLA FLAN TANGELO 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014347",
    "descripcion": "FORRO BENCH MARSELLA MAY SILT 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014386",
    "descripcion": "FORRO MANCHESTER AH CORP (TELA PROPIA)",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30014401",
    "descripcion": "FORRO FOAM FLANIGAN FUDGE 70",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30014403",
    "descripcion": "FORRO FOAM FLANIGAN HIBISCUS 70",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30014405",
    "descripcion": "FORRO FOAM FLANIGAN TANGELO 70",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30014407",
    "descripcion": "FORRO FOAM FLANIGAN MERLOT 70",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30014409",
    "descripcion": "FORRO FOAM 070 FLANIGAN TIDEWATER",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30014413",
    "descripcion": "FORRO FOAM 105 FLANIGAN FUDGE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30014415",
    "descripcion": "FORRO FOAM 105 FLANIGAN HIBISCUS",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30014417",
    "descripcion": "FORRO FOAM FLANIGAN TANGELO 105",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30014419",
    "descripcion": "FORRO FOAM 105 FLANIGAN MERLOT",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30014421",
    "descripcion": "FORRO FOAM FLANIGAN TIDEWAT 105",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30014425",
    "descripcion": "FORRO FOAM 135 FLANIGAN FUDGE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30014428",
    "descripcion": "FORRO FOAM FLANIGAN HIBISCUS 135",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30014430",
    "descripcion": "FORRO FOAM 135 FLANIGAN TANGELO",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30014432",
    "descripcion": "FORRO FOAM FLANIGAN MERLOT 135",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30014434",
    "descripcion": "FORRO FOAM FLANIGAN TIDEWAT 135",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30014658",
    "descripcion": "FORRO BENCH 115 VINTAGE NEGRO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014659",
    "descripcion": "FORRO BENCH 145 VINTAGE NEGRO",
    "tiempoMin": 35
  },
  {
    "codigo": "30014660",
    "descripcion": "FORRO BENCH 115 VINTAGE CAPUCC",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014661",
    "descripcion": "FORRO BENCH VINTAGE CAPUCC ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30014662",
    "descripcion": "FORRO BENCH 115 VINTAGE CAFE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014663",
    "descripcion": "FORRO BENCH 145 VINTAGE CAFE",
    "tiempoMin": 35
  },
  {
    "codigo": "30014664",
    "descripcion": "FORRO BENCH 115 VINTAGE HUMO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014665",
    "descripcion": "FORRO BENCH VINTAGE HUMO ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30014666",
    "descripcion": "FORRO BENCH 115 EPIC OCEANO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014667",
    "descripcion": "FORRO BENCH 145 EPIC OCEANO",
    "tiempoMin": 35
  },
  {
    "codigo": "30014668",
    "descripcion": "FORRO BENCH 115 EPIC TIERRA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014669",
    "descripcion": "FORRO BENCH 145 EPIC TIERRA",
    "tiempoMin": 35
  },
  {
    "codigo": "30014670",
    "descripcion": "FORRO BENCH 115 EPIC OTONO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014671",
    "descripcion": "FORRO BENCH EPIC OTONO ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30014672",
    "descripcion": "FORRO BENCH 115 EPIC ARENA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014673",
    "descripcion": "FORRO BENCH 145 EPIC ARENA",
    "tiempoMin": 35
  },
  {
    "codigo": "30014674",
    "descripcion": "FORRO BENCH EPIC BRUMA ANCHO 115",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014675",
    "descripcion": "FORRO BENCH 145 EPIC BRUMA",
    "tiempoMin": 35
  },
  {
    "codigo": "30014676",
    "descripcion": "FORRO BENCH 115 STONE JASPE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014677",
    "descripcion": "FORRO BENCH STONE JASPE ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30014678",
    "descripcion": "FORRO BENCH 115 STONE COBRE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014679",
    "descripcion": "FORRO BENCH STONE COBRE ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30014680",
    "descripcion": "FORRO BENCH 115 STONE GRAFITO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014681",
    "descripcion": "FORRO BENCH 145 STONE GRAFITO",
    "tiempoMin": 35
  },
  {
    "codigo": "30014682",
    "descripcion": "FORRO BENCH 115 STONE MARMOL",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014683",
    "descripcion": "FORRO BENCH 145 STONE MARMOL",
    "tiempoMin": 35
  },
  {
    "codigo": "30014684",
    "descripcion": "FORRO BENCH 115 STONE PLATA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30014685",
    "descripcion": "FORRO BENCH 145 STONE PLATA",
    "tiempoMin": 35
  },
  {
    "codigo": "30014686",
    "descripcion": "FORRO BUTACA ROMA VINTAGE NEGRO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014687",
    "descripcion": "FORRO BUTACA ROMA VINTAGE CAFE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014688",
    "descripcion": "FORRO BUTACA ROMA VINTAGE CAPUCC",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014689",
    "descripcion": "FORRO BUTACA ROMA VINTAGE HUMO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014690",
    "descripcion": "FORRO BUTACA ROMA EPIC OCEANO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014691",
    "descripcion": "FORRO BUTACA ROMA EPIC TIERRA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014692",
    "descripcion": "FORRO BUTACA ROMA EPIC ARENA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014693",
    "descripcion": "FORRO BUTACA ROMA EPIC BRUMA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014694",
    "descripcion": "FORRO BUTACA ROMA EPIC OTONO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014695",
    "descripcion": "FORRO BUTACA ROMA STONE JASPE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014696",
    "descripcion": "FORRO BUTACA ROMA STONE COBRE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014697",
    "descripcion": "FORRO BUTACA ROMA STONE PLATA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014698",
    "descripcion": "FORRO BUTACA ROMA STONE GRAFITO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014699",
    "descripcion": "FORRO BUTACA ROMA STONE MARMOL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30014700",
    "descripcion": "FORRO CAB CAPRI 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014701",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014702",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014703",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014704",
    "descripcion": "FORRO CAB CAPRI 115X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014705",
    "descripcion": "FORRO CAB CAPRI 145X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014706",
    "descripcion": "FORRO CAB CAPRI 170X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014707",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014708",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014709",
    "descripcion": "FORRO CAB CAPRI 145X50 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014710",
    "descripcion": "FORRO CAB CAPRI 170X50 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014711",
    "descripcion": "FORRO CAB CAPRI 210X50 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014712",
    "descripcion": "FORRO CAB CAPRI 115X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014713",
    "descripcion": "FORRO CAB CAPRI 145X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014714",
    "descripcion": "FORRO CAB CAPRI 170X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014715",
    "descripcion": "FORRO CAB CAPRI 210X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014716",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014717",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014718",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014719",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014720",
    "descripcion": "FORRO CAB CAPRI 115X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014721",
    "descripcion": "FORRO CAB CAPRI 145X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014722",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014723",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014724",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014725",
    "descripcion": "FORRO CAB CAPRI 145X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014726",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014727",
    "descripcion": "FORRO CAB CAPRI 210X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014728",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014729",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014730",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014731",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014732",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014733",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014734",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014735",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014736",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014737",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014738",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014739",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014740",
    "descripcion": "FORRO CAB CAPRI 115X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014741",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014742",
    "descripcion": "FORRO CAB CAPRI 170X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014743",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014744",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014745",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014746",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014747",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014748",
    "descripcion": "FORRO CAB CAPRI 115X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014749",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014750",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014751",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014752",
    "descripcion": "FORRO CAB CAPRI 50 1.5PLZ STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014753",
    "descripcion": "FORRO CAB CAPRI 50 2PLZ STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014754",
    "descripcion": "FORRO CAB CAPRI 50 2.5PLZ STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014755",
    "descripcion": "FORRO CAB CAPRI 50 3PLZ STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014756",
    "descripcion": "FORRO CAB CAPRI 145X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014757",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014758",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014759",
    "descripcion": "FORRO CAB CAPRI 72 2PLZ VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014760",
    "descripcion": "FORRO CAB CAPRI 170X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014761",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014762",
    "descripcion": "FORRO CAB CAPRI 145X72 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014763",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014764",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014765",
    "descripcion": "FORRO CAB CAPRI 72 2PLZ VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014766",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014767",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014768",
    "descripcion": "FORRO CAB CAPRI 72 2PLZ EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014769",
    "descripcion": "FORRO CAB CAPRI 170X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014770",
    "descripcion": "FORRO CAB CAPRI 210X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014771",
    "descripcion": "FORRO CAB CAPRI 145X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014772",
    "descripcion": "FORRO CAB CAPRI 170X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014773",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014774",
    "descripcion": "FORRO CAB CAPRI 145X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014775",
    "descripcion": "FORRO CAB CAPRI 170X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014776",
    "descripcion": "FORRO CAB CAPRI 210X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014777",
    "descripcion": "FORRO CAB CAPRI 72 2PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014778",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014779",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014780",
    "descripcion": "FORRO CAB CAPRI 72 2PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014781",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014782",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014783",
    "descripcion": "FORRO CAB CAPRI 145X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014784",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014785",
    "descripcion": "FORRO CAB CAPRI 210X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014786",
    "descripcion": "FORRO CAB CAPRI 145X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014787",
    "descripcion": "FORRO CAB CAPRI 170X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014788",
    "descripcion": "FORRO CAB CAPRI 210X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014789",
    "descripcion": "FORRO CAB CAPRI 145X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014790",
    "descripcion": "FORRO CAB CAPRI 170X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014791",
    "descripcion": "FORRO CAB CAPRI 210X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014792",
    "descripcion": "FORRO CAB CAPRI 72 2PLZ STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014793",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014794",
    "descripcion": "FORRO CAB CAPRI 210X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014795",
    "descripcion": "FORRO CAB CAPRI 145X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014796",
    "descripcion": "FORRO CAB CAPRI 72 2.5PLZ STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014797",
    "descripcion": "FORRO CAB CAPRI 72 3PLZ STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014798",
    "descripcion": "FORRO CAMA BERLIN 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014799",
    "descripcion": "FORRO CAMA BERLIN 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014800",
    "descripcion": "FORRO CAMA BERLIN 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014801",
    "descripcion": "FORRO CAMA BERLIN 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014802",
    "descripcion": "FORRO CAMA BERLIN 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014803",
    "descripcion": "FORRO CAMA BERLIN 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014804",
    "descripcion": "FORRO CAMA BERLIN 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014805",
    "descripcion": "FORRO CAMA BERLIN 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014806",
    "descripcion": "FORRO CAMA BERLIN 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014807",
    "descripcion": "FORRO CAMA BERLIN 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014808",
    "descripcion": "FORRO CAMA BERLIN 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014809",
    "descripcion": "FORRO CAMA BERLIN 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014810",
    "descripcion": "FORRO CAMA BERLIN 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014811",
    "descripcion": "FORRO CAMA BERLIN 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014812",
    "descripcion": "FORRO CAMA BERLIN 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014813",
    "descripcion": "FORRO CAMA BERLIN 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014814",
    "descripcion": "FORRO CAMA BERLIN 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014815",
    "descripcion": "FORRO CAMA BERLIN 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014816",
    "descripcion": "FORRO CAMA BERLIN 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014817",
    "descripcion": "FORRO CAMA BERLIN 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014818",
    "descripcion": "FORRO CAMA BERLIN 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014819",
    "descripcion": "FORRO CAMA BERLIN 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014820",
    "descripcion": "FORRO CAMA BERLIN 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014821",
    "descripcion": "FORRO CAMA BERLIN 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014822",
    "descripcion": "FORRO CAMA BERLIN 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014823",
    "descripcion": "FORRO CAMA BERLIN 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014824",
    "descripcion": "FORRO CAMA BERLIN 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014825",
    "descripcion": "FORRO CAMA BERLIN 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014826",
    "descripcion": "FORRO CAMA BERLIN 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014827",
    "descripcion": "FORRO CAMA BERLIN 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014828",
    "descripcion": "FORRO CAMA BERLIN 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014829",
    "descripcion": "FORRO CAMA BERLIN 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014830",
    "descripcion": "FORRO CAMA BERLIN 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014831",
    "descripcion": "FORRO CAMA BERLIN 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014832",
    "descripcion": "FORRO CAMA BERLIN 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014833",
    "descripcion": "FORRO CAMA BERLIN 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014834",
    "descripcion": "FORRO CAMA BERLIN 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014835",
    "descripcion": "FORRO CAMA BERLIN 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014836",
    "descripcion": "FORRO CAMA BERLIN 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014837",
    "descripcion": "FORRO CAMA BERLIN 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014838",
    "descripcion": "FORRO CAMA BERLIN 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014839",
    "descripcion": "FORRO CAMA BERLIN 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014840",
    "descripcion": "FORRO CAMA BERLIN 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014841",
    "descripcion": "FORRO CAMA BERLIN 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014842",
    "descripcion": "FORRO CAMA BERLIN 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014843",
    "descripcion": "FORRO CAMA BERLIN 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014844",
    "descripcion": "FORRO CAMA BERLIN 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014845",
    "descripcion": "FORRO CAMA BERLIN 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014846",
    "descripcion": "FORRO CAMA BERLIN 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014847",
    "descripcion": "FORRO CAMA BERLIN 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014848",
    "descripcion": "FORRO CAMA BERLIN 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014849",
    "descripcion": "FORRO CAMA BERLIN 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014850",
    "descripcion": "FORRO CAMA BERLIN 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014851",
    "descripcion": "FORRO CAMA BERLIN 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014852",
    "descripcion": "FORRO CAMA BERLIN 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014853",
    "descripcion": "FORRO CAMA BERLIN 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014854",
    "descripcion": "FORRO CAMA BARU 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014855",
    "descripcion": "FORRO CAMA BARU 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014856",
    "descripcion": "FORRO CAMA BARU 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014857",
    "descripcion": "FORRO CAMA BARU 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014858",
    "descripcion": "FORRO CAMA BARU 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014859",
    "descripcion": "FORRO CAMA BARU 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014860",
    "descripcion": "FORRO CAMA BARU 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014861",
    "descripcion": "FORRO CAMA BARU 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014862",
    "descripcion": "FORRO CAMA BARU 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014863",
    "descripcion": "FORRO CAMA BARU 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014864",
    "descripcion": "FORRO CAMA BARU 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014865",
    "descripcion": "FORRO CAMA BARU 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014866",
    "descripcion": "FORRO CAMA BARU 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014867",
    "descripcion": "FORRO CAMA BARU 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014868",
    "descripcion": "FORRO CAMA BARU 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014869",
    "descripcion": "FORRO CAMA BARU 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014870",
    "descripcion": "FORRO CAMA BARU 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014871",
    "descripcion": "FORRO CAMA BARU 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014872",
    "descripcion": "FORRO CAMA BARU 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014873",
    "descripcion": "FORRO CAMA BARU 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014874",
    "descripcion": "FORRO CAMA BARU 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014875",
    "descripcion": "FORRO CAMA BARU 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014876",
    "descripcion": "FORRO CAMA BARU 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014877",
    "descripcion": "FORRO CAMA BARU 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014878",
    "descripcion": "FORRO CAMA BARU 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014879",
    "descripcion": "FORRO CAMA BARU 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014880",
    "descripcion": "FORRO CAMA BARU 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014881",
    "descripcion": "FORRO CAMA BARU 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014882",
    "descripcion": "FORRO CAMA BARU 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014883",
    "descripcion": "FORRO CAMA BARU 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014884",
    "descripcion": "FORRO CAMA BARU 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014885",
    "descripcion": "FORRO CAMA BARU 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014886",
    "descripcion": "FORRO CAMA BARU 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014887",
    "descripcion": "FORRO CAMA BARU 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014888",
    "descripcion": "FORRO CAMA BARU 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014889",
    "descripcion": "FORRO CAMA BARU 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014890",
    "descripcion": "FORRO CAMA BARU 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014891",
    "descripcion": "FORRO CAMA BARU 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014892",
    "descripcion": "FORRO CAMA BARU 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014893",
    "descripcion": "FORRO CAMA BARU 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014894",
    "descripcion": "FORRO CAMA BARU 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014895",
    "descripcion": "FORRO CAMA BARU 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014896",
    "descripcion": "FORRO CAMA BARU 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014897",
    "descripcion": "FORRO CAMA BARU 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014898",
    "descripcion": "FORRO CAMA BARU 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014899",
    "descripcion": "FORRO CAMA BARU 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014900",
    "descripcion": "FORRO CAMA BARU 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014901",
    "descripcion": "FORRO CAMA BARU 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014902",
    "descripcion": "FORRO CAMA BARU 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014903",
    "descripcion": "FORRO CAMA BARU 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014904",
    "descripcion": "FORRO CAMA BARU 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014905",
    "descripcion": "FORRO CAMA BARU 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014906",
    "descripcion": "FORRO CAMA BARU 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014907",
    "descripcion": "FORRO CAMA BARU 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014908",
    "descripcion": "FORRO CAMA BARU 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014909",
    "descripcion": "FORRO CAMA BARU 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014910",
    "descripcion": "FORRO CAMA CRETA 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014911",
    "descripcion": "FORRO CAMA CRETA 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014912",
    "descripcion": "FORRO CAMA CRETA 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014913",
    "descripcion": "FORRO CAMA CRETA 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014914",
    "descripcion": "FORRO CAMA CRETA 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014915",
    "descripcion": "FORRO CAMA CRETA 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014916",
    "descripcion": "FORRO CAMA CRETA 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014917",
    "descripcion": "FORRO CAMA CRETA 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014918",
    "descripcion": "FORRO CAMA CRETA 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014919",
    "descripcion": "FORRO CAMA CRETA 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014920",
    "descripcion": "FORRO CAMA CRETA 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014921",
    "descripcion": "FORRO CAMA CRETA 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014922",
    "descripcion": "FORRO CAMA CRETA 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014923",
    "descripcion": "FORRO CAMA CRETA 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014924",
    "descripcion": "FORRO CAMA CRETA 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014925",
    "descripcion": "FORRO CAMA CRETA 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014926",
    "descripcion": "FORRO CAMA CRETA 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014927",
    "descripcion": "FORRO CAMA CRETA 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014928",
    "descripcion": "FORRO CAMA CRETA 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014929",
    "descripcion": "FORRO CAMA CRETA 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014930",
    "descripcion": "FORRO CAMA CRETA 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014931",
    "descripcion": "FORRO CAMA CRETA 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014932",
    "descripcion": "FORRO CAMA CRETA 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014933",
    "descripcion": "FORRO CAMA CRETA 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014934",
    "descripcion": "FORRO CAMA CRETA 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014935",
    "descripcion": "FORRO CAMA CRETA 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014936",
    "descripcion": "FORRO CAMA CRETA 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014937",
    "descripcion": "FORRO CAMA CRETA 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014938",
    "descripcion": "FORRO CAMA CRETA 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014939",
    "descripcion": "FORRO CAMA CRETA 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014940",
    "descripcion": "FORRO CAMA CRETA 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014941",
    "descripcion": "FORRO CAMA CRETA 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014942",
    "descripcion": "FORRO CAMA CRETA 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014943",
    "descripcion": "FORRO CAMA CRETA 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014944",
    "descripcion": "FORRO CAMA CRETA 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014945",
    "descripcion": "FORRO CAMA CRETA 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014946",
    "descripcion": "FORRO CAMA CRETA 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014947",
    "descripcion": "FORRO CAMA CRETA 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014948",
    "descripcion": "FORRO CAMA CRETA 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014949",
    "descripcion": "FORRO CAMA CRETA 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014950",
    "descripcion": "FORRO CAMA CRETA 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014951",
    "descripcion": "FORRO CAMA CRETA 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014952",
    "descripcion": "FORRO CAMA CRETA 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014953",
    "descripcion": "FORRO CAMA CRETA 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014954",
    "descripcion": "FORRO CAMA CRETA 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014955",
    "descripcion": "FORRO CAMA CRETA 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014956",
    "descripcion": "FORRO CAMA CRETA 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014957",
    "descripcion": "FORRO CAMA CRETA 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014958",
    "descripcion": "FORRO CAMA CRETA 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014959",
    "descripcion": "FORRO CAMA CRETA 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014960",
    "descripcion": "FORRO CAMA CRETA 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014961",
    "descripcion": "FORRO CAMA CRETA 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014962",
    "descripcion": "FORRO CAMA CRETA 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014963",
    "descripcion": "FORRO CAMA CRETA 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014964",
    "descripcion": "FORRO CAMA CRETA 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014965",
    "descripcion": "FORRO CAMA CRETA 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014966",
    "descripcion": "FORRO CAMA FLORENCIA 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014967",
    "descripcion": "FORRO CAMA FLORENCIA 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014968",
    "descripcion": "FORRO CAMA FLORENCIA 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014969",
    "descripcion": "FORRO CAMA FLORENCIA 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014970",
    "descripcion": "FORRO CAMA FLORENCIA 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014971",
    "descripcion": "FORRO CAMA FLORENCIA 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014972",
    "descripcion": "FORRO CAMA FLORENCIA 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014973",
    "descripcion": "FORRO CAMA FLORENCIA 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014974",
    "descripcion": "FORRO CAMA FLORENCIA 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014975",
    "descripcion": "FORRO CAMA FLORENCIA 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014976",
    "descripcion": "FORRO CAMA FLORENCIA 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014977",
    "descripcion": "FORRO CAMA FLORENCIA 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014978",
    "descripcion": "FORRO CAMA FLORENCIA 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014979",
    "descripcion": "FORRO CAMA FLORENCIA 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014980",
    "descripcion": "FORRO CAMA FLORENCIA 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014981",
    "descripcion": "FORRO CAMA FLORENCIA 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014982",
    "descripcion": "FORRO CAMA FLORENCIA 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014983",
    "descripcion": "FORRO CAMA FLORENCIA 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014984",
    "descripcion": "FORRO CAMA FLORENCIA 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014985",
    "descripcion": "FORRO CAMA FLORENCIA 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014986",
    "descripcion": "FORRO CAMA FLORENCIA 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014987",
    "descripcion": "FORRO CAMA FLORENCIA 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014988",
    "descripcion": "FORRO CAMA FLORENCIA 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014989",
    "descripcion": "FORRO CAMA FLORENCIA 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014990",
    "descripcion": "FORRO CAMA FLORENCIA 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014991",
    "descripcion": "FORRO CAMA FLORENCIA 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014992",
    "descripcion": "FORRO CAMA FLORENCIA 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014993",
    "descripcion": "FORRO CAMA FLORENCIA 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014994",
    "descripcion": "FORRO CAMA FLORENCIA 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014995",
    "descripcion": "FORRO CAMA FLORENCIA 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014996",
    "descripcion": "FORRO CAMA FLORENCIA 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014997",
    "descripcion": "FORRO CAMA FLORENCIA 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014998",
    "descripcion": "FORRO CAMA FLORENCIA 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30014999",
    "descripcion": "FORRO CAMA FLORENCIA 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015000",
    "descripcion": "FORRO CAMA FLORENCIA 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015001",
    "descripcion": "FORRO CAMA FLORENCIA 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015002",
    "descripcion": "FORRO CAMA FLORENCIA 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015003",
    "descripcion": "FORRO CAMA FLORENCIA 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015004",
    "descripcion": "FORRO CAMA FLORENCIA 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015005",
    "descripcion": "FORRO CAMA FLORENCIA 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015006",
    "descripcion": "FORRO CAMA FLORENCIA 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015007",
    "descripcion": "FORRO CAMA FLORENCIA 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015008",
    "descripcion": "FORRO CAMA FLORENCIA 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015009",
    "descripcion": "FORRO CAMA FLORENCIA 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015010",
    "descripcion": "FORRO CAMA FLORENCIA 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015011",
    "descripcion": "FORRO CAMA FLORENCIA 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015012",
    "descripcion": "FORRO CAMA FLORENCIA 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015013",
    "descripcion": "FORRO CAMA FLORENCIA 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015014",
    "descripcion": "FORRO CAMA FLORENCIA 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015015",
    "descripcion": "FORRO CAMA FLORENCIA 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015016",
    "descripcion": "FORRO CAMA FLORENCIA 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015017",
    "descripcion": "FORRO CAMA FLORENCIA 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015018",
    "descripcion": "FORRO CAMA FLORENCIA 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015019",
    "descripcion": "FORRO CAMA FLORENCIA 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015020",
    "descripcion": "FORRO CAMA FLORENCIA 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015021",
    "descripcion": "FORRO CAMA FLORENCIA 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015022",
    "descripcion": "FORRO CAMA LISBOA 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015023",
    "descripcion": "FORRO CAMA LISBOA 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015024",
    "descripcion": "FORRO CAMA LISBOA 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015025",
    "descripcion": "FORRO CAMA LISBOA 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015026",
    "descripcion": "FORRO CAMA LISBOA 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015027",
    "descripcion": "FORRO CAMA LISBOA 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015028",
    "descripcion": "FORRO CAMA LISBOA 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015029",
    "descripcion": "FORRO CAMA LISBOA 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015030",
    "descripcion": "FORRO CAMA LISBOA 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015031",
    "descripcion": "FORRO CAMA LISBOA 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015032",
    "descripcion": "FORRO CAMA LISBOA 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015033",
    "descripcion": "FORRO CAMA LISBOA 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015034",
    "descripcion": "FORRO CAMA LISBOA 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015035",
    "descripcion": "FORRO CAMA LISBOA 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015036",
    "descripcion": "FORRO CAMA LISBOA 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015037",
    "descripcion": "FORRO CAMA LISBOA 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015038",
    "descripcion": "FORRO CAMA LISBOA 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015039",
    "descripcion": "FORRO CAMA LISBOA 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015040",
    "descripcion": "FORRO CAMA LISBOA 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015041",
    "descripcion": "FORRO CAMA LISBOA 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015042",
    "descripcion": "FORRO CAMA LISBOA 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015043",
    "descripcion": "FORRO CAMA LISBOA 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015044",
    "descripcion": "FORRO CAMA LISBOA 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015045",
    "descripcion": "FORRO CAMA LISBOA 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015046",
    "descripcion": "FORRO CAMA LISBOA 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015047",
    "descripcion": "FORRO CAMA LISBOA 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015048",
    "descripcion": "FORRO CAMA LISBOA 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015049",
    "descripcion": "FORRO CAMA LISBOA 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015050",
    "descripcion": "FORRO CAMA LISBOA 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015051",
    "descripcion": "FORRO CAMA LISBOA 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015052",
    "descripcion": "FORRO CAMA LISBOA 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015053",
    "descripcion": "FORRO CAMA LISBOA 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015054",
    "descripcion": "FORRO CAMA LISBOA 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015055",
    "descripcion": "FORRO CAMA LISBOA 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015056",
    "descripcion": "FORRO CAMA LISBOA 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015057",
    "descripcion": "FORRO CAMA LISBOA 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015058",
    "descripcion": "FORRO CAMA LISBOA 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015059",
    "descripcion": "FORRO CAMA LISBOA 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015060",
    "descripcion": "FORRO CAMA LISBOA 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015061",
    "descripcion": "FORRO CAMA LISBOA 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015062",
    "descripcion": "FORRO CAMA LISBOA 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015063",
    "descripcion": "FORRO CAMA LISBOA 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015064",
    "descripcion": "FORRO CAMA LISBOA 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015065",
    "descripcion": "FORRO CAMA LISBOA 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015066",
    "descripcion": "FORRO CAMA LISBOA 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015067",
    "descripcion": "FORRO CAMA LISBOA 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015068",
    "descripcion": "FORRO CAMA LISBOA 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015069",
    "descripcion": "FORRO CAMA LISBOA 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015070",
    "descripcion": "FORRO CAMA LISBOA 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015071",
    "descripcion": "FORRO CAMA LISBOA 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015072",
    "descripcion": "FORRO CAMA LISBOA 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015073",
    "descripcion": "FORRO CAMA LISBOA 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015074",
    "descripcion": "FORRO CAMA LISBOA 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015075",
    "descripcion": "FORRO CAMA LISBOA 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015076",
    "descripcion": "FORRO CAMA LISBOA 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015077",
    "descripcion": "FORRO CAMA LISBOA 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015078",
    "descripcion": "FORRO CAMA MILOS 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015079",
    "descripcion": "FORRO CAMA MILOS 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015080",
    "descripcion": "FORRO CAMA MILOS 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015081",
    "descripcion": "FORRO CAMA MILOS 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015082",
    "descripcion": "FORRO CAMA MILOS 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015083",
    "descripcion": "FORRO CAMA MILOS 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015084",
    "descripcion": "FORRO CAMA MILOS 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015085",
    "descripcion": "FORRO CAMA MILOS 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015086",
    "descripcion": "FORRO CAMA MILOS 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015087",
    "descripcion": "FORRO CAMA MILOS 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015088",
    "descripcion": "FORRO CAMA MILOS 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015089",
    "descripcion": "FORRO CAMA MILOS 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015090",
    "descripcion": "FORRO CAMA MILOS 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015091",
    "descripcion": "FORRO CAMA MILOS 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015092",
    "descripcion": "FORRO CAMA MILOS 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015093",
    "descripcion": "FORRO CAMA MILOS 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015094",
    "descripcion": "FORRO CAMA MILOS 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015095",
    "descripcion": "FORRO CAMA MILOS 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015096",
    "descripcion": "FORRO CAMA MILOS 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015097",
    "descripcion": "FORRO CAMA MILOS 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015098",
    "descripcion": "FORRO CAMA MILOS 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015099",
    "descripcion": "FORRO CAMA MILOS 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015100",
    "descripcion": "FORRO CAMA MILOS 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015101",
    "descripcion": "FORRO CAMA MILOS 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015102",
    "descripcion": "FORRO CAMA MILOS 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015103",
    "descripcion": "FORRO CAMA MILOS 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015104",
    "descripcion": "FORRO CAMA MILOS 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015105",
    "descripcion": "FORRO CAMA MILOS 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015106",
    "descripcion": "FORRO CAMA MILOS 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015107",
    "descripcion": "FORRO CAMA MILOS 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015108",
    "descripcion": "FORRO CAMA MILOS 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015109",
    "descripcion": "FORRO CAMA MILOS 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015110",
    "descripcion": "FORRO CAMA MILOS 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015111",
    "descripcion": "FORRO CAMA MILOS 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015112",
    "descripcion": "FORRO CAMA MILOS 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015113",
    "descripcion": "FORRO CAMA MILOS 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015114",
    "descripcion": "FORRO CAMA MILOS 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015115",
    "descripcion": "FORRO CAMA MILOS 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015116",
    "descripcion": "FORRO CAMA MILOS 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015117",
    "descripcion": "FORRO CAMA MILOS 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015118",
    "descripcion": "FORRO CAMA MILOS 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015119",
    "descripcion": "FORRO CAMA MILOS 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015120",
    "descripcion": "FORRO CAMA MILOS 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015121",
    "descripcion": "FORRO CAMA MILOS 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015122",
    "descripcion": "FORRO CAMA MILOS 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015123",
    "descripcion": "FORRO CAMA MILOS 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015124",
    "descripcion": "FORRO CAMA MILOS 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015125",
    "descripcion": "FORRO CAMA MILOS 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015126",
    "descripcion": "FORRO CAMA MILOS 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015127",
    "descripcion": "FORRO CAMA MILOS 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015128",
    "descripcion": "FORRO CAMA MILOS 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015129",
    "descripcion": "FORRO CAMA MILOS 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015130",
    "descripcion": "FORRO CAMA MILOS 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015131",
    "descripcion": "FORRO CAMA MILOS 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015132",
    "descripcion": "FORRO CAMA MILOS 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015133",
    "descripcion": "FORRO CAMA MILOS 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015134",
    "descripcion": "FORRO CAMA LONDRES 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015135",
    "descripcion": "FORRO CAMA LONDRES 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015136",
    "descripcion": "FORRO CAMA LONDRES 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015137",
    "descripcion": "FORRO CAMA LONDRES 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015138",
    "descripcion": "FORRO CAMA LONDRES 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015139",
    "descripcion": "FORRO CAMA LONDRES 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015140",
    "descripcion": "FORRO CAMA LONDRES 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015141",
    "descripcion": "FORRO CAMA LONDRES 200 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015142",
    "descripcion": "FORRO CAMA LONDRES 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015143",
    "descripcion": "FORRO CAMA LONDRES 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015144",
    "descripcion": "FORRO CAMA LONDRES 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015145",
    "descripcion": "FORRO CAMA LONDRES 200 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015146",
    "descripcion": "FORRO CAMA LONDRES 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015147",
    "descripcion": "FORRO CAMA LONDRES 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015148",
    "descripcion": "FORRO CAMA LONDRES 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015149",
    "descripcion": "FORRO CAMA LONDRES 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015150",
    "descripcion": "FORRO CAMA LONDRES 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015151",
    "descripcion": "FORRO CAMA LONDRES 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015152",
    "descripcion": "FORRO CAMA LONDRES 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015153",
    "descripcion": "FORRO CAMA LONDRES 200 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015154",
    "descripcion": "FORRO CAMA LONDRES 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015155",
    "descripcion": "FORRO CAMA LONDRES 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015156",
    "descripcion": "FORRO CAMA LONDRES 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015157",
    "descripcion": "FORRO CAMA LONDRES 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015158",
    "descripcion": "FORRO CAMA LONDRES 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015159",
    "descripcion": "FORRO CAMA LONDRES 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015160",
    "descripcion": "FORRO CAMA LONDRES 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015161",
    "descripcion": "FORRO CAMA LONDRES 200 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015162",
    "descripcion": "FORRO CAMA LONDRES 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015163",
    "descripcion": "FORRO CAMA LONDRES 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015164",
    "descripcion": "FORRO CAMA LONDRES 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015165",
    "descripcion": "FORRO CAMA LONDRES 200 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015166",
    "descripcion": "FORRO CAMA LONDRES 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015167",
    "descripcion": "FORRO CAMA LONDRES 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015168",
    "descripcion": "FORRO CAMA LONDRES 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015169",
    "descripcion": "FORRO CAMA LONDRES 200 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015170",
    "descripcion": "FORRO CAMA LONDRES 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015171",
    "descripcion": "FORRO CAMA LONDRES 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015172",
    "descripcion": "FORRO CAMA LONDRES 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015173",
    "descripcion": "FORRO CAMA LONDRES 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015174",
    "descripcion": "FORRO CAMA LONDRES 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015175",
    "descripcion": "FORRO CAMA LONDRES 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015176",
    "descripcion": "FORRO CAMA LONDRES 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015177",
    "descripcion": "FORRO CAMA LONDRES 200 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015178",
    "descripcion": "FORRO CAMA LONDRES 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015179",
    "descripcion": "FORRO CAMA LONDRES 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015180",
    "descripcion": "FORRO CAMA LONDRES 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015181",
    "descripcion": "FORRO CAMA LONDRES 200 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015182",
    "descripcion": "FORRO CAMA LONDRES 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015183",
    "descripcion": "FORRO CAMA LONDRES 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015184",
    "descripcion": "FORRO CAMA LONDRES 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015185",
    "descripcion": "FORRO CAMA LONDRES 200 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015186",
    "descripcion": "FORRO CAMA LONDRES 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015187",
    "descripcion": "FORRO CAMA LONDRES 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015188",
    "descripcion": "FORRO CAMA LONDRES 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015189",
    "descripcion": "FORRO CAMA LONDRES 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015190",
    "descripcion": "FORRO CAMA PRAGA 115 VINTAGE NEGRO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015191",
    "descripcion": "FORRO CAMA PRAGA 145 VINTAGE NEGRO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015192",
    "descripcion": "FORRO CAMA PRAGA 170 VINTAGE NEGRO",
    "tiempoMin": 8
  },
  {
    "codigo": "30015193",
    "descripcion": "FORRO CAMA PRAGA 210 VINTAGE NEGRO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015194",
    "descripcion": "FORRO CAMA PRAGA 115 VINTAGE CAFE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015195",
    "descripcion": "FORRO CAMA PRAGA 145 VINTAGE CAFE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015196",
    "descripcion": "FORRO CAMA PRAGA 170 VINTAGE CAFE",
    "tiempoMin": 8
  },
  {
    "codigo": "30015197",
    "descripcion": "FORRO CAMA PRAGA 210 VINTAGE CAFE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015198",
    "descripcion": "FORRO CAMA PRAGA 115 VINTAGE CAPUCC",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015199",
    "descripcion": "FORRO CAMA PRAGA 145 VINTAGE CAPUCC",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015200",
    "descripcion": "FORRO CAMA PRAGA 170 VINTAGE CAPUCC",
    "tiempoMin": 8
  },
  {
    "codigo": "30015201",
    "descripcion": "FORRO CAMA PRAGA 210 VINTAGE CAPUCC",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015202",
    "descripcion": "FORRO CAMA PRAGA 115 VINTAGE HUMO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015203",
    "descripcion": "FORRO CAMA PRAGA 145 VINTAGE HUMO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015204",
    "descripcion": "FORRO CAMA PRAGA 170 VINTAGE HUMO",
    "tiempoMin": 8
  },
  {
    "codigo": "30015205",
    "descripcion": "FORRO CAMA PRAGA 210 VINTAGE HUMO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015206",
    "descripcion": "FORRO CAMA PRAGA 115 EPIC OCEANO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015207",
    "descripcion": "FORRO CAMA PRAGA 145 EPIC OCEANO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015208",
    "descripcion": "FORRO CAMA PRAGA 170 EPIC OCEANO",
    "tiempoMin": 8
  },
  {
    "codigo": "30015209",
    "descripcion": "FORRO CAMA PRAGA 210 EPIC OCEANO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015210",
    "descripcion": "FORRO CAMA PRAGA 115 EPIC TIERRA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015211",
    "descripcion": "FORRO CAMA PRAGA 145 EPIC TIERRA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015212",
    "descripcion": "FORRO CAMA PRAGA 170 EPIC TIERRA",
    "tiempoMin": 8
  },
  {
    "codigo": "30015213",
    "descripcion": "FORRO CAMA PRAGA 210 EPIC TIERRA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015214",
    "descripcion": "FORRO CAMA PRAGA 115 EPIC ARENA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015215",
    "descripcion": "FORRO CAMA PRAGA 145 EPIC ARENA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015216",
    "descripcion": "FORRO CAMA PRAGA 170 EPIC ARENA",
    "tiempoMin": 8
  },
  {
    "codigo": "30015217",
    "descripcion": "FORRO CAMA PRAGA 210 EPIC ARENA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015218",
    "descripcion": "FORRO CAMA PRAGA 115 EPIC OTONO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015219",
    "descripcion": "FORRO CAMA PRAGA 145 EPIC OTONO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015220",
    "descripcion": "FORRO CAMA PRAGA 170 EPIC OTONO",
    "tiempoMin": 8
  },
  {
    "codigo": "30015221",
    "descripcion": "FORRO CAMA PRAGA 210 EPIC OTONO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015222",
    "descripcion": "FORRO CAMA PRAGA 115 EPIC BRUMA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015223",
    "descripcion": "FORRO CAMA PRAGA 145 EPIC BRUMA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015224",
    "descripcion": "FORRO CAMA PRAGA 170 EPIC BRUMA",
    "tiempoMin": 8
  },
  {
    "codigo": "30015225",
    "descripcion": "FORRO CAMA PRAGA 210 EPIC BRUMA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015226",
    "descripcion": "FORRO CAMA PRAGA 115 STONE JASPE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015227",
    "descripcion": "FORRO CAMA PRAGA 145 STONE JASPE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015228",
    "descripcion": "FORRO CAMA PRAGA 170 STONE JASPE",
    "tiempoMin": 8
  },
  {
    "codigo": "30015229",
    "descripcion": "FORRO CAMA PRAGA 210 STONE JASPE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015230",
    "descripcion": "FORRO CAMA PRAGA 115 STONE COBRE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015231",
    "descripcion": "FORRO CAMA PRAGA 145 STONE COBRE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015232",
    "descripcion": "FORRO CAMA PRAGA 170 STONE COBRE",
    "tiempoMin": 8
  },
  {
    "codigo": "30015233",
    "descripcion": "FORRO CAMA PRAGA 210 STONE COBRE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015234",
    "descripcion": "FORRO CAMA PRAGA 115 STONE PLATA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015235",
    "descripcion": "FORRO CAMA PRAGA 145 STONE PLATA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015236",
    "descripcion": "FORRO CAMA PRAGA 170 STONE PLATA",
    "tiempoMin": 8
  },
  {
    "codigo": "30015237",
    "descripcion": "FORRO CAMA PRAGA 210 STONE PLATA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015238",
    "descripcion": "FORRO CAMA PRAGA 115 STONE GRAFITO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015239",
    "descripcion": "FORRO CAMA PRAGA 145 STONE GRAFITO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015240",
    "descripcion": "FORRO CAMA PRAGA 170 STONE GRAFITO",
    "tiempoMin": 8
  },
  {
    "codigo": "30015241",
    "descripcion": "FORRO CAMA PRAGA 210 STONE GRAFITO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015242",
    "descripcion": "FORRO CAMA PRAGA 115 STONE MARMOL",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30015243",
    "descripcion": "FORRO CAMA PRAGA 145 STONE MARMOL",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30015244",
    "descripcion": "FORRO CAMA PRAGA 170 STONE MARMOL",
    "tiempoMin": 8
  },
  {
    "codigo": "30015245",
    "descripcion": "FORRO CAMA PRAGA 210 STONE MARMOL",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30015246",
    "descripcion": "FORRO CAMA NAPOLES 105 VINTAGE NEGRO",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015247",
    "descripcion": "FORRO CAMA NAPOLES 135 VINTAGE NEGRO",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015248",
    "descripcion": "FORRO CAMA NAPOLES 160 VINTAGE NEGRO",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015249",
    "descripcion": "FORRO CAMA NAPOLES 200 VINTAGE NEGRO",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015250",
    "descripcion": "FORRO CAMA NAPOLES 105 VINTAGE CAPUCC",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015251",
    "descripcion": "FORRO CAMA NAPOLES 135 VINTAGE CAPUCC",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015252",
    "descripcion": "FORRO CAMA NAPOLES 160 VINTAGE CAPUCC",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015253",
    "descripcion": "FORRO CAMA NAPOLES 200 VINTAGE CAPUCC",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015254",
    "descripcion": "FORRO CAMA NAPOLES 105 VINTAGE CAFE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015255",
    "descripcion": "FORRO CAMA NAPOLES 135 VINTAGE CAFE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015256",
    "descripcion": "FORRO CAMA NAPOLES 160 VINTAGE CAFE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015257",
    "descripcion": "FORRO CAMA NAPOLES 200 VINTAGE CAFE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015258",
    "descripcion": "FORRO CAMA NAPOLES 105 VINTAGE HUMO",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015259",
    "descripcion": "FORRO CAMA NAPOLES 135 VINTAGE HUMO",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015260",
    "descripcion": "FORRO CAMA NAPOLES 160 VINTAGE HUMO",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015261",
    "descripcion": "FORRO CAMA NAPOLES 200 VINTAGE HUMO",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015262",
    "descripcion": "FORRO CAMA NAPOLES 105 EPIC OCEANO",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015263",
    "descripcion": "FORRO CAMA NAPOLES 135 EPIC OCEANO",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015264",
    "descripcion": "FORRO CAMA NAPOLES 160 EPIC OCEANO",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015265",
    "descripcion": "FORRO CAMA NAPOLES 200 EPIC OCEANO",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015266",
    "descripcion": "FORRO CAMA NAPOLES 105 EPIC TIERRA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015267",
    "descripcion": "FORRO CAMA NAPOLES 135 EPIC TIERRA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015268",
    "descripcion": "FORRO CAMA NAPOLES 160 EPIC TIERRA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015269",
    "descripcion": "FORRO CAMA NAPOLES 200 EPIC TIERRA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015270",
    "descripcion": "FORRO CAMA NAPOLES 105 EPIC ARENA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015271",
    "descripcion": "FORRO CAMA NAPOLES 135 EPIC ARENA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015272",
    "descripcion": "FORRO CAMA NAPOLES 160 EPIC ARENA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015273",
    "descripcion": "FORRO CAMA NAPOLES 200 EPIC ARENA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015274",
    "descripcion": "FORRO CAMA NAPOLES 105 EPIC OTONO",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015275",
    "descripcion": "FORRO CAMA NAPOLES 135 EPIC OTONO",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015276",
    "descripcion": "FORRO CAMA NAPOLES 160 EPIC OTONO",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015277",
    "descripcion": "FORRO CAMA NAPOLES 200 EPIC OTONO",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015278",
    "descripcion": "FORRO CAMA NAPOLES 105 EPIC BRUMA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015279",
    "descripcion": "FORRO CAMA NAPOLES 135 EPIC BRUMA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015280",
    "descripcion": "FORRO CAMA NAPOLES 160 EPIC BRUMA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015281",
    "descripcion": "FORRO CAMA NAPOLES 200 EPIC BRUMA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015282",
    "descripcion": "FORRO CAMA NAPOLES 105 STONE JASPE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015283",
    "descripcion": "FORRO CAMA NAPOLES 135 STONE JASPE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015284",
    "descripcion": "FORRO CAMA NAPOLES 160 STONE JASPE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015285",
    "descripcion": "FORRO CAMA NAPOLES 200 STONE JASPE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015286",
    "descripcion": "FORRO CAMA NAPOLES 105 STONE COBRE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015287",
    "descripcion": "FORRO CAMA NAPOLES 135 STONE COBRE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015288",
    "descripcion": "FORRO CAMA NAPOLES 160 STONE COBRE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015289",
    "descripcion": "FORRO CAMA NAPOLES 200 STONE COBRE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015290",
    "descripcion": "FORRO CAMA NAPOLES 105 STONE PLATA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015291",
    "descripcion": "FORRO CAMA NAPOLES 135 STONE PLATA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015292",
    "descripcion": "FORRO CAMA NAPOLES 160 STONE PLATA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015293",
    "descripcion": "FORRO CAMA NAPOLES 200 STONE PLATA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015294",
    "descripcion": "FORRO CAMA NAPOLES 105 STONE GRAFITO",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015295",
    "descripcion": "FORRO CAMA NAPOLES 135 STONE GRAFITO",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015296",
    "descripcion": "FORRO CAMA NAPOLES 160 STONE GRAFITO",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015297",
    "descripcion": "FORRO CAMA NAPOLES 200 STONE GRAFITO",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015298",
    "descripcion": "FORRO CAMA NAPOLES 105 STONE MARMOL",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30015299",
    "descripcion": "FORRO CAMA NAPOLES 135 STONE MARMOL",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30015300",
    "descripcion": "FORRO CAMA NAPOLES 160 STONE MARMOL",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30015301",
    "descripcion": "FORRO CAMA NAPOLES 200 STONE MARMOL",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30015302",
    "descripcion": "FORRO CAMA TOSCANA 115 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015303",
    "descripcion": "FORRO CAMA TOSCANA 145 VINTAGE NEGRO",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015304",
    "descripcion": "FORRO CAMA TOSCANA 170 VINTAGE NEGRO",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015305",
    "descripcion": "FORRO CAMA TOSCANA 200 VINTAGE NEGRO",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015306",
    "descripcion": "FORRO CAMA TOSCANA 115 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015307",
    "descripcion": "FORRO CAMA TOSCANA 135 VINTAGE CAFE",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015308",
    "descripcion": "FORRO CAMA TOSCANA 160 VINTAGE CAFE",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015309",
    "descripcion": "FORRO CAMA TOSCANA 210 VINTAGE CAFE",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015310",
    "descripcion": "FORRO CAMA TOSCANA 115 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015311",
    "descripcion": "FORRO CAMA TOSCANA 135 VINTAGE CAPUCC",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015312",
    "descripcion": "FORRO CAMA TOSCANA 160 VINTAGE CAPUCC",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015313",
    "descripcion": "FORRO CAMA TOSCANA 210 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015314",
    "descripcion": "FORRO CAMA TOSCANA 115 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015315",
    "descripcion": "FORRO CAMA TOSCANA 135 VINTAGE HUMO",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015316",
    "descripcion": "FORRO CAMA TOSCANA 160 VINTAGE HUMO",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015317",
    "descripcion": "FORRO CAMA TOSCANA 200 VINTAGE HUMO",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015318",
    "descripcion": "FORRO CAMA TOSCANA 115 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015319",
    "descripcion": "FORRO CAMA TOSCANA 145 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015320",
    "descripcion": "FORRO CAMA TOSCANA 160 EPIC OCEANO",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015321",
    "descripcion": "FORRO CAMA TOSCANA 200 EPIC OCEANO",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015322",
    "descripcion": "FORRO CAMA TOSCANA 115 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015323",
    "descripcion": "FORRO CAMA TOSCANA 145 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015324",
    "descripcion": "FORRO CAMA TOSCANA 160 EPIC TIERRA",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015325",
    "descripcion": "FORRO CAMA TOSCANA 210 EPIC TIERRA",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015326",
    "descripcion": "FORRO CAMA TOSCANA 115 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015327",
    "descripcion": "FORRO CAMA TOSCANA 145 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015328",
    "descripcion": "FORRO CAMA TOSCANA 170 EPIC ARENA",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015329",
    "descripcion": "FORRO CAMA TOSCANA 200 EPIC ARENA",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015330",
    "descripcion": "FORRO CAMA TOSCANA 115 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015331",
    "descripcion": "FORRO CAMA TOSCANA 145 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015332",
    "descripcion": "FORRO CAMA TOSCANA 170 EPIC OTONO",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015333",
    "descripcion": "FORRO CAMA TOSCANA 210 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015334",
    "descripcion": "FORRO CAMA TOSCANA 105 EPIC BRUMA",
    "tiempoMin": 4.79
  },
  {
    "codigo": "30015335",
    "descripcion": "FORRO CAMA TOSCANA 135 EPIC BRUMA",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015336",
    "descripcion": "FORRO CAMA TOSCANA 170 EPIC BRUMA",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015337",
    "descripcion": "FORRO CAMA TOSCANA 200 EPIC BRUMA",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015338",
    "descripcion": "FORRO CAMA TOSCANA 115 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015339",
    "descripcion": "FORRO CAMA TOSCANA 135 STONE JASPE",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015340",
    "descripcion": "FORRO CAMA TOSCANA 160 STONE JASPE",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015341",
    "descripcion": "FORRO CAMA TOSCANA 210 STONE JASPE",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015342",
    "descripcion": "FORRO CAMA TOSCANA 105 STONE COBRE",
    "tiempoMin": 4.79
  },
  {
    "codigo": "30015343",
    "descripcion": "FORRO CAMA TOSCANA 135 STONE COBRE",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015344",
    "descripcion": "FORRO CAMA TOSCANA 160 STONE COBRE",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015345",
    "descripcion": "FORRO CAMA TOSCANA 200 STONE COBRE",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015346",
    "descripcion": "FORRO CAMA TOSCANA 115 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015347",
    "descripcion": "FORRO CAMA TOSCANA 135 STONE PLATA",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015348",
    "descripcion": "FORRO CAMA TOSCANA 160 STONE PLATA",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015349",
    "descripcion": "FORRO CAMA TOSCANA 200 STONE PLATA",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015350",
    "descripcion": "FORRO CAMA TOSCANA 115 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015351",
    "descripcion": "FORRO CAMA TOSCANA 135 STONE GRAFITO",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015352",
    "descripcion": "FORRO CAMA TOSCANA 160 STONE GRAFITO",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015353",
    "descripcion": "FORRO CAMA TOSCANA 210 STONE GRAFITO",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015354",
    "descripcion": "FORRO CAMA TOSCANA 105 STONE MARMOL",
    "tiempoMin": 4.79
  },
  {
    "codigo": "30015355",
    "descripcion": "FORRO CAMA TOSCANA 135 STONE MARMOL",
    "tiempoMin": 7.22
  },
  {
    "codigo": "30015356",
    "descripcion": "FORRO CAMA TOSCANA 160 STONE MARMOL",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30015357",
    "descripcion": "FORRO CAMA TOSCANA 210 STONE MARMOL",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30015358",
    "descripcion": "FORRO INT COJIN VINTAGE NEGRO 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015360",
    "descripcion": "FORRO INT COJIN VINTAGE CAFE 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015362",
    "descripcion": "FORRO INT COJIN VINTAGE HUMO 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015364",
    "descripcion": "FORRO INT COJIN VINTAGE CAPUCC 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015366",
    "descripcion": "FORRO INT COJIN 45X45 EPIC OCEANO",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015368",
    "descripcion": "FORRO INT COJIN 45X45 EPIC TIERRA",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015370",
    "descripcion": "FORRO INT COJIN EPIC ARENA 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015372",
    "descripcion": "FORRO INT COJIN EPIC BRUMA 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015374",
    "descripcion": "FORRO INT COJIN EPIC OTONO 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015376",
    "descripcion": "FORRO INT COJIN STONE JASPE 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015377",
    "descripcion": "FORRO INT COJIN STONE JASPE 56X27",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015378",
    "descripcion": "FORRO INT COJIN 45X45 STONE COBRE",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015379",
    "descripcion": "FORRO INT COJIN STONE COBRE 56X27",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015380",
    "descripcion": "FORRO INT COJIN 45X45 STONE PLATA",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015382",
    "descripcion": "FORRO INT COJIN STONE GRAFITO 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015384",
    "descripcion": "FORRO INT COJIN 45X45 STONE MARMOL",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015385",
    "descripcion": "FORRO INT COJIN STONE MARMOL 56X27",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30015386",
    "descripcion": "FORRO SOFA MALIBU VINTAGE NEGRO 105X190",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015387",
    "descripcion": "FORRO SOFA MALIBU VINTAGE NEGRO 135X190",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015388",
    "descripcion": "FORRO SOFA MALIBU VINTAGE CAFE 105X190",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015389",
    "descripcion": "FORRO MALIBU 135 VINTAGE CAFE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015390",
    "descripcion": "FORRO MALIBU 105 VINTAGE CAPUCCINO",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015391",
    "descripcion": "FORRO SOFA MALIBU VINTAGE CAPUCC 135X190",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015392",
    "descripcion": "FORRO MALIBU 105 VINTAGE HUMO",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015393",
    "descripcion": "FORRO SOFA MALIBU VINTAGE HUMO 135X190",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015394",
    "descripcion": "FORRO MALIBU 105 EPIC OCEANO",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015395",
    "descripcion": "FORRO MALIBU 135 EPIC OCEANO",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015396",
    "descripcion": "FORRO SOFA MALIBU EPIC TIERRA 105X190",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015397",
    "descripcion": "FORRO MALIBU 135 EPIC TIERRA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015398",
    "descripcion": "FORRO MALIBU 105 EPIC OTONO",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015399",
    "descripcion": "FORRO SOFA MALIBU EPIC OTONO 135X190",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015400",
    "descripcion": "FORRO MALIBU 105 EPIC ARENA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015401",
    "descripcion": "FORRO MALIBU 135 EPIC ARENA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015402",
    "descripcion": "FORRO MALIBU 105 EPIC BRUMA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015403",
    "descripcion": "FORRO MALIBU 135 EPIC BRUMA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015404",
    "descripcion": "FORRO MALIBU 105 STONE PLATA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015405",
    "descripcion": "FORRO MALIBU 135 STONE PLATA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015406",
    "descripcion": "FORRO MALIBU 105 STONE COBRE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015407",
    "descripcion": "FORRO MALIBU 135 STONE COBRE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015408",
    "descripcion": "FORRO MALIBU 105 STONE JASPE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015409",
    "descripcion": "FORRO MALIBU 135 STONE JASPE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015410",
    "descripcion": "FORRO MALIBU 105 STONE MARMOL",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015411",
    "descripcion": "FORRO MALIBU 135 STONE MARMOL",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015412",
    "descripcion": "FORRO MALIBU 105 STONE GRAFITO",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30015413",
    "descripcion": "FORRO MALIBU 135 STONE GRAFITO",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30015414",
    "descripcion": "FORRO FOAM 070 ARGO TURQUESA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30015415",
    "descripcion": "FORRO FOAM 105 ARGO TURQUESA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30015416",
    "descripcion": "FORRO FOAM 135 ARGO TURQUESA",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30015417",
    "descripcion": "FORRO FOAM 070 ARGO AZUL",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30015418",
    "descripcion": "FORRO FOAM 105 ARGO AZUL",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30015419",
    "descripcion": "FORRO FOAM 135 ARGO AZUL",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30015420",
    "descripcion": "FORRO FOAM 070 ARGO TERRACOTA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30015421",
    "descripcion": "FORRO FOAM 105 ARGO TERRACOTA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30015422",
    "descripcion": "FORRO FOAM 135 ARGO TERRACOTA",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30015423",
    "descripcion": "FORRO FOAM 070 ARGO GRIS",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30015424",
    "descripcion": "FORRO FOAM 105 ARGO GRIS",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30015425",
    "descripcion": "FORRO FOAM 135 ARGO GRIS",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30015426",
    "descripcion": "FORRO FOAM 070 ARGO BEIGE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30015427",
    "descripcion": "FORRO FOAM 105 ARGO BEIGE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30015428",
    "descripcion": "FORRO FOAM 135 ARGO BEIGE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30015429",
    "descripcion": "FORRO FOAM 070 ARGO CHOCOLATE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30015430",
    "descripcion": "FORRO FOAM 105 ARGO CHOCOLATE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30015431",
    "descripcion": "FORRO FOAM 135 ARGO CHOCOLATE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30015432",
    "descripcion": "FORRO MANCHESTER 105 VINTAGE NEGRO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015433",
    "descripcion": "FORRO MANCHESTER 105 VINTAGE CAFE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015434",
    "descripcion": "FORRO MANCHESTER 105 VINTAGE CAPUCCINO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015435",
    "descripcion": "FORRO MANCHESTER 105 VINTAGE HUMO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015436",
    "descripcion": "FORRO MANCHESTER 105 EPIC OCEANO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015437",
    "descripcion": "FORRO MANCHESTER 105 EPIC TIERRA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015438",
    "descripcion": "FORRO MANCHESTER 105 EPIC OTONO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015439",
    "descripcion": "FORRO MANCHESTER 105 EPIC ARENA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015440",
    "descripcion": "FORRO MANCHESTER 105 EPIC BRUMA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015441",
    "descripcion": "FORRO MANCHESTER 105 STONE JASPE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015442",
    "descripcion": "FORRO MANCHESTER 105 STONE COBRE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015443",
    "descripcion": "FORRO SOFA MANCHESTER STONE PLATA 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015444",
    "descripcion": "FORRO MANCHESTER 105 STONE GRAFITO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015445",
    "descripcion": "FORRO MANCHESTER 105 STONE MARMOL",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30015446",
    "descripcion": "FORRO CAMA VERONA 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015447",
    "descripcion": "FORRO CAMA VERONA 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015448",
    "descripcion": "FORRO CAMA VERONA 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015449",
    "descripcion": "FORRO CAMA VERONA 105 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015450",
    "descripcion": "FORRO CAMA VERONA 135 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015452",
    "descripcion": "FORRO CAMA VERONA 160 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015453",
    "descripcion": "FORRO CAMA VERONA 105 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015454",
    "descripcion": "FORRO CAMA VERONA 135 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015456",
    "descripcion": "FORRO CAMA VERONA 160 VINTAGE CAPUCC",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015457",
    "descripcion": "FORRO CAMA VERONA 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015458",
    "descripcion": "FORRO CAMA VERONA 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015459",
    "descripcion": "FORRO CAMA VERONA 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015460",
    "descripcion": "FORRO CAMA VERONA 105 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015461",
    "descripcion": "FORRO CAMA VERONA 135 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015462",
    "descripcion": "FORRO CAMA VERONA 160 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015463",
    "descripcion": "FORRO CAMA VERONA 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015464",
    "descripcion": "FORRO CAMA VERONA 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015465",
    "descripcion": "FORRO CAMA VERONA 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015466",
    "descripcion": "FORRO CAMA VERONA 105 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015467",
    "descripcion": "FORRO CAMA VERONA 135 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015468",
    "descripcion": "FORRO CAMA VERONA 160 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015469",
    "descripcion": "FORRO CAMA VERONA 105 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015470",
    "descripcion": "FORRO CAMA VERONA 135 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015471",
    "descripcion": "FORRO CAMA VERONA 160 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015472",
    "descripcion": "FORRO CAMA VERONA 105 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015473",
    "descripcion": "FORRO CAMA VERONA 135 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015474",
    "descripcion": "FORRO CAMA VERONA 160 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015475",
    "descripcion": "FORRO CAMA VERONA 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015476",
    "descripcion": "FORRO CAMA VERONA 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015477",
    "descripcion": "FORRO CAMA VERONA 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015478",
    "descripcion": "FORRO CAMA VERONA 105 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015479",
    "descripcion": "FORRO CAMA VERONA 135 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015480",
    "descripcion": "FORRO CAMA VERONA 160 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015481",
    "descripcion": "FORRO CAMA VERONA 105 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015482",
    "descripcion": "FORRO CAMA VERONA 135 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015483",
    "descripcion": "FORRO CAMA VERONA 160 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015484",
    "descripcion": "FORRO CAMA VERONA 105 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015485",
    "descripcion": "FORRO CAMA VERONA 135 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015486",
    "descripcion": "FORRO CAMA VERONA 160 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015487",
    "descripcion": "FORRO CAMA VERONA 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015488",
    "descripcion": "FORRO CAMA VERONA 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015489",
    "descripcion": "FORRO CAMA VERONA 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30015490",
    "descripcion": "FORRO MATISSE 105 VINTAGE CAFE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015491",
    "descripcion": "FORRO MATISSE 105 VINTAGE NEGRO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015492",
    "descripcion": "FORRO MATISSE 105 VINTAGE CAPUCCINO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015493",
    "descripcion": "FORRO MATISSE 105 VINTAGE HUMO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015494",
    "descripcion": "FORRO MATISSE 105 EPIC OCEANO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015495",
    "descripcion": "FORRO MATISSE 105 EPIC ARENA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015496",
    "descripcion": "FORRO MATISSE 105 EPIC TIERRA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015497",
    "descripcion": "FORRO MATISSE 105 EPIC OTONO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015498",
    "descripcion": "FORRO MATISSE 105 EPIC BRUMA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015499",
    "descripcion": "FORRO MATISSE 105 STONE JASPE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015500",
    "descripcion": "FORRO MATISSE 105 STONE COBRE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015501",
    "descripcion": "FORRO MATISSE 105 STONE PLATA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015502",
    "descripcion": "FORRO MATISSE 105 STONE GRAFITO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015503",
    "descripcion": "FORRO MATISSE 105 STONE MARMOL",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30015504",
    "descripcion": "FORRO SOFA MIAMI VINTAGE NEGRO 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015505",
    "descripcion": "FORRO SOFA MIAMI VINTAGE CAFE 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015506",
    "descripcion": "FORRO SOFA MIAMI VINTAGE CAPUCC 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015507",
    "descripcion": "FORRO MIAMI 105 VINTAGE HUMO",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015508",
    "descripcion": "FORRO SOFA MIAMI EPIC OCEANO 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015509",
    "descripcion": "FORRO MIAMI 105 EPIC TIERRA",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015510",
    "descripcion": "FORRO SOFA MIAMI EPIC OTONO 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015511",
    "descripcion": "FORRO SOFA MIAMI EPIC ARENA 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015512",
    "descripcion": "FORRO MIAMI 105 EPIC BRUMA",
    "tiempoMin": 86.06
  },
  {
    "codigo": "30015513",
    "descripcion": "FORRO MIAMI 105 STONE JASPE",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015514",
    "descripcion": "FORRO SOFA MIAMI STONE COBRE 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015515",
    "descripcion": "FORRO MIAMI 105 STONE PLATA",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015516",
    "descripcion": "FORRO SOFA MIAMI STONE GRAFITO 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015517",
    "descripcion": "FORRO MIAMI 105 STONE MARMOL",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30015518",
    "descripcion": "FORRO MILANO 105 VINTAGE NEGRO",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015519",
    "descripcion": "FORRO SOFA MILANO VINTAGE CAFE 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015520",
    "descripcion": "FORRO SOFA MILANO VINTAGE CAPUCC 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015521",
    "descripcion": "FORRO SOFA MILANO VINTAGE HUMO 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015522",
    "descripcion": "FORRO SOFA MILANO EPIC OCEANO 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015523",
    "descripcion": "FORRO MILANO 105 EPIC TIERRA",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015524",
    "descripcion": "FORRO SOFA MILANO EPIC ARENA 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015525",
    "descripcion": "FORRO SOFA MILANO EPIC OTONO 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015526",
    "descripcion": "FORRO SOFA MILANO EPIC BRUMA 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015527",
    "descripcion": "FORRO SOFA MILANO STONE JASPE 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015528",
    "descripcion": "FORRO SOFA MILANO STONE COBRE 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015529",
    "descripcion": "FORRO SOFA MILANO STONE PLATA 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015530",
    "descripcion": "FORRO SOFA MILANO STONE MARMOL 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015531",
    "descripcion": "FORRO SOFA MILANO STONE GRAFITO 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30015532",
    "descripcion": "FORRO MIRAGE 105 VINTAGE NEGRO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015533",
    "descripcion": "FORRO MIRAGE 120 VINTAGE NEGRO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015534",
    "descripcion": "FORRO SOFA MIRAGE VINTAGE NEGRO 135X190",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015535",
    "descripcion": "FORRO MIRAGE 105 VINTAGE CAFE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015536",
    "descripcion": "FORRO MIRAGE 120 VINTAGE CAFE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015537",
    "descripcion": "FORRO MIRAGE 135 VINTAGE CAFE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015538",
    "descripcion": "FORRO MIRAGE 105 VINTAGE CAPUCCINO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015539",
    "descripcion": "FORRO MIRAGE 120 VINTAGE CAPUCCINO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015540",
    "descripcion": "FORRO SOFA MIRAGE VINTAGE CAPUCC 135X190",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015541",
    "descripcion": "FORRO SOFA MIRAGE VINTAGE HUMO 105X190",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015542",
    "descripcion": "FORRO MIRAGE 120 VINTAGE HUMO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015543",
    "descripcion": "FORRO SOFA MIRAGE VINTAGE HUMO 135X190",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015544",
    "descripcion": "FORRO MIRAGE 105 EPIC TIERRA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015545",
    "descripcion": "FORRO MIRAGE 120 EPIC TIERRA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015546",
    "descripcion": "FORRO MIRAGE 135 EPIC TIERRA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015547",
    "descripcion": "FORRO MIRAGE 105 EPIC OCEANO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015548",
    "descripcion": "FORRO MIRAGE 120 EPIC OCEANO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015549",
    "descripcion": "FORRO MIRAGE 135 EPIC OCEANO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015550",
    "descripcion": "FORRO MIRAGE 105 EPIC BRUMA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015551",
    "descripcion": "FORRO SOFA MIRAGE EPIC BRUMA 120X190",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015552",
    "descripcion": "FORRO MIRAGE 135 EPIC BRUMA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015553",
    "descripcion": "FORRO MIRAGE 105 EPIC OTONO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015554",
    "descripcion": "FORRO SOFA MIRAGE EPIC OTONO 120X190",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015555",
    "descripcion": "FORRO MIRAGE 135 EPIC OTONO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015556",
    "descripcion": "FORRO MIRAGE 105 EPIC ARENA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015557",
    "descripcion": "FORRO MIRAGE 120 EPIC ARENA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015558",
    "descripcion": "FORRO MIRAGE 135 EPIC ARENA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015559",
    "descripcion": "FORRO SOFA MIRAGE STONE JASPE 105X190",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015560",
    "descripcion": "FORRO MIRAGE 120 STONE JASPE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015561",
    "descripcion": "FORRO SOFA MIRAGE STONE JASPE 135X190",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015562",
    "descripcion": "FORRO MIRAGE 105 STONE PLATA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015563",
    "descripcion": "FORRO SOFA MIRAGE STONE PLATA 120X190",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015564",
    "descripcion": "FORRO MIRAGE 135 STONE PLATA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015565",
    "descripcion": "FORRO SOFA MIRAGE STONE COBRE 105X190",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015566",
    "descripcion": "FORRO SOFA MIRAGE STONE COBRE 120X190",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015567",
    "descripcion": "FORRO MIRAGE 135 STONE COBRE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015568",
    "descripcion": "FORRO SOFA MIRAGE STONE GRAFITO 105X190",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015569",
    "descripcion": "FORRO SOFA MIRAGE STONE GRAFITO 120X190",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015570",
    "descripcion": "FORRO SOFA MIRAGE STONE GRAFITO 135X190",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015571",
    "descripcion": "FORRO MIRAGE 105 STONE MARMOL",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30015572",
    "descripcion": "FORRO SOFA MIRAGE STONE MARMOL 120X190",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30015573",
    "descripcion": "FORRO SOFA MIRAGE STONE MARMOL 135X190",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30015574",
    "descripcion": "FORRO OTTOMAN VINTAGE NEGRO",
    "tiempoMin": 30
  },
  {
    "codigo": "30015575",
    "descripcion": "FORRO OTTOMAN REDONDO VINTAGE NEGRO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015576",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P VINTAGE NEGRO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015577",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P VINTAGE NEGRO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015578",
    "descripcion": "FORRO OTTOMAN 70 VINTAGE CAFE",
    "tiempoMin": 30
  },
  {
    "codigo": "30015579",
    "descripcion": "FORRO OTTOMAN REDONDO VINTAGE CAFE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015580",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P VINTAGE CAFE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015581",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P VINTAGE CAFE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015582",
    "descripcion": "FORRO OTTOMAN VINTAGE CAPUCC",
    "tiempoMin": 30
  },
  {
    "codigo": "30015583",
    "descripcion": "FORRO OTTOMAN REDONDO VINTAGE CAPUCCINO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015584",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P VINTAGE CAPUC",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015585",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P VINTAGE CAPUC",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015586",
    "descripcion": "FORRO OTTOMAN 70 VINTAGE HUMO",
    "tiempoMin": 30
  },
  {
    "codigo": "30015587",
    "descripcion": "FORRO OTTOMAN REDONDO VINTAGE HUMO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015588",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P VINTAGE HUMO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015589",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P VINTAGE HUMO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015590",
    "descripcion": "FORRO OTTOMAN EPIC OCEANO",
    "tiempoMin": 30
  },
  {
    "codigo": "30015591",
    "descripcion": "FORRO OTTOMAN REDONDO EPIC OCEANO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015592",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P EPIC OCEANO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015593",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P EPIC OCEANO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015594",
    "descripcion": "FORRO OTTOMAN 70 EPIC TIERRA",
    "tiempoMin": 30
  },
  {
    "codigo": "30015595",
    "descripcion": "FORRO OTTOMAN REDONDO EPIC TIERRA",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015596",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P EPIC TIERRA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015597",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P EPIC TIERRA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015598",
    "descripcion": "FORRO OTTOMAN EPIC ARENA",
    "tiempoMin": 30
  },
  {
    "codigo": "30015599",
    "descripcion": "FORRO OTTOMAN REDONDO EPIC ARENA",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015600",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P EPIC ARENA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015601",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P EPIC ARENA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015602",
    "descripcion": "FORRO OTTOMAN EPIC BRUMA",
    "tiempoMin": 30
  },
  {
    "codigo": "30015603",
    "descripcion": "FORRO OTTOMAN REDONDO EPIC BRUMA",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015604",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P EPIC BRUMA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015605",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P EPIC BRUMA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015606",
    "descripcion": "FORRO OTTOMAN 70 EPIC OTONO",
    "tiempoMin": 30
  },
  {
    "codigo": "30015607",
    "descripcion": "FORRO OTTOMAN REDONDO EPIC OTONO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015608",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P EPIC OTONO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015609",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P EPIC OTONO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015610",
    "descripcion": "FORRO OTTOMAN 70 STONE COBRE",
    "tiempoMin": 30
  },
  {
    "codigo": "30015611",
    "descripcion": "FORRO OTTOMAN REDONDO STONE COBRE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015612",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P STONE COBRE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015613",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P STONE COBRE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015614",
    "descripcion": "FORRO OTTOMAN STONE JASPE",
    "tiempoMin": 30
  },
  {
    "codigo": "30015615",
    "descripcion": "FORRO OTTOMAN REDONDO STONE JASPE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015616",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P STONE JASPE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015617",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P STONE JASPE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015618",
    "descripcion": "FORRO OTTOMAN STONE PLATA",
    "tiempoMin": 30
  },
  {
    "codigo": "30015619",
    "descripcion": "FORRO OTTOMAN REDONDO STONE PLATA",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015620",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P STONE PLATA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015621",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P STONE PLATA",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015622",
    "descripcion": "FORRO OTTOMAN STONE GRAFITO",
    "tiempoMin": 30
  },
  {
    "codigo": "30015623",
    "descripcion": "FORRO OTTOMAN REDONDO STONE GRAFITO",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015624",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P STONE GRAFITO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015625",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P STONE GRAFITO",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015626",
    "descripcion": "FORRO OTTOMAN 70 STONE MARMOL",
    "tiempoMin": 30
  },
  {
    "codigo": "30015627",
    "descripcion": "FORRO OTTOMAN REDONDO STONE MARMOL",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30015628",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P STONE MARMOL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015629",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P STONE MARMOL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30015630",
    "descripcion": "FORRO VELADOR FLORENCIA VINTAGE NEGRO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015631",
    "descripcion": "FORRO VELADOR FLORENCIA VINTAGE CAFE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015632",
    "descripcion": "FORRO VELADOR FLORENCIA VINTAGE CAPUCCIN",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015633",
    "descripcion": "FORRO VELADOR FLORENCIA VINTAGE HUMO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015634",
    "descripcion": "FORRO VELADOR FLORENCIA EPIC OCEANO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015635",
    "descripcion": "FORRO VELADOR FLORENCIA EPIC TIERRA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015636",
    "descripcion": "FORRO VELADOR FLORENCIA EPIC ARENA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015637",
    "descripcion": "FORRO VELADOR FLORENCIA EPIC OTONO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015638",
    "descripcion": "FORRO VELADOR FLORENCIA EPIC BRUMA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015639",
    "descripcion": "FORRO VELADOR FLORENCIA STONE COBRE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015640",
    "descripcion": "FORRO VELADOR FLORENCIA STONE PLATA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015641",
    "descripcion": "FORRO VELADOR FLORENCIA STONE GRAFITO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015642",
    "descripcion": "FORRO VELADOR FLORENCIA STONE JASPE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015643",
    "descripcion": "FORRO VELADOR FLORENCIA STONE MARMOL",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30015644",
    "descripcion": "FORRO VELADOR PALERMO VINTAGE NEGRO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015645",
    "descripcion": "FORRO VELADOR PALERMO VINTAGE CAFE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015646",
    "descripcion": "FORRO VELADOR PALERMO VINTAGE CAPUCC",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015647",
    "descripcion": "FORRO VELADOR PALERMO VINTAGE HUMO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015648",
    "descripcion": "FORRO VELADOR PALERMO EPIC TIERRA",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015649",
    "descripcion": "FORRO VELADOR PALERMO EPIC OCEANO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015650",
    "descripcion": "FORRO VELADOR PALERMO EPIC ARENA",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015651",
    "descripcion": "FORRO VELADOR PALERMO EPIC OTONO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015652",
    "descripcion": "FORRO VELADOR PALERMO EPIC BRUMA",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015653",
    "descripcion": "FORRO VELADOR PALERMO STONE COBRE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015654",
    "descripcion": "FORRO VELADOR PALERMO STONE PLATA",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015655",
    "descripcion": "FORRO VELADOR PALERMO STONE JASPE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015656",
    "descripcion": "FORRO VELADOR PALERMO STONE GRAFITO",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015657",
    "descripcion": "FORRO VELADOR PALERMO STONE MARMOL",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30015658",
    "descripcion": "FORRO SPRING 105 VINTAGE CAPUCCINO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015659",
    "descripcion": "FORRO SPRING 105 VINTAGE HUMO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015660",
    "descripcion": "FORRO SPRING 105 VINTAGE CAFE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015661",
    "descripcion": "FORRO SPRING 105 VINTAGE NEGRO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015662",
    "descripcion": "FORRO SPRING 105 EPIC OCEANO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015663",
    "descripcion": "FORRO SPRING 105 EPIC ARENA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015664",
    "descripcion": "FORRO SPRING 105 EPIC TIERRA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015665",
    "descripcion": "FORRO SPRING 105 EPIC OTONO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015666",
    "descripcion": "FORRO SPRING 105 EPIC BRUMA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015667",
    "descripcion": "FORRO SPRING 105 STONE JASPE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015668",
    "descripcion": "FORRO SPRING 105 STONE COBRE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015669",
    "descripcion": "FORRO SPRING 105 STONE PLATA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015670",
    "descripcion": "FORRO SPRING 105 STONE GRAFITO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30015671",
    "descripcion": "FORRO SPRING 105 STONE MARMOL",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30016839",
    "descripcion": "FORRO COJIN CILINDRICO ARGO TURQUESA",
    "tiempoMin": 5
  },
  {
    "codigo": "30016840",
    "descripcion": "FORRO COJIN CILINDRICO ARGO AZUL",
    "tiempoMin": 5
  },
  {
    "codigo": "30016841",
    "descripcion": "FORRO COJIN CILINDRICO ARGO GRIS",
    "tiempoMin": 5
  },
  {
    "codigo": "30016842",
    "descripcion": "FORRO COJIN CILINDRICO ARGO TERRACOTA",
    "tiempoMin": 5
  },
  {
    "codigo": "30016843",
    "descripcion": "FORRO COJIN CILINDRICO ARGO BEIGE",
    "tiempoMin": 5
  },
  {
    "codigo": "30016844",
    "descripcion": "FORRO COJIN CILINDRICO ARGO CHOCOLATE",
    "tiempoMin": 5
  },
  {
    "codigo": "30016845",
    "descripcion": "FORRO COJIN CILINDRICO VINTAGE CAPUCCIN",
    "tiempoMin": 5
  },
  {
    "codigo": "30016846",
    "descripcion": "FORRO COJIN CILINDRICO VINTAGE HUMO",
    "tiempoMin": 5
  },
  {
    "codigo": "30016847",
    "descripcion": "FORRO COJIN CILINDRICO VINTAGE CAFE",
    "tiempoMin": 5
  },
  {
    "codigo": "30016848",
    "descripcion": "FORRO COJIN CILINDRICO VINTAGE NEGRO",
    "tiempoMin": 5
  },
  {
    "codigo": "30016849",
    "descripcion": "FORRO COJIN CILINDRICO EPIC OCEANO",
    "tiempoMin": 5
  },
  {
    "codigo": "30016850",
    "descripcion": "FORRO COJIN CILINDRICO EPIC ARENA",
    "tiempoMin": 5
  },
  {
    "codigo": "30016851",
    "descripcion": "FORRO COJIN CILINDRICO EPIC TIERRA",
    "tiempoMin": 5
  },
  {
    "codigo": "30016853",
    "descripcion": "FORRO COJIN CILINDRICO EPIC OTONO",
    "tiempoMin": 5
  },
  {
    "codigo": "30016854",
    "descripcion": "FORRO COJIN CILINDRICO EPIC BRUMA",
    "tiempoMin": 5
  },
  {
    "codigo": "30016877",
    "descripcion": "FORRO COJIN CILINDRICO STONE JASPE CAFE",
    "tiempoMin": 5
  },
  {
    "codigo": "30016878",
    "descripcion": "FORRO COJIN CILINDRICO STONE COBRE",
    "tiempoMin": 5
  },
  {
    "codigo": "30016879",
    "descripcion": "FORRO COJIN CILINDRICO STONE PLATA",
    "tiempoMin": 5
  },
  {
    "codigo": "30016880",
    "descripcion": "FORRO COJIN CILINDRICO STONE GRAFITO",
    "tiempoMin": 5
  },
  {
    "codigo": "30016881",
    "descripcion": "FORRO COJIN CILINDRICO STONE MARMOL",
    "tiempoMin": 5
  },
  {
    "codigo": "30016982",
    "descripcion": "FORRO PROTECTOR CHN IMPER AZ 080X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016983",
    "descripcion": "FORRO PROTECTOR CHN IMPER AZ 090X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016984",
    "descripcion": "FORRO PROTECTOR CHN IMPER AZ 105X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016985",
    "descripcion": "FORRO PROTECTOR CHN IMPER AZ 135X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016986",
    "descripcion": "FORRO PROTECTOR CHN IMPER AZ 160X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016987",
    "descripcion": "FORRO PROTECTOR CHN IMPER AZ 200X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016988",
    "descripcion": "FORRO PROTECTOR CHN IMPER BEBE 68x96x6",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016989",
    "descripcion": "FORRO PROTECTOR CHN IMPER BEBE 70X130X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016990",
    "descripcion": "FORRO PROTECTOR CHN IMPER BEBE 70X140X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016991",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 066X099",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016992",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 080X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016993",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 090X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016994",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 105X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016995",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 135X190",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016996",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 160X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016997",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 200X200",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016998",
    "descripcion": "FORRO PROTECTOR CHN IMPER BL 42X117X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30016999",
    "descripcion": "FORRO PROTECTOR CHN IMPER BORN 70X130X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30017000",
    "descripcion": "FORRO PROTECTOR CHN IMPER BORN 73X108X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30017001",
    "descripcion": "FORRO PROTECTOR CHN IMPER FAVORITA 66X99",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30017002",
    "descripcion": "FORRO BENCH MARSELLA STONE JASPE CAFE 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017003",
    "descripcion": "FORRO BENCH MARSELLA STONE GRAFITO 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017004",
    "descripcion": "FORRO BENCH MARSELLA STONE PLATA 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017005",
    "descripcion": "FORRO BENCH MARSELLA STONE COBRE 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017008",
    "descripcion": "FORRO BENCH MARSELLA EPIC OCEANO 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017011",
    "descripcion": "FORRO BENCH MARSELLA EPIC ARENA 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017012",
    "descripcion": "FORRO BENCH MARSELLA VINTAGE HUMO 70",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017014",
    "descripcion": "FORRO BENCH MARSELLA 70 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30017016",
    "descripcion": "FORRO BENCH AREZZO STONE JASPE CAFE 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017017",
    "descripcion": "FORRO BENCH AREZZO 70 STONE GRAFITO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017018",
    "descripcion": "FORRO BENCH AREZZO 70 STONE PLATA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017019",
    "descripcion": "FORRO BENCH AREZZO STONE COBRE 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017020",
    "descripcion": "FORRO BENCH AREZZO STONE MARMOL 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017021",
    "descripcion": "FORRO BENCH AREZZO 70 EPIC TIERRA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017022",
    "descripcion": "FORRO BENCH AREZZO 70 EPIC OCEANO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017023",
    "descripcion": "FORRO BENCH AREZZO 70 EPIC BRUMA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017024",
    "descripcion": "FORRO BENCH AREZZO 70 EPIC OTONO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017025",
    "descripcion": "FORRO BENCH AREZZO 70 EPIC ARENA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017026",
    "descripcion": "FORRO BENCH AREZZO VINTAGE HUMO 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017027",
    "descripcion": "FORRO BENCH AREZZO VINTAGE CAFE 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017028",
    "descripcion": "FORRO BENCH AREZZO VINTAGE NEGRO 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017029",
    "descripcion": "FORRO BENCH AREZZO VINTAGE CAPUCCINO 75",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30017066",
    "descripcion": "FORRO COJIN CILINDRICO RESILFEX",
    "tiempoMin": 5
  },
  {
    "codigo": "30017071",
    "descripcion": "FORRO DE PRUEBA MUEBLES",
    "tiempoMin": 183.23
  },
  {
    "codigo": "30017111",
    "descripcion": "FORRO OTTOMAN VIENA ARGO BEIGE",
    "tiempoMin": 110
  },
  {
    "codigo": "30017112",
    "descripcion": "FORRO OTTOMAN VIENA 80 ARGO GRIS",
    "tiempoMin": 110
  },
  {
    "codigo": "30017113",
    "descripcion": "FORRO OTTOMAN VIENA ARGO AZUL",
    "tiempoMin": 110
  },
  {
    "codigo": "30017114",
    "descripcion": "FORRO OTTOMAN VIENA 80 ARGO TURQUEZA",
    "tiempoMin": 110
  },
  {
    "codigo": "30017115",
    "descripcion": "FORRO OTTOMAN VIENA 80 ARGO CHOCOLATE",
    "tiempoMin": 110
  },
  {
    "codigo": "30017116",
    "descripcion": "FORRO OTTOMAN VIENA 80 ARGO TERROCOTA",
    "tiempoMin": 110
  },
  {
    "codigo": "30017124",
    "descripcion": "TAPA FALSO BLANCO OTTOMAN VIENA",
    "tiempoMin": 7.89
  },
  {
    "codigo": "30017125",
    "descripcion": "TAPA T. FALSO NEGRO OTTOMAN VIENA",
    "tiempoMin": 5.35
  },
  {
    "codigo": "30017249",
    "descripcion": "FORRO RECLINABLE ZEUS VINTAGE NEGRO",
    "tiempoMin": 142
  },
  {
    "codigo": "30017250",
    "descripcion": "FORRO SOFA RECLINABLE VINTAGE CAPUCCINO",
    "tiempoMin": 142
  },
  {
    "codigo": "30017251",
    "descripcion": "FORRO RECLINABLE ZEUS VINTAGE CAFE",
    "tiempoMin": 142
  },
  {
    "codigo": "30017252",
    "descripcion": "FORRO SOFA RECLINABLE VINTAGE HUMO",
    "tiempoMin": 142
  },
  {
    "codigo": "30017253",
    "descripcion": "FORRO SOFA RECLINABLE EPIC OCEANO",
    "tiempoMin": 142
  },
  {
    "codigo": "30017254",
    "descripcion": "FORRO SOFA RECLINABLE EPIC TIERRA",
    "tiempoMin": 142
  },
  {
    "codigo": "30017255",
    "descripcion": "FORRO RECLINABLE ZEUS EPIC OTONO",
    "tiempoMin": 142
  },
  {
    "codigo": "30017256",
    "descripcion": "FORRO SOFA RECLINABLE EPIC ARENA",
    "tiempoMin": 142
  },
  {
    "codigo": "30017257",
    "descripcion": "FORRO RECLINABLE ZEUS EPIC BRUMA",
    "tiempoMin": 142
  },
  {
    "codigo": "30017258",
    "descripcion": "FORRO SOFA RECLINABLE STONE JASPE",
    "tiempoMin": 142
  },
  {
    "codigo": "30017259",
    "descripcion": "FORRO SOFA RECLINABLE STONE COBRE",
    "tiempoMin": 142
  },
  {
    "codigo": "30017260",
    "descripcion": "FORRO RECLINABLE ZEUS STONE GRAFITO",
    "tiempoMin": 142
  },
  {
    "codigo": "30017261",
    "descripcion": "FORRO SOFA RECLINABLE STONE MARMOL",
    "tiempoMin": 142
  },
  {
    "codigo": "30017262",
    "descripcion": "FORRO RECLINABLE ZEUS STONE PLATA",
    "tiempoMin": 142
  },
  {
    "codigo": "30017280",
    "descripcion": "FORRO COJIN INTER CLOUD ESPALDAR MED",
    "tiempoMin": 5
  },
  {
    "codigo": "30017323",
    "descripcion": "FORRO INT COJIN ARGO TERRACOTA 45X45",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30017328",
    "descripcion": "FORRO COJIN CILINDRICO REGALO",
    "tiempoMin": 5
  },
  {
    "codigo": "30017330",
    "descripcion": "EMPAQUE COJINES REGALO CUMPLEANOS",
    "tiempoMin": 5
  },
  {
    "codigo": "30017360",
    "descripcion": "TAPA T. FALSO NEGRO BENCH 115",
    "tiempoMin": 3.72
  },
  {
    "codigo": "30017361",
    "descripcion": "TAPA T. FALSO NEGRO MEGA BENCH 145",
    "tiempoMin": 4.01
  },
  {
    "codigo": "30017362",
    "descripcion": "TAPA T. FALSO NEGRO FOAM 70",
    "tiempoMin": 1.9
  },
  {
    "codigo": "30017363",
    "descripcion": "TAPA T. FALSO NEGRO FOAM 105",
    "tiempoMin": 2.1
  },
  {
    "codigo": "30017364",
    "descripcion": "TAPA T. FALSO NEGRO FOAM 135",
    "tiempoMin": 2.23
  },
  {
    "codigo": "30017365",
    "descripcion": "TAPA T. FALSO NEGRO MALIBU 105",
    "tiempoMin": 2.6
  },
  {
    "codigo": "30017366",
    "descripcion": "TAPA T. FALSO NEGRO MALIBU 135",
    "tiempoMin": 2.74
  },
  {
    "codigo": "30017367",
    "descripcion": "TAPA T. FALSO NEGRO MILANO",
    "tiempoMin": 6.46
  },
  {
    "codigo": "30017368",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 115X50",
    "tiempoMin": 1.91
  },
  {
    "codigo": "30017369",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 145X50",
    "tiempoMin": 2.03
  },
  {
    "codigo": "30017370",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 210X50",
    "tiempoMin": 2.46
  },
  {
    "codigo": "30017371",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 145X72",
    "tiempoMin": 2.26
  },
  {
    "codigo": "30017372",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 170X50",
    "tiempoMin": 2.19
  },
  {
    "codigo": "30017373",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 170X72",
    "tiempoMin": 2.41
  },
  {
    "codigo": "30017374",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 210X72",
    "tiempoMin": 2.56
  },
  {
    "codigo": "30017375",
    "descripcion": "TAPA T. FALSO NEGRO OTTOMAN 70X50",
    "tiempoMin": 3.24
  },
  {
    "codigo": "30017503",
    "descripcion": "TAPA T. FALSO NEGRO VELADOR",
    "tiempoMin": 1.62
  },
  {
    "codigo": "30017504",
    "descripcion": "TAPA T. FALSO NEGRO MIRAGE 105",
    "tiempoMin": 3.78
  },
  {
    "codigo": "30017505",
    "descripcion": "TAPA T. FALSO NEGRO MIRAGE 120",
    "tiempoMin": 4.32
  },
  {
    "codigo": "30017506",
    "descripcion": "TAPA T. FALSO NEGRO MIRAGE 135",
    "tiempoMin": 4.86
  },
  {
    "codigo": "30017576",
    "descripcion": "FORRO FALSO COSIDO BLANCO ES 70",
    "tiempoMin": 10
  },
  {
    "codigo": "30017577",
    "descripcion": "FORRO FALSO COSIDO BLANCO ES 105",
    "tiempoMin": 12.5
  },
  {
    "codigo": "30017578",
    "descripcion": "FORRO FALSO COSIDO BLANCO ES 135",
    "tiempoMin": 15
  },
  {
    "codigo": "30017583",
    "descripcion": "FORRO CAMA ATENAS 105 VINTAGE CAFE",
    "tiempoMin": 18
  },
  {
    "codigo": "30017584",
    "descripcion": "FORRO CAMA ATENAS 105 VINTAGE HUMO",
    "tiempoMin": 18
  },
  {
    "codigo": "30017585",
    "descripcion": "FORRO CAMA ATENAS 105 VINTAGE CAPPUCHINO",
    "tiempoMin": 18
  },
  {
    "codigo": "30017586",
    "descripcion": "FORRO CAMA ATENAS 105 VINTAGE NEGRO",
    "tiempoMin": 18
  },
  {
    "codigo": "30017587",
    "descripcion": "FORRO CAMA ATENAS 105 STONE GRAFITO",
    "tiempoMin": 18
  },
  {
    "codigo": "30017588",
    "descripcion": "FORRO CAMA ATENAS 105 STONE JASPE CAFE",
    "tiempoMin": 18
  },
  {
    "codigo": "30017589",
    "descripcion": "FORRO CAMA ATENAS 105 STONE PLATA",
    "tiempoMin": 18
  },
  {
    "codigo": "30017590",
    "descripcion": "FORRO CAMA ATENAS 105 STONE MARMOL",
    "tiempoMin": 18
  },
  {
    "codigo": "30017591",
    "descripcion": "FORRO CAMA ATENAS 105 STONE COBRE",
    "tiempoMin": 18
  },
  {
    "codigo": "30017592",
    "descripcion": "FORRO CAMA ATENAS 105 EPIC BRUMA",
    "tiempoMin": 18
  },
  {
    "codigo": "30017593",
    "descripcion": "FORRO CAMA ATENAS 105 EPIC TIERRA",
    "tiempoMin": 18
  },
  {
    "codigo": "30017594",
    "descripcion": "FORRO CAMA ATENAS 105 EPIC ARENA",
    "tiempoMin": 18
  },
  {
    "codigo": "30017595",
    "descripcion": "FORRO CAMA ATENAS 105 EPIC OCEANO",
    "tiempoMin": 18
  },
  {
    "codigo": "30017596",
    "descripcion": "FORRO CAMA ATENAS 105 EPIC OTONO",
    "tiempoMin": 18
  },
  {
    "codigo": "30017597",
    "descripcion": "FORRO CAMA ATENAS 135 VINTAGE CAFE",
    "tiempoMin": 20
  },
  {
    "codigo": "30017598",
    "descripcion": "FORRO CAMA ATENAS 135 VINTAGE HUMO",
    "tiempoMin": 20
  },
  {
    "codigo": "30017599",
    "descripcion": "FORRO CAMA ATENAS 135 VINTAGE CAPPUCHINO",
    "tiempoMin": 20
  },
  {
    "codigo": "30017600",
    "descripcion": "FORRO CAMA ATENAS 135 VINTAGE NEGRO MATE",
    "tiempoMin": 20
  },
  {
    "codigo": "30017601",
    "descripcion": "FORRO CAMA ATENAS 135 STONE GRAFITO",
    "tiempoMin": 20
  },
  {
    "codigo": "30017602",
    "descripcion": "FORRO CAMA ATENAS 135 STONE JASPE CAFE",
    "tiempoMin": 20
  },
  {
    "codigo": "30017603",
    "descripcion": "FORRO CAMA ATENAS 135 STONE PLATA",
    "tiempoMin": 20
  },
  {
    "codigo": "30017604",
    "descripcion": "FORRO CAMA ATENAS 135 STONE MARMOL",
    "tiempoMin": 20
  },
  {
    "codigo": "30017605",
    "descripcion": "FORRO CAMA ATENAS 135 STONE COBRE",
    "tiempoMin": 20
  },
  {
    "codigo": "30017606",
    "descripcion": "FORRO CAMA ATENAS 135 EPIC BRUMA",
    "tiempoMin": 20
  },
  {
    "codigo": "30017607",
    "descripcion": "FORRO CAMA ATENAS 135 EPIC TIERRA",
    "tiempoMin": 20
  },
  {
    "codigo": "30017608",
    "descripcion": "FORRO CAMA ATENAS 135 EPIC ARENA",
    "tiempoMin": 20
  },
  {
    "codigo": "30017609",
    "descripcion": "FORRO CAMA ATENAS 135 EPIC OCEANO",
    "tiempoMin": 20
  },
  {
    "codigo": "30017610",
    "descripcion": "FORRO CAMA ATENAS 135 EPIC OTONO",
    "tiempoMin": 20
  },
  {
    "codigo": "30017611",
    "descripcion": "FORRO CAMA ATENAS 160 VINTAGE CAFE",
    "tiempoMin": 22
  },
  {
    "codigo": "30017612",
    "descripcion": "FORRO CAMA ATENAS 160 VINTAGE HUMO",
    "tiempoMin": 22
  },
  {
    "codigo": "30017613",
    "descripcion": "FORRO CAMA ATENAS 160 VINTAGE CAPPUCHINO",
    "tiempoMin": 22
  },
  {
    "codigo": "30017614",
    "descripcion": "FORRO CAMA ATENAS 160 VINTAGE NEGRO",
    "tiempoMin": 22
  },
  {
    "codigo": "30017615",
    "descripcion": "FORRO CAMA ATENAS 160 STONE GRAFITO",
    "tiempoMin": 22
  },
  {
    "codigo": "30017616",
    "descripcion": "FORRO CAMA ATENAS 160 STONE JASPE CAFE",
    "tiempoMin": 22
  },
  {
    "codigo": "30017617",
    "descripcion": "FORRO CAMA ATENAS 160 STONE PLATA",
    "tiempoMin": 22
  },
  {
    "codigo": "30017618",
    "descripcion": "FORRO CAMA ATENAS 160 STONE MARMOL",
    "tiempoMin": 22
  },
  {
    "codigo": "30017619",
    "descripcion": "FORRO CAMA ATENAS 160 STONE COBRE",
    "tiempoMin": 22
  },
  {
    "codigo": "30017620",
    "descripcion": "FORRO CAMA ATENAS 160 EPIC BRUMA",
    "tiempoMin": 22
  },
  {
    "codigo": "30017621",
    "descripcion": "FORRO CAMA ATENAS 160 EPIC TIERRA",
    "tiempoMin": 22
  },
  {
    "codigo": "30017622",
    "descripcion": "FORRO CAMA ATENAS 160 EPIC ARENA",
    "tiempoMin": 22
  },
  {
    "codigo": "30017623",
    "descripcion": "FORRO CAMA ATENAS 160 EPIC OCEANO",
    "tiempoMin": 22
  },
  {
    "codigo": "30017624",
    "descripcion": "FORRO CAMA ATENAS 160 EPIC OTONO",
    "tiempoMin": 22
  },
  {
    "codigo": "30017625",
    "descripcion": "FORRO CAMA ATENAS 200 VINTAGE CAFE",
    "tiempoMin": 24
  },
  {
    "codigo": "30017626",
    "descripcion": "FORRO CAMA ATENAS 200 VINTAGE HUMO",
    "tiempoMin": 24
  },
  {
    "codigo": "30017627",
    "descripcion": "FORRO CAMA ATENAS 200 VINTAGE CAPPUCHINO",
    "tiempoMin": 24
  },
  {
    "codigo": "30017628",
    "descripcion": "FORRO CAMA ATENAS 200 VINTAGE NEGRO",
    "tiempoMin": 24
  },
  {
    "codigo": "30017629",
    "descripcion": "FORRO CAMA ATENAS 200 STONE GRAFITO",
    "tiempoMin": 24
  },
  {
    "codigo": "30017630",
    "descripcion": "FORRO CAMA ATENAS 200 STONE JASPE CAFE",
    "tiempoMin": 24
  },
  {
    "codigo": "30017631",
    "descripcion": "FORRO CAMA ATENAS 200 STONE PLATA",
    "tiempoMin": 24
  },
  {
    "codigo": "30017632",
    "descripcion": "FORRO CAMA ATENAS 200 STONE MARMOL",
    "tiempoMin": 24
  },
  {
    "codigo": "30017633",
    "descripcion": "FORRO CAMA ATENAS 200 STONE COBRE",
    "tiempoMin": 24
  },
  {
    "codigo": "30017634",
    "descripcion": "FORRO CAMA ATENAS 200 EPIC BRUMA",
    "tiempoMin": 24
  },
  {
    "codigo": "30017635",
    "descripcion": "FORRO CAMA ATENAS 200 EPIC TIERRA",
    "tiempoMin": 24
  },
  {
    "codigo": "30017636",
    "descripcion": "FORRO CAMA ATENAS 200 EPIC ARENA",
    "tiempoMin": 24
  },
  {
    "codigo": "30017637",
    "descripcion": "FORRO CAMA ATENAS 200 EPIC OCEANO",
    "tiempoMin": 24
  },
  {
    "codigo": "30017638",
    "descripcion": "FORRO CAMA ATENAS 200 EPIC OTONO",
    "tiempoMin": 24
  },
  {
    "codigo": "30017768",
    "descripcion": "TAPA T. CAMA ATENAS FALSO NEGRO 105",
    "tiempoMin": 2.28
  },
  {
    "codigo": "30017769",
    "descripcion": "TAPA T. FALSO NEGRO CAMA ATENAS 135",
    "tiempoMin": 2.93
  },
  {
    "codigo": "30017770",
    "descripcion": "TAPA T. FALSO NEGRO CAMA ATENAS 160",
    "tiempoMin": 3.48
  },
  {
    "codigo": "30017771",
    "descripcion": "TAPA T. FALSO NEGRO CAMA ATENAS 200",
    "tiempoMin": 3.6
  },
  {
    "codigo": "30017807",
    "descripcion": "FORRO OPORTO 135 VINTAGE CAFE",
    "tiempoMin": 210
  },
  {
    "codigo": "30017808",
    "descripcion": "FORRO OPORTO 135 VINTAGE HUMO",
    "tiempoMin": 210
  },
  {
    "codigo": "30017809",
    "descripcion": "FORRO S. OPORTO VINTAGE CAPPUCH 135X190",
    "tiempoMin": 210
  },
  {
    "codigo": "30017810",
    "descripcion": "FORRO OPORTO 135 VINTAGE NEGRO",
    "tiempoMin": 210
  },
  {
    "codigo": "30017811",
    "descripcion": "FORRO OPORTO 135 STONE GRAFITO",
    "tiempoMin": 210
  },
  {
    "codigo": "30017812",
    "descripcion": "FORRO OPORTO 135 STONE JASPE",
    "tiempoMin": 210
  },
  {
    "codigo": "30017813",
    "descripcion": "FORRO OPORTO 135 STONE PLATA",
    "tiempoMin": 210
  },
  {
    "codigo": "30017814",
    "descripcion": "FORRO OPORTO 135 STONE MARMOL",
    "tiempoMin": 210
  },
  {
    "codigo": "30017815",
    "descripcion": "FORRO OPORTO 135 STONE COBRE",
    "tiempoMin": 210
  },
  {
    "codigo": "30017816",
    "descripcion": "FORRO OPORTO 135 EPIC BRUMA",
    "tiempoMin": 210
  },
  {
    "codigo": "30017817",
    "descripcion": "FORRO OPORTO 135 EPIC TIERRA",
    "tiempoMin": 210
  },
  {
    "codigo": "30017818",
    "descripcion": "FORRO OPORTO 135 EPIC ARENA",
    "tiempoMin": 210
  },
  {
    "codigo": "30017819",
    "descripcion": "FORRO OPORTO 135 EPIC OCEANO",
    "tiempoMin": 210
  },
  {
    "codigo": "30017820",
    "descripcion": "FORRO S. OPORTO EPIC OTONO 135X190",
    "tiempoMin": 210
  },
  {
    "codigo": "30017835",
    "descripcion": "TAPA T. FALSO NEGRO SOFA OPORTO",
    "tiempoMin": 8.76
  },
  {
    "codigo": "30017840",
    "descripcion": "FORRO COJIN INTERNO INFERIOR OPORTO",
    "tiempoMin": 5.27
  },
  {
    "codigo": "30017841",
    "descripcion": "FORRO COJIN INTERNO SUPERIOR OPORTO",
    "tiempoMin": 6.42
  },
  {
    "codigo": "30017987",
    "descripcion": "FORRO SOFA SPRING ARGO BEIGE 105X190",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30017988",
    "descripcion": "FORRO SOFA SPRING ARGO AZUL 105X190",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30017989",
    "descripcion": "FORRO SOFA MATISSE ARGO BEIGE 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30017990",
    "descripcion": "FORRO SOFA MATISSE ARGO AZUL 105",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30017991",
    "descripcion": "FORRO S. OPORTO ARGO BEIGE 135X190",
    "tiempoMin": 210
  },
  {
    "codigo": "30017992",
    "descripcion": "FORRO S. OPORTO ARGO AZUL 135X190",
    "tiempoMin": 210
  },
  {
    "codigo": "30017993",
    "descripcion": "FORRO SOFA MIAMI ARGO BEIGE 105X190",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30017994",
    "descripcion": "FORRO MIAMI 105 ARGO AZUL",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30017995",
    "descripcion": "FORRO MANCHESTER 105 ARGO BEIGE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30017996",
    "descripcion": "FORRO SOFA MANCHESTER ARGO AZUL 105",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30017997",
    "descripcion": "FORRO SOFA MILANO ARGO BEIGE 105X190",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30017998",
    "descripcion": "FORRO MILANO 105 ARGO AZUL",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30017999",
    "descripcion": "FORRO SOFA MALIBU ARGO BEIGE 105X190",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30018000",
    "descripcion": "FORRO SOFA MALIBU ARGO AZUL 105X190",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30018001",
    "descripcion": "FORRO MALIBU 135 ARGO BEIGE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30018002",
    "descripcion": "FORRO SOFA MALIBU ARGO AZUL 135X190",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30018003",
    "descripcion": "FORRO BENCH ARGO BEIGE ANCHO 115",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30018004",
    "descripcion": "FORRO BENCH ARGO AZUL ANCHO 115",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30018005",
    "descripcion": "FORRO BENCH ARGO BEIGE ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30018006",
    "descripcion": "FORRO BENCH ARGO AZUL ANCHO 145",
    "tiempoMin": 35
  },
  {
    "codigo": "30018007",
    "descripcion": "FORRO OTTOMAN ARGO BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30018008",
    "descripcion": "FORRO OTTOMAN ARGO AZUL",
    "tiempoMin": 30
  },
  {
    "codigo": "30018009",
    "descripcion": "FORRO OTTOMAN REDONDO ARGO BEIGE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30018010",
    "descripcion": "FORRO OTTOMAN REDONDO ARGO AZUL",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30018011",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P ARGO BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30018012",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P ARGO AZUL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30018013",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P ARGO BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30018014",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P ARGO AZUL",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30018126",
    "descripcion": "FORRO CAB BARU 115X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018127",
    "descripcion": "FORRO CAB BARU 115X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018128",
    "descripcion": "FORRO CAB BARU 115X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018129",
    "descripcion": "FORRO CAB BARU 115X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018130",
    "descripcion": "FORRO CAB BARU 115X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018131",
    "descripcion": "FORRO CAB BARU 115X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018132",
    "descripcion": "FORRO CAB BARU 115X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018133",
    "descripcion": "FORRO CAB BARU 115X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018134",
    "descripcion": "FORRO CAB BARU 115X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018135",
    "descripcion": "FORRO CAB BARU 115X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018136",
    "descripcion": "FORRO CAB BARU 115X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018137",
    "descripcion": "FORRO CAB BARU  STONE JASPE 115",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018138",
    "descripcion": "FORRO CAB BARU 115X50 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018139",
    "descripcion": "FORRO CAB BARU 115X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018140",
    "descripcion": "FORRO CAB BARU 115X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018141",
    "descripcion": "FORRO CAB BARU 115X50 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018142",
    "descripcion": "FORRO CAB BARU 115X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018143",
    "descripcion": "FORRO CAB BARU 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018147",
    "descripcion": "FORRO CAB BARU EPIC ARENA 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018148",
    "descripcion": "FORRO CAB BARU 145X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018149",
    "descripcion": "FORRO CAB BARU 145X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018150",
    "descripcion": "FORRO CAB BARU 145X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018151",
    "descripcion": "FORRO CAB BARU 145X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018152",
    "descripcion": "FORRO CAB BARU 145X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018153",
    "descripcion": "FORRO CAB BARU 145X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018154",
    "descripcion": "FORRO CAB BARU 145X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018155",
    "descripcion": "FORRO CAB BARU 145X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018156",
    "descripcion": "FORRO CAB BARU STONE COBRE 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018157",
    "descripcion": "FORRO CAB BARU 145X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018158",
    "descripcion": "FORRO CAB BARU 145X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018159",
    "descripcion": "FORRO CAB BARU STONE MARMOL 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018160",
    "descripcion": "FORRO CAB BARU 145X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018161",
    "descripcion": "FORRO CAB BARU 145X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018162",
    "descripcion": "FORRO CAB BARU VINTAGE CAPUCCINO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018163",
    "descripcion": "FORRO CAB BARU VINTAGE HUMO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018164",
    "descripcion": "FORRO CAB BARU 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018165",
    "descripcion": "FORRO CAB BARU 145X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018166",
    "descripcion": "FORRO CAB BARU 145X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018167",
    "descripcion": "FORRO CAB BARU 145X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018168",
    "descripcion": "FORRO CAB BARU 145X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018169",
    "descripcion": "FORRO CAB BARU 145X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018170",
    "descripcion": "FORRO CAB BARU 145X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018171",
    "descripcion": "FORRO CAB BARU 145X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018172",
    "descripcion": "FORRO CAB BARU 145X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018173",
    "descripcion": "FORRO CAB BARU 145X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018174",
    "descripcion": "FORRO CAB BARU 145X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018175",
    "descripcion": "FORRO CAB BARU 145X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018176",
    "descripcion": "FORRO CAB BARU STONE JASPE 145X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018177",
    "descripcion": "FORRO CAB BARU 145X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018178",
    "descripcion": "FORRO CAB BARU 145X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018179",
    "descripcion": "FORRO CAB BARU 145X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018180",
    "descripcion": "FORRO CAB BARU 145X72 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018181",
    "descripcion": "FORRO CAB BARU 145X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018182",
    "descripcion": "FORRO CAB BARU 145X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018669",
    "descripcion": "FORRO CAB BARU TAPIZ PLOMO 115",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018670",
    "descripcion": "FORRO CAB BARU 115X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018671",
    "descripcion": "FORRO CAB BARU 115X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018672",
    "descripcion": "FORRO CAB BARU 115X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018673",
    "descripcion": "FORRO CAB BARU TAPIZ AZUL 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018674",
    "descripcion": "FORRO CAB BARU 145X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018675",
    "descripcion": "FORRO CAB BARU TAPIZ CHOCO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018676",
    "descripcion": "FORRO CAB BARU 145X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018677",
    "descripcion": "FORRO CAB BARU 145X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018678",
    "descripcion": "FORRO CAB BARU 145X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018679",
    "descripcion": "FORRO CAB BARU 145X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018680",
    "descripcion": "FORRO CAB BARU 145X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018681",
    "descripcion": "FORRO CAB BARU EPIC ARENA 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018682",
    "descripcion": "FORRO CAB BARU 170X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018683",
    "descripcion": "FORRO CAB BARU 170X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018684",
    "descripcion": "FORRO CAB BARU 170X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018685",
    "descripcion": "FORRO CAB BARU 170X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018686",
    "descripcion": "FORRO CAB BARU 170X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018687",
    "descripcion": "FORRO CAB BARU 170X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018688",
    "descripcion": "FORRO CAB BARU 170X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018689",
    "descripcion": "FORRO CAB BARU 170X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018690",
    "descripcion": "FORRO CAB BARU 170X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018691",
    "descripcion": "FORRO CAB BARU STONE GRAFITO 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018692",
    "descripcion": "FORRO CAB BARU 170X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018693",
    "descripcion": "FORRO CAB BARU STONE MARMOL 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018694",
    "descripcion": "FORRO CAB BARU 170X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018695",
    "descripcion": "FORRO CAB BARU 170X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018696",
    "descripcion": "FORRO CAB BARU VINTAGE CAPUCCI 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018697",
    "descripcion": "FORRO CAB BARU 170X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018698",
    "descripcion": "FORRO CAB BARU 170X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018699",
    "descripcion": "FORRO CAB BARU TAPIZ AZUL 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018700",
    "descripcion": "FORRO CAB BARU 170X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018701",
    "descripcion": "FORRO CAB BARU 170X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018702",
    "descripcion": "FORRO CAB BARU 170X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018703",
    "descripcion": "FORRO CAB BARU 170X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018704",
    "descripcion": "FORRO CAB BARU 170X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018705",
    "descripcion": "FORRO CAB BARU 170X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018706",
    "descripcion": "FORRO CAB BARU 170X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018707",
    "descripcion": "FORRO CAB BARU 170X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018708",
    "descripcion": "FORRO CAB BARU 170X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018709",
    "descripcion": "FORRO CAB BARU 170X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018710",
    "descripcion": "FORRO CAB BARU 170X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018711",
    "descripcion": "FORRO CAB BARU 170X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018712",
    "descripcion": "FORRO CAB BARU 170X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018713",
    "descripcion": "FORRO CAB BARU 170X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018714",
    "descripcion": "FORRO CAB BARU STONE JASPE 170X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018715",
    "descripcion": "FORRO CAB BARU 170X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018716",
    "descripcion": "FORRO CAB BARU 170X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018717",
    "descripcion": "FORRO CAB BARU 170X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018718",
    "descripcion": "FORRO CAB BARU 170X72 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018719",
    "descripcion": "FORRO CAB BARU 170X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018720",
    "descripcion": "FORRO CAB BARU VINTAGE NEGRO 170X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018721",
    "descripcion": "FORRO CAB BARU 170X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018722",
    "descripcion": "FORRO CAB BARU 170X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018723",
    "descripcion": "FORRO CAB BARU 170X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018724",
    "descripcion": "FORRO CAB BARU 170X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018725",
    "descripcion": "FORRO CAB BARU 210X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018726",
    "descripcion": "FORRO CAB BARU 210X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018727",
    "descripcion": "FORRO CAB BARU 210X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018728",
    "descripcion": "FORRO CAB BARU 210X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018729",
    "descripcion": "FORRO CAB BARU EPIC TIERRA 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018730",
    "descripcion": "FORRO CAB BARU 210X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018731",
    "descripcion": "FORRO CAB BARU 210X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018732",
    "descripcion": "FORRO CAB BARU 210X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018733",
    "descripcion": "FORRO CAB BARU 210X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018734",
    "descripcion": "FORRO CAB BARU 210X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018735",
    "descripcion": "FORRO CAB BARU STONE GRAFITO 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018736",
    "descripcion": "FORRO CAB BARU 210X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018737",
    "descripcion": "FORRO CAB BARU 210X50 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018738",
    "descripcion": "FORRO CAB BARU 210X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018739",
    "descripcion": "FORRO CAB BARU 210X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018740",
    "descripcion": "FORRO CAB BARU 210X50 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018741",
    "descripcion": "FORRO CAB BARU 210X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018742",
    "descripcion": "FORRO CAB BARU 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018743",
    "descripcion": "FORRO CAB BARU 210X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018744",
    "descripcion": "FORRO CAB BARU 210X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018745",
    "descripcion": "FORRO CAB BARU 210X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018746",
    "descripcion": "FORRO CAB BARU 210X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018747",
    "descripcion": "FORRO CAB BARU EPIC ARENA 210X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018748",
    "descripcion": "FORRO CAB BARU 210X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018749",
    "descripcion": "FORRO CAB BARU 210X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018750",
    "descripcion": "FORRO CAB BARU 210X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018751",
    "descripcion": "FORRO CAB BARU 210X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018752",
    "descripcion": "FORRO CAB BARU 210X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018753",
    "descripcion": "FORRO CAB BARU 210X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018754",
    "descripcion": "FORRO CAB BARU 210X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018755",
    "descripcion": "FORRO CAB BARU 210X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018756",
    "descripcion": "FORRO CAB BARU 210X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018757",
    "descripcion": "FORRO CAB BARU 210X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018758",
    "descripcion": "FORRO CAB BARU 210X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018759",
    "descripcion": "FORRO CAB BARU 210X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018760",
    "descripcion": "FORRO CAB BARU 210X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018761",
    "descripcion": "FORRO CAB BARU 210X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018762",
    "descripcion": "FORRO CAB BARU 210X72 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018763",
    "descripcion": "FORRO CAB BARU 210X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018764",
    "descripcion": "FORRO CAB BARU 210X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018765",
    "descripcion": "FORRO CAB BARU 210X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018766",
    "descripcion": "FORRO CAB BARU 210X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018767",
    "descripcion": "FORRO CAB BARU 210X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018768",
    "descripcion": "FORRO CAB BARU 210X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018769",
    "descripcion": "FORRO CAB BERLIN 115X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018770",
    "descripcion": "FORRO CAB BERLIN 115X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018771",
    "descripcion": "FORRO CAB BERLIN 115X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018772",
    "descripcion": "FORRO CAB BERLIN 115X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018773",
    "descripcion": "FORRO CAB BERLIN 115X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018774",
    "descripcion": "FORRO CAB BERLIN 115X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018775",
    "descripcion": "FORRO CAB BERLIN 115X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018776",
    "descripcion": "FORRO CAB BERLIN 115X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018777",
    "descripcion": "FORRO CAB BERLIN 115X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018778",
    "descripcion": "FORRO CAB BERLIN 115X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018779",
    "descripcion": "FORRO CAB BERLIN 115X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018780",
    "descripcion": "FORRO CAB BERLIN 115X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018781",
    "descripcion": "FORRO CAB BERLIN 115X50 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018782",
    "descripcion": "FORRO CAB BERLIN 115X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018783",
    "descripcion": "FORRO CAB BERLIN 115X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018784",
    "descripcion": "FORRO CAB BERLIN VINTAGE CAPUCCI 115",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018785",
    "descripcion": "FORRO CAB BERLIN 115X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018786",
    "descripcion": "FORRO CAB BERLIN 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018787",
    "descripcion": "FORRO CAB BERLIN 115X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018788",
    "descripcion": "FORRO CAB BERLIN 115X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018789",
    "descripcion": "FORRO CAB BERLIN 115X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018790",
    "descripcion": "FORRO CAB BERLIN 115X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018791",
    "descripcion": "FORRO CAB BERLIN 145X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018792",
    "descripcion": "FORRO CAB BERLIN 145X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018793",
    "descripcion": "FORRO CAB BERLIN EPIC OCEANO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018794",
    "descripcion": "FORRO CAB BERLIN 145X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018795",
    "descripcion": "FORRO CAB BERLIN EPIC TIERRA 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018796",
    "descripcion": "FORRO CAB BERLIN 145X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018797",
    "descripcion": "FORRO CAB BERLIN 145X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018798",
    "descripcion": "FORRO CAB BERLIN 145X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018799",
    "descripcion": "FORRO CAB BERLIN 145X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018800",
    "descripcion": "FORRO CAB BERLIN 145X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018801",
    "descripcion": "FORRO CAB BERLIN STONE GRAFITO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018802",
    "descripcion": "FORRO CAB BERLIN 145X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018803",
    "descripcion": "FORRO CAB BERLIN 145X50 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018804",
    "descripcion": "FORRO CAB BERLIN 145X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018805",
    "descripcion": "FORRO CAB BERLIN 145X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018806",
    "descripcion": "FORRO CAB BERLIN VINTAGE CAPUC 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018807",
    "descripcion": "FORRO CAB BERLIN VINTAGE HUMO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018808",
    "descripcion": "FORRO CAB BERLIN 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018809",
    "descripcion": "FORRO CAB BERLIN 145X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018810",
    "descripcion": "FORRO CAB BERLIN 145X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018811",
    "descripcion": "FORRO CAB BERLIN 145X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018812",
    "descripcion": "FORRO CAB BERLIN 145X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018813",
    "descripcion": "FORRO CAB BERLIN 145X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018814",
    "descripcion": "FORRO CAB BERLIN 145X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018815",
    "descripcion": "FORRO CAB BERLIN 145X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018816",
    "descripcion": "FORRO CAB BERLIN 145X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018817",
    "descripcion": "FORRO CAB BERLIN 145X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018818",
    "descripcion": "FORRO CAB BERLIN 145X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018819",
    "descripcion": "FORRO CAB BERLIN 145X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018820",
    "descripcion": "FORRO CAB BERLIN 145X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018821",
    "descripcion": "FORRO CAB BERLIN 145X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018822",
    "descripcion": "FORRO CAB BERLIN 145X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018823",
    "descripcion": "FORRO CAB BERLIN 145X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018824",
    "descripcion": "FORRO CAB BERLIN 145X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018825",
    "descripcion": "FORRO CAB BERLIN 145X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018826",
    "descripcion": "FORRO CAB BERLIN 145X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018827",
    "descripcion": "FORRO CAB BERLIN 145X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018828",
    "descripcion": "FORRO CAB BERLIN 145X72 VINTAGE CAPUCCIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018829",
    "descripcion": "FORRO CAB BERLIN VINTAGE HUMO 145X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018830",
    "descripcion": "FORRO CAB BERLIN 145X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018831",
    "descripcion": "FORRO CAB BERLIN 145X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018832",
    "descripcion": "FORRO CAB BERLIN 145X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018833",
    "descripcion": "FORRO CAB BERLIN 145X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018834",
    "descripcion": "FORRO CAB BERLIN 145X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018835",
    "descripcion": "FORRO CAB BERLIN 170X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018836",
    "descripcion": "FORRO CAB BERLIN EPIC BRUMA 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018837",
    "descripcion": "FORRO CAB BERLIN 170X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018838",
    "descripcion": "FORRO CAB BERLIN 170X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018839",
    "descripcion": "FORRO CAB BERLIN EPIC TIERRA 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018840",
    "descripcion": "FORRO CAB BERLIN 170X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018841",
    "descripcion": "FORRO CAB BERLIN 170X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018842",
    "descripcion": "FORRO CAB BERLIN 170X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018843",
    "descripcion": "FORRO CAB BERLIN 170X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018844",
    "descripcion": "FORRO CAB BERLIN 170X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018845",
    "descripcion": "FORRO CAB BERLIN STONE GRAFITO 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018846",
    "descripcion": "FORRO CAB BERLIN STONE JASPE 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018847",
    "descripcion": "FORRO CAB BERLIN STONE MARMOL 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018848",
    "descripcion": "FORRO CAB BERLIN 170X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018849",
    "descripcion": "FORRO CAB BERLIN VINTAGE CAFE 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018850",
    "descripcion": "FORRO CAB BERLIN 170X50 VINTAGE CAPUCCIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018851",
    "descripcion": "FORRO CAB BERLIN VINTAGE HUMO 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018852",
    "descripcion": "FORRO CAB BERLIN VINTAGE NEGRO 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018853",
    "descripcion": "FORRO CAB BERLIN 170X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018854",
    "descripcion": "FORRO CAB BERLIN 170X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018855",
    "descripcion": "FORRO CAB BERLIN 170X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018856",
    "descripcion": "FORRO CAB BERLIN 170X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018857",
    "descripcion": "FORRO CAB BERLIN 170X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018858",
    "descripcion": "FORRO CAB BERLIN 170X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018859",
    "descripcion": "FORRO CAB BERLIN 170X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018860",
    "descripcion": "FORRO CAB BERLIN 170X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018861",
    "descripcion": "FORRO CAB BERLIN 170X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018862",
    "descripcion": "FORRO CAB BERLIN 170X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018863",
    "descripcion": "FORRO CAB BERLIN 170X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018864",
    "descripcion": "FORRO CAB BERLIN 170X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018865",
    "descripcion": "FORRO CAB BERLIN 170X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018866",
    "descripcion": "FORRO CAB BERLIN 170X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018867",
    "descripcion": "FORRO CAB BERLIN 170X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018868",
    "descripcion": "FORRO CAB BERLIN 170X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018869",
    "descripcion": "FORRO CAB BERLIN 170X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018870",
    "descripcion": "FORRO CAB BERLIN 170X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018871",
    "descripcion": "FORRO CAB BERLIN 170X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018872",
    "descripcion": "FORRO CAB BERLIN 170X72 VINTAGE CAPUCCIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018873",
    "descripcion": "FORRO CAB BERLIN 170X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018874",
    "descripcion": "FORRO CAB BERLIN VINTAGE NEGRO 170X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018875",
    "descripcion": "FORRO CAB BERLIN 170X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018876",
    "descripcion": "FORRO CAB BERLIN 170X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018877",
    "descripcion": "FORRO CAB BERLIN 170X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018878",
    "descripcion": "FORRO CAB BERLIN 170X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018879",
    "descripcion": "FORRO CAB BERLIN EPIC ARENA 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018880",
    "descripcion": "FORRO CAB BERLIN 210X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018881",
    "descripcion": "FORRO CAB BERLIN 210X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018882",
    "descripcion": "FORRO CAB BERLIN 210X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018883",
    "descripcion": "FORRO CAB BERLIN 210X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018884",
    "descripcion": "FORRO CAB BERLIN 210X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018885",
    "descripcion": "FORRO CAB BERLIN 210X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018886",
    "descripcion": "FORRO CAB BERLIN 210X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018887",
    "descripcion": "FORRO CAB BERLIN 210X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018888",
    "descripcion": "FORRO CAB BERLIN 210X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018889",
    "descripcion": "FORRO CAB BERLIN 210X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018890",
    "descripcion": "FORRO CAB BERLIN 210X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018891",
    "descripcion": "FORRO CAB BERLIN STONE MARMOL 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018892",
    "descripcion": "FORRO CAB BERLIN 210X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018893",
    "descripcion": "FORRO CAB BERLIN 210X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018894",
    "descripcion": "FORRO CAB BERLIN 210X50 VINTAGE CAPUCCIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018895",
    "descripcion": "FORRO CAB BERLIN VINTAGE HUMO 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018896",
    "descripcion": "FORRO CAB BERLIN 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018897",
    "descripcion": "FORRO CAB BERLIN 210X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018898",
    "descripcion": "FORRO CAB BERLIN 210X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018899",
    "descripcion": "FORRO CAB BERLIN 210X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018900",
    "descripcion": "FORRO CAB BERLIN 210X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018901",
    "descripcion": "FORRO CAB BERLIN EPIC ARENA 210X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018902",
    "descripcion": "FORRO CAB BERLIN 210X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018903",
    "descripcion": "FORRO CAB BERLIN 210X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018904",
    "descripcion": "FORRO CAB BERLIN 210X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018905",
    "descripcion": "FORRO CAB BERLIN 210X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018906",
    "descripcion": "FORRO CAB BERLIN 210X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018907",
    "descripcion": "FORRO CAB BERLIN 210X72 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018908",
    "descripcion": "FORRO CAB BERLIN 210X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018909",
    "descripcion": "FORRO CAB BERLIN 210X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018910",
    "descripcion": "FORRO CAB BERLIN 210X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018911",
    "descripcion": "FORRO CAB BERLIN 210X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018912",
    "descripcion": "FORRO CAB BERLIN 210X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018913",
    "descripcion": "FORRO CAB BERLIN 210X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018914",
    "descripcion": "FORRO CAB BERLIN 210X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018915",
    "descripcion": "FORRO CAB BERLIN 210X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018916",
    "descripcion": "FORRO CAB BERLIN 210X72 VINTAGE CAPUCCIN",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018917",
    "descripcion": "FORRO CAB BERLIN 210X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018918",
    "descripcion": "FORRO CAB BERLIN 210X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018919",
    "descripcion": "FORRO CAB BERLIN 210X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018920",
    "descripcion": "FORRO CAB BERLIN 210X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018921",
    "descripcion": "FORRO CAB BERLIN 210X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018922",
    "descripcion": "FORRO CAB BERLIN 210X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018923",
    "descripcion": "FORRO CAB CRETA 115X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018924",
    "descripcion": "FORRO CAB CRETA 115X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018925",
    "descripcion": "FORRO CAB CRETA 115X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018926",
    "descripcion": "FORRO CAB CRETA 115X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018927",
    "descripcion": "FORRO CAB CRETA 115X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018928",
    "descripcion": "FORRO CAB CRETA 115X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018929",
    "descripcion": "FORRO CAB CRETA 115X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018930",
    "descripcion": "FORRO CAB CRETA 115X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018931",
    "descripcion": "FORRO CAB CRETA 115X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018932",
    "descripcion": "FORRO CAB CRETA 115X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018933",
    "descripcion": "FORRO CAB CRETA 115X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018934",
    "descripcion": "FORRO CAB CRETA 115X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018935",
    "descripcion": "FORRO CAB CRETA STONE MARMOL 115",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018936",
    "descripcion": "FORRO CAB CRETA 115X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018937",
    "descripcion": "FORRO CAB CRETA VINTAGE CAFE 115",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018938",
    "descripcion": "FORRO CAB CRETA 115X50 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018939",
    "descripcion": "FORRO CAB CRETA 115X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018940",
    "descripcion": "FORRO CAB CRETA 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018941",
    "descripcion": "FORRO CAB CRETA 115X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018942",
    "descripcion": "FORRO CAB CRETA 115X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018943",
    "descripcion": "FORRO CAB CRETA 115X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018944",
    "descripcion": "FORRO CAB CRETA 115X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018945",
    "descripcion": "FORRO CAB CRETA EPIC ARENA 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018946",
    "descripcion": "FORRO CAB CRETA 145X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018947",
    "descripcion": "FORRO CAB CRETA EPIC OCEANO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018948",
    "descripcion": "FORRO CAB CRETA 145X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018949",
    "descripcion": "FORRO CAB CRETA EPIC TIERRA 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018950",
    "descripcion": "FORRO CAB CRETA 145X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018951",
    "descripcion": "FORRO CAB CRETA 145X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018952",
    "descripcion": "FORRO CAB CRETA 145X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018953",
    "descripcion": "FORRO CAB CRETA 145X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018954",
    "descripcion": "FORRO CAB CRETA 145X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018955",
    "descripcion": "FORRO CAB CRETA 145X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018956",
    "descripcion": "FORRO CAB CRETA 145X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018957",
    "descripcion": "FORRO CAB CRETA STONE MARMOL 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018958",
    "descripcion": "FORRO CAB CRETA 145X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018959",
    "descripcion": "FORRO CAB CRETA 145X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018960",
    "descripcion": "FORRO CAB CRETA VINTAGE CAPUC 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018961",
    "descripcion": "FORRO CAB CRETA 145X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018962",
    "descripcion": "FORRO CAB CRETA 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018963",
    "descripcion": "FORRO CAB CRETA 145X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018964",
    "descripcion": "FORRO CAB CRETA 145X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018965",
    "descripcion": "FORRO CAB CRETA 145X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018966",
    "descripcion": "FORRO CAB CRETA TAPIZ PLOMO 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018967",
    "descripcion": "FORRO CAB CRETA 145X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018968",
    "descripcion": "FORRO CAB CRETA 145X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018969",
    "descripcion": "FORRO CAB CRETA 145X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018970",
    "descripcion": "FORRO CAB CRETA 145X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018971",
    "descripcion": "FORRO CAB CRETA 145X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018972",
    "descripcion": "FORRO CAB CRETA 145X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018973",
    "descripcion": "FORRO CAB CRETA 145X72 FLANIN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018974",
    "descripcion": "FORRO CAB CRETA 145X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018975",
    "descripcion": "FORRO CAB CRETA 145X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018976",
    "descripcion": "FORRO CAB CRETA 145X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018977",
    "descripcion": "FORRO CAB CRETA STONE GRAFITO 145X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018978",
    "descripcion": "FORRO CAB CRETA 145X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018979",
    "descripcion": "FORRO CAB CRETA 145X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018980",
    "descripcion": "FORRO CAB CRETA STONE PLATA 145X72",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018981",
    "descripcion": "FORRO CAB CRETA 145X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018982",
    "descripcion": "FORRO CAB CRETA 145X72 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018983",
    "descripcion": "FORRO CAB CRETA 145X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018984",
    "descripcion": "FORRO CAB CRETA 145X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018985",
    "descripcion": "FORRO CAB CRETA 145X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018986",
    "descripcion": "FORRO CAB CRETA 145X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018987",
    "descripcion": "FORRO CAB CRETA 145X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018988",
    "descripcion": "FORRO CAB CRETA 145X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018989",
    "descripcion": "FORRO CAB CRETA 170X50 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018990",
    "descripcion": "FORRO CAB CRETA 170X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018991",
    "descripcion": "FORRO CAB CRETA 170X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018992",
    "descripcion": "FORRO CAB CRETA 170X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018993",
    "descripcion": "FORRO CAB CRETA EPIC TIERRA 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018994",
    "descripcion": "FORRO CAB CRETA 170X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018995",
    "descripcion": "FORRO CAB CRETA 170X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018996",
    "descripcion": "FORRO CAB CRETA 170X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018997",
    "descripcion": "FORRO CAB CRETA 170X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018998",
    "descripcion": "FORRO CAB CRETA STONE COBRE 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30018999",
    "descripcion": "FORRO CAB CRETA 170X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019000",
    "descripcion": "FORRO CAB CRETA 170X50 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019001",
    "descripcion": "FORRO CAB CRETA STONE MARMOL 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019002",
    "descripcion": "FORRO CAB CRETA STONE PLATA 170X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019003",
    "descripcion": "FORRO CAB CRETA 170X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019004",
    "descripcion": "FORRO CAB CRETA 170X50 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019005",
    "descripcion": "FORRO CAB CRETA 170X50 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019006",
    "descripcion": "FORRO CAB CRETA 170X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019007",
    "descripcion": "FORRO CAB CRETA 170X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019008",
    "descripcion": "FORRO CAB CRETA 170X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019009",
    "descripcion": "FORRO CAB CRETA 170X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019010",
    "descripcion": "FORRO CAB CRETA 170X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019011",
    "descripcion": "FORRO CAB CRETA 170X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019012",
    "descripcion": "FORRO CAB CRETA 170X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019013",
    "descripcion": "FORRO CAB CRETA 170X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019014",
    "descripcion": "FORRO CAB CRETA 170X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019015",
    "descripcion": "FORRO CAB CRETA 170X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019016",
    "descripcion": "FORRO CAB CRETA 170X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019017",
    "descripcion": "FORRO CAB CRETA 170X72 FLANIN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019018",
    "descripcion": "FORRO CAB CRETA 170X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019019",
    "descripcion": "FORRO CAB CRETA 170X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019020",
    "descripcion": "FORRO CAB CRETA 170X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019021",
    "descripcion": "FORRO CAB CRETA 170X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019022",
    "descripcion": "FORRO CAB CRETA 170X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019023",
    "descripcion": "FORRO CAB CRETA 170X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019024",
    "descripcion": "FORRO CAB CRETA 170X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019025",
    "descripcion": "FORRO CAB CRETA 170X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019026",
    "descripcion": "FORRO CAB CRETA 170X72 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019027",
    "descripcion": "FORRO CAB CRETA 170X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019028",
    "descripcion": "FORRO CAB CRETA 170X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019029",
    "descripcion": "FORRO CAB CRETA 170X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019030",
    "descripcion": "FORRO CAB CRETA 170X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019031",
    "descripcion": "FORRO CAB CRETA 170X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019032",
    "descripcion": "FORRO CAB CRETA 170X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019033",
    "descripcion": "FORRO CAB CRETA EPIC ARENA 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019034",
    "descripcion": "FORRO CAB CRETA 210X50 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019035",
    "descripcion": "FORRO CAB CRETA 210X50 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019036",
    "descripcion": "FORRO CAB CRETA 210X50 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019037",
    "descripcion": "FORRO CAB CRETA 210X50 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019038",
    "descripcion": "FORRO CAB CRETA 210X50 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019039",
    "descripcion": "FORRO CAB CRETA 210X50 FLANI HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019040",
    "descripcion": "FORRO CAB CRETA 210X50 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019041",
    "descripcion": "FORRO CAB CRETA 210X50 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019042",
    "descripcion": "FORRO CAB CRETA 210X50 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019043",
    "descripcion": "FORRO CAB CRETA 210X50 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019044",
    "descripcion": "FORRO CAB CRETA STONE JASPE 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019045",
    "descripcion": "FORRO CAB CRETA STONE MARMOL 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019046",
    "descripcion": "FORRO CAB CRETA 210X50 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019047",
    "descripcion": "FORRO CAB CRETA 210X50 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019048",
    "descripcion": "FORRO CAB CRETA 210X50 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019049",
    "descripcion": "FORRO CAB CRETA VINTAGE HUMO 210X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019050",
    "descripcion": "FORRO CAB CRETA 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019051",
    "descripcion": "FORRO CAB CRETA 210X50 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019052",
    "descripcion": "FORRO CAB CRETA 210X50 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019053",
    "descripcion": "FORRO CAB CRETA 210X50 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019054",
    "descripcion": "FORRO CAB CRETA 210X50 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019055",
    "descripcion": "FORRO CAB CRETA 210X72 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019056",
    "descripcion": "FORRO CAB CRETA 210X72 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019057",
    "descripcion": "FORRO CAB CRETA 210X72 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019058",
    "descripcion": "FORRO CAB CRETA 210X72 EPIC OTONO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019059",
    "descripcion": "FORRO CAB CRETA 210X72 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019060",
    "descripcion": "FORRO CAB CRETA 210X72 FLANI FUDGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019061",
    "descripcion": "FORRO CAB CRETA 210X72 FLANIN HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019062",
    "descripcion": "FORRO CAB CRETA 210X72 FLANI MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019063",
    "descripcion": "FORRO CAB CRETA 210X72 FLANI TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019064",
    "descripcion": "FORRO CAB CRETA 210X72 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019065",
    "descripcion": "FORRO CAB CRETA 210X72 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019066",
    "descripcion": "FORRO CAB CRETA 210X72 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019067",
    "descripcion": "FORRO CAB CRETA 210X72 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019068",
    "descripcion": "FORRO CAB CRETA 210X72 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019069",
    "descripcion": "FORRO CAB CRETA 210X72 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019070",
    "descripcion": "FORRO CAB CRETA 210X72 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019071",
    "descripcion": "FORRO CAB CRETA 210X72 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019072",
    "descripcion": "FORRO CAB CRETA 210X72 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019073",
    "descripcion": "FORRO CAB CRETA 210X72 TAPIZ AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019074",
    "descripcion": "FORRO CAB CRETA 210X72 TAPIZ CAFE CLARO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019075",
    "descripcion": "FORRO CAB CRETA 210X72 TAPIZ CHOCO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019076",
    "descripcion": "FORRO CAB CRETA 210X72 TAPIZ PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019090",
    "descripcion": "FORRO PROTECTOR CHN IMPER BEBE 70X100X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30019245",
    "descripcion": "FORRO CAMA ATENAS 105 ARGO AZUL",
    "tiempoMin": 18
  },
  {
    "codigo": "30019246",
    "descripcion": "FORRO CAMA ATENAS 105 ARGO BEIGE",
    "tiempoMin": 18
  },
  {
    "codigo": "30019248",
    "descripcion": "FORRO CAMA ATENAS 135 ARGO AZUL",
    "tiempoMin": 20
  },
  {
    "codigo": "30019249",
    "descripcion": "FORRO CAMA ATENAS 135 ARGO BEIGE",
    "tiempoMin": 20
  },
  {
    "codigo": "30019251",
    "descripcion": "FORRO CAMA ATENAS 160 ARGO AZUL",
    "tiempoMin": 22
  },
  {
    "codigo": "30019252",
    "descripcion": "FORRO CAMA ATENAS 160 ARGO BEIGE",
    "tiempoMin": 22
  },
  {
    "codigo": "30019253",
    "descripcion": "FORRO CAMA ATENAS 160 MAY STUCCO",
    "tiempoMin": 22
  },
  {
    "codigo": "30019254",
    "descripcion": "FORRO CAMA ATENAS 200 ARGO AZUL",
    "tiempoMin": 24
  },
  {
    "codigo": "30019255",
    "descripcion": "FORRO CAMA ATENAS 200 ARGO BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30019256",
    "descripcion": "FORRO CAMA ATENAS 200 MAY STUCCO",
    "tiempoMin": 24
  },
  {
    "codigo": "30019257",
    "descripcion": "FORRO VELADOR FLORENCIA ARGO BEIGE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30019258",
    "descripcion": "FORRO VELADOR FLORENCIA ARGO AZUL",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30019259",
    "descripcion": "FORRO VELADOR PALERMO ARGO BEIGE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30019260",
    "descripcion": "FORRO VELADOR PALERMO ARGO AZUL",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30019296",
    "descripcion": "FORRO CAB BARU 115X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019297",
    "descripcion": "FORRO CAB BARU 115X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019298",
    "descripcion": "FORRO CAB BERLIN 115X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019299",
    "descripcion": "FORRO CAB BERLIN 115X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019300",
    "descripcion": "FORRO CAB CRETA ARGO AZUL 115",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019301",
    "descripcion": "FORRO CAB CRETA 115X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019302",
    "descripcion": "FORRO CAB BARU 145X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019303",
    "descripcion": "FORRO CAB BARU 145X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019304",
    "descripcion": "FORRO CAB BERLIN 145X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019305",
    "descripcion": "FORRO CAB BERLIN 145X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019306",
    "descripcion": "FORRO CAB CRETA 145X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019307",
    "descripcion": "FORRO CAB CRETA ARGO BEIGE 145X50",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019308",
    "descripcion": "FORRO CAB BARU 145X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019309",
    "descripcion": "FORRO CAB BARU 145X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019310",
    "descripcion": "FORRO CAB BERLIN 145X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019311",
    "descripcion": "FORRO CAB BERLIN 145X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019312",
    "descripcion": "FORRO CAB CRETA 145X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019313",
    "descripcion": "FORRO CAB CRETA 145X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019314",
    "descripcion": "FORRO CAB BARU 170X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019315",
    "descripcion": "FORRO CAB BARU 170X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019316",
    "descripcion": "FORRO CAB BERLIN 170X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019317",
    "descripcion": "FORRO CAB BERLIN 170X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019318",
    "descripcion": "FORRO CAB CRETA 170X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019319",
    "descripcion": "FORRO CAB CRETA 170X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019320",
    "descripcion": "FORRO CAB BARU 170X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019321",
    "descripcion": "FORRO CAB BARU 170X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019322",
    "descripcion": "FORRO CAB BERLIN 170X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019323",
    "descripcion": "FORRO CAB BERLIN 170X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019324",
    "descripcion": "FORRO CAB CRETA 170X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019325",
    "descripcion": "FORRO CAB CRETA 170X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019326",
    "descripcion": "FORRO CAB BARU 210X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019327",
    "descripcion": "FORRO CAB BARU 210X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019328",
    "descripcion": "FORRO CAB BERLIN 210X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019329",
    "descripcion": "FORRO CAB BERLIN 210X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019330",
    "descripcion": "FORRO CAB CRETA 210X50 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019331",
    "descripcion": "FORRO CAB CRETA 210X50 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019332",
    "descripcion": "FORRO CAB BARU 210X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019333",
    "descripcion": "FORRO CAB BARU 210X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019334",
    "descripcion": "FORRO CAB BERLIN 210X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019335",
    "descripcion": "FORRO CAB BERLIN 210X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019336",
    "descripcion": "FORRO CAB CRETA 210X72 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019337",
    "descripcion": "FORRO CAB CRETA 210X72 ARGO BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019380",
    "descripcion": "FORRO MIRAGE 105 ARGO AZUL",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30019381",
    "descripcion": "FORRO MIRAGE 120 ARGO AZUL",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30019382",
    "descripcion": "FORRO MIRAGE 135 ARGO AZUL",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30019383",
    "descripcion": "FORRO MIRAGE ARGO BEIGE 105",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30019384",
    "descripcion": "FORRO MIRAGE 120 ARGO BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30019385",
    "descripcion": "FORRO MIRAGE 135 ARGO BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30019395",
    "descripcion": "FORRO CHN. BABY CHAIDE CAMBIADOR 80X40X5",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019403",
    "descripcion": "FORRO SOFA MASCOTA BEIGE /CAFE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019404",
    "descripcion": "FORRO SOFA MASCOTA PLATA/GRIS",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019490",
    "descripcion": "FORRO CAMA ATENAS 105 FLA FUDGE",
    "tiempoMin": 18
  },
  {
    "codigo": "30019491",
    "descripcion": "FORRO CAMA ATENAS 135 FLA FUDGE",
    "tiempoMin": 20
  },
  {
    "codigo": "30019492",
    "descripcion": "FORRO CAMA ATENAS 160 FLA FUDGE",
    "tiempoMin": 22
  },
  {
    "codigo": "30019493",
    "descripcion": "FORRO CAMA ATENAS 200 FLA FUDGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30019512",
    "descripcion": "FORRO BENCH AREZZO 120 FLANIGAN HIBISCUS",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019513",
    "descripcion": "FORRO BENCH AREZZO 120 FLANIGAN TANGELO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019514",
    "descripcion": "FORRO BENCH AREZZO 120 FLANIGAN MERLOT",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019515",
    "descripcion": "FORRO BENCH AREZZO 120 FLANIGAN FUDGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019516",
    "descripcion": "FORRO BENCH AREZZO 120 LYRICAL SIERRA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019517",
    "descripcion": "FORRO BENCH AREZZO 120 VINTAGE BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019518",
    "descripcion": "FORRO BENCH AREZZO 120 VINTAGE CAPUCCINO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019519",
    "descripcion": "FORRO BENCH AREZZO 120 VINTAGE HUMO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019520",
    "descripcion": "FORRO BENCH AREZZO 120 VINTAGE CAFE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019521",
    "descripcion": "FORRO BENCH AREZZO 120 VINTAGE NEGRO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019522",
    "descripcion": "FORRO BENCH AREZZO 120 EPIC BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019523",
    "descripcion": "FORRO BENCH AREZZO 120 EPIC OCEANO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019524",
    "descripcion": "FORRO BENCH AREZZO 120 EPIC ARENA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019525",
    "descripcion": "FORRO BENCH AREZZO 120 EPIC TIERRA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019526",
    "descripcion": "FORRO BENCH AREZZO 120 EPIC OTONO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019527",
    "descripcion": "FORRO BENCH AREZZO 120 EPIC BRUMA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019528",
    "descripcion": "FORRO BENCH AREZZO 120 STONE PLATA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019529",
    "descripcion": "FORRO BENCH AREZZO 120 STONE JASPE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019530",
    "descripcion": "FORRO BENCH AREZZO 120 STONE COBRE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019531",
    "descripcion": "FORRO BENCH AREZZO 120 STONE GRAFITO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019532",
    "descripcion": "FORRO BENCH AREZZO 120 STONE MARMOL",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019573",
    "descripcion": "TAPA T. FALSO NEGRO BUTACA",
    "tiempoMin": 6.34
  },
  {
    "codigo": "30019574",
    "descripcion": "TAPA T. FALSO NEGRO RECLINABLE",
    "tiempoMin": 5
  },
  {
    "codigo": "30019575",
    "descripcion": "TAPA T. FALSO NEGRO OTTOMAN REDONDO",
    "tiempoMin": 2.3
  },
  {
    "codigo": "30019576",
    "descripcion": "TAPA T. FALSO NEGRO OTTOMAN ZAPATERA",
    "tiempoMin": 2.3
  },
  {
    "codigo": "30019584",
    "descripcion": "FORRO CAMA ATENAS 105 VINTAGE BEIGE",
    "tiempoMin": 18
  },
  {
    "codigo": "30019585",
    "descripcion": "FORRO CAMA ATENAS 135 VINTAGE BEIGE",
    "tiempoMin": 20
  },
  {
    "codigo": "30019586",
    "descripcion": "FORRO CAMA ATENAS 160 VINTAGE BEIGE",
    "tiempoMin": 22
  },
  {
    "codigo": "30019587",
    "descripcion": "FORRO CAMA ATENAS 200 VINTAGE BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30019588",
    "descripcion": "FORRO CAB BERLIN 115X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019589",
    "descripcion": "FORRO CAB BERLIN 145X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019590",
    "descripcion": "FORRO CAB BERLIN 170X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019591",
    "descripcion": "FORRO CAB BERLIN 210X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019592",
    "descripcion": "FORRO CAB BERLIN 145X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019593",
    "descripcion": "FORRO CAB BERLIN 170X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019594",
    "descripcion": "FORRO CAB BERLIN 210X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019595",
    "descripcion": "FORRO CAB BARU 115X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019596",
    "descripcion": "FORRO CAB BARU 145X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019597",
    "descripcion": "FORRO CAB BARU 170X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019598",
    "descripcion": "FORRO CAB BARU 210X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019599",
    "descripcion": "FORRO CAB BARU 145X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019600",
    "descripcion": "FORRO CAB BARU 170X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019601",
    "descripcion": "FORRO CAB BARU 210X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019602",
    "descripcion": "FORRO CAB CRETA 115X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019603",
    "descripcion": "FORRO CAB CRETA 145X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019604",
    "descripcion": "FORRO CAB CRETA 170X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019605",
    "descripcion": "FORRO CAB CRETA 210X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019606",
    "descripcion": "FORRO CAB CRETA 145X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019607",
    "descripcion": "FORRO CAB CRETA 170X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019608",
    "descripcion": "FORRO CAB CRETA 210X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019609",
    "descripcion": "FORRO CAB CAPRI 115X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019610",
    "descripcion": "FORRO CAB CAPRI 145X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019611",
    "descripcion": "FORRO CAB CAPRI 170X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019612",
    "descripcion": "FORRO CAB CAPRI 210X50 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019613",
    "descripcion": "FORRO CAB CAPRI 145X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019614",
    "descripcion": "FORRO CAB CAPRI 170X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019615",
    "descripcion": "FORRO CAB CAPRI 210X72 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019616",
    "descripcion": "FORRO SPRING 105 VINTAGE BEIGE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30019617",
    "descripcion": "FORRO MATISSE 105 VINTAGE BEIGE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30019618",
    "descripcion": "FORRO OPORTO 135 VINTAGE BEIGE",
    "tiempoMin": 210
  },
  {
    "codigo": "30019619",
    "descripcion": "FORRO MIAMI 105 VINTAGE BEIGE",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30019620",
    "descripcion": "FORRO MANCHESTER 105 VINTAGE BEIGE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30019621",
    "descripcion": "FORRO MILANO 105 VINTAGE BEIGE",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30019622",
    "descripcion": "FORRO MALIBU 105 VINTAGE BEIGE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30019623",
    "descripcion": "FORRO MALIBU 135 VINTAGE BEIGE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30019624",
    "descripcion": "FORRO BENCH 115 VINTAGE BEIGE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30019625",
    "descripcion": "FORRO BENCH 145 VINTAGE BEIGE",
    "tiempoMin": 35
  },
  {
    "codigo": "30019626",
    "descripcion": "FORRO OTTOMAN 70 VINTAGE BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30019627",
    "descripcion": "FORRO OTTOMAN REDONDO VINTAGE BEIGE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30019628",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P VINTAGE BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019629",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P VINTAGE BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019630",
    "descripcion": "FORRO BUTACA ROMA EPIC BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019631",
    "descripcion": "FORRO RECLINABLE ZEUS VINTAGE BEIGE",
    "tiempoMin": 142
  },
  {
    "codigo": "30019632",
    "descripcion": "FORRO VELADOR FLORENCIA VINTAGE BEIGE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30019633",
    "descripcion": "FORRO VELADOR PALERMO VINTAGE BEIGE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30019634",
    "descripcion": "FORRO MIRAGE 105 VINTAGE BEIGE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30019635",
    "descripcion": "FORRO MIRAGE 120 VINTAGE BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30019636",
    "descripcion": "FORRO MIRAGE 135 VINTAGE BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30019637",
    "descripcion": "FORRO CAMA BERLIN 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019638",
    "descripcion": "FORRO CAMA BERLIN 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019639",
    "descripcion": "FORRO CAMA BERLIN 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019640",
    "descripcion": "FORRO CAMA BERLIN 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019641",
    "descripcion": "FORRO CAMA BARU 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019642",
    "descripcion": "FORRO CAMA BARU 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019643",
    "descripcion": "FORRO CAMA BARU 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019644",
    "descripcion": "FORRO CAMA BARU 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019645",
    "descripcion": "FORRO CAMA CRETA 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019646",
    "descripcion": "FORRO CAMA CRETA 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019647",
    "descripcion": "FORRO CAMA CRETA 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019648",
    "descripcion": "FORRO CAMA CRETA 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019649",
    "descripcion": "FORRO CAMA FLOREN 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019650",
    "descripcion": "FORRO CAMA FLOREN 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019651",
    "descripcion": "FORRO CAMA FLOREN 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019652",
    "descripcion": "FORRO CAMA FLOREN 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019653",
    "descripcion": "FORRO CAMA LISBOA 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019654",
    "descripcion": "FORRO CAMA LISBOA 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019655",
    "descripcion": "FORRO CAMA LISBOA 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019656",
    "descripcion": "FORRO CAMA LISBOA 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019657",
    "descripcion": "FORRO CAMA MILOS 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019658",
    "descripcion": "FORRO CAMA MILOS 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019659",
    "descripcion": "FORRO CAMA MILOS 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019660",
    "descripcion": "FORRO CAMA MILOS 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019661",
    "descripcion": "FORRO CAMA LONDRES 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019662",
    "descripcion": "FORRO CAMA LONDRES 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019663",
    "descripcion": "FORRO CAMA LONDRES 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019664",
    "descripcion": "FORRO CAMA LONDRES 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019665",
    "descripcion": "FORRO CAMA PRAGA 115 VINTAGE BEIGE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30019666",
    "descripcion": "FORRO CAMA PRAGA 145 VINTAGE BEIGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30019667",
    "descripcion": "FORRO CAMA PRAGA 170 VINTAGE BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30019668",
    "descripcion": "FORRO CAMA PRAGA 210 VINTAGE BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30019669",
    "descripcion": "FORRO CAMA NAPOLES 105 VINTAGE BEIGE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30019670",
    "descripcion": "FORRO CAMA NAPOLES 135 VINTAGE BEIGE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30019671",
    "descripcion": "FORRO CAMA NAPOLES 160 VINTAGE BEIGE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30019672",
    "descripcion": "FORRO CAMA NAPOLES 200 VINTAGE BEIGE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30019673",
    "descripcion": "FORRO CAMA TOSCANA 115 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019674",
    "descripcion": "FORRO CAMA TOSCANA 145 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019675",
    "descripcion": "FORRO CAMA TOSCANA 170 VINTAGE BEIGE",
    "tiempoMin": 7.76
  },
  {
    "codigo": "30019676",
    "descripcion": "FORRO CAMA TOSCANA 210 VINTAGE BEIGE",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30019677",
    "descripcion": "FORRO CAMA VERONA 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019678",
    "descripcion": "FORRO CAMA VERONA 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019679",
    "descripcion": "FORRO CAMA VERONA 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019680",
    "descripcion": "FORRO BENCH AREZZO 75 VINTAGE BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30019794",
    "descripcion": "FORRO CAMA ATENAS 105 EPIC BEIGE",
    "tiempoMin": 18
  },
  {
    "codigo": "30019795",
    "descripcion": "FORRO CAMA ATENAS 135 EPIC BEIGE",
    "tiempoMin": 20
  },
  {
    "codigo": "30019796",
    "descripcion": "FORRO CAMA ATENAS 160 EPIC BEIGE",
    "tiempoMin": 22
  },
  {
    "codigo": "30019797",
    "descripcion": "FORRO CAMA ATENAS 200 EPIC BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30019798",
    "descripcion": "FORRO CAB BERLIN 115X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019799",
    "descripcion": "FORRO CAB BERLIN 145X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019800",
    "descripcion": "FORRO CAB BERLIN 170X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019801",
    "descripcion": "FORRO CAB BERLIN 210X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019802",
    "descripcion": "FORRO CAB BERLIN 145X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019803",
    "descripcion": "FORRO CAB BERLIN 170X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019804",
    "descripcion": "FORRO CAB BERLIN 210X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019805",
    "descripcion": "FORRO CAB BARU 115X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019806",
    "descripcion": "FORRO CAB BARU 145X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019807",
    "descripcion": "FORRO CAB BARU 170X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019808",
    "descripcion": "FORRO CAB BARU 210X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019809",
    "descripcion": "FORRO CAB BARU 145X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019810",
    "descripcion": "FORRO CAB BARU 170X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019811",
    "descripcion": "FORRO CAB BARU 210X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019812",
    "descripcion": "FORRO CAB CRETA 115X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019813",
    "descripcion": "FORRO CAB CRETA 145X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019814",
    "descripcion": "FORRO CAB CRETA 170X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019815",
    "descripcion": "FORRO CAB CRETA 210X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019816",
    "descripcion": "FORRO CAB CRETA 145X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019817",
    "descripcion": "FORRO CAB CRETA 170X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019818",
    "descripcion": "FORRO CAB CRETA 210X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019819",
    "descripcion": "FORRO CAB CAPRI 115X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019820",
    "descripcion": "FORRO CAB CAPRI 145X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019821",
    "descripcion": "FORRO CAB CAPRI 170X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019822",
    "descripcion": "FORRO CAB CAPRI 210X50 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019823",
    "descripcion": "FORRO CAB CAPRI 145X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019824",
    "descripcion": "FORRO CAB CAPRI 170X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019825",
    "descripcion": "FORRO CAB CAPRI 210X72 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019826",
    "descripcion": "FORRO SPRING 105 EPIC BEIGE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30019827",
    "descripcion": "FORRO MATISSE 105 EPIC BEIGE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30019828",
    "descripcion": "FORRO OPORTO 135 EPIC BEIGE",
    "tiempoMin": 210
  },
  {
    "codigo": "30019829",
    "descripcion": "FORRO MIAMI 105 EPIC BEIGE",
    "tiempoMin": 76.72
  },
  {
    "codigo": "30019830",
    "descripcion": "FORRO MANCHESTER 105 EPIC BEIGE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30019831",
    "descripcion": "FORRO MILANO 105 EPIC BEIGE",
    "tiempoMin": 67.92
  },
  {
    "codigo": "30019832",
    "descripcion": "FORRO MALIBU 105 EPIC BEIGE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30019833",
    "descripcion": "FORRO MALIBU 135 EPIC BEIGE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30019834",
    "descripcion": "FORRO BENCH 115 EPIC BEIGE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30019835",
    "descripcion": "FORRO BENCH 145 EPIC BEIGE",
    "tiempoMin": 35
  },
  {
    "codigo": "30019836",
    "descripcion": "FORRO OTTOMAN 70 EPIC BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30019837",
    "descripcion": "FORRO OTTOMAN REDONDO EPIC BEIGE",
    "tiempoMin": 33.79
  },
  {
    "codigo": "30019838",
    "descripcion": "FORRO OTTOMAN ZAPATERA C/P EPIC BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019839",
    "descripcion": "FORRO OTTOMAN ZAPATERA S/P EPIC BEIGE",
    "tiempoMin": 1.97
  },
  {
    "codigo": "30019840",
    "descripcion": "FORRO RECLINABLE ZEUS EPIC BEIGE",
    "tiempoMin": 142
  },
  {
    "codigo": "30019841",
    "descripcion": "FORRO VELADOR FLORENCIA EPIC BEIGE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30019842",
    "descripcion": "FORRO VELADOR PALERMO EPIC BEIGE",
    "tiempoMin": 6.26
  },
  {
    "codigo": "30019843",
    "descripcion": "FORRO MIRAGE 105 EPIC BEIGE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30019844",
    "descripcion": "FORRO MIRAGE 120 EPIC BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30019845",
    "descripcion": "FORRO MIRAGE 135 EPIC BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30019846",
    "descripcion": "FORRO CAMA BERLIN 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019847",
    "descripcion": "FORRO CAMA BERLIN 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019848",
    "descripcion": "FORRO CAMA BERLIN 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019849",
    "descripcion": "FORRO CAMA BERLIN 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019850",
    "descripcion": "FORRO CAMA BARU 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019851",
    "descripcion": "FORRO CAMA BARU 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019852",
    "descripcion": "FORRO CAMA BARU 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019853",
    "descripcion": "FORRO CAMA BARU 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019854",
    "descripcion": "FORRO CAMA CRETA 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019855",
    "descripcion": "FORRO CAMA CRETA 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019856",
    "descripcion": "FORRO CAMA CRETA 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019857",
    "descripcion": "FORRO CAMA CRETA 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019858",
    "descripcion": "FORRO CAMA FLOREN 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019859",
    "descripcion": "FORRO CAMA FLOREN 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019860",
    "descripcion": "FORRO CAMA FLOREN 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019861",
    "descripcion": "FORRO CAMA FLOREN 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019862",
    "descripcion": "FORRO CAMA LISBOA 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019863",
    "descripcion": "FORRO CAMA LISBOA 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019864",
    "descripcion": "FORRO CAMA LISBOA 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019865",
    "descripcion": "FORRO CAMA LISBOA 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019866",
    "descripcion": "FORRO CAMA MILOS 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019867",
    "descripcion": "FORRO CAMA MILOS 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019868",
    "descripcion": "FORRO CAMA MILOS 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019869",
    "descripcion": "FORRO CAMA MILOS 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019870",
    "descripcion": "FORRO CAMA LONDRES 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019871",
    "descripcion": "FORRO CAMA LONDRES 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019872",
    "descripcion": "FORRO CAMA LONDRES 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019873",
    "descripcion": "FORRO CAMA LONDRES 200 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019874",
    "descripcion": "FORRO CAMA PRAGA 115 EPIC BEIGE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30019875",
    "descripcion": "FORRO CAMA PRAGA 145 EPIC BEIGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30019876",
    "descripcion": "FORRO CAMA PRAGA 170 EPIC BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30019877",
    "descripcion": "FORRO CAMA PRAGA 210 EPIC BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30019878",
    "descripcion": "FORRO CAMA NAPOLES 105 EPIC BEIGE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30019879",
    "descripcion": "FORRO CAMA NAPOLES 135 EPIC BEIGE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30019880",
    "descripcion": "FORRO CAMA NAPOLES 160 EPIC BEIGE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30019881",
    "descripcion": "FORRO CAMA NAPOLES 200 EPIC BEIGE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30019882",
    "descripcion": "FORRO CAMA TOSCANA 115 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019883",
    "descripcion": "FORRO CAMA TOSCANA 145 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019884",
    "descripcion": "FORRO CAMA TOSCANA 170 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019885",
    "descripcion": "FORRO CAMA TOSCANA 210 EPIC BEIGE",
    "tiempoMin": 8.53
  },
  {
    "codigo": "30019886",
    "descripcion": "FORRO CAMA VERONA 105 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019887",
    "descripcion": "FORRO CAMA VERONA 135 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019888",
    "descripcion": "FORRO CAMA VERONA 160 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30019889",
    "descripcion": "FORRO BENCH AREZZO 75 EPIC BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30020009",
    "descripcion": "FORRO OTTOMAN VIENA 80 VINTAGE CAFE",
    "tiempoMin": 110
  },
  {
    "codigo": "30020010",
    "descripcion": "FORRO OTTOMAN VIENA 80 VINTAGE BEIGE",
    "tiempoMin": 110
  },
  {
    "codigo": "30020011",
    "descripcion": "FORRO OTTOMAN VIENA 80 VINTAGE NEGRO",
    "tiempoMin": 110
  },
  {
    "codigo": "30020012",
    "descripcion": "FORRO OTTOMAN VIENA 80 VINTAGE HUMO",
    "tiempoMin": 110
  },
  {
    "codigo": "30020013",
    "descripcion": "FORRO OTTOMAN VIENA 80 VINT CAPPUCINO",
    "tiempoMin": 110
  },
  {
    "codigo": "30020014",
    "descripcion": "FORRO OTTOMAN VIENA 80 STONE GRAFITO",
    "tiempoMin": 110
  },
  {
    "codigo": "30020015",
    "descripcion": "FORRO OTTOMAN VIENA 80 STONE JASPE",
    "tiempoMin": 110
  },
  {
    "codigo": "30020016",
    "descripcion": "FORRO OTTOMAN VIENA 80 STONE PLATA",
    "tiempoMin": 110
  },
  {
    "codigo": "30020017",
    "descripcion": "FORRO OTTOMAN VIENA 80 STONE MARMOL",
    "tiempoMin": 110
  },
  {
    "codigo": "30020018",
    "descripcion": "FORRO OTTOMAN VIENA 80 STONE COBRE",
    "tiempoMin": 110
  },
  {
    "codigo": "30020019",
    "descripcion": "FORRO OTTOMAN VIENA 80 EPIC OTONO",
    "tiempoMin": 110
  },
  {
    "codigo": "30020020",
    "descripcion": "FORRO OTTOMAN VIENA 80 EPIC BEIGE",
    "tiempoMin": 110
  },
  {
    "codigo": "30020021",
    "descripcion": "FORRO OTTOMAN VIENA 80 EPIC BRUMA",
    "tiempoMin": 110
  },
  {
    "codigo": "30020022",
    "descripcion": "FORRO OTTOMAN VIENA 80 EPIC TIERRA",
    "tiempoMin": 110
  },
  {
    "codigo": "30020023",
    "descripcion": "FORRO OTTOMAN VIENA 80 EPIC ARENA",
    "tiempoMin": 110
  },
  {
    "codigo": "30020024",
    "descripcion": "FORRO OTTOMAN VIENA 80 EPIC OCEANO",
    "tiempoMin": 110
  },
  {
    "codigo": "30020123",
    "descripcion": "FORRO COJIN CILINDRICO VINTAGE BEIGE",
    "tiempoMin": 5
  },
  {
    "codigo": "30020124",
    "descripcion": "FORRO COJIN CILINDRICO EPIC BEIGE",
    "tiempoMin": 5
  },
  {
    "codigo": "30020135",
    "descripcion": "FORRO INT COJIN 45X45 VINTAGE BEIGE",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30020136",
    "descripcion": "FORRO INT COJIN 45X45 EPIC BEIGE",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30020162",
    "descripcion": "FORRO CAMA ENCANTO 105 MOSTAZA",
    "tiempoMin": 13.56
  },
  {
    "codigo": "30020163",
    "descripcion": "FORRO CAMA ENCANTO 135 MOSTAZA",
    "tiempoMin": 11.28
  },
  {
    "codigo": "30020164",
    "descripcion": "FORRO CAMA ENCANTO 105 AZUL",
    "tiempoMin": 16.13
  },
  {
    "codigo": "30020165",
    "descripcion": "FORRO CAMA ENCANTO 135 AZUL",
    "tiempoMin": 11.28
  },
  {
    "codigo": "30020166",
    "descripcion": "FORRO CAMA ENCANTO 105 ROSA",
    "tiempoMin": 13.56
  },
  {
    "codigo": "30020167",
    "descripcion": "FORRO CAMA ENCANTO 135 ROSA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30020168",
    "descripcion": "FORRO CAMA ARIEL 105 MOSTAZA",
    "tiempoMin": 12.41
  },
  {
    "codigo": "30020169",
    "descripcion": "FORRO CAMA ARIEL 135 MOSTAZA",
    "tiempoMin": 11.28
  },
  {
    "codigo": "30020170",
    "descripcion": "FORRO CAMA ARIEL 105 AZUL",
    "tiempoMin": 12.41
  },
  {
    "codigo": "30020171",
    "descripcion": "FORRO CAMA ARIEL 135 AZUL",
    "tiempoMin": 11.28
  },
  {
    "codigo": "30020172",
    "descripcion": "FORRO CAMA ARIEL 105 ROSA",
    "tiempoMin": 12.41
  },
  {
    "codigo": "30020173",
    "descripcion": "FORRO CAMA ARIEL 135 ROSA",
    "tiempoMin": 11.28
  },
  {
    "codigo": "30020174",
    "descripcion": "FORRO CAMA LUNA 105 MOSTAZA",
    "tiempoMin": 12.41
  },
  {
    "codigo": "30020175",
    "descripcion": "FORRO CAMA LUNA 135 MOSTAZA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30020176",
    "descripcion": "FORRO CAMA LUNA 105 AZUL",
    "tiempoMin": 12.41
  },
  {
    "codigo": "30020177",
    "descripcion": "FORRO CAMA LUNA 135 AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30020178",
    "descripcion": "FORRO CAMA LUNA 105 ROSA",
    "tiempoMin": 12.41
  },
  {
    "codigo": "30020179",
    "descripcion": "FORRO CAMA LUNA 135 ROSA",
    "tiempoMin": 11.28
  },
  {
    "codigo": "30020234",
    "descripcion": "TAPA T. FALSO NEGRO CAMA LUNA 105",
    "tiempoMin": 6.14
  },
  {
    "codigo": "30020235",
    "descripcion": "TAPA T. FALSO NEGRO CAMA LUNA 135",
    "tiempoMin": 7.89
  },
  {
    "codigo": "30020248",
    "descripcion": "FORRO RECLINABLE APOLO VINTAGE BEIGE",
    "tiempoMin": 182
  },
  {
    "codigo": "30020249",
    "descripcion": "FORRO RECLINABLE APOLO VINTAGE CAFE",
    "tiempoMin": 182
  },
  {
    "codigo": "30020250",
    "descripcion": "FORRO RECLINABLE APOLO VINTAGE HUMO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020251",
    "descripcion": "FORRO RECLINABLE APOLO VINTAGE CAPPUCINO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020252",
    "descripcion": "FORRO RECLINABLE APOLO VINTAGE NEGRO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020253",
    "descripcion": "FORRO RECLINABLE APOLO STONE GRAFITO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020254",
    "descripcion": "FORRO RECLINABLE APOLO STONE JASPE",
    "tiempoMin": 182
  },
  {
    "codigo": "30020255",
    "descripcion": "FORRO RECLINABLE APOLO STONE PLATA",
    "tiempoMin": 182
  },
  {
    "codigo": "30020256",
    "descripcion": "FORRO RECLINABLE APOLO STONE MARMOL",
    "tiempoMin": 182
  },
  {
    "codigo": "30020257",
    "descripcion": "FORRO RECLINABLE APOLO STONE COBRE",
    "tiempoMin": 182
  },
  {
    "codigo": "30020258",
    "descripcion": "FORRO RECLINABLE APOLO EPIC BEIGE",
    "tiempoMin": 182
  },
  {
    "codigo": "30020259",
    "descripcion": "FORRO RECLINABLE APOLO EPIC BRUMA",
    "tiempoMin": 182
  },
  {
    "codigo": "30020260",
    "descripcion": "FORRO RECLINABLE APOLO EPIC TIERRA",
    "tiempoMin": 182
  },
  {
    "codigo": "30020261",
    "descripcion": "FORRO RECLINABLE APOLO EPIC ARENA",
    "tiempoMin": 182
  },
  {
    "codigo": "30020262",
    "descripcion": "FORRO RECLINABLE APOLO EPIC OCEANO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020263",
    "descripcion": "FORRO RECLINABLE APOLO EPIC OTONO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020264",
    "descripcion": "FORRO RECLINABLE APOLO FLA TANGELO",
    "tiempoMin": 182
  },
  {
    "codigo": "30020265",
    "descripcion": "FORRO RECLINABLE APOLO FLA FUDGE",
    "tiempoMin": 182
  },
  {
    "codigo": "30020266",
    "descripcion": "FORRO RECLINABLE APOLO FLA HIBISCUS",
    "tiempoMin": 182
  },
  {
    "codigo": "30020267",
    "descripcion": "FORRO RECLINABLE APOLO FLA MERLOT",
    "tiempoMin": 182
  },
  {
    "codigo": "30020290",
    "descripcion": "FORRO COJIN INTER RECLI APOLO INF",
    "tiempoMin": 5
  },
  {
    "codigo": "30020291",
    "descripcion": "FORRO COJIN INTER RECLI APOLO SUP",
    "tiempoMin": 5
  },
  {
    "codigo": "30020294",
    "descripcion": "TAPA FALSO BLANCO RECLINABLE APOLO",
    "tiempoMin": 7.89
  },
  {
    "codigo": "30020310",
    "descripcion": "FORRO PROTECTOR CHN. AC CAFE 135X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020311",
    "descripcion": "FORRO PROTECTOR CHN AC BLANCO 105X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020408",
    "descripcion": "TAPA T. FALSO NEGRO CAM ARIEL 105",
    "tiempoMin": 2.31
  },
  {
    "codigo": "30020409",
    "descripcion": "TAPA T. FALSO NEGRO CAM ARIEL 135",
    "tiempoMin": 2.98
  },
  {
    "codigo": "30020418",
    "descripcion": "FORRO PROTECTOR CHN AC BLANCO 080X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020419",
    "descripcion": "FORRO PROTECTOR CHN AC CAFE 080X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020420",
    "descripcion": "FORRO PROTECTOR CHN AC AZUL 080X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020421",
    "descripcion": "FORRO PROTECTOR CHN AC GRIS 080X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020422",
    "descripcion": "FORRO PROTECTOR CHN AC BLANCO 090X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020423",
    "descripcion": "FORRO PROTECTOR CHN AC CAFE 090X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020424",
    "descripcion": "FORRO PROTECTOR CHN AC AZUL 090X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020425",
    "descripcion": "FORRO PROTECTOR CHN AC GRIS 090X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020426",
    "descripcion": "FORRO PROTECTOR CHN AC CAFE 105X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020427",
    "descripcion": "FORRO PROTECTOR CHN AC AZUL 105X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020428",
    "descripcion": "FORRO PROTECTOR CHN AC GRIS 105X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020429",
    "descripcion": "FORRO PROTECTOR CHN AC BLANCO 135X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020430",
    "descripcion": "FORRO PROTECTOR CHN AC CAFE 135X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020431",
    "descripcion": "FORRO PROTECTOR CHN AC AZUL 135X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020432",
    "descripcion": "FORRO PROTECTOR CHN AC GRIS 135X190 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020433",
    "descripcion": "FORRO PROTECTOR CHN AC BLANCO 160X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020434",
    "descripcion": "FORRO PROTECTOR CHN AC CAFE 160X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020435",
    "descripcion": "FORRO PROTECTOR CHN AC AZUL 160X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020436",
    "descripcion": "FORRO PROTECTOR CHN AC GRIS 160X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020437",
    "descripcion": "FORRO PROTECTOR CHN AC BLANCO 200X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020438",
    "descripcion": "FORRO PROTECTOR CHN AC CAFE 200X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020439",
    "descripcion": "FORRO PROTECTOR CHN AC AZUL 200X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020440",
    "descripcion": "FORRO PROTECTOR CHN AC GRIS 200X200 PB",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30020669",
    "descripcion": "FORRO PHOENIX 105 VINTAGE NEGRO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020670",
    "descripcion": "FORRO PHOENIX 120 VINTAGE NEGRO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020671",
    "descripcion": "FORRO PHOENIX 135 VINTAGE NEGRO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020672",
    "descripcion": "FORRO PHOENIX 105 VINTAGE CAF_201_",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020673",
    "descripcion": "FORRO PHOENIX 120 VINTAGE CAF_201_",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020674",
    "descripcion": "FORRO PHOENIX 135 VINTAGE CAF_201_",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020675",
    "descripcion": "FORRO PHOENIX 105 VINTAGE HUMO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020676",
    "descripcion": "FORRO PHOENIX 120 VINTAGE HUMO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020677",
    "descripcion": "FORRO PHOENIX 135 VINTAGE HUMO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020678",
    "descripcion": "FORRO PHOENIX 105 VINTAGE CAPPUCINO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020679",
    "descripcion": "FORRO PHOENIX 120 VINTAGE CAPPUCINO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020680",
    "descripcion": "FORRO PHOENIX 135 VINTAGE CAPPUCINO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020681",
    "descripcion": "FORRO PHOENIX 105 VINTAGE BEIGE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020682",
    "descripcion": "FORRO PHOENIX 120 VINTAGE BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020683",
    "descripcion": "FORRO PHOENIX 135 VINTAGE BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020684",
    "descripcion": "FORRO PHOENIX 105 STONE GRAFITO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020685",
    "descripcion": "FORRO PHOENIX 120 STONE GRAFITO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020686",
    "descripcion": "FORRO PHOENIX 135 STONE GRAFITO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020687",
    "descripcion": "FORRO PHOENIX 105 STONE JASPE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020688",
    "descripcion": "FORRO PHOENIX 120 STONE JASPE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020689",
    "descripcion": "FORRO PHOENIX 135 STONE JASPE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020690",
    "descripcion": "FORRO PHOENIX 105 STONE PLATA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020691",
    "descripcion": "FORRO PHOENIX 120 STONE PLATA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020692",
    "descripcion": "FORRO PHOENIX 135 STONE PLATA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020693",
    "descripcion": "FORRO PHOENIX 105 STONE MARMOL",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020694",
    "descripcion": "FORRO PHOENIX 120 STONE MARMOL",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020695",
    "descripcion": "FORRO PHOENIX 135 STONE MARMOL",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020696",
    "descripcion": "FORRO PHOENIX 105 STONE COBRE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020697",
    "descripcion": "FORRO PHOENIX 120 STONE COBRE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020698",
    "descripcion": "FORRO PHOENIX 135 STONE COBRE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020699",
    "descripcion": "FORRO PHOENIX 105 EPIC BRUMA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020700",
    "descripcion": "FORRO PHOENIX 120 EPIC BRUMA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020701",
    "descripcion": "FORRO PHOENIX 135 EPIC BRUMA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020702",
    "descripcion": "FORRO PHOENIX 105 EPIC TIERRA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020703",
    "descripcion": "FORRO PHOENIX 120 EPIC TIERRA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020704",
    "descripcion": "FORRO PHOENIX 135 EPIC TIERRA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020705",
    "descripcion": "FORRO PHOENIX 105 EPIC ARENA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020706",
    "descripcion": "FORRO PHOENIX 120 EPIC ARENA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020707",
    "descripcion": "FORRO PHOENIX 135 EPIC ARENA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020708",
    "descripcion": "FORRO PHOENIX 105 EPIC OC_201_ANO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020709",
    "descripcion": "FORRO PHOENIX 120 EPIC OC_201_ANO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020710",
    "descripcion": "FORRO PHOENIX 135 EPIC OC_201_ANO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020711",
    "descripcion": "FORRO PHOENIX 105 EPIC OTO_209_O",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020712",
    "descripcion": "FORRO PHOENIX 120 EPIC OTO_209_O",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020713",
    "descripcion": "FORRO PHOENIX 135 EPIC OTO_209_O",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020714",
    "descripcion": "FORRO PHOENIX 105 EPIC BEIGE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020715",
    "descripcion": "FORRO PHOENIX 120 EPIC BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020716",
    "descripcion": "FORRO PHOENIX 135 EPIC BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020717",
    "descripcion": "FORRO PHOENIX 105 FLANIGAN TANGELO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020718",
    "descripcion": "FORRO PHOENIX 120 FLANIGAN TANGELO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020719",
    "descripcion": "FORRO PHOENIX 135 FLANIGAN TANGELO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020720",
    "descripcion": "FORRO PHOENIX 105 FLANIGAN HIBISCUS",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020721",
    "descripcion": "FORRO PHOENIX 120 FLANIGAN HIBISCUS",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020722",
    "descripcion": "FORRO PHOENIX 135 FLANIGAN HIBISCUS",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020723",
    "descripcion": "FORRO PHOENIX 105 FLANIGAN MERLOT",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30020724",
    "descripcion": "FORRO PHOENIX 120 FLANIGAN MERLOT",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30020725",
    "descripcion": "FORRO PHOENIX 135 FLANIGAN MERLOT",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30020792",
    "descripcion": "FORRO COJIN INTERNO PHOENIX 105",
    "tiempoMin": 6.5
  },
  {
    "codigo": "30020793",
    "descripcion": "FORRO COJIN INTERNO PHOENIX 120",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30020794",
    "descripcion": "FORRO COJIN INTERNO PHOENIX 135",
    "tiempoMin": 8.67
  },
  {
    "codigo": "30020831",
    "descripcion": "FORRO OTTOMAN AH 160",
    "tiempoMin": 240
  },
  {
    "codigo": "30020880",
    "descripcion": "FORRO SPRING 105 GEMA MIEL",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30020881",
    "descripcion": "FORRO SPRING 105 GEMA CHOCOLATE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30020882",
    "descripcion": "FORRO SPRING 105 GEMA HUMO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30020939",
    "descripcion": "FORRO BASE GRAND 119 VINT NEGRO MATE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020940",
    "descripcion": "FORRO BASE GRAND  119 VINTAGE CAPPUCINO",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020941",
    "descripcion": "FORRO BASE GRAND  119 VINTAGE HUMO",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020942",
    "descripcion": "FORRO BASE GRAND  119 VINTAGE CAF_201_",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020943",
    "descripcion": "FORRO BASE GRAND  119 VINTAGE BEIGE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020944",
    "descripcion": "FORRO BASE GRAND  119 STONE GRAFITO",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020945",
    "descripcion": "FORRO BASE GRAND  119 STONE JASPE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020946",
    "descripcion": "FORRO BASE GRAND  119 STONE PLATA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020947",
    "descripcion": "FORRO BASE GRAND  119 STONE MARMOL",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020948",
    "descripcion": "FORRO BASE GRAND  119 STONE COBRE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020949",
    "descripcion": "FORRO BASE GRAND  119 EPIC BRUMA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020950",
    "descripcion": "FORRO BASE GRAND  119 EPIC TIERRA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020951",
    "descripcion": "FORRO BASE GRAND  119 EPIC ARENA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020952",
    "descripcion": "FORRO BASE GRAND 119 EURUS OCEANO",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020953",
    "descripcion": "FORRO BASE GRAND  119 EPIC OTO_209_O",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020954",
    "descripcion": "FORRO BASE GRAND 119 EURUS BEIGE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020955",
    "descripcion": "FORRO BASE GRAND  119 FLA TANGELO",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020956",
    "descripcion": "FORRO BASE GRAND  119 FLA HIBISCUS",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020957",
    "descripcion": "FORRO BASE GRAND  119 FLA MERLOT",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30020958",
    "descripcion": "FORRO BASE GRAND 149 VINT NEGRO MATE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020959",
    "descripcion": "FORRO BASE GRAND  149 VINTAGE CAPPUCINO",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020960",
    "descripcion": "FORRO BASE GRAND  149 VINTAGE HUMO",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020961",
    "descripcion": "FORRO BASE GRAND  149 VINTAGE CAF_201_",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020962",
    "descripcion": "FORRO BASE GRAND  149 VINTAGE BEIGE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020963",
    "descripcion": "FORRO BASE GRAND  149 STONE GRAFITO",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020964",
    "descripcion": "FORRO BASE GRAND  149 STONE JASPE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020965",
    "descripcion": "FORRO BASE GRAND  149 STONE PLATA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020966",
    "descripcion": "FORRO BASE GRAND  149 STONE MARMOL",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020967",
    "descripcion": "FORRO BASE GRAND  149 STONE COBRE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020968",
    "descripcion": "FORRO BASE GRAND  149 EPIC BRUMA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020969",
    "descripcion": "FORRO BASE GRAND  149 EPIC TIERRA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020970",
    "descripcion": "FORRO BASE GRAND  149 EPIC ARENA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020971",
    "descripcion": "FORRO BASE GRAND 149 EURUS OCEANO",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020972",
    "descripcion": "FORRO BASE GRAND  149 EPIC OTO_209_O",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020973",
    "descripcion": "FORRO BASE GRAND 149 EURUS BEIGE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020974",
    "descripcion": "FORRO BASE GRAND  149 FLA TANGELO",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020975",
    "descripcion": "FORRO BASE GRAND  149 FLA HIBISCUS",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020976",
    "descripcion": "FORRO BASE GRAND  149 FLA MERLOT",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30020977",
    "descripcion": "FORRO BASE GRAND 174 VINT NEGRO MATE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020978",
    "descripcion": "FORRO BASE GRAND  174 VINTAGE CAPPUCINO",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020979",
    "descripcion": "FORRO BASE GRAND  174 VINTAGE HUMO",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020980",
    "descripcion": "FORRO BASE GRAND  174 VINTAGE CAF_201_",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020981",
    "descripcion": "FORRO BASE GRAND  174 VINTAGE BEIGE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020982",
    "descripcion": "FORRO BASE GRAND  174 STONE GRAFITO",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020983",
    "descripcion": "FORRO BASE GRAND  174 STONE JASPE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020984",
    "descripcion": "FORRO BASE GRAND  174 STONE PLATA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020985",
    "descripcion": "FORRO BASE GRAND  174 STONE MARMOL",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020986",
    "descripcion": "FORRO BASE GRAND  174 STONE COBRE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020987",
    "descripcion": "FORRO BASE GRAND  174 EPIC BRUMA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020988",
    "descripcion": "FORRO BASE GRAND  174 EPIC TIERRA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020989",
    "descripcion": "FORRO BASE GRAND  174 EPIC ARENA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020990",
    "descripcion": "FORRO BASE GRAND 174 EURUS OCEANO",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020991",
    "descripcion": "FORRO BASE GRAND  174 EPIC OTO_209_O",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020992",
    "descripcion": "FORRO BASE GRAND 174 EURUS BEIGE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020993",
    "descripcion": "FORRO BASE GRAND  174 FLA TANGELO",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020994",
    "descripcion": "FORRO BASE GRAND  174 FLA HIBISCUS",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020995",
    "descripcion": "FORRO BASE GRAND  174 FLA MERLOT",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30020996",
    "descripcion": "FORRO BASE GRAND 214 2C VINT NEGRO MATE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30020997",
    "descripcion": "FORRO BASE GRAND  214 2C VINTAGE CAPPU",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30020998",
    "descripcion": "FORRO BASE GRAND  214 2C VINTAGE HUMO",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30020999",
    "descripcion": "FORRO BASE GRAND  214 2C VINTAGE CAF_201_",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021000",
    "descripcion": "FORRO BASE GRAND  214 2C VINTAGE BEIGE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021001",
    "descripcion": "FORRO BASE GRAND  214 2C STONE GRAFITO",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021002",
    "descripcion": "FORRO BASE GRAND  214 2C STONE JASPE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021003",
    "descripcion": "FORRO BASE GRAND  214 2C STONE PLATA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021004",
    "descripcion": "FORRO BASE GRAND  214 2C STONE MARMOL",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021005",
    "descripcion": "FORRO BASE GRAND  214 2C STONE COBRE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021006",
    "descripcion": "FORRO BASE GRAND  214 2C EPIC BRUMA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021007",
    "descripcion": "FORRO BASE GRAND  214 2C EPIC TIERRA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021008",
    "descripcion": "FORRO BASE GRAND  214 2C EPIC ARENA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021009",
    "descripcion": "FORRO BASE GRAND 214 2C EURUS OCEANO",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021010",
    "descripcion": "FORRO BASE GRAND  214 2C EPIC OTO_209_O",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021011",
    "descripcion": "FORRO BASE GRAND 214 2C EURUS BEIGE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021012",
    "descripcion": "FORRO BASE GRAND  214 2C FLA TANGELO",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021013",
    "descripcion": "FORRO BASE GRAND  214 2C FLA HIBISCUS",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021014",
    "descripcion": "FORRO BASE GRAND  214 2C FLA MERLOT",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30021091",
    "descripcion": "FORRO GRAND BARU 119 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021092",
    "descripcion": "FORRO GRAND BARU 119 VINTAGE CAPPUCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021093",
    "descripcion": "FORRO GRAND BARU 119 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021094",
    "descripcion": "FORRO GRAND BARU 119 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021095",
    "descripcion": "FORRO GRAND BARU 119 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021096",
    "descripcion": "FORRO GRAND BARU 119 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021097",
    "descripcion": "FORRO GRAND BARU 119 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021098",
    "descripcion": "FORRO GRAND BARU 119 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021099",
    "descripcion": "FORRO GRAND BARU 119 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021100",
    "descripcion": "FORRO GRAND BARU 119 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021101",
    "descripcion": "FORRO GRAND BARU 119 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021102",
    "descripcion": "FORRO GRAND BARU 119 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021103",
    "descripcion": "FORRO GRAND BARU 119 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021104",
    "descripcion": "FORRO GRAND BARU 119 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021105",
    "descripcion": "FORRO GRAND BARU 119 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021106",
    "descripcion": "FORRO GRAND BARU 119 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021107",
    "descripcion": "FORRO GRAND BARU 119 FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021108",
    "descripcion": "FORRO GRAND BARU 119 FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021109",
    "descripcion": "FORRO GRAND BARU 119 FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021110",
    "descripcion": "FORRO GRAND BARU 149 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021111",
    "descripcion": "FORRO GRAND BARU 149 VINTAGE CAPPUCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021112",
    "descripcion": "FORRO GRAND BARU 149 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021113",
    "descripcion": "FORRO GRAND BARU 149 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021114",
    "descripcion": "FORRO GRAND BARU 149 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021115",
    "descripcion": "FORRO GRAND BARU 149 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021116",
    "descripcion": "FORRO GRAND BARU 149 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021117",
    "descripcion": "FORRO GRAND BARU 149 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021118",
    "descripcion": "FORRO GRAND BARU 149 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021119",
    "descripcion": "FORRO GRAND BARU 149 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021120",
    "descripcion": "FORRO GRAND BARU 149 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021121",
    "descripcion": "FORRO GRAND BARU 149 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021122",
    "descripcion": "FORRO GRAND BARU 149 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021123",
    "descripcion": "FORRO GRAND BARU 149 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021124",
    "descripcion": "FORRO GRAND BARU 149 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021125",
    "descripcion": "FORRO GRAND BARU 149 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021126",
    "descripcion": "FORRO GRAND BARU 149 FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021127",
    "descripcion": "FORRO GRAND BARU 149 FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021128",
    "descripcion": "FORRO GRAND BARU 149 FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021129",
    "descripcion": "FORRO GRAND BARU 174 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021130",
    "descripcion": "FORRO GRAND BARU 174 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021131",
    "descripcion": "FORRO GRAND BARU 174 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021132",
    "descripcion": "FORRO GRAND BARU 174 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021133",
    "descripcion": "FORRO GRAND BARU 174 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021134",
    "descripcion": "FORRO GRAND BARU 174 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021135",
    "descripcion": "FORRO GRAND BARU 174 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021136",
    "descripcion": "FORRO GRAND BARU 174 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021137",
    "descripcion": "FORRO GRAND BARU 174 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021138",
    "descripcion": "FORRO GRAND BARU 174 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021139",
    "descripcion": "FORRO GRAND BARU 174 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021140",
    "descripcion": "FORRO GRAND BARU 174 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021141",
    "descripcion": "FORRO GRAND BARU 174 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021142",
    "descripcion": "FORRO GRAND BARU 174 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021143",
    "descripcion": "FORRO GRAND BARU 174 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021144",
    "descripcion": "FORRO GRAND BARU 174 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021145",
    "descripcion": "FORRO GRAND BARU 174 FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021146",
    "descripcion": "FORRO GRAND BARU 174 FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021147",
    "descripcion": "FORRO GRAND BARU 174 FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021148",
    "descripcion": "FORRO GRAND BARU 214 2C VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021149",
    "descripcion": "FORRO GRAND BARU 214 2C VINTAGE CAPPU",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021150",
    "descripcion": "FORRO GRAND BARU 214 2C VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021151",
    "descripcion": "FORRO GRAND BARU 214 2C VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021152",
    "descripcion": "FORRO GRAND BARU 214 2C VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021153",
    "descripcion": "FORRO GRAND BARU 214 2C STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021154",
    "descripcion": "FORRO GRAND BARU 214 2C STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021155",
    "descripcion": "FORRO GRAND BARU 214 2C STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021156",
    "descripcion": "FORRO GRAND BARU 214 2C STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021157",
    "descripcion": "FORRO GRAND BARU 214 2C STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021158",
    "descripcion": "FORRO GRAND BARU 214 2C EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021159",
    "descripcion": "FORRO GRAND BARU 214 2C EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021160",
    "descripcion": "FORRO GRAND BARU 214 2C EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021161",
    "descripcion": "FORRO GRAND BARU 214 2C EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021162",
    "descripcion": "FORRO GRAND BARU 214 2C EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021163",
    "descripcion": "FORRO GRAND BARU 214 2C EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021164",
    "descripcion": "FORRO GRAND BARU 214 2C FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021165",
    "descripcion": "FORRO GRAND BARU 214 2C FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021166",
    "descripcion": "FORRO GRAND BARU 214 2C FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021167",
    "descripcion": "FORRO GRAND BERLIN 119 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021168",
    "descripcion": "FORRO GRAND BERLIN 119 VINTAGE CAPPUCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021169",
    "descripcion": "FORRO GRAND BERLIN 119 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021170",
    "descripcion": "FORRO GRAND BERLIN 119 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021171",
    "descripcion": "FORRO GRAND BERLIN 119 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021172",
    "descripcion": "FORRO GRAND BERLIN 119 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021173",
    "descripcion": "FORRO GRAND BERLIN 119 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021174",
    "descripcion": "FORRO GRAND BERLIN 119 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021175",
    "descripcion": "FORRO GRAND BERLIN 119 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021176",
    "descripcion": "FORRO GRAND BERLIN 119 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021177",
    "descripcion": "FORRO GRAND BERLIN 119 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021178",
    "descripcion": "FORRO GRAND BERLIN 119 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021179",
    "descripcion": "FORRO GRAND BERLIN 119 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021180",
    "descripcion": "FORRO GRAND BERLIN 119 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021181",
    "descripcion": "FORRO GRAND BERLIN 119 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021182",
    "descripcion": "FORRO GRAND BERLIN 119 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021183",
    "descripcion": "FORRO GRAND BERLIN 119 FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021184",
    "descripcion": "FORRO GRAND BERLIN 119 FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021185",
    "descripcion": "FORRO GRAND BERLIN 119 FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021186",
    "descripcion": "FORRO GRAND BERLIN 149 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021187",
    "descripcion": "FORRO GRAND BERLIN 149 VINTAGE CAPPUCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021188",
    "descripcion": "FORRO GRAND BERLIN 149 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021189",
    "descripcion": "FORRO GRAND BERLIN 149 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021190",
    "descripcion": "FORRO GRAND BERLIN 149 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021191",
    "descripcion": "FORRO GRAND BERLIN 149 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021192",
    "descripcion": "FORRO GRAND BERLIN 149 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021193",
    "descripcion": "FORRO GRAND BERLIN 149 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021194",
    "descripcion": "FORRO GRAND BERLIN 149 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021195",
    "descripcion": "FORRO GRAND BERLIN 149 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021196",
    "descripcion": "FORRO GRAND BERLIN 149 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021197",
    "descripcion": "FORRO GRAND BERLIN 149 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021198",
    "descripcion": "FORRO GRAND BERLIN 149 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021199",
    "descripcion": "FORRO GRAND BERLIN 149 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021200",
    "descripcion": "FORRO GRAND BERLIN 149 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021201",
    "descripcion": "FORRO GRAND BERLIN 149 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021202",
    "descripcion": "FORRO GRAND BERLIN 149 FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021203",
    "descripcion": "FORRO GRAND BERLIN 149 FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021204",
    "descripcion": "FORRO GRAND BERLIN 149 FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021205",
    "descripcion": "FORRO GRAND BERLIN 174 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021206",
    "descripcion": "FORRO GRAND BERLIN 174 VINTAGE CAPPUCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021207",
    "descripcion": "FORRO GRAND BERLIN 174 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021208",
    "descripcion": "FORRO GRAND BERLIN 174 VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021209",
    "descripcion": "FORRO GRAND BERLIN 174 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021210",
    "descripcion": "FORRO GRAND BERLIN 174 STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021211",
    "descripcion": "FORRO GRAND BERLIN 174 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021212",
    "descripcion": "FORRO GRAND BERLIN 174 STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021213",
    "descripcion": "FORRO GRAND BERLIN 174 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021214",
    "descripcion": "FORRO GRAND BERLIN 174 STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021215",
    "descripcion": "FORRO GRAND BERLIN 174 EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021216",
    "descripcion": "FORRO GRAND BERLIN 174 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021217",
    "descripcion": "FORRO GRAND BERLIN 174 EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021218",
    "descripcion": "FORRO GRAND BERLIN 174 EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021219",
    "descripcion": "FORRO GRAND BERLIN 174 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021220",
    "descripcion": "FORRO GRAND BERLIN 174 EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021221",
    "descripcion": "FORRO GRAND BERLIN 174 FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021222",
    "descripcion": "FORRO GRAND BERLIN 174 FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021223",
    "descripcion": "FORRO GRAND BERLIN 174 FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021224",
    "descripcion": "FORRO GRAND BERLIN 214 2C VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021225",
    "descripcion": "FORRO GRAND BERLIN 214 2C VINT CAPPUCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021226",
    "descripcion": "FORRO GRAND BERLIN 214 2C VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021227",
    "descripcion": "FORRO GRAND BERLIN 214 2C VINTAGE CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021228",
    "descripcion": "FORRO GRAND BERLIN 214 2C VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021229",
    "descripcion": "FORRO GRAND BERLIN 214 2C STONE GRAFITO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021230",
    "descripcion": "FORRO GRAND BERLIN 214 2C STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021231",
    "descripcion": "FORRO GRAND BERLIN 214 2C STONE PLATA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021232",
    "descripcion": "FORRO GRAND BERLIN 214 2C STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021233",
    "descripcion": "FORRO GRAND BERLIN 214 2C STONE COBRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021234",
    "descripcion": "FORRO GRAND BERLIN 214 2C EPIC BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021235",
    "descripcion": "FORRO GRAND BERLIN 214 2C EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021236",
    "descripcion": "FORRO GRAND BERLIN 214 2C EPIC ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021237",
    "descripcion": "FORRO GRAND BERLIN 214 2C EPIC OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021238",
    "descripcion": "FORRO GRAND BERLIN 214 2C EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021239",
    "descripcion": "FORRO GRAND BERLIN 214 2C EPIC BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021240",
    "descripcion": "FORRO GRAND BERLIN 214 2C FLA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021241",
    "descripcion": "FORRO GRAND BERLIN 214 2C FLA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021242",
    "descripcion": "FORRO GRAND BERLIN 214 2C FLA MERLOT",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021395",
    "descripcion": "TAPA T. FALSO NEGRO CAMA GRAND 119",
    "tiempoMin": 2.61
  },
  {
    "codigo": "30021396",
    "descripcion": "TAPA T. FALSO NEGRO CAMA GRAND 149",
    "tiempoMin": 2.75
  },
  {
    "codigo": "30021397",
    "descripcion": "TAPA T. FALSO NEGRO CAMA GRAND 174",
    "tiempoMin": 3.2
  },
  {
    "codigo": "30021398",
    "descripcion": "TAPA T. FALSO NEGRO CAMA GRAND 214",
    "tiempoMin": 3.2
  },
  {
    "codigo": "30021531",
    "descripcion": "FORRO MUNICH 94 VINT NEGRO MATE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021532",
    "descripcion": "FORRO MUNICH 94 VINTAGE CAFE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021533",
    "descripcion": "FORRO MUNICH 94 VINTAGE CAPUCCINO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021534",
    "descripcion": "FORRO MUNICH 94 VINTAGE HUMO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021535",
    "descripcion": "FORRO MUNICH 94 VINTAGE BEIGE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021536",
    "descripcion": "FORRO MUNICH 94 EURUS OCEANO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021537",
    "descripcion": "FORRO MUNICH 94 EPIC TIERRA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021538",
    "descripcion": "FORRO MUNICH 94 EPIC OTO_209_O",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021539",
    "descripcion": "FORRO MUNICH 94 EPIC ARENA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021540",
    "descripcion": "FORRO MUNICH 94 EPIC BRUMA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021541",
    "descripcion": "FORRO MUNICH 94 EURUS BEIGE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021542",
    "descripcion": "FORRO MUNICH 94 STONE JASPE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021543",
    "descripcion": "FORRO MUNICH 94 STONE COBRE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021544",
    "descripcion": "FORRO MUNICH 94 STONE PLATA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021545",
    "descripcion": "FORRO MUNICH 94 STONE GRAFITO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021546",
    "descripcion": "FORRO MUNICH 94 STONE MARMOL",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021567",
    "descripcion": "FORRO COJIN ESPALDAR INTERNO MUNICH",
    "tiempoMin": 5
  },
  {
    "codigo": "30021568",
    "descripcion": "FORRO COJIN RESPALDO INTERNO MUNICH",
    "tiempoMin": 35
  },
  {
    "codigo": "30021571",
    "descripcion": "TAPA T. FALSO NEGRO MUNICH",
    "tiempoMin": 3.8
  },
  {
    "codigo": "30021580",
    "descripcion": "FORRO MILAN 105 BORBON PLOMO RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021581",
    "descripcion": "FORRO MILAN 135 BORBON PLOMO RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021582",
    "descripcion": "FORRO MILAN 160 BORBON PLOMO RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021583",
    "descripcion": "FORRO MILAN 200 BORBON PLOMO RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021592",
    "descripcion": "FORRO MUNICH 94 FLANIGAN TANGELO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30021666",
    "descripcion": "FORRO BENCH 115 ASTRA BEIGE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021667",
    "descripcion": "FORRO BENCH 115 ASTRA CAF_201_",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021668",
    "descripcion": "FORRO BENCH 115 ASTRA CARB_211_N",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021669",
    "descripcion": "FORRO BENCH 115 ASTRA GRIS",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021670",
    "descripcion": "FORRO BENCH 115 VINTAGE NEGRO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021671",
    "descripcion": "FORRO BENCH 115 EURUS CAF_201_",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021672",
    "descripcion": "FORRO BENCH 115 EURUS GRIS",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30021673",
    "descripcion": "FORRO BENCH AREZZO 120 ASTRA BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021674",
    "descripcion": "FORRO BENCH AREZZO 120 ASTRA CAF_201_",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021675",
    "descripcion": "FORRO BENCH AREZZO 120 ASTRA CARB_211_N",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021676",
    "descripcion": "FORRO BENCH AREZZO 120 ASTRA GRIS",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021677",
    "descripcion": "FORRO BENCH AREZZO 120 VINTAGE NEGRO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021678",
    "descripcion": "FORRO BENCH AREZZO 120 EURUS CAF_201_",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021679",
    "descripcion": "FORRO BENCH AREZZO 120 EURUS GRIS",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021680",
    "descripcion": "FORRO BENCH AREZZO 70 ASTRA BEIGE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021681",
    "descripcion": "FORRO BENCH AREZZO 70 ASTRA CAF_201_",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021682",
    "descripcion": "FORRO BENCH AREZZO 70 ASTRA CARB_211_N",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021683",
    "descripcion": "FORRO BENCH AREZZO 70 ASTRA GRIS",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021684",
    "descripcion": "FORRO BENCH AREZZO 70 VINTAGE NEGRO",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021685",
    "descripcion": "FORRO BENCH AREZZO 70 EURUS CAF_201_",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021686",
    "descripcion": "FORRO BENCH AREZZO 70 EURUS GRIS",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30021687",
    "descripcion": "FORRO BENCH 145 ASTRA BEIGE",
    "tiempoMin": 35
  },
  {
    "codigo": "30021688",
    "descripcion": "FORRO BENCH 145 ASTRA CAF_201_",
    "tiempoMin": 35
  },
  {
    "codigo": "30021689",
    "descripcion": "FORRO BENCH 145 ASTRA CARB_211_N",
    "tiempoMin": 35
  },
  {
    "codigo": "30021690",
    "descripcion": "FORRO BENCH 145 ASTRA GRIS",
    "tiempoMin": 35
  },
  {
    "codigo": "30021691",
    "descripcion": "FORRO BENCH 145 VINTAGE NEGRO",
    "tiempoMin": 35
  },
  {
    "codigo": "30021692",
    "descripcion": "FORRO BENCH 145 EURUS CAF_201_",
    "tiempoMin": 35
  },
  {
    "codigo": "30021693",
    "descripcion": "FORRO BENCH 145 EURUS GRIS",
    "tiempoMin": 35
  },
  {
    "codigo": "30021735",
    "descripcion": "FORRO MALIBU 105 ASTRA BEIGE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021736",
    "descripcion": "FORRO MALIBU 105 ASTRA CAF_201_",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021737",
    "descripcion": "FORRO MALIBU 105 ASTRA CARB_211_N",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021738",
    "descripcion": "FORRO MALIBU 105 ASTRA GRIS",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021739",
    "descripcion": "FORRO MALIBU 105 VINTAGE NEGRO",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021740",
    "descripcion": "FORRO MALIBU 105 EURUS CAF_201_",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021741",
    "descripcion": "FORRO MALIBU 105 EURUS GRIS",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30021742",
    "descripcion": "FORRO MALIBU 135 ASTRA BEIGE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021743",
    "descripcion": "FORRO MALIBU 135 ASTRA CAF_201_",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021744",
    "descripcion": "FORRO MALIBU 135 ASTRA CARB_211_N",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021745",
    "descripcion": "FORRO MALIBU 135 ASTRA GRIS",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021746",
    "descripcion": "FORRO MALIBU 135 VINTAGE NEGRO",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021747",
    "descripcion": "FORRO MALIBU 135 EURUS CAF_201_",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021748",
    "descripcion": "FORRO MALIBU 135 EURUS GRIS",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30021763",
    "descripcion": "FORRO MANCHESTER 105 ASTRA BEIGE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021764",
    "descripcion": "FORRO MANCHESTER 105 ASTRA CAF_201_",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021765",
    "descripcion": "FORRO MANCHESTER 105 ASTRA CARB_211_N",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021766",
    "descripcion": "FORRO MANCHESTER 105 ASTRA GRIS",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021767",
    "descripcion": "FORRO MANCHESTER 105 VINTAGE NEGRO",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021768",
    "descripcion": "FORRO MANCHESTER 105 EURUS CAF_201_",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021769",
    "descripcion": "FORRO MANCHESTER 105 EURUS GRIS",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30021853",
    "descripcion": "FORRO CAB BARU 115X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021854",
    "descripcion": "FORRO CAB BARU 115X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021855",
    "descripcion": "FORRO CAB BARU 115X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021856",
    "descripcion": "FORRO CAB BARU 115X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021857",
    "descripcion": "FORRO CAB BARU 115X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021858",
    "descripcion": "FORRO CAB BARU 115X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021859",
    "descripcion": "FORRO CAB BARU 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021860",
    "descripcion": "FORRO CAB BARU 145X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021861",
    "descripcion": "FORRO CAB BARU 145X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021862",
    "descripcion": "FORRO CAB BARU 145X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021863",
    "descripcion": "FORRO CAB BARU 145X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021864",
    "descripcion": "FORRO CAB BARU 145X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021865",
    "descripcion": "FORRO CAB BARU 145X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021866",
    "descripcion": "FORRO CAB BARU 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021867",
    "descripcion": "FORRO CAB BARU 170X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021868",
    "descripcion": "FORRO CAB BARU 170X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021869",
    "descripcion": "FORRO CAB BARU 170X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021870",
    "descripcion": "FORRO CAB BARU 170X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021871",
    "descripcion": "FORRO CAB BARU 170X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021872",
    "descripcion": "FORRO CAB BARU 170X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021873",
    "descripcion": "FORRO CAB BARU 170X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021874",
    "descripcion": "FORRO CAB BARU 210X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021875",
    "descripcion": "FORRO CAB BARU 210X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021876",
    "descripcion": "FORRO CAB BARU 210X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021877",
    "descripcion": "FORRO CAB BARU 210X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021878",
    "descripcion": "FORRO CAB BARU 210X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021879",
    "descripcion": "FORRO CAB BARU 210X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021880",
    "descripcion": "FORRO CAB BARU 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021881",
    "descripcion": "FORRO CAB BERLIN 115X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021882",
    "descripcion": "FORRO CAB BERLIN 115X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021883",
    "descripcion": "FORRO CAB BERLIN 115X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021884",
    "descripcion": "FORRO CAB BERLIN 115X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021885",
    "descripcion": "FORRO CAB BERLIN 115X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021886",
    "descripcion": "FORRO CAB BERLIN 115X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021887",
    "descripcion": "FORRO CAB BERLIN 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021888",
    "descripcion": "FORRO CAB BERLIN 145X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021889",
    "descripcion": "FORRO CAB BERLIN 145X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021890",
    "descripcion": "FORRO CAB BERLIN 145X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021891",
    "descripcion": "FORRO CAB BERLIN 145X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021892",
    "descripcion": "FORRO CAB BERLIN 145X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021893",
    "descripcion": "FORRO CAB BERLIN 145X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021894",
    "descripcion": "FORRO CAB BERLIN 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021895",
    "descripcion": "FORRO CAB BERLIN 170X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021896",
    "descripcion": "FORRO CAB BERLIN 170X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021897",
    "descripcion": "FORRO CAB BERLIN 170X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021898",
    "descripcion": "FORRO CAB BERLIN 170X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021899",
    "descripcion": "FORRO CAB BERLIN 170X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021900",
    "descripcion": "FORRO CAB BERLIN 170X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021901",
    "descripcion": "FORRO CAB BERLIN 170X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021902",
    "descripcion": "FORRO CAB BERLIN 210X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021903",
    "descripcion": "FORRO CAB BERLIN 210X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021904",
    "descripcion": "FORRO CAB BERLIN 210X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021905",
    "descripcion": "FORRO CAB BERLIN 210X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021906",
    "descripcion": "FORRO CAB BERLIN 210X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021907",
    "descripcion": "FORRO CAB BERLIN 210X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021908",
    "descripcion": "FORRO CAB BERLIN 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021909",
    "descripcion": "FORRO CAB CRETA 115X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021910",
    "descripcion": "FORRO CAB CRETA 115X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021911",
    "descripcion": "FORRO CAB CRETA 115X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021912",
    "descripcion": "FORRO CAB CRETA 115X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021913",
    "descripcion": "FORRO CAB CRETA 115X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021914",
    "descripcion": "FORRO CAB CRETA 115X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021915",
    "descripcion": "FORRO CAB CRETA 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021916",
    "descripcion": "FORRO CAB CRETA 145X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021917",
    "descripcion": "FORRO CAB CRETA 145X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021918",
    "descripcion": "FORRO CAB CRETA 145X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021919",
    "descripcion": "FORRO CAB CRETA 145X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021920",
    "descripcion": "FORRO CAB CRETA 145X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021921",
    "descripcion": "FORRO CAB CRETA 145X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021922",
    "descripcion": "FORRO CAB CRETA 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021923",
    "descripcion": "FORRO CAB CRETA 170X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021924",
    "descripcion": "FORRO CAB CRETA 170X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021925",
    "descripcion": "FORRO CAB CRETA 170X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021926",
    "descripcion": "FORRO CAB CRETA 170X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021927",
    "descripcion": "FORRO CAB CRETA 170X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021928",
    "descripcion": "FORRO CAB CRETA 170X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021929",
    "descripcion": "FORRO CAB CRETA 170X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021930",
    "descripcion": "FORRO CAB CRETA 210X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021931",
    "descripcion": "FORRO CAB CRETA 210X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021932",
    "descripcion": "FORRO CAB CRETA 210X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021933",
    "descripcion": "FORRO CAB CRETA 210X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021934",
    "descripcion": "FORRO CAB CRETA 210X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021935",
    "descripcion": "FORRO CAB CRETA 210X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021936",
    "descripcion": "FORRO CAB CRETA 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021937",
    "descripcion": "FORRO CAB FLORENCIA 115X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021938",
    "descripcion": "FORRO CAB FLORENCIA 115X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021939",
    "descripcion": "FORRO CAB FLORENCIA 115X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021940",
    "descripcion": "FORRO CAB FLORENCIA 115X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021941",
    "descripcion": "FORRO CAB FLORENCIA 115X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021942",
    "descripcion": "FORRO CAB FLORENCIA 115X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021943",
    "descripcion": "FORRO CAB FLORENCIA 115X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021944",
    "descripcion": "FORRO CAB FLORENCIA 145X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021945",
    "descripcion": "FORRO CAB FLORENCIA 145X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021946",
    "descripcion": "FORRO CAB FLORENCIA 145X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021947",
    "descripcion": "FORRO CAB FLORENCIA 145X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021948",
    "descripcion": "FORRO CAB FLORENCIA 145X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021949",
    "descripcion": "FORRO CAB FLORENCIA 145X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021950",
    "descripcion": "FORRO CAB FLORENCIA 145X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021951",
    "descripcion": "FORRO CAB FLORENCIA 170X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021952",
    "descripcion": "FORRO CAB FLORENCIA 170X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021953",
    "descripcion": "FORRO CAB FLORENCIA 170X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021954",
    "descripcion": "FORRO CAB FLORENCIA 170X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021955",
    "descripcion": "FORRO CAB FLORENCIA 170X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021956",
    "descripcion": "FORRO CAB FLORENCIA 170X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021957",
    "descripcion": "FORRO CAB FLORENCIA 170X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021958",
    "descripcion": "FORRO CAB FLORENCIA 210X50 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021959",
    "descripcion": "FORRO CAB FLORENCIA 210X50 ASTRA CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021960",
    "descripcion": "FORRO CAB FLORENCIA 210X50 ASTRA CARB_211_N",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021961",
    "descripcion": "FORRO CAB FLORENCIA 210X50 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021962",
    "descripcion": "FORRO CAB FLORENCIA 210X50 EURUS CAF_201_",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021963",
    "descripcion": "FORRO CAB FLORENCIA 210X50 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30021964",
    "descripcion": "FORRO CAB FLORENCIA 210X50 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022199",
    "descripcion": "FORRO CAMA ATENAS 105 ASTRA BEIGE",
    "tiempoMin": 18
  },
  {
    "codigo": "30022206",
    "descripcion": "FORRO CAMA ATENAS 135 ASTRA BEIGE",
    "tiempoMin": 20
  },
  {
    "codigo": "30022208",
    "descripcion": "FORRO CAMA ATENAS 135 ASTRA CAFE",
    "tiempoMin": 20
  },
  {
    "codigo": "30022209",
    "descripcion": "FORRO CAMA ATENAS 135 ASTRA CARBON",
    "tiempoMin": 20
  },
  {
    "codigo": "30022210",
    "descripcion": "FORRO CAMA ATENAS 135 ASTRA GRIS",
    "tiempoMin": 20
  },
  {
    "codigo": "30022211",
    "descripcion": "FORRO CAMA ATENAS 135 VINTAGE NEGRO",
    "tiempoMin": 20
  },
  {
    "codigo": "30022212",
    "descripcion": "FORRO CAMA ATENAS 135 EURUS CAFE",
    "tiempoMin": 20
  },
  {
    "codigo": "30022213",
    "descripcion": "FORRO CAMA ATENAS 135 EURUS GRIS",
    "tiempoMin": 20
  },
  {
    "codigo": "30022214",
    "descripcion": "FORRO CAMA ATENAS 160 ASTRA BEIGE",
    "tiempoMin": 22
  },
  {
    "codigo": "30022215",
    "descripcion": "FORRO CAMA ATENAS 160 ASTRA CAFE",
    "tiempoMin": 22
  },
  {
    "codigo": "30022216",
    "descripcion": "FORRO CAMA ATENAS 160 ASTRA CARBON",
    "tiempoMin": 22
  },
  {
    "codigo": "30022217",
    "descripcion": "FORRO CAMA ATENAS 160 ASTRA GRIS",
    "tiempoMin": 22
  },
  {
    "codigo": "30022218",
    "descripcion": "FORRO CAMA ATENAS 160 VINTAGE NEGRO",
    "tiempoMin": 22
  },
  {
    "codigo": "30022219",
    "descripcion": "FORRO CAMA ATENAS 160 EURUS CAFE",
    "tiempoMin": 22
  },
  {
    "codigo": "30022220",
    "descripcion": "FORRO CAMA ATENAS 160 EURUS GRIS",
    "tiempoMin": 22
  },
  {
    "codigo": "30022221",
    "descripcion": "FORRO CAMA ATENAS 200 ASTRA BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30022223",
    "descripcion": "FORRO CAMA ATENAS 200 ASTRA CAFE",
    "tiempoMin": 24
  },
  {
    "codigo": "30022224",
    "descripcion": "FORRO CAMA ATENAS 200 ASTRA CARBON",
    "tiempoMin": 24
  },
  {
    "codigo": "30022225",
    "descripcion": "FORRO CAMA ATENAS 200 ASTRA GRIS",
    "tiempoMin": 24
  },
  {
    "codigo": "30022226",
    "descripcion": "FORRO CAMA ATENAS 200 VINTAGE NEGRO",
    "tiempoMin": 24
  },
  {
    "codigo": "30022227",
    "descripcion": "FORRO CAMA ATENAS 200 EURUS CAFE",
    "tiempoMin": 24
  },
  {
    "codigo": "30022228",
    "descripcion": "FORRO CAMA ATENAS 200 EURUS GRIS",
    "tiempoMin": 24
  },
  {
    "codigo": "30022285",
    "descripcion": "FORRO CAMA BARU 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022286",
    "descripcion": "FORRO CAMA BARU 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022287",
    "descripcion": "FORRO CAMA BARU 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022288",
    "descripcion": "FORRO CAMA BARU 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022289",
    "descripcion": "FORRO CAMA BARU 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022290",
    "descripcion": "FORRO CAMA BARU 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022291",
    "descripcion": "FORRO CAMA BARU 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022292",
    "descripcion": "FORRO CAMA BARU 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022293",
    "descripcion": "FORRO CAMA BARU 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022294",
    "descripcion": "FORRO CAMA BARU 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022295",
    "descripcion": "FORRO CAMA BARU 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022296",
    "descripcion": "FORRO CAMA BARU 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022297",
    "descripcion": "FORRO CAMA BARU 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022298",
    "descripcion": "FORRO CAMA BARU 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022299",
    "descripcion": "FORRO CAMA BARU 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022300",
    "descripcion": "FORRO CAMA BARU 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022301",
    "descripcion": "FORRO CAMA BARU 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022302",
    "descripcion": "FORRO CAMA BARU 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022303",
    "descripcion": "FORRO CAMA BARU 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022304",
    "descripcion": "FORRO CAMA BARU 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022305",
    "descripcion": "FORRO CAMA BARU 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022306",
    "descripcion": "FORRO CAMA BARU 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022307",
    "descripcion": "FORRO CAMA BARU 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022308",
    "descripcion": "FORRO CAMA BARU 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022309",
    "descripcion": "FORRO CAMA BARU 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022310",
    "descripcion": "FORRO CAMA BARU 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022311",
    "descripcion": "FORRO CAMA BARU 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022312",
    "descripcion": "FORRO CAMA BARU 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022341",
    "descripcion": "FORRO CAMA BERLIN 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022342",
    "descripcion": "FORRO CAMA BERLIN 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022343",
    "descripcion": "FORRO CAMA BERLIN 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022344",
    "descripcion": "FORRO CAMA BERLIN 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022345",
    "descripcion": "FORRO CAMA BERLIN 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022346",
    "descripcion": "FORRO CAMA BERLIN 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022347",
    "descripcion": "FORRO CAMA BERLIN 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022348",
    "descripcion": "FORRO CAMA BERLIN 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022349",
    "descripcion": "FORRO CAMA BERLIN 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022350",
    "descripcion": "FORRO CAMA BERLIN 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022351",
    "descripcion": "FORRO CAMA BERLIN 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022352",
    "descripcion": "FORRO CAMA BERLIN 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022353",
    "descripcion": "FORRO CAMA BERLIN 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022354",
    "descripcion": "FORRO CAMA BERLIN 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022355",
    "descripcion": "FORRO CAMA BERLIN 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022356",
    "descripcion": "FORRO CAMA BERLIN 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022357",
    "descripcion": "FORRO CAMA BERLIN 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022358",
    "descripcion": "FORRO CAMA BERLIN 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022359",
    "descripcion": "FORRO CAMA BERLIN 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022360",
    "descripcion": "FORRO CAMA BERLIN 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022361",
    "descripcion": "FORRO CAMA BERLIN 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022362",
    "descripcion": "FORRO CAMA BERLIN 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022363",
    "descripcion": "FORRO CAMA BERLIN 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022364",
    "descripcion": "FORRO CAMA BERLIN 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022365",
    "descripcion": "FORRO CAMA BERLIN 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022366",
    "descripcion": "FORRO CAMA BERLIN 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022367",
    "descripcion": "FORRO CAMA BERLIN 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022368",
    "descripcion": "FORRO CAMA BERLIN 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022397",
    "descripcion": "FORRO CAMA BOSTON 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022398",
    "descripcion": "FORRO CAMA BOSTON 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022399",
    "descripcion": "FORRO CAMA BOSTON 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022400",
    "descripcion": "FORRO CAMA BOSTON 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022401",
    "descripcion": "FORRO CAMA BOSTON 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022402",
    "descripcion": "FORRO CAMA BOSTON 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022403",
    "descripcion": "FORRO CAMA BOSTON 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022404",
    "descripcion": "FORRO CAMA BOSTON 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022405",
    "descripcion": "FORRO CAMA BOSTON 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022406",
    "descripcion": "FORRO CAMA BOSTON 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022407",
    "descripcion": "FORRO CAMA BOSTON 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022408",
    "descripcion": "FORRO CAMA BOSTON 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022409",
    "descripcion": "FORRO CAMA BOSTON 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022410",
    "descripcion": "FORRO CAMA BOSTON 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022411",
    "descripcion": "FORRO CAMA BOSTON 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022412",
    "descripcion": "FORRO CAMA BOSTON 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022413",
    "descripcion": "FORRO CAMA BOSTON 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022414",
    "descripcion": "FORRO CAMA BOSTON 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022415",
    "descripcion": "FORRO CAMA BOSTON 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022416",
    "descripcion": "FORRO CAMA BOSTON 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022417",
    "descripcion": "FORRO CAMA BOSTON 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022418",
    "descripcion": "FORRO CAMA BOSTON 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022419",
    "descripcion": "FORRO CAMA BOSTON 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022420",
    "descripcion": "FORRO CAMA BOSTON 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022421",
    "descripcion": "FORRO CAMA BOSTON 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022422",
    "descripcion": "FORRO CAMA BOSTON 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022423",
    "descripcion": "FORRO CAMA BOSTON 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022424",
    "descripcion": "FORRO CAMA BOSTON 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022453",
    "descripcion": "FORRO CAMA CRETA 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022454",
    "descripcion": "FORRO CAMA CRETA 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022455",
    "descripcion": "FORRO CAMA CRETA 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022456",
    "descripcion": "FORRO CAMA CRETA 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022457",
    "descripcion": "FORRO CAMA CRETA 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022458",
    "descripcion": "FORRO CAMA CRETA 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022459",
    "descripcion": "FORRO CAMA CRETA 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022460",
    "descripcion": "FORRO CAMA CRETA 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022461",
    "descripcion": "FORRO CAMA CRETA 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022462",
    "descripcion": "FORRO CAMA CRETA 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022463",
    "descripcion": "FORRO CAMA CRETA 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022464",
    "descripcion": "FORRO CAMA CRETA 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022465",
    "descripcion": "FORRO CAMA CRETA 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022466",
    "descripcion": "FORRO CAMA CRETA 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022467",
    "descripcion": "FORRO CAMA CRETA 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022468",
    "descripcion": "FORRO CAMA CRETA 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022469",
    "descripcion": "FORRO CAMA CRETA 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022470",
    "descripcion": "FORRO CAMA CRETA 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022471",
    "descripcion": "FORRO CAMA CRETA 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022472",
    "descripcion": "FORRO CAMA CRETA 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022473",
    "descripcion": "FORRO CAMA CRETA 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022474",
    "descripcion": "FORRO CAMA CRETA 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022475",
    "descripcion": "FORRO CAMA CRETA 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022476",
    "descripcion": "FORRO CAMA CRETA 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022477",
    "descripcion": "FORRO CAMA CRETA 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022478",
    "descripcion": "FORRO CAMA CRETA 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022479",
    "descripcion": "FORRO CAMA CRETA 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022480",
    "descripcion": "FORRO CAMA CRETA 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022509",
    "descripcion": "FORRO CAMA FLORENCIA 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022510",
    "descripcion": "FORRO CAMA FLORENCIA 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022511",
    "descripcion": "FORRO CAMA FLORENCIA 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022512",
    "descripcion": "FORRO CAMA FLORENCIA 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022513",
    "descripcion": "FORRO CAMA FLORENCIA 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022514",
    "descripcion": "FORRO CAMA FLORENCIA 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022515",
    "descripcion": "FORRO CAMA FLORENCIA 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022516",
    "descripcion": "FORRO CAMA FLORENCIA 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022517",
    "descripcion": "FORRO CAMA FLORENCIA 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022518",
    "descripcion": "FORRO CAMA FLORENCIA 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022519",
    "descripcion": "FORRO CAMA FLORENCIA 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022520",
    "descripcion": "FORRO CAMA FLORENCIA 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022521",
    "descripcion": "FORRO CAMA FLORENCIA 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022522",
    "descripcion": "FORRO CAMA FLORENCIA 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022523",
    "descripcion": "FORRO CAMA FLORENCIA 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022524",
    "descripcion": "FORRO CAMA FLORENCIA 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022525",
    "descripcion": "FORRO CAMA FLORENCIA 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022526",
    "descripcion": "FORRO CAMA FLORENCIA 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022527",
    "descripcion": "FORRO CAMA FLORENCIA 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022528",
    "descripcion": "FORRO CAMA FLORENCIA 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022529",
    "descripcion": "FORRO CAMA FLORENCIA 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022530",
    "descripcion": "FORRO CAMA FLORENCIA 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022531",
    "descripcion": "FORRO CAMA FLORENCIA 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022532",
    "descripcion": "FORRO CAMA FLORENCIA 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022533",
    "descripcion": "FORRO CAMA FLORENCIA 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022534",
    "descripcion": "FORRO CAMA FLORENCIA 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022535",
    "descripcion": "FORRO CAMA FLORENCIA 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022536",
    "descripcion": "FORRO CAMA FLORENCIA 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022565",
    "descripcion": "FORRO CAMA LONDRES 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022566",
    "descripcion": "FORRO CAMA LONDRES 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022567",
    "descripcion": "FORRO CAMA LONDRES 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022568",
    "descripcion": "FORRO CAMA LONDRES 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022569",
    "descripcion": "FORRO CAMA LONDRES 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022570",
    "descripcion": "FORRO CAMA LONDRES 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022571",
    "descripcion": "FORRO CAMA LONDRES 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022572",
    "descripcion": "FORRO CAMA LONDRES 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022573",
    "descripcion": "FORRO CAMA LONDRES 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022574",
    "descripcion": "FORRO CAMA LONDRES 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022575",
    "descripcion": "FORRO CAMA LONDRES 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022576",
    "descripcion": "FORRO CAMA LONDRES 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022577",
    "descripcion": "FORRO CAMA LONDRES 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022578",
    "descripcion": "FORRO CAMA LONDRES 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022579",
    "descripcion": "FORRO CAMA LONDRES 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022580",
    "descripcion": "FORRO CAMA LONDRES 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022581",
    "descripcion": "FORRO CAMA LONDRES 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022582",
    "descripcion": "FORRO CAMA LONDRES 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022583",
    "descripcion": "FORRO CAMA LONDRES 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022584",
    "descripcion": "FORRO CAMA LONDRES 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022585",
    "descripcion": "FORRO CAMA LONDRES 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022586",
    "descripcion": "FORRO CAMA LONDRES 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022587",
    "descripcion": "FORRO CAMA LONDRES 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022588",
    "descripcion": "FORRO CAMA LONDRES 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022589",
    "descripcion": "FORRO CAMA LONDRES 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022590",
    "descripcion": "FORRO CAMA LONDRES 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022591",
    "descripcion": "FORRO CAMA LONDRES 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022592",
    "descripcion": "FORRO CAMA LONDRES 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022621",
    "descripcion": "FORRO CAMA MILOS 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022622",
    "descripcion": "FORRO CAMA MILOS 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022623",
    "descripcion": "FORRO CAMA MILOS 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022624",
    "descripcion": "FORRO CAMA MILOS 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022625",
    "descripcion": "FORRO CAMA MILOS 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022626",
    "descripcion": "FORRO CAMA MILOS 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022627",
    "descripcion": "FORRO CAMA MILOS 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022628",
    "descripcion": "FORRO CAMA MILOS 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022629",
    "descripcion": "FORRO CAMA MILOS 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022630",
    "descripcion": "FORRO CAMA MILOS 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022631",
    "descripcion": "FORRO CAMA MILOS 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022632",
    "descripcion": "FORRO CAMA MILOS 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022633",
    "descripcion": "FORRO CAMA MILOS 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022634",
    "descripcion": "FORRO CAMA MILOS 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022635",
    "descripcion": "FORRO CAMA MILOS 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022636",
    "descripcion": "FORRO CAMA MILOS 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022637",
    "descripcion": "FORRO CAMA MILOS 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022638",
    "descripcion": "FORRO CAMA MILOS 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022639",
    "descripcion": "FORRO CAMA MILOS 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022640",
    "descripcion": "FORRO CAMA MILOS 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022641",
    "descripcion": "FORRO CAMA MILOS 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022642",
    "descripcion": "FORRO CAMA MILOS 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022643",
    "descripcion": "FORRO CAMA MILOS 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022644",
    "descripcion": "FORRO CAMA MILOS 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022645",
    "descripcion": "FORRO CAMA MILOS 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022646",
    "descripcion": "FORRO CAMA MILOS 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022647",
    "descripcion": "FORRO CAMA MILOS 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022648",
    "descripcion": "FORRO CAMA MILOS 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30022677",
    "descripcion": "FORRO CAMA NAPOLES 105 ASTRA BEIGE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022678",
    "descripcion": "FORRO CAMA NAPOLES 105 ASTRA CAFE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022679",
    "descripcion": "FORRO CAMA NAPOLES 105 ASTRA CARBON",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022680",
    "descripcion": "FORRO CAMA NAPOLES 105 ASTRA GRIS",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022681",
    "descripcion": "FORRO CAMA NAPOLES 105 VINTAGE NEGRO",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022682",
    "descripcion": "FORRO CAMA NAPOLES 105 EURUS CAFE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022683",
    "descripcion": "FORRO CAMA NAPOLES 105 EURUS GRIS",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30022684",
    "descripcion": "FORRO CAMA NAPOLES 135 ASTRA BEIGE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022685",
    "descripcion": "FORRO CAMA NAPOLES 135 ASTRA CAFE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022686",
    "descripcion": "FORRO CAMA NAPOLES 135 ASTRA CARBON",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022687",
    "descripcion": "FORRO CAMA NAPOLES 135 ASTRA GRIS",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022688",
    "descripcion": "FORRO CAMA NAPOLES 135 VINTAGE NEGRO",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022689",
    "descripcion": "FORRO CAMA NAPOLES 135 EURUS CAFE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022690",
    "descripcion": "FORRO CAMA NAPOLES 135 EURUS GRIS",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30022691",
    "descripcion": "FORRO CAMA NAPOLES 160 ASTRA BEIGE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022692",
    "descripcion": "FORRO CAMA NAPOLES 160 ASTRA CAFE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022693",
    "descripcion": "FORRO CAMA NAPOLES 160 ASTRA CARBON",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022694",
    "descripcion": "FORRO CAMA NAPOLES 160 ASTRA GRIS",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022695",
    "descripcion": "FORRO CAMA NAPOLES 160 VINTAGE NEGRO",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022696",
    "descripcion": "FORRO CAMA NAPOLES 160 EURUS CAFE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022697",
    "descripcion": "FORRO CAMA NAPOLES 160 EURUS GRIS",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30022698",
    "descripcion": "FORRO CAMA NAPOLES 200 ASTRA BEIGE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022699",
    "descripcion": "FORRO CAMA NAPOLES 200 ASTRA CAFE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022700",
    "descripcion": "FORRO CAMA NAPOLES 200 ASTRA CARBON",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022701",
    "descripcion": "FORRO CAMA NAPOLES 200 ASTRA GRIS",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022702",
    "descripcion": "FORRO CAMA NAPOLES 200 VINTAGE NEGRO",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022703",
    "descripcion": "FORRO CAMA NAPOLES 200 EURUS CAFE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022704",
    "descripcion": "FORRO CAMA NAPOLES 200 EURUS GRIS",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30022733",
    "descripcion": "FORRO CAMA PRAGA 115 ASTRA BEIGE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022734",
    "descripcion": "FORRO CAMA PRAGA 115 ASTRA CAFE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022735",
    "descripcion": "FORRO CAMA PRAGA 115 ASTRA CARBON",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022736",
    "descripcion": "FORRO CAMA PRAGA 115 ASTRA GRIS",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022737",
    "descripcion": "FORRO CAMA PRAGA 115 VINTAGE NEGRO",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022738",
    "descripcion": "FORRO CAMA PRAGA 115 EURUS CAFE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022739",
    "descripcion": "FORRO CAMA PRAGA 115 EURUS GRIS",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30022740",
    "descripcion": "FORRO CAMA PRAGA 145 ASTRA BEIGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022741",
    "descripcion": "FORRO CAMA PRAGA 145 ASTRA CAFE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022742",
    "descripcion": "FORRO CAMA PRAGA 145 ASTRA CARBON",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022743",
    "descripcion": "FORRO CAMA PRAGA 145 ASTRA GRIS",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022744",
    "descripcion": "FORRO CAMA PRAGA 145 VINTAGE NEGRO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022745",
    "descripcion": "FORRO CAMA PRAGA 145 EURUS CAFE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022746",
    "descripcion": "FORRO CAMA PRAGA 145 EURUS GRIS",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30022747",
    "descripcion": "FORRO CAMA PRAGA 170 ASTRA BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30022748",
    "descripcion": "FORRO CAMA PRAGA 170 ASTRA CAFE",
    "tiempoMin": 8
  },
  {
    "codigo": "30022749",
    "descripcion": "FORRO CAMA PRAGA 170 ASTRA CARBON",
    "tiempoMin": 8
  },
  {
    "codigo": "30022750",
    "descripcion": "FORRO CAMA PRAGA 170 ASTRA GRIS",
    "tiempoMin": 8
  },
  {
    "codigo": "30022751",
    "descripcion": "FORRO CAMA PRAGA 170 VINTAGE NEGRO",
    "tiempoMin": 8
  },
  {
    "codigo": "30022752",
    "descripcion": "FORRO CAMA PRAGA 170 EURUS CAFE",
    "tiempoMin": 8
  },
  {
    "codigo": "30022753",
    "descripcion": "FORRO CAMA PRAGA 170 EURUS GRIS",
    "tiempoMin": 8
  },
  {
    "codigo": "30022754",
    "descripcion": "FORRO CAMA PRAGA 210 ASTRA BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022755",
    "descripcion": "FORRO CAMA PRAGA 210 ASTRA CAFE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022756",
    "descripcion": "FORRO CAMA PRAGA 210 ASTRA CARBON",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022757",
    "descripcion": "FORRO CAMA PRAGA 210 ASTRA GRIS",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022758",
    "descripcion": "FORRO CAMA PRAGA 210 VINTAGE NEGRO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022759",
    "descripcion": "FORRO CAMA PRAGA 210 EURUS CAFE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022760",
    "descripcion": "FORRO CAMA PRAGA 210 EURUS GRIS",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30022866",
    "descripcion": "FORRO COJIN CILINDRICO ASTRA BEIGE",
    "tiempoMin": 5
  },
  {
    "codigo": "30022867",
    "descripcion": "FORRO COJIN CILINDRICO ASTRA CAFE",
    "tiempoMin": 5
  },
  {
    "codigo": "30022868",
    "descripcion": "FORRO COJIN CILINDRICO ASTRA CARBON",
    "tiempoMin": 5
  },
  {
    "codigo": "30022869",
    "descripcion": "FORRO COJIN CILINDRICO ASTRA GRIS",
    "tiempoMin": 5
  },
  {
    "codigo": "30022870",
    "descripcion": "FORRO COJIN CILINDRICO VINTAGE NEGRO",
    "tiempoMin": 5
  },
  {
    "codigo": "30022871",
    "descripcion": "FORRO COJIN CILINDRICO EURUS CAFE",
    "tiempoMin": 5
  },
  {
    "codigo": "30022872",
    "descripcion": "FORRO COJIN CILINDRICO EURUS GRIS",
    "tiempoMin": 5
  },
  {
    "codigo": "30022880",
    "descripcion": "FORRO MATISSE 105 ASTRA BEIGE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022881",
    "descripcion": "FORRO MATISSE 105 ASTRA CAFE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022882",
    "descripcion": "FORRO MATISSE 105 ASTRA CARBON",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022883",
    "descripcion": "FORRO MATISSE 105 ASTRA GRIS",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022884",
    "descripcion": "FORRO MATISSE 105 VINTAGE NEGRO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022885",
    "descripcion": "FORRO MATISSE 105 EURUS CAFE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022886",
    "descripcion": "FORRO MATISSE 105 EURUS GRIS",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30022887",
    "descripcion": "FORRO MIRAGE 105 ASTRA BEIGE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022888",
    "descripcion": "FORRO MIRAGE 105 ASTRA CAFE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022889",
    "descripcion": "FORRO MIRAGE 105 ASTRA CARBON",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022890",
    "descripcion": "FORRO MIRAGE 105 ASTRA GRIS",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022891",
    "descripcion": "FORRO MIRAGE 105 VINTAGE NEGRO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022892",
    "descripcion": "FORRO MIRAGE 105 EURUS CAFE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022893",
    "descripcion": "FORRO MIRAGE 105 EURUS GRIS",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022894",
    "descripcion": "FORRO MIRAGE 120 ASTRA BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022895",
    "descripcion": "FORRO MIRAGE 120 ASTRA CAFE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022896",
    "descripcion": "FORRO MIRAGE 120 ASTRA CARBON",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022897",
    "descripcion": "FORRO MIRAGE 120 ASTRA GRIS",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022898",
    "descripcion": "FORRO MIRAGE 120 VINTAGE NEGRO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022899",
    "descripcion": "FORRO MIRAGE 120 EURUS CAFE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022900",
    "descripcion": "FORRO MIRAGE 120 EURUS GRIS",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022901",
    "descripcion": "FORRO MIRAGE 135 ASTRA BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022902",
    "descripcion": "FORRO MIRAGE 135 ASTRA CAFE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022903",
    "descripcion": "FORRO MIRAGE 135 ASTRA CARBON",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022904",
    "descripcion": "FORRO MIRAGE 135 ASTRA GRIS",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022905",
    "descripcion": "FORRO MIRAGE 135 VINTAGE NEGRO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022906",
    "descripcion": "FORRO MIRAGE 135 EURUS CAFE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022907",
    "descripcion": "FORRO MIRAGE 135 EURUS GRIS",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022908",
    "descripcion": "FORRO OPORTO 135 ASTRA BEIGE",
    "tiempoMin": 210
  },
  {
    "codigo": "30022909",
    "descripcion": "FORRO OPORTO 135 ASTRA CAFE",
    "tiempoMin": 210
  },
  {
    "codigo": "30022910",
    "descripcion": "FORRO OPORTO 135 ASTRA CARBON",
    "tiempoMin": 210
  },
  {
    "codigo": "30022911",
    "descripcion": "FORRO OPORTO 135 ASTRA GRIS",
    "tiempoMin": 210
  },
  {
    "codigo": "30022912",
    "descripcion": "FORRO OPORTO 135 VINTAGE NEGRO",
    "tiempoMin": 210
  },
  {
    "codigo": "30022913",
    "descripcion": "FORRO OPORTO 135 EURUS CAFE",
    "tiempoMin": 210
  },
  {
    "codigo": "30022914",
    "descripcion": "FORRO OPORTO 135 EURUS GRIS",
    "tiempoMin": 210
  },
  {
    "codigo": "30022915",
    "descripcion": "FORRO OTTOMAN 70 ASTRA BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30022916",
    "descripcion": "FORRO OTTOMAN 70 ASTRA CAFE",
    "tiempoMin": 30
  },
  {
    "codigo": "30022917",
    "descripcion": "FORRO OTTOMAN 70 ASTRA CARBON",
    "tiempoMin": 30
  },
  {
    "codigo": "30022918",
    "descripcion": "FORRO OTTOMAN 70 ASTRA GRIS",
    "tiempoMin": 30
  },
  {
    "codigo": "30022919",
    "descripcion": "FORRO OTTOMAN 70 VINTAGE NEGRO",
    "tiempoMin": 30
  },
  {
    "codigo": "30022920",
    "descripcion": "FORRO OTTOMAN 70 EURUS CAFE",
    "tiempoMin": 30
  },
  {
    "codigo": "30022921",
    "descripcion": "FORRO OTTOMAN 70 EURUS GRIS",
    "tiempoMin": 30
  },
  {
    "codigo": "30022922",
    "descripcion": "FORRO OTTOMAN VIENA 80 ASTRA BEIGE",
    "tiempoMin": 110
  },
  {
    "codigo": "30022923",
    "descripcion": "FORRO OTTOMAN VIENA 80 ASTRA CAFE",
    "tiempoMin": 110
  },
  {
    "codigo": "30022924",
    "descripcion": "FORRO OTTOMAN VIENA 80 ASTRA CARBON",
    "tiempoMin": 110
  },
  {
    "codigo": "30022925",
    "descripcion": "FORRO OTTOMAN VIENA 80 ASTRA GRIS",
    "tiempoMin": 110
  },
  {
    "codigo": "30022926",
    "descripcion": "FORRO OTTOMAN VIENA 80 VINTAGE NEGRO",
    "tiempoMin": 110
  },
  {
    "codigo": "30022927",
    "descripcion": "FORRO OTTOMAN VIENA 80 EURUS CAFE",
    "tiempoMin": 110
  },
  {
    "codigo": "30022928",
    "descripcion": "FORRO OTTOMAN VIENA 80 EURUS GRIS",
    "tiempoMin": 110
  },
  {
    "codigo": "30022929",
    "descripcion": "FORRO PHOENIX 105 ASTRA BEIGE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022930",
    "descripcion": "FORRO PHOENIX 105 ASTRA CAFE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022931",
    "descripcion": "FORRO PHOENIX 105 ASTRA CARBON",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022932",
    "descripcion": "FORRO PHOENIX 105 ASTRA GRIS",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022933",
    "descripcion": "FORRO PHOENIX 105 VINTAGE NEGRO",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022934",
    "descripcion": "FORRO PHOENIX 105 EURUS CAFE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022935",
    "descripcion": "FORRO PHOENIX 105 EURUS GRIS",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30022936",
    "descripcion": "FORRO PHOENIX 120 ASTRA BEIGE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022937",
    "descripcion": "FORRO PHOENIX 120 ASTRA CAFE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022938",
    "descripcion": "FORRO PHOENIX 120 ASTRA CARBON",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022939",
    "descripcion": "FORRO PHOENIX 120 ASTRA GRIS",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022940",
    "descripcion": "FORRO PHOENIX 120 VINTAGE NEGRO",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022941",
    "descripcion": "FORRO PHOENIX 120 EURUS CAFE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022942",
    "descripcion": "FORRO PHOENIX 120 EURUS GRIS",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30022943",
    "descripcion": "FORRO PHOENIX 135 ASTRA BEIGE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022944",
    "descripcion": "FORRO PHOENIX 135 ASTRA CAFE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022945",
    "descripcion": "FORRO PHOENIX 135 ASTRA CARBON",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022946",
    "descripcion": "FORRO PHOENIX 135 ASTRA GRIS",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022947",
    "descripcion": "FORRO PHOENIX 135 VINTAGE NEGRO",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022948",
    "descripcion": "FORRO PHOENIX 135 EURUS CAFE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022949",
    "descripcion": "FORRO PHOENIX 135 EURUS GRIS",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30022950",
    "descripcion": "FORRO RECLINABLE APOLO ASTRA BEIGE",
    "tiempoMin": 182
  },
  {
    "codigo": "30022951",
    "descripcion": "FORRO RECLINABLE APOLO ASTRA CAFE",
    "tiempoMin": 182
  },
  {
    "codigo": "30022952",
    "descripcion": "FORRO RECLINABLE APOLO ASTRA CARBON",
    "tiempoMin": 182
  },
  {
    "codigo": "30022953",
    "descripcion": "FORRO RECLINABLE APOLO ASTRA GRIS",
    "tiempoMin": 182
  },
  {
    "codigo": "30022954",
    "descripcion": "FORRO RECLINABLE APOLO VINTAGE NEGRO",
    "tiempoMin": 182
  },
  {
    "codigo": "30022955",
    "descripcion": "FORRO RECLINABLE APOLO EURUS CAFE",
    "tiempoMin": 182
  },
  {
    "codigo": "30022956",
    "descripcion": "FORRO RECLINABLE APOLO EURUS GRIS",
    "tiempoMin": 182
  },
  {
    "codigo": "30022957",
    "descripcion": "FORRO RECLINABLE ZEUS ASTRA BEIGE",
    "tiempoMin": 142
  },
  {
    "codigo": "30022958",
    "descripcion": "FORRO RECLINABLE ZEUS ASTRA CAFE",
    "tiempoMin": 142
  },
  {
    "codigo": "30022959",
    "descripcion": "FORRO RECLINABLE ZEUS ASTRA CARBON",
    "tiempoMin": 142
  },
  {
    "codigo": "30022960",
    "descripcion": "FORRO RECLINABLE ZEUS ASTRA GRIS",
    "tiempoMin": 142
  },
  {
    "codigo": "30022961",
    "descripcion": "FORRO RECLINABLE ZEUS VINTAGE NEGRO",
    "tiempoMin": 142
  },
  {
    "codigo": "30022962",
    "descripcion": "FORRO RECLINABLE ZEUS EURUS CAFE",
    "tiempoMin": 142
  },
  {
    "codigo": "30022963",
    "descripcion": "FORRO RECLINABLE ZEUS EURUS GRIS",
    "tiempoMin": 142
  },
  {
    "codigo": "30022964",
    "descripcion": "FORRO SPRING 105 ASTRA BEIGE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022965",
    "descripcion": "FORRO SPRING 105 ASTRA CAFE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022966",
    "descripcion": "FORRO SPRING 105 ASTRA CARBON",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022967",
    "descripcion": "FORRO SPRING 105 ASTRA GRIS",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022968",
    "descripcion": "FORRO SPRING 105 VINTAGE NEGRO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022969",
    "descripcion": "FORRO SPRING 105 EURUS CAFE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022970",
    "descripcion": "FORRO SPRING 105 EURUS GRIS",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30022971",
    "descripcion": "FORRO VELADOR FLORENCIA ASTRA BEIGE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30022972",
    "descripcion": "FORRO VELADOR FLORENCIA ASTRA CAFE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30022973",
    "descripcion": "FORRO VELADOR FLORENCIA ASTRA CARBON",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30022974",
    "descripcion": "FORRO VELADOR FLORENCIA ASTRA GRIS",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30022975",
    "descripcion": "FORRO VELADOR FLORENCIA VINTAGE NEGRO",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30022976",
    "descripcion": "FORRO VELADOR FLORENCIA EURUS CAFE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30022977",
    "descripcion": "FORRO VELADOR FLORENCIA EURUS GRIS",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30023106",
    "descripcion": "FORRO FOAM 105 ASTRA BEIGE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023107",
    "descripcion": "FORRO FOAM 105 ASTRA CAFE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023108",
    "descripcion": "FORRO FOAM 105 ASTRA CARBON",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023109",
    "descripcion": "FORRO FOAM 105 ASTRA GRIS",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023110",
    "descripcion": "FORRO FOAM 105 EURUS CAFE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023111",
    "descripcion": "FORRO FOAM 105 EURUS GRIS",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023112",
    "descripcion": "FORRO FOAM 105 EURUS OCEANO",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023113",
    "descripcion": "FORRO FOAM 105 EURUS BEIGE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30023114",
    "descripcion": "FORRO FOAM 135 ASTRA BEIGE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023115",
    "descripcion": "FORRO FOAM 135 ASTRA CAFE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023116",
    "descripcion": "FORRO FOAM 135 ASTRA CARBON",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023117",
    "descripcion": "FORRO FOAM 135 ASTRA GRIS",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023118",
    "descripcion": "FORRO FOAM 135 EURUS CAFE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023119",
    "descripcion": "FORRO FOAM 135 EURUS GRIS",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023120",
    "descripcion": "FORRO FOAM 135 EURUS OCEANO",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023121",
    "descripcion": "FORRO FOAM 135 EURUS BEIGE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30023122",
    "descripcion": "FORRO FOAM 070 ASTRA BEIGE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023123",
    "descripcion": "FORRO FOAM 070 ASTRA CAFE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023124",
    "descripcion": "FORRO FOAM 070 ASTRA CARBON",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023125",
    "descripcion": "FORRO FOAM 070 ASTRA GRIS",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023126",
    "descripcion": "FORRO FOAM 070 EURUS CAFE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023127",
    "descripcion": "FORRO FOAM 070 EURUS GRIS",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023128",
    "descripcion": "FORRO FOAM 070 EURUS OCEANO",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023129",
    "descripcion": "FORRO FOAM 070 EURUS BEIGE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30023164",
    "descripcion": "FORRO CAB MODULAR ASTRA BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30023165",
    "descripcion": "FORRO CAB MODULAR ASTRA CAF_201_",
    "tiempoMin": 24
  },
  {
    "codigo": "30023166",
    "descripcion": "FORRO CAB MODULAR ASTRA CARB_211_N",
    "tiempoMin": 24
  },
  {
    "codigo": "30023167",
    "descripcion": "FORRO CAB MODULAR ASTRA GRIS",
    "tiempoMin": 24
  },
  {
    "codigo": "30023168",
    "descripcion": "FORRO CAB MODULAR VINTAGE NEGRO",
    "tiempoMin": 24
  },
  {
    "codigo": "30023169",
    "descripcion": "FORRO CAB MODULAR EURUS CAF_201_",
    "tiempoMin": 24
  },
  {
    "codigo": "30023170",
    "descripcion": "FORRO CAB MODULAR EURUS GRIS",
    "tiempoMin": 24
  },
  {
    "codigo": "30023171",
    "descripcion": "FORRO CAB MODULAR EURUS OC_201_ANO",
    "tiempoMin": 24
  },
  {
    "codigo": "30023172",
    "descripcion": "FORRO CAB MODULAR EURUS BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30023173",
    "descripcion": "FORRO CAB MODULAR VINTAGE BEIGE",
    "tiempoMin": 24
  },
  {
    "codigo": "30023174",
    "descripcion": "FORRO CAB MODULAR VINTAGE CAPUCCINO",
    "tiempoMin": 24
  },
  {
    "codigo": "30023175",
    "descripcion": "FORRO CAB MODULAR VINTAGE HUMO",
    "tiempoMin": 24
  },
  {
    "codigo": "30023176",
    "descripcion": "FORRO CAB MODULAR FLANIGAN HIBISCUS",
    "tiempoMin": 24
  },
  {
    "codigo": "30023177",
    "descripcion": "FORRO CAB MODULAR FLANIGAN TANGELO",
    "tiempoMin": 24
  },
  {
    "codigo": "30023178",
    "descripcion": "FORRO CAB MODULAR FLANIGAN TIDEWATER",
    "tiempoMin": 24
  },
  {
    "codigo": "30023179",
    "descripcion": "FORRO CAB MODULAR LYRICAL SIERRA",
    "tiempoMin": 24
  },
  {
    "codigo": "30023180",
    "descripcion": "FORRO CAB MODULAR ARGO AZUL",
    "tiempoMin": 24
  },
  {
    "codigo": "30023181",
    "descripcion": "FORRO CAB MODULAR ARGO TERRACOTA",
    "tiempoMin": 24
  },
  {
    "codigo": "30023182",
    "descripcion": "FORRO CAB MODULAR VINTAGE NEGRO MATE",
    "tiempoMin": 24
  },
  {
    "codigo": "30023183",
    "descripcion": "FORRO CAB MODULAR STONE M_193_RMOL",
    "tiempoMin": 24
  },
  {
    "codigo": "30023204",
    "descripcion": "TAPA T. FALSO NEGRO CABECERO 115X34",
    "tiempoMin": 1.9
  },
  {
    "codigo": "30023214",
    "descripcion": "FORRO COMFY BOX 105 ASTRA CAF_201_",
    "tiempoMin": 105
  },
  {
    "codigo": "30023215",
    "descripcion": "FORRO COMFY BOX 105 ASTRA GRIS",
    "tiempoMin": 105
  },
  {
    "codigo": "30023222",
    "descripcion": "FORRO LOVE SEAT APOLO ASTRA BEIGE",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023223",
    "descripcion": "FORRO LOVE SEAT APOLO ASTRA CAF_201_",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023224",
    "descripcion": "FORRO LOVE SEAT APOLO ASTRA CARB_211_N",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023225",
    "descripcion": "FORRO LOVE SEAT APOLO ASTRA GRIS",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023226",
    "descripcion": "FORRO LOVE SEAT APOLO VINTAGE NEGRO",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023227",
    "descripcion": "FORRO LOVE SEAT APOLO EURUS CAF_201_",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023228",
    "descripcion": "FORRO LOVE SEAT APOLO EURUS GRIS",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023229",
    "descripcion": "FORRO LOVE SEAT APOLO EURUS OC_201_ANO",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023230",
    "descripcion": "FORRO LOVE SEAT APOLO EURUS BEIGE",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023231",
    "descripcion": "FORRO LOVE SEAT APOLO VINTAGE BEIGE",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023232",
    "descripcion": "FORRO LOVE SEAT APOLO VINTAGE CAPUCCINO",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023233",
    "descripcion": "FORRO LOVE SEAT APOLO VINTAGE HUMO",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023234",
    "descripcion": "FORRO LOVE SEAT APOLO FLANIGAN HIBISCUS",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023235",
    "descripcion": "FORRO LOVE SEAT APOLO FLANIGAN TANGELO",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023236",
    "descripcion": "FORRO LOVE SEAT APOLO LYRICAL SIERRA",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023237",
    "descripcion": "FORRO LOVE SEAT APOLO ARGO AZUL",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023238",
    "descripcion": "FORRO LOVE SEAT APOLO ARGO TERRACOTA",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023239",
    "descripcion": "FORRO LOVE SEAT APOLO VINTAG NEGRO MATE",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023240",
    "descripcion": "FORRO LOVE SEAT APOLO STONE M_193_RMOL",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30023274",
    "descripcion": "FORRO VELADOR E-TECH ASTRA BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30023275",
    "descripcion": "FORRO VELADOR E-TECH ASTRA CAF_201_",
    "tiempoMin": 30
  },
  {
    "codigo": "30023276",
    "descripcion": "FORRO VELADOR E-TECH ASTRA CARB_211_N",
    "tiempoMin": 30
  },
  {
    "codigo": "30023277",
    "descripcion": "FORRO VELADOR E-TECH ASTRA GRIS",
    "tiempoMin": 30
  },
  {
    "codigo": "30023278",
    "descripcion": "FORRO VELADOR E-TECH VINTAGE NEGRO",
    "tiempoMin": 30
  },
  {
    "codigo": "30023279",
    "descripcion": "FORRO VELADOR E-TECH EURUS CAF_201_",
    "tiempoMin": 30
  },
  {
    "codigo": "30023280",
    "descripcion": "FORRO VELADOR E-TECH EURUS GRIS",
    "tiempoMin": 30
  },
  {
    "codigo": "30023281",
    "descripcion": "FORRO VELADOR E-TECH EURUS OC_201_ANO",
    "tiempoMin": 30
  },
  {
    "codigo": "30023282",
    "descripcion": "FORRO VELADOR E-TECH EURUS BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30023283",
    "descripcion": "FORRO VELADOR E-TECH VINTAGE BEIGE",
    "tiempoMin": 30
  },
  {
    "codigo": "30023284",
    "descripcion": "FORRO VELADOR E-TECH VINTAGE CAPUCCINO",
    "tiempoMin": 30
  },
  {
    "codigo": "30023285",
    "descripcion": "FORRO VELADOR E-TECH VINTAGE HUMO",
    "tiempoMin": 30
  },
  {
    "codigo": "30023286",
    "descripcion": "FORRO VELADOR E-TECH FLANIGAN HIBISCUS",
    "tiempoMin": 30
  },
  {
    "codigo": "30023287",
    "descripcion": "FORRO VELADOR E-TECH FLANIGAN TANGELO",
    "tiempoMin": 30
  },
  {
    "codigo": "30023288",
    "descripcion": "FORRO VELADOR E-TECH FLANIGAN TIDEWATER",
    "tiempoMin": 30
  },
  {
    "codigo": "30023289",
    "descripcion": "FORRO VELADOR E-TECH LYRICAL SIERRA",
    "tiempoMin": 30
  },
  {
    "codigo": "30023290",
    "descripcion": "FORRO VELADOR E-TECH ARGO AZUL",
    "tiempoMin": 30
  },
  {
    "codigo": "30023291",
    "descripcion": "FORRO VELADOR E-TECH ARGO TERRACOTA",
    "tiempoMin": 30
  },
  {
    "codigo": "30023292",
    "descripcion": "FORRO VELADOR E-TECH VINTAGE NEGRO MATE",
    "tiempoMin": 30
  },
  {
    "codigo": "30023293",
    "descripcion": "FORRO VELADOR E-TECH STONE M_193_RMOL",
    "tiempoMin": 30
  },
  {
    "codigo": "30023333",
    "descripcion": "FORRO MUNICH 94 ASTRA BEIGE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023334",
    "descripcion": "FORRO MUNICH 94 ASTRA CAFE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023335",
    "descripcion": "FORRO MUNICH 94 ASTRA CARBON",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023336",
    "descripcion": "FORRO MUNICH 94 ASTRA GRIS",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023337",
    "descripcion": "FORRO MUNICH 94 VINTAGE NEGRO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023338",
    "descripcion": "FORRO MUNICH 94 EURUS CAFE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023339",
    "descripcion": "FORRO MUNICH 94 EURUS GRIS",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30023352",
    "descripcion": "FORRO MARTINICA 105 ASTRA BEIGE",
    "tiempoMin": 105
  },
  {
    "codigo": "30023353",
    "descripcion": "FORRO MARTINICA 105 ASTRA CAFE",
    "tiempoMin": 105
  },
  {
    "codigo": "30023354",
    "descripcion": "FORRO MARTINICA 105 ASTRA CARBON",
    "tiempoMin": 105
  },
  {
    "codigo": "30023355",
    "descripcion": "FORRO MARTINICA 105 ASTRA GRIS",
    "tiempoMin": 105
  },
  {
    "codigo": "30023356",
    "descripcion": "FORRO MARTINICA 105 VINTAGE NEGRO",
    "tiempoMin": 105
  },
  {
    "codigo": "30023357",
    "descripcion": "FORRO MARTINICA 105 EURUS CAFE",
    "tiempoMin": 105
  },
  {
    "codigo": "30023358",
    "descripcion": "FORRO MARTINICA 105 EURUS GRIS",
    "tiempoMin": 105
  },
  {
    "codigo": "30023359",
    "descripcion": "FORRO MARTINICA 105 EURUS OCEANO",
    "tiempoMin": 105
  },
  {
    "codigo": "30023360",
    "descripcion": "FORRO MARTINICA 105 EURUS BEIGE",
    "tiempoMin": 105
  },
  {
    "codigo": "30023361",
    "descripcion": "FORRO MARTINICA 105 VINTAGE BEIGE",
    "tiempoMin": 105
  },
  {
    "codigo": "30023362",
    "descripcion": "FORRO MARTINICA 105 VINTAGE CAPUCCINO",
    "tiempoMin": 105
  },
  {
    "codigo": "30023363",
    "descripcion": "FORRO MARTINICA 105 VINTAGE HUMO",
    "tiempoMin": 105
  },
  {
    "codigo": "30023364",
    "descripcion": "FORRO MARTINICA 105 FLANIGAN HIBISCUS",
    "tiempoMin": 105
  },
  {
    "codigo": "30023365",
    "descripcion": "FORRO MARTINICA 105 FLANIGAN TANGELO",
    "tiempoMin": 105
  },
  {
    "codigo": "30023366",
    "descripcion": "FORRO MARTINICA 105 LYRICAL SIERRA",
    "tiempoMin": 105
  },
  {
    "codigo": "30023367",
    "descripcion": "FORRO MARTINICA 105 ARGO AZUL",
    "tiempoMin": 105
  },
  {
    "codigo": "30023368",
    "descripcion": "FORRO MARTINICA 105 ARGO TERRACOTA",
    "tiempoMin": 105
  },
  {
    "codigo": "30023369",
    "descripcion": "FORRO MARTINICA 105 VINTAGE NEGRO MATE",
    "tiempoMin": 105
  },
  {
    "codigo": "30023370",
    "descripcion": "FORRO MARTINICA 105 STONE MARMOL",
    "tiempoMin": 105
  },
  {
    "codigo": "30023390",
    "descripcion": "TAPA T. FALSO NEGRO MARTINICA",
    "tiempoMin": 6.45
  },
  {
    "codigo": "30023399",
    "descripcion": "FORRO GRAND BARU 119 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023400",
    "descripcion": "FORRO GRAND BARU 119 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023401",
    "descripcion": "FORRO GRAND BARU 119 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023402",
    "descripcion": "FORRO GRAND BARU 119 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023403",
    "descripcion": "FORRO GRAND BARU 119 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023404",
    "descripcion": "FORRO GRAND BARU 119 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023405",
    "descripcion": "FORRO GRAND BARU 119 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023406",
    "descripcion": "FORRO GRAND BARU 149 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023407",
    "descripcion": "FORRO GRAND BARU 149 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023408",
    "descripcion": "FORRO GRAND BARU 149 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023409",
    "descripcion": "FORRO GRAND BARU 149 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023410",
    "descripcion": "FORRO GRAND BARU 149 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023411",
    "descripcion": "FORRO GRAND BARU 149 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023412",
    "descripcion": "FORRO GRAND BARU 149 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023413",
    "descripcion": "FORRO GRAND BARU 174 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023414",
    "descripcion": "FORRO GRAND BARU 174 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023415",
    "descripcion": "FORRO GRAND BARU 174 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023416",
    "descripcion": "FORRO GRAND BARU 174 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023417",
    "descripcion": "FORRO GRAND BARU 174 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023418",
    "descripcion": "FORRO GRAND BARU 174 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023419",
    "descripcion": "FORRO GRAND BARU 174 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023420",
    "descripcion": "FORRO GRAND BARU 214 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023421",
    "descripcion": "FORRO GRAND BARU 214 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023422",
    "descripcion": "FORRO GRAND BARU 214 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023423",
    "descripcion": "FORRO GRAND BARU 214 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023424",
    "descripcion": "FORRO GRAND BARU 214 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023425",
    "descripcion": "FORRO GRAND BARU 214 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023426",
    "descripcion": "FORRO GRAND BARU 214 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023427",
    "descripcion": "FORRO GRAND BERLIN 119 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023428",
    "descripcion": "FORRO GRAND BERLIN 119 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023429",
    "descripcion": "FORRO GRAND BERLIN 119 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023430",
    "descripcion": "FORRO GRAND BERLIN 119 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023431",
    "descripcion": "FORRO GRAND BERLIN 119 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023432",
    "descripcion": "FORRO GRAND BERLIN 119 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023433",
    "descripcion": "FORRO GRAND BERLIN 119 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023434",
    "descripcion": "FORRO GRAND BERLIN 149 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023435",
    "descripcion": "FORRO GRAND BERLIN 149 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023436",
    "descripcion": "FORRO GRAND BERLIN 149 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023437",
    "descripcion": "FORRO GRAND BERLIN 149 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023438",
    "descripcion": "FORRO GRAND BERLIN 149 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023439",
    "descripcion": "FORRO GRAND BERLIN 149 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023440",
    "descripcion": "FORRO GRAND BERLIN 149 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023441",
    "descripcion": "FORRO GRAND BERLIN 174 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023442",
    "descripcion": "FORRO GRAND BERLIN 174 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023443",
    "descripcion": "FORRO GRAND BERLIN 174 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023444",
    "descripcion": "FORRO GRAND BERLIN 174 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023445",
    "descripcion": "FORRO GRAND BERLIN 174 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023446",
    "descripcion": "FORRO GRAND BERLIN 174 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023447",
    "descripcion": "FORRO GRAND BERLIN 174 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023448",
    "descripcion": "FORRO GRAND BERLIN 214 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023449",
    "descripcion": "FORRO GRAND BERLIN 214 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023450",
    "descripcion": "FORRO GRAND BERLIN 214 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023451",
    "descripcion": "FORRO GRAND BERLIN 214 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023452",
    "descripcion": "FORRO GRAND BERLIN 214 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023453",
    "descripcion": "FORRO GRAND BERLIN 214 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023454",
    "descripcion": "FORRO GRAND BERLIN 214 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023539",
    "descripcion": "FORRO BASE GRAND 119 ASTRA BEIGE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023540",
    "descripcion": "FORRO BASE GRAND 119 ASTRA CAFE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023541",
    "descripcion": "FORRO BASE GRAND 119 ASTRA CARBON",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023542",
    "descripcion": "FORRO BASE GRAND 119 ASTRA GRIS",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023543",
    "descripcion": "FORRO BASE GRAND 119 VINTAGE NEGRO",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023544",
    "descripcion": "FORRO BASE GRAND 119 EURUS CAFE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023545",
    "descripcion": "FORRO BASE GRAND 119 EURUS GRIS",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30023546",
    "descripcion": "FORRO BASE GRAND 149 ASTRA BEIGE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023547",
    "descripcion": "FORRO BASE GRAND 149 ASTRA CAFE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023548",
    "descripcion": "FORRO BASE GRAND 149 ASTRA CARBON",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023549",
    "descripcion": "FORRO BASE GRAND 149 ASTRA GRIS",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023550",
    "descripcion": "FORRO BASE GRAND 149 VINTAGE NEGRO",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023551",
    "descripcion": "FORRO BASE GRAND 149 EURUS CAFE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023552",
    "descripcion": "FORRO BASE GRAND 149 EURUS GRIS",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30023553",
    "descripcion": "FORRO BASE GRAND 174 ASTRA BEIGE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023554",
    "descripcion": "FORRO BASE GRAND 174 ASTRA CAFE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023555",
    "descripcion": "FORRO BASE GRAND 174 ASTRA CARBON",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023556",
    "descripcion": "FORRO BASE GRAND 174 ASTRA GRIS",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023557",
    "descripcion": "FORRO BASE GRAND 174 VINTAGE NEGRO",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023558",
    "descripcion": "FORRO BASE GRAND 174 EURUS CAFE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023559",
    "descripcion": "FORRO BASE GRAND 174 EURUS GRIS",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30023560",
    "descripcion": "FORRO BASE GRAND 214 ASTRA BEIGE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023561",
    "descripcion": "FORRO BASE GRAND 214 ASTRA CAFE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023562",
    "descripcion": "FORRO BASE GRAND 214 ASTRA CARBON",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023563",
    "descripcion": "FORRO BASE GRAND 214 ASTRA GRIS",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023564",
    "descripcion": "FORRO BASE GRAND 214 VINTAGE NEGRO",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023565",
    "descripcion": "FORRO BASE GRAND 214 EURUS CAFE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023566",
    "descripcion": "FORRO BASE GRAND 214 EURUS GRIS",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30023621",
    "descripcion": "TAPA T. FALSO NEGRO PHOENIX 105",
    "tiempoMin": 4.17
  },
  {
    "codigo": "30023624",
    "descripcion": "TAPA T. FALSO NEGRO PHOENIX 120",
    "tiempoMin": 4.83
  },
  {
    "codigo": "30023626",
    "descripcion": "TAPA T. FALSO NEGRO PHOENIX 135",
    "tiempoMin": 5.67
  },
  {
    "codigo": "30023635",
    "descripcion": "TAPA T. FALSO NEGRO LOVE SEAT",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30023646",
    "descripcion": "FORRO COJIN INT RECLI LOVESEAT APOYBRAZO",
    "tiempoMin": 3
  },
  {
    "codigo": "30023647",
    "descripcion": "FORRO COJIN INT RECLI LOVESEAT APOYAPIES",
    "tiempoMin": 2
  },
  {
    "codigo": "30023648",
    "descripcion": "FORRO COJIN INT RECLI LOVESEAT ESPAD SUP",
    "tiempoMin": 5
  },
  {
    "codigo": "30023649",
    "descripcion": "FORRO COJIN INT RECLI LOVESEAT ESPAD INF",
    "tiempoMin": 5
  },
  {
    "codigo": "30023674",
    "descripcion": "FORRO VELADOR E-TECH STONE GRAFITO",
    "tiempoMin": 30
  },
  {
    "codigo": "30023675",
    "descripcion": "FORRO VELADOR E-TECH STONE JASPE",
    "tiempoMin": 30
  },
  {
    "codigo": "30023676",
    "descripcion": "FORRO VELADOR E-TECH STONE COBRE",
    "tiempoMin": 30
  },
  {
    "codigo": "30023721",
    "descripcion": "FORRO MECEDORA ALMA ASTRA BEIGE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023722",
    "descripcion": "FORRO MECEDORA ALMA ASTRA CAFE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023723",
    "descripcion": "FORRO MECEDORA ALMA ASTRA CARBON",
    "tiempoMin": 150
  },
  {
    "codigo": "30023724",
    "descripcion": "FORRO MECEDORA ALMA ASTRA GRIS",
    "tiempoMin": 150
  },
  {
    "codigo": "30023725",
    "descripcion": "FORRO MECEDORA ALMA EURUS CAFE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023726",
    "descripcion": "FORRO MECEDORA ALMA EURUS GRIS",
    "tiempoMin": 150
  },
  {
    "codigo": "30023727",
    "descripcion": "FORRO MECEDORA ALMA EURUS OCEANO",
    "tiempoMin": 150
  },
  {
    "codigo": "30023728",
    "descripcion": "FORRO MECEDORA ALMA EURUS BEIGE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023729",
    "descripcion": "FORRO MECEDORA ALMA VINTAGE NEGR MATE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023730",
    "descripcion": "FORRO MECEDORA ALMA VINTAGE NEGRO",
    "tiempoMin": 150
  },
  {
    "codigo": "30023731",
    "descripcion": "FORRO MECEDORA ALMA VINTAGE CAPUCCINO",
    "tiempoMin": 150
  },
  {
    "codigo": "30023732",
    "descripcion": "FORRO MECEDORA ALMA VINTAGE HUMO",
    "tiempoMin": 150
  },
  {
    "codigo": "30023733",
    "descripcion": "FORRO MECEDORA ALMA VINTAGE BEIGE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023734",
    "descripcion": "FORRO MECEDORA ALMA STONE JASPE",
    "tiempoMin": 150
  },
  {
    "codigo": "30023735",
    "descripcion": "FORRO MECEDORA ALMA STONE MARMOL",
    "tiempoMin": 150
  },
  {
    "codigo": "30023736",
    "descripcion": "FORRO MECEDORA ALMA EPIC BRUMA",
    "tiempoMin": 150
  },
  {
    "codigo": "30023737",
    "descripcion": "FORRO MECEDORA ALMA EPIC TIERRA",
    "tiempoMin": 150
  },
  {
    "codigo": "30023738",
    "descripcion": "FORRO MECEDORA ALMA EPIC OTO_209_O",
    "tiempoMin": 150
  },
  {
    "codigo": "30023739",
    "descripcion": "FORRO MECEDORA ALMA LYRICAL SIERRA",
    "tiempoMin": 150
  },
  {
    "codigo": "30023740",
    "descripcion": "FORRO MECEDORA ALMA FLANNIGA TANGELO",
    "tiempoMin": 150
  },
  {
    "codigo": "30023741",
    "descripcion": "FORRO MECEDORA ALMA FLANNIGA HIBISCUS",
    "tiempoMin": 150
  },
  {
    "codigo": "30023770",
    "descripcion": "FORRO COJIN INTER MECEDORA INF",
    "tiempoMin": 4
  },
  {
    "codigo": "30023771",
    "descripcion": "FORRO COJIN INTER MECEDORA SUP/MED",
    "tiempoMin": 4
  },
  {
    "codigo": "30023772",
    "descripcion": "FORRO COJIN INTER MECEDORA SUP/MED",
    "tiempoMin": 4
  },
  {
    "codigo": "30023773",
    "descripcion": "FORRO COJIN INTER MECEDORA APOYABRAZO",
    "tiempoMin": 4
  },
  {
    "codigo": "30023774",
    "descripcion": "FORRO COJIN INTER MECEDORA PIES",
    "tiempoMin": 2
  },
  {
    "codigo": "30023775",
    "descripcion": "FORRO COJIN INTER MECEDORA APOYAPIES",
    "tiempoMin": 2
  },
  {
    "codigo": "30023782",
    "descripcion": "TAPA T. FALSO NEGRO MECEDORA",
    "tiempoMin": 4
  },
  {
    "codigo": "30023788",
    "descripcion": "FORRO CAMA OSLO 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023789",
    "descripcion": "FORRO CAMA OSLO 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023790",
    "descripcion": "FORRO CAMA OSLO 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023791",
    "descripcion": "FORRO CAMA OSLO 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023792",
    "descripcion": "FORRO CAMA OSLO 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023793",
    "descripcion": "FORRO CAMA OSLO 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023794",
    "descripcion": "FORRO CAMA OSLO 105 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023795",
    "descripcion": "FORRO CAMA OSLO 105 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023796",
    "descripcion": "FORRO CAMA OSLO 105 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023797",
    "descripcion": "FORRO CAMA OSLO 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023798",
    "descripcion": "FORRO CAMA OSLO 105 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023799",
    "descripcion": "FORRO CAMA OSLO 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023800",
    "descripcion": "FORRO CAMA OSLO 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023801",
    "descripcion": "FORRO CAMA OSLO 105 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023802",
    "descripcion": "FORRO CAMA OSLO 105 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023803",
    "descripcion": "FORRO CAMA OSLO 105 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023804",
    "descripcion": "FORRO CAMA OSLO 105 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023805",
    "descripcion": "FORRO CAMA OSLO 105 LYRICAL SIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023806",
    "descripcion": "FORRO CAMA OSLO 105 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023807",
    "descripcion": "FORRO CAMA OSLO 105 FLANNIGA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023808",
    "descripcion": "FORRO CAMA OSLO 105 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023809",
    "descripcion": "FORRO CAMA OSLO 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023810",
    "descripcion": "FORRO CAMA OSLO 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023811",
    "descripcion": "FORRO CAMA OSLO 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023812",
    "descripcion": "FORRO CAMA OSLO 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023813",
    "descripcion": "FORRO CAMA OSLO 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023814",
    "descripcion": "FORRO CAMA OSLO 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023815",
    "descripcion": "FORRO CAMA OSLO 135 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023816",
    "descripcion": "FORRO CAMA OSLO 135 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023817",
    "descripcion": "FORRO CAMA OSLO 135 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023818",
    "descripcion": "FORRO CAMA OSLO 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023819",
    "descripcion": "FORRO CAMA OSLO 135 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023820",
    "descripcion": "FORRO CAMA OSLO 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023821",
    "descripcion": "FORRO CAMA OSLO 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023822",
    "descripcion": "FORRO CAMA OSLO 135 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023823",
    "descripcion": "FORRO CAMA OSLO 135 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023824",
    "descripcion": "FORRO CAMA OSLO 135 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023825",
    "descripcion": "FORRO CAMA OSLO 135 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023826",
    "descripcion": "FORRO CAMA OSLO 135 LYRICAL SIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023827",
    "descripcion": "FORRO CAMA OSLO 135 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023828",
    "descripcion": "FORRO CAMA OSLO 135 FLANNIGA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023829",
    "descripcion": "FORRO CAMA OSLO 135 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023830",
    "descripcion": "FORRO CAMA OSLO 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023831",
    "descripcion": "FORRO CAMA OSLO 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023832",
    "descripcion": "FORRO CAMA OSLO 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023833",
    "descripcion": "FORRO CAMA OSLO 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023834",
    "descripcion": "FORRO CAMA OSLO 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023835",
    "descripcion": "FORRO CAMA OSLO 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023836",
    "descripcion": "FORRO CAMA OSLO 160 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023837",
    "descripcion": "FORRO CAMA OSLO 160 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023838",
    "descripcion": "FORRO CAMA OSLO 160 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023839",
    "descripcion": "FORRO CAMA OSLO 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023840",
    "descripcion": "FORRO CAMA OSLO 160 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023841",
    "descripcion": "FORRO CAMA OSLO 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023842",
    "descripcion": "FORRO CAMA OSLO 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023843",
    "descripcion": "FORRO CAMA OSLO 160 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023844",
    "descripcion": "FORRO CAMA OSLO 160 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023845",
    "descripcion": "FORRO CAMA OSLO 160 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023846",
    "descripcion": "FORRO CAMA OSLO 160 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023847",
    "descripcion": "FORRO CAMA OSLO 160 LYRICAL SIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023848",
    "descripcion": "FORRO CAMA OSLO 160 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023849",
    "descripcion": "FORRO CAMA OSLO 160 FLANNIGA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023850",
    "descripcion": "FORRO CAMA OSLO 160 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023851",
    "descripcion": "FORRO CAMA OSLO 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023852",
    "descripcion": "FORRO CAMA OSLO 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023853",
    "descripcion": "FORRO CAMA OSLO 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023854",
    "descripcion": "FORRO CAMA OSLO 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023855",
    "descripcion": "FORRO CAMA OSLO 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023856",
    "descripcion": "FORRO CAMA OSLO 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023857",
    "descripcion": "FORRO CAMA OSLO 200 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023858",
    "descripcion": "FORRO CAMA OSLO 200 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023859",
    "descripcion": "FORRO CAMA OSLO 200 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023860",
    "descripcion": "FORRO CAMA OSLO 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023861",
    "descripcion": "FORRO CAMA OSLO 200 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023862",
    "descripcion": "FORRO CAMA OSLO 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023863",
    "descripcion": "FORRO CAMA OSLO 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023864",
    "descripcion": "FORRO CAMA OSLO 200 STONE JASPE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023865",
    "descripcion": "FORRO CAMA OSLO 200 STONE MARMOL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023866",
    "descripcion": "FORRO CAMA OSLO 200 EPIC TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023867",
    "descripcion": "FORRO CAMA OSLO 200 EPIC OTO_209_O",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023868",
    "descripcion": "FORRO CAMA OSLO 200 LYRICAL SIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023869",
    "descripcion": "FORRO CAMA OSLO 200 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023870",
    "descripcion": "FORRO CAMA OSLO 200 FLANNIGA HIBISCUS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30023871",
    "descripcion": "FORRO CAMA OSLO 200 ARGO AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024113",
    "descripcion": "FORRO SOFA RESIFLEX DOMINICA MIEL",
    "tiempoMin": 105
  },
  {
    "codigo": "30024114",
    "descripcion": "FORRO SOFA RESIFLEX DOMINICA CHOCO",
    "tiempoMin": 105
  },
  {
    "codigo": "30024115",
    "descripcion": "FORRO SOFA RESIFLEX DOMINICA PLOMO",
    "tiempoMin": 105
  },
  {
    "codigo": "30024119",
    "descripcion": "TAPA T. FALSO NEGRO DOMINICA",
    "tiempoMin": 6
  },
  {
    "codigo": "30024184",
    "descripcion": "FORRO PROT CHN IMPER KIT BB 68X96X06",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30024185",
    "descripcion": "FORRO PROT CHN IMPER KIT BB 70X100X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30024186",
    "descripcion": "FORRO PROT CHN IMPER KIT BB 70X130X10",
    "tiempoMin": 0.84
  },
  {
    "codigo": "30024187",
    "descripcion": "FORRO MILAN 105 BEIGE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024188",
    "descripcion": "FORRO MILAN 135 BEIGE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024189",
    "descripcion": "FORRO MILAN 160 BEIGE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024190",
    "descripcion": "FORRO MILAN 200 BEIGE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024191",
    "descripcion": "FORRO MILAN 105 CHOCOLATE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024192",
    "descripcion": "FORRO MILAN 135 CHOCOLATE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024193",
    "descripcion": "FORRO MILAN 105 CHOCOLATE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024194",
    "descripcion": "FORRO MILAN 105 CHOCOLATE RESIFLEX",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024235",
    "descripcion": "FORRO MARTINICA CONFIGURABLE",
    "tiempoMin": 105
  },
  {
    "codigo": "30024240",
    "descripcion": "FORRO SPRING 105 KHALOS AZUL",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30024241",
    "descripcion": "FORRO SPRING 105 KHALOS GRIS",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30024242",
    "descripcion": "FORRO SPRING 105 KHALOS NEGRO",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30024243",
    "descripcion": "FORRO MATISSE 105 KHALOS AZUL",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30024244",
    "descripcion": "FORRO MATISSE 105 KHALOS GRIS",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30024245",
    "descripcion": "FORRO MATISSE 105 KHALOS NEGRO",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30024246",
    "descripcion": "FORRO BENCH 115 KHALOS AZUL",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30024247",
    "descripcion": "FORRO BENCH 115 KHALOS GRIS",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30024248",
    "descripcion": "FORRO BENCH 115 KHALOS NEGRO",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30024249",
    "descripcion": "FORRO MEGA BENCH 145 KHALOS AZUL",
    "tiempoMin": 35
  },
  {
    "codigo": "30024250",
    "descripcion": "FORRO MEGA BENCH 145 KHALOS GRIS",
    "tiempoMin": 35
  },
  {
    "codigo": "30024251",
    "descripcion": "FORRO MEGA BENCH 145 KHALOS NEGRO",
    "tiempoMin": 35
  },
  {
    "codigo": "30024270",
    "descripcion": "FORRO COJIN CILINDRICO KHALOS AZUL",
    "tiempoMin": 8
  },
  {
    "codigo": "30024271",
    "descripcion": "FORRO COJIN CILINDRICO KHALOS GRIS",
    "tiempoMin": 8
  },
  {
    "codigo": "30024272",
    "descripcion": "FORRO COJIN CILINDRICO KHALOS NEGRO",
    "tiempoMin": 8
  },
  {
    "codigo": "30024273",
    "descripcion": "FORRO COJIN CILINDRICO KALOS AZUL",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30024274",
    "descripcion": "FORRO COJIN CILINDRICO KALOS GRIS",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30024275",
    "descripcion": "FORRO COJIN CILINDRICO KALOS NEGRO",
    "tiempoMin": 10.32
  },
  {
    "codigo": "30024279",
    "descripcion": "FORRO PROVENZA VINTAGE NEGRO",
    "tiempoMin": 120
  },
  {
    "codigo": "30024280",
    "descripcion": "FORRO PROVENZA VINTAGE NEGRO MATE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024281",
    "descripcion": "FORRO PROVENZA VINTAGE CAPUCHINO",
    "tiempoMin": 120
  },
  {
    "codigo": "30024282",
    "descripcion": "FORRO PROVENZA VINTAGE HUMO",
    "tiempoMin": 120
  },
  {
    "codigo": "30024283",
    "descripcion": "FORRO PROVENZA VINTAGE BEIGE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024284",
    "descripcion": "FORRO PROVENZA ASTRA CARBON",
    "tiempoMin": 120
  },
  {
    "codigo": "30024285",
    "descripcion": "FORRO PROVENZA ASTRA GRIS",
    "tiempoMin": 120
  },
  {
    "codigo": "30024286",
    "descripcion": "FORRO PROVENZA ASTRA CAF_201_",
    "tiempoMin": 120
  },
  {
    "codigo": "30024287",
    "descripcion": "FORRO PROVENZA ASTRA BEIGE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024288",
    "descripcion": "FORRO PROVENZA EURUS CAF_201_",
    "tiempoMin": 120
  },
  {
    "codigo": "30024289",
    "descripcion": "FORRO PROVENZA EURUS GRIS",
    "tiempoMin": 120
  },
  {
    "codigo": "30024290",
    "descripcion": "FORRO PROVENZA EURUS OC_201_ANO",
    "tiempoMin": 120
  },
  {
    "codigo": "30024291",
    "descripcion": "FORRO PROVENZA EURUS BEIGE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024292",
    "descripcion": "FORRO PROVENZA STONE JASPE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024293",
    "descripcion": "FORRO PROVENZA STONE M_193_RMOL",
    "tiempoMin": 120
  },
  {
    "codigo": "30024294",
    "descripcion": "FORRO PROVENZA EPIC OTO_209_O",
    "tiempoMin": 120
  },
  {
    "codigo": "30024295",
    "descripcion": "FORRO PROVENZA FLANIGAN TANGELO",
    "tiempoMin": 120
  },
  {
    "codigo": "30024296",
    "descripcion": "FORRO PROVENZA FLANIGAN HIBISCUS",
    "tiempoMin": 120
  },
  {
    "codigo": "30024297",
    "descripcion": "FORRO PROVENZA LYRICAL SIERRA",
    "tiempoMin": 120
  },
  {
    "codigo": "30024298",
    "descripcion": "FORRO PROVENZA ARGO TERRACOTA",
    "tiempoMin": 120
  },
  {
    "codigo": "30024299",
    "descripcion": "FORRO PROVENZA ARGO AZUL",
    "tiempoMin": 120
  },
  {
    "codigo": "30024345",
    "descripcion": "TAPA T. FALSO NEGRO PROVENZA",
    "tiempoMin": 7
  },
  {
    "codigo": "30024358",
    "descripcion": "FORRO MASSAGE ZEUS VINT NEGRO MATE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024359",
    "descripcion": "FORRO MASSAGE ZEUS VINTAGE NEGRO",
    "tiempoMin": 180
  },
  {
    "codigo": "30024360",
    "descripcion": "FORRO MASSAGE ZEUS VINTAGE HUMO",
    "tiempoMin": 180
  },
  {
    "codigo": "30024361",
    "descripcion": "FORRO MASSAGE ZEUS VINTAGE BEIGE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024362",
    "descripcion": "FORRO MASSAGE ZEUS VINTAGE CAPUCCINO",
    "tiempoMin": 180
  },
  {
    "codigo": "30024363",
    "descripcion": "FORRO MASSAGE ZEUS ASTRA GRIS",
    "tiempoMin": 180
  },
  {
    "codigo": "30024364",
    "descripcion": "FORRO MASSAGE ZEUS ASTRA CAFE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024365",
    "descripcion": "FORRO MASSAGE ZEUS ASTRA BEIGE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024366",
    "descripcion": "FORRO MASSAGE ZEUS EURUS CAFE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024367",
    "descripcion": "FORRO MASSAGE ZEUS EURUS GRIS",
    "tiempoMin": 180
  },
  {
    "codigo": "30024368",
    "descripcion": "FORRO MASSAGE ZEUS EURUS OCEANO",
    "tiempoMin": 180
  },
  {
    "codigo": "30024369",
    "descripcion": "FORRO MASSAGE ZEUS EURUS BEIGE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024370",
    "descripcion": "FORRO MASSAGE ZEUS STONE JASPE",
    "tiempoMin": 180
  },
  {
    "codigo": "30024371",
    "descripcion": "FORRO MASSAGE ZEUS STONE MARMOL",
    "tiempoMin": 180
  },
  {
    "codigo": "30024372",
    "descripcion": "FORRO MASSAGE ZEUS EPIC OTO_209_O",
    "tiempoMin": 180
  },
  {
    "codigo": "30024426",
    "descripcion": "FORRO MUNICH 3P FLANIGAN TANGELO",
    "tiempoMin": 330
  },
  {
    "codigo": "30024427",
    "descripcion": "FORRO MUNICH 3P FLANIGAN HIBISCUS",
    "tiempoMin": 330
  },
  {
    "codigo": "30024428",
    "descripcion": "FORRO MUNICH 3P LYRICAL SIERRA",
    "tiempoMin": 330
  },
  {
    "codigo": "30024429",
    "descripcion": "FORRO MUNICH 3P ARGO TERRACOTA",
    "tiempoMin": 330
  },
  {
    "codigo": "30024430",
    "descripcion": "FORRO MUNICH 3P ARGO AZUL",
    "tiempoMin": 330
  },
  {
    "codigo": "30024431",
    "descripcion": "FORRO MUNICH 3P VINTAGE NEGRO MATE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024432",
    "descripcion": "FORRO MUNICH 3P VINTAGE CAPUCCINO",
    "tiempoMin": 330
  },
  {
    "codigo": "30024433",
    "descripcion": "FORRO MUNICH 3P VINTAGE HUMO",
    "tiempoMin": 330
  },
  {
    "codigo": "30024434",
    "descripcion": "FORRO MUNICH 3P VINTAGE BEIGE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024435",
    "descripcion": "FORRO MUNICH 3P EURUS OCEANO",
    "tiempoMin": 330
  },
  {
    "codigo": "30024436",
    "descripcion": "FORRO MUNICH 3P EPIC OTO",
    "tiempoMin": 330
  },
  {
    "codigo": "30024437",
    "descripcion": "FORRO MUNICH 3P EURUS BEIGE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024438",
    "descripcion": "FORRO MUNICH 3P STONE JASPE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024439",
    "descripcion": "FORRO MUNICH 3P STONE MARMOL",
    "tiempoMin": 330
  },
  {
    "codigo": "30024440",
    "descripcion": "FORRO MUNICH 3P ASTRA BEIGE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024441",
    "descripcion": "FORRO MUNICH 3P ASTRA CAFE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024442",
    "descripcion": "FORRO MUNICH 3P ASTRA GRIS",
    "tiempoMin": 330
  },
  {
    "codigo": "30024443",
    "descripcion": "FORRO MUNICH 3P VINTAGE NEGRO",
    "tiempoMin": 330
  },
  {
    "codigo": "30024444",
    "descripcion": "FORRO MUNICH 3P EURUS CAFE",
    "tiempoMin": 330
  },
  {
    "codigo": "30024445",
    "descripcion": "FORRO MUNICH 3P EURUS GRIS",
    "tiempoMin": 330
  },
  {
    "codigo": "30024457",
    "descripcion": "FORRO PUFF MUNICH EURUS BEIGE",
    "tiempoMin": 90
  },
  {
    "codigo": "30024458",
    "descripcion": "FORRO PUFF MUNICH STONE JASPE",
    "tiempoMin": 90
  },
  {
    "codigo": "30024459",
    "descripcion": "FORRO PUFF MUNICH STONE MARMOL",
    "tiempoMin": 90
  },
  {
    "codigo": "30024460",
    "descripcion": "FORRO PUFF MUNICH ASTRA BEIGE",
    "tiempoMin": 90
  },
  {
    "codigo": "30024461",
    "descripcion": "FORRO PUFF MUNICH ASTRA CAFE",
    "tiempoMin": 90
  },
  {
    "codigo": "30024462",
    "descripcion": "FORRO PUFF MUNICH ASTRA GRIS",
    "tiempoMin": 90
  },
  {
    "codigo": "30024463",
    "descripcion": "FORRO PUFF MUNICH VINTAGE NEGRO",
    "tiempoMin": 90
  },
  {
    "codigo": "30024464",
    "descripcion": "FORRO PUFF MUNICH EURUS CAFE",
    "tiempoMin": 90
  },
  {
    "codigo": "30024465",
    "descripcion": "FORRO PUFF MUNICH EURUS GRIS",
    "tiempoMin": 90
  },
  {
    "codigo": "30024466",
    "descripcion": "FORRO AUXILIAR MUNICH FLANIGAN TANGELO",
    "tiempoMin": 100
  },
  {
    "codigo": "30024467",
    "descripcion": "FORRO AUXILIAR MUNICH FLANIGAN HIBISCUS",
    "tiempoMin": 100
  },
  {
    "codigo": "30024468",
    "descripcion": "FORRO AUXILIAR MUNICH LYRICAL SIERRA",
    "tiempoMin": 100
  },
  {
    "codigo": "30024469",
    "descripcion": "FORRO AUXILIAR MUNICH ARGO TERRACOTA",
    "tiempoMin": 100
  },
  {
    "codigo": "30024470",
    "descripcion": "FORRO AUXILIAR MUNICH ARGO AZUL",
    "tiempoMin": 100
  },
  {
    "codigo": "30024471",
    "descripcion": "FORRO AUXILIAR MUNICH VINTAGE NEGRO MATE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024472",
    "descripcion": "FORRO AUXILIAR MUNICH VINTAGE CAPUCCINO",
    "tiempoMin": 100
  },
  {
    "codigo": "30024473",
    "descripcion": "FORRO AUXILIAR MUNICH VINTAGE HUMO",
    "tiempoMin": 100
  },
  {
    "codigo": "30024474",
    "descripcion": "FORRO AUXILIAR MUNICH VINTAGE BEIGE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024475",
    "descripcion": "FORRO AUXILIAR MUNICH EURUS OCEANO",
    "tiempoMin": 100
  },
  {
    "codigo": "30024476",
    "descripcion": "FORRO AUXILIAR MUNICH EPIC OTONO",
    "tiempoMin": 100
  },
  {
    "codigo": "30024477",
    "descripcion": "FORRO AUXILIAR MUNICH EURUS BEIGE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024478",
    "descripcion": "FORRO AUXILIAR MUNICH STONE JASPE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024479",
    "descripcion": "FORRO AUXILIAR MUNICH STONE MARMOL",
    "tiempoMin": 100
  },
  {
    "codigo": "30024480",
    "descripcion": "FORRO AUXILIAR MUNICH ASTRA BEIGE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024481",
    "descripcion": "FORRO AUXILIAR MUNICH ASTRA CAFE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024482",
    "descripcion": "FORRO AUXILIAR MUNICH ASTRA GRIS",
    "tiempoMin": 100
  },
  {
    "codigo": "30024483",
    "descripcion": "FORRO AUXILIAR MUNICH VINTAGE NEGRO",
    "tiempoMin": 100
  },
  {
    "codigo": "30024484",
    "descripcion": "FORRO AUXILIAR MUNICH EURUS CAFE",
    "tiempoMin": 100
  },
  {
    "codigo": "30024485",
    "descripcion": "FORRO AUXILIAR MUNICH EURUS GRIS",
    "tiempoMin": 100
  },
  {
    "codigo": "30024557",
    "descripcion": "FORRO CAMA MONTESSORI 90 MOSTAZA",
    "tiempoMin": 120
  },
  {
    "codigo": "30024558",
    "descripcion": "FORRO CAMA MONTESSORI 90 AZUL",
    "tiempoMin": 120
  },
  {
    "codigo": "30024559",
    "descripcion": "FORRO CAMA MONTESSORI 90 ROSA",
    "tiempoMin": 120
  },
  {
    "codigo": "30024560",
    "descripcion": "FORRO CAMA MONTESSORI 90 ASTRA BEIGE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024561",
    "descripcion": "FORRO CAMA MONTESSORI 90 ASTRA GRIS",
    "tiempoMin": 120
  },
  {
    "codigo": "30024562",
    "descripcion": "FORRO CAMA MONTESSORI 90 ASTRA CAFE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024563",
    "descripcion": "FORRO CAMA MONTESSORI 90 EURUS GRIS",
    "tiempoMin": 120
  },
  {
    "codigo": "30024564",
    "descripcion": "FORRO CAMA MONTESSORI 90 EURUS OCEANO",
    "tiempoMin": 120
  },
  {
    "codigo": "30024565",
    "descripcion": "FORRO CAMA MONTESSORI 90 EURUS CAFE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024566",
    "descripcion": "FORRO CAMA MONTESSORI 90 EURUS BEIGE",
    "tiempoMin": 120
  },
  {
    "codigo": "30024567",
    "descripcion": "FORRO CAMA MONTESSORI 105 MOSTAZA",
    "tiempoMin": 130
  },
  {
    "codigo": "30024568",
    "descripcion": "FORRO CAMA MONTESSORI 105 AZUL",
    "tiempoMin": 130
  },
  {
    "codigo": "30024569",
    "descripcion": "FORRO CAMA MONTESSORI 105 ROSA",
    "tiempoMin": 130
  },
  {
    "codigo": "30024570",
    "descripcion": "FORRO CAMA MONTESSORI 105 ASTRA BEIGE",
    "tiempoMin": 130
  },
  {
    "codigo": "30024571",
    "descripcion": "FORRO CAMA MONTESSORI 105 ASTRA GRIS",
    "tiempoMin": 130
  },
  {
    "codigo": "30024572",
    "descripcion": "FORRO CAMA MONTESSORI 105 ASTRA CAFE",
    "tiempoMin": 130
  },
  {
    "codigo": "30024573",
    "descripcion": "FORRO CAMA MONTESSORI 105 EURUS GRIS",
    "tiempoMin": 130
  },
  {
    "codigo": "30024574",
    "descripcion": "FORRO CAMA MONTESSORI 105 EURUS OCEANO",
    "tiempoMin": 130
  },
  {
    "codigo": "30024575",
    "descripcion": "FORRO CAMA MONTESSORI 105 EURUS CAFE",
    "tiempoMin": 130
  },
  {
    "codigo": "30024576",
    "descripcion": "FORRO CAMA MONTESSORI 105 EURUS BEIGE",
    "tiempoMin": 130
  },
  {
    "codigo": "30024577",
    "descripcion": "TAPA T. FALSO NEGRO MONTESORI 90",
    "tiempoMin": 4
  },
  {
    "codigo": "30024578",
    "descripcion": "TAPA T. ANTIDESLIZANTE MONTESORI 90",
    "tiempoMin": 3
  },
  {
    "codigo": "30024579",
    "descripcion": "TAPA T. FALSO NEGRO MONTESORI 105",
    "tiempoMin": 4
  },
  {
    "codigo": "30024580",
    "descripcion": "TAPA T. ANTIDESLIZANTE MONTESORI 105",
    "tiempoMin": 3
  },
  {
    "codigo": "30024635",
    "descripcion": "FORRO MUNICHBOX EURUS BEIGE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30024636",
    "descripcion": "FORRO MUNICH BOX EURUS CAFE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30024637",
    "descripcion": "FORRO MUNICH BOX EURUS GRIS",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30024638",
    "descripcion": "FORRO MUNICH BOX EURUS OCEANO",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30024639",
    "descripcion": "FORRO FOAM BOX 112 EURUS BEIGE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30024640",
    "descripcion": "FORRO FOAM BOX 112 EURUS CAFE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30024641",
    "descripcion": "FORRO FOAM BOX 112 EURUS GRIS",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30024642",
    "descripcion": "FORRO FOAM BOX 112 EURUS OCEANO",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30024666",
    "descripcion": "FORRO COJIN MUNICH BOX",
    "tiempoMin": 5
  },
  {
    "codigo": "30024667",
    "descripcion": "FORRO COJIN FOAM BOX",
    "tiempoMin": 5
  },
  {
    "codigo": "30024867",
    "descripcion": "FORRO CAB BARU 145X50 TAPIZ BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024868",
    "descripcion": "FORRO CAB BERLIN 170X50 TAPIZ BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024869",
    "descripcion": "FORRO CAB CRETA 170X50 TAPIZ BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30024912",
    "descripcion": "FORRO OTTOMAN AH 193X200",
    "tiempoMin": 240
  },
  {
    "codigo": "30024958",
    "descripcion": "FORRO OTTOMAN AH 152x200",
    "tiempoMin": 240
  },
  {
    "codigo": "30024959",
    "descripcion": "FORRO OTTOMAN AH 193X152",
    "tiempoMin": 240
  },
  {
    "codigo": "30025038",
    "descripcion": "FORRO IBIZA 145 ASTRA BEIGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025039",
    "descripcion": "FORRO IBIZA 145 ASTRA CAF_",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025040",
    "descripcion": "FORRO IBIZA 145 ASTRA CARB",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025041",
    "descripcion": "FORRO IBIZA 145 ASTRA GRIS",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025042",
    "descripcion": "FORRO IBIZA 145 EURUS CAF_",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025043",
    "descripcion": "FORRO IBIZA 145 EURUS GRIS",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025044",
    "descripcion": "FORRO IBIZA 145 EURUS OC_ANO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025045",
    "descripcion": "FORRO IBIZA 145 EURUS BEIGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025046",
    "descripcion": "FORRO IBIZA 145 VINTAGE NEGRO MATE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025047",
    "descripcion": "FORRO IBIZA 145 VINTAGE NEGRO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025048",
    "descripcion": "FORRO IBIZA 145 VINTAGE CAPUCCINO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025049",
    "descripcion": "FORRO IBIZA 145 VINTAGE HUMO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025050",
    "descripcion": "FORRO IBIZA 145 VINTAGE BEIGE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025052",
    "descripcion": "FORRO IBIZA 145 FLANNIGAN TANGELO",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025053",
    "descripcion": "FORRO IBIZA 145 ARGO TERRACOTA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30025054",
    "descripcion": "FORRO IBIZA 170 ASTRA BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30025055",
    "descripcion": "FORRO IBIZA 170 ASTRA CAF_",
    "tiempoMin": 8
  },
  {
    "codigo": "30025056",
    "descripcion": "FORRO IBIZA 170 ASTRA CARB_",
    "tiempoMin": 8
  },
  {
    "codigo": "30025057",
    "descripcion": "FORRO IBIZA 170 ASTRA GRIS",
    "tiempoMin": 8
  },
  {
    "codigo": "30025058",
    "descripcion": "FORRO IBIZA 170 EURUS CAF_",
    "tiempoMin": 8
  },
  {
    "codigo": "30025059",
    "descripcion": "FORRO IBIZA 170 EURUS GRIS",
    "tiempoMin": 8
  },
  {
    "codigo": "30025060",
    "descripcion": "FORRO IBIZA 170 EURUS OC_ANO",
    "tiempoMin": 8
  },
  {
    "codigo": "30025061",
    "descripcion": "FORRO IBIZA 170 EURUS BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30025062",
    "descripcion": "FORRO IBIZA 170 VINTAGE NEGRO MATE",
    "tiempoMin": 8
  },
  {
    "codigo": "30025063",
    "descripcion": "FORRO IBIZA 170 VINTAGE NEGRO",
    "tiempoMin": 8
  },
  {
    "codigo": "30025064",
    "descripcion": "FORRO IBIZA 170 VINTAGE CAPUCCINO",
    "tiempoMin": 8
  },
  {
    "codigo": "30025065",
    "descripcion": "FORRO IBIZA 170 VINTAGE HUMO",
    "tiempoMin": 8
  },
  {
    "codigo": "30025066",
    "descripcion": "FORRO IBIZA 170 VINTAGE BEIGE",
    "tiempoMin": 8
  },
  {
    "codigo": "30025068",
    "descripcion": "FORRO IBIZA 170 FLANNIGAN TANGELO",
    "tiempoMin": 8
  },
  {
    "codigo": "30025069",
    "descripcion": "FORRO IBIZA 170 ARGO TERRACOTA",
    "tiempoMin": 8
  },
  {
    "codigo": "30025070",
    "descripcion": "FORRO IBIZA 210 ASTRA BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025071",
    "descripcion": "FORRO IBIZA 210 ASTRA CAF_",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025072",
    "descripcion": "FORRO IBIZA 210 ASTRA CARB_",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025073",
    "descripcion": "FORRO IBIZA 210 ASTRA GRIS",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025074",
    "descripcion": "FORRO IBIZA 210 EURUS CAF_",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025075",
    "descripcion": "FORRO IBIZA 210 EURUS GRIS",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025076",
    "descripcion": "FORRO IBIZA 210 EURUS OC_ANO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025077",
    "descripcion": "FORRO IBIZA 210 EURUS BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025078",
    "descripcion": "FORRO IBIZA 210 VINTAGE NEGRO MATE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025079",
    "descripcion": "FORRO IBIZA 210 VINTAGE NEGRO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025080",
    "descripcion": "FORRO IBIZA 210 VINTAGE CAPUCCINO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025081",
    "descripcion": "FORRO IBIZA 210 VINTAGE HUMO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025082",
    "descripcion": "FORRO IBIZA 210 VINTAGE BEIGE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025084",
    "descripcion": "FORRO IBIZA 210 FLANNIGAN TANGELO",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025085",
    "descripcion": "FORRO IBIZA 210 ARGO TERRACOTA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30025225",
    "descripcion": "FORRO CAMA PARIS 105 ARGO TERRACOTA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025226",
    "descripcion": "FORRO CAMA PARIS 105 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025227",
    "descripcion": "FORRO CAMA PARIS 105 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025228",
    "descripcion": "FORRO CAMA PARIS 105 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025229",
    "descripcion": "FORRO CAMA PARIS 105 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025230",
    "descripcion": "FORRO CAMA PARIS 105 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025231",
    "descripcion": "FORRO CAMA PARIS 105 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025232",
    "descripcion": "FORRO CAMA PARIS 105 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025233",
    "descripcion": "FORRO CAMA PARIS 105 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025234",
    "descripcion": "FORRO CAMA PARIS 105 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025235",
    "descripcion": "FORRO CAMA PARIS 105 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025236",
    "descripcion": "FORRO CAMA PARIS 105 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025237",
    "descripcion": "FORRO CAMA PARIS 105 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025238",
    "descripcion": "FORRO CAMA PARIS 105 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025239",
    "descripcion": "FORRO CAMA PARIS 105 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025240",
    "descripcion": "FORRO CAMA PARIS 135 ARGO TERRACOTA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025241",
    "descripcion": "FORRO CAMA PARIS 135 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025242",
    "descripcion": "FORRO CAMA PARIS 135 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025243",
    "descripcion": "FORRO CAMA PARIS 135 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025244",
    "descripcion": "FORRO CAMA PARIS 135 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025245",
    "descripcion": "FORRO CAMA PARIS 135 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025246",
    "descripcion": "FORRO CAMA PARIS 135 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025247",
    "descripcion": "FORRO CAMA PARIS 135 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025248",
    "descripcion": "FORRO CAMA PARIS 135 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025249",
    "descripcion": "FORRO CAMA PARIS 135 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025250",
    "descripcion": "FORRO CAMA PARIS 135 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025251",
    "descripcion": "FORRO CAMA PARIS 135 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025252",
    "descripcion": "FORRO CAMA PARIS 135 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025253",
    "descripcion": "FORRO CAMA PARIS 135 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025254",
    "descripcion": "FORRO CAMA PARIS 135 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025255",
    "descripcion": "FORRO CAMA PARIS 160 ARGO TERRACOTA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025256",
    "descripcion": "FORRO CAMA PARIS 160 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025257",
    "descripcion": "FORRO CAMA PARIS 160 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025258",
    "descripcion": "FORRO CAMA PARIS 160 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025259",
    "descripcion": "FORRO CAMA PARIS 160 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025260",
    "descripcion": "FORRO CAMA PARIS 160 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025261",
    "descripcion": "FORRO CAMA PARIS 160 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025262",
    "descripcion": "FORRO CAMA PARIS 160 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025263",
    "descripcion": "FORRO CAMA PARIS 160 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025264",
    "descripcion": "FORRO CAMA PARIS 160 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025265",
    "descripcion": "FORRO CAMA PARIS 160 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025266",
    "descripcion": "FORRO CAMA PARIS 160 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025267",
    "descripcion": "FORRO CAMA PARIS 160 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025268",
    "descripcion": "FORRO CAMA PARIS 160 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025269",
    "descripcion": "FORRO CAMA PARIS 160 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025270",
    "descripcion": "FORRO CAMA PARIS 200 ARGO TERRACOTA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025271",
    "descripcion": "FORRO CAMA PARIS 200 ASTRA BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025272",
    "descripcion": "FORRO CAMA PARIS 200 ASTRA CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025273",
    "descripcion": "FORRO CAMA PARIS 200 ASTRA CARBON",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025274",
    "descripcion": "FORRO CAMA PARIS 200 ASTRA GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025275",
    "descripcion": "FORRO CAMA PARIS 200 EURUS BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025276",
    "descripcion": "FORRO CAMA PARIS 200 EURUS CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025277",
    "descripcion": "FORRO CAMA PARIS 200 EURUS GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025278",
    "descripcion": "FORRO CAMA PARIS 200 EURUS OCEANO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025279",
    "descripcion": "FORRO CAMA PARIS 200 FLANNIGA TANGELO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025280",
    "descripcion": "FORRO CAMA PARIS 200 VINTAGE BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025281",
    "descripcion": "FORRO CAMA PARIS 200 VINTAGE CAPUCCINO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025282",
    "descripcion": "FORRO CAMA PARIS 200 VINTAGE HUMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025283",
    "descripcion": "FORRO CAMA PARIS 200 VINTAGE NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025284",
    "descripcion": "FORRO CAMA PARIS 200 VINTAGE NEGR MATE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30025747",
    "descripcion": "FORRO MANCHESTER 105 ELEMENTA AIRE",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30025748",
    "descripcion": "FORRO MANCHESTER 105 ELEMENTA BRUMA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30025749",
    "descripcion": "FORRO MANCHESTER 105 ELEMENTA AGUA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30025750",
    "descripcion": "FORRO MANCHESTER 105 ELEMENTA TIERRA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30025751",
    "descripcion": "FORRO MANCHESTER 105 ELEMENTA ARENA",
    "tiempoMin": 74.47
  },
  {
    "codigo": "30025779",
    "descripcion": "FORRO OPORTO 135 ELEMENTA AIRE",
    "tiempoMin": 210
  },
  {
    "codigo": "30025780",
    "descripcion": "FORRO OPORTO 135 ELEMENTA BRUMA",
    "tiempoMin": 210
  },
  {
    "codigo": "30025781",
    "descripcion": "FORRO OPORTO 135 ELEMENTA AGUA",
    "tiempoMin": 210
  },
  {
    "codigo": "30025782",
    "descripcion": "FORRO OPORTO 135 ELEMENTA TIERRA",
    "tiempoMin": 210
  },
  {
    "codigo": "30025783",
    "descripcion": "FORRO OPORTO 135 ELEMENTA ARENA",
    "tiempoMin": 210
  },
  {
    "codigo": "30025789",
    "descripcion": "FORRO SPRING 105 ELEMENTA AIRE",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30025790",
    "descripcion": "FORRO SPRING 105 ELEMENTA BRUMA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30025791",
    "descripcion": "FORRO SPRING 105 ELEMENTA AGUA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30025792",
    "descripcion": "FORRO SPRING 105 ELEMENTA TIERRA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30025793",
    "descripcion": "FORRO SPRING 105 ELEMENTA ARENA",
    "tiempoMin": 32.4
  },
  {
    "codigo": "30025804",
    "descripcion": "FORRO MATISSE 105 ELEMENTA AIRE",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30025805",
    "descripcion": "FORRO MATISSE 105 ELEMENTA BRUMA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30025806",
    "descripcion": "FORRO MATISSE 105 ELEMENTA AGUA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30025807",
    "descripcion": "FORRO MATISSE 105 ELEMENTA TIERRA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30025808",
    "descripcion": "FORRO MATISSE 105 ELEMENTA ARENA",
    "tiempoMin": 61.15
  },
  {
    "codigo": "30025819",
    "descripcion": "FORRO FOAM 070 ELEMENTA AIRE",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30025820",
    "descripcion": "FORRO FOAM 70 ELEMENTA BRUMA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30025821",
    "descripcion": "FORRO FOAM 70 ELEMENTA AGUA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30025822",
    "descripcion": "FORRO FOAM 70 ELEMENTA TIERRA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30025823",
    "descripcion": "FORRO FOAM 70 ELEMENTA ARENA",
    "tiempoMin": 37.71
  },
  {
    "codigo": "30025824",
    "descripcion": "FORRO FOAM 105 ELEMENTA AIRE",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30025825",
    "descripcion": "FORRO FOAM 105 ELEMENTA BRUMA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30025826",
    "descripcion": "FORRO FOAM 105 ELEMENTA AGUA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30025827",
    "descripcion": "FORRO FOAM 105 ELEMENTA TIERRA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30025828",
    "descripcion": "FORRO FOAM 105 ELEMENTA ARENA",
    "tiempoMin": 43.36
  },
  {
    "codigo": "30025829",
    "descripcion": "FORRO FOAM 135 ELEMENTA AIRE",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30025830",
    "descripcion": "FORRO FOAM 135 ELEMENTA BRUMA",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30025831",
    "descripcion": "FORRO FOAM 135 ELEMENTA AGUA",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30025832",
    "descripcion": "FORRO FOAM 135 ELEMENTA TIERRA",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30025833",
    "descripcion": "FORRO FOAM 135 ELEMENTA ARENA",
    "tiempoMin": 53.46
  },
  {
    "codigo": "30025849",
    "descripcion": "FORRO PROVENZA 105 ELEMENTA AIRE",
    "tiempoMin": 120
  },
  {
    "codigo": "30025850",
    "descripcion": "FORRO PROVENZA 105 ELEMENTA BRUMA",
    "tiempoMin": 120
  },
  {
    "codigo": "30025851",
    "descripcion": "FORRO PROVENZA 105 ELEMENTA AGUA",
    "tiempoMin": 120
  },
  {
    "codigo": "30025852",
    "descripcion": "FORRO PROVENZA 105 ELEMENTA TIERRA",
    "tiempoMin": 120
  },
  {
    "codigo": "30025853",
    "descripcion": "FORRO PROVENZA 105 ELEMENTA ARENA",
    "tiempoMin": 120
  },
  {
    "codigo": "30025864",
    "descripcion": "FORRO MIRAGE 105 ELEMENTA AIRE",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30025865",
    "descripcion": "FORRO MIRAGE 105 ELEMENTA BRUMA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30025866",
    "descripcion": "FORRO MIRAGE 105 ELEMENTA AGUA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30025867",
    "descripcion": "FORRO MIRAGE 105 ELEMENTA TIERRA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30025868",
    "descripcion": "FORRO MIRAGE 105 ELEMENTA ARENA",
    "tiempoMin": 118.89
  },
  {
    "codigo": "30025869",
    "descripcion": "FORRO MIRAGE 120 ELEMENTA AIRE",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30025870",
    "descripcion": "FORRO MIRAGE 120 ELEMENTA BRUMA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30025871",
    "descripcion": "FORRO MIRAGE 120 ELEMENTA AGUA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30025872",
    "descripcion": "FORRO MIRAGE 120 ELEMENTA TIERRA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30025873",
    "descripcion": "FORRO MIRAGE 120 ELEMENTA ARENA",
    "tiempoMin": 139.23
  },
  {
    "codigo": "30025874",
    "descripcion": "FORRO MIRAGE 135 ELEMENTA AIRE",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30025875",
    "descripcion": "FORRO MIRAGE 135 ELEMENTA BRUMA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30025876",
    "descripcion": "FORRO MIRAGE 135 ELEMENTA AGUA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30025877",
    "descripcion": "FORRO MIRAGE 135 ELEMENTA TIERRA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30025878",
    "descripcion": "FORRO MIRAGE 135 ELEMENTA ARENA",
    "tiempoMin": 152.86
  },
  {
    "codigo": "30025894",
    "descripcion": "FORRO MALIBU 105 ELEMENTA AIRE",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30025895",
    "descripcion": "FORRO MALIBU 105 ELEMENTA BRUMA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30025896",
    "descripcion": "FORRO MALIBU 105 ELEMENTA AGUA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30025897",
    "descripcion": "FORRO MALIBU 105 ELEMENTA TIERRA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30025898",
    "descripcion": "FORRO MALIBU 105 ELEMENTA ARENA",
    "tiempoMin": 57.68
  },
  {
    "codigo": "30025899",
    "descripcion": "FORRO MALIBU 135 ELEMENTA AIRE",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30025900",
    "descripcion": "FORRO MALIBU 135 ELEMENTA BRUMA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30025901",
    "descripcion": "FORRO MALIBU 135 ELEMENTA AGUA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30025902",
    "descripcion": "FORRO MALIBU 135 ELEMENTA TIERRA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30025903",
    "descripcion": "FORRO MALIBU 135 ELEMENTA ARENA",
    "tiempoMin": 70.83
  },
  {
    "codigo": "30025914",
    "descripcion": "FORRO MARTINICA 105 ELEMENTA AIRE",
    "tiempoMin": 105
  },
  {
    "codigo": "30025915",
    "descripcion": "FORRO MARTINICA 105 ELEMENTA BRUMA",
    "tiempoMin": 105
  },
  {
    "codigo": "30025916",
    "descripcion": "FORRO MARTINICA 105 ELEMENTA AGUA",
    "tiempoMin": 105
  },
  {
    "codigo": "30025917",
    "descripcion": "FORRO MARTINICA 105 ELEMENTA TIERRA",
    "tiempoMin": 105
  },
  {
    "codigo": "30025918",
    "descripcion": "FORRO MARTINICA 105 ELEMENTA ARENA",
    "tiempoMin": 105
  },
  {
    "codigo": "30026067",
    "descripcion": "FORRO AUXILIAR MUNICH ELEMENTA AGUA",
    "tiempoMin": 100
  },
  {
    "codigo": "30026068",
    "descripcion": "FORRO AUXILIAR MUNICH ELEMENTA TIERRA",
    "tiempoMin": 100
  },
  {
    "codigo": "30026069",
    "descripcion": "FORRO AUXILIAR MUNICH ELEMENTA ARENA",
    "tiempoMin": 100
  },
  {
    "codigo": "30026070",
    "descripcion": "FORRO PUFF MUNICH ELEMENTA AIRE",
    "tiempoMin": 90
  },
  {
    "codigo": "30026071",
    "descripcion": "FORRO PUFF MUNICH ELEMENTA BRUMA",
    "tiempoMin": 90
  },
  {
    "codigo": "30026072",
    "descripcion": "FORRO PUFF MUNICH ELEMENTA AGUA",
    "tiempoMin": 90
  },
  {
    "codigo": "30026073",
    "descripcion": "FORRO PUFF MUNICH ELEMENTA TIERRA",
    "tiempoMin": 90
  },
  {
    "codigo": "30026074",
    "descripcion": "FORRO PUFF MUNICH ELEMENTA ARENA",
    "tiempoMin": 90
  },
  {
    "codigo": "30026107",
    "descripcion": "FORRO GRAN BARU 119 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026108",
    "descripcion": "FORRO GRAN BARU 119 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026109",
    "descripcion": "FORRO GRAN BARU 119 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026110",
    "descripcion": "FORRO GRAN BARU 119 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026111",
    "descripcion": "FORRO GRAN BARU 119 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026112",
    "descripcion": "FORRO GRAN BARU 149 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026113",
    "descripcion": "FORRO GRAN BARU 149 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026114",
    "descripcion": "FORRO GRAN BARU 149 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026115",
    "descripcion": "FORRO GRAN BARU 149 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026116",
    "descripcion": "FORRO GRAN BARU 149 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026117",
    "descripcion": "FORRO GRAN BARU 174 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026118",
    "descripcion": "FORRO GRAN BARU 174 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026119",
    "descripcion": "FORRO GRAN BARU 174 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026120",
    "descripcion": "FORRO GRAN BARU 174 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026121",
    "descripcion": "FORRO GRAN BARU 174 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026122",
    "descripcion": "FORRO GRAN BARU 214 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026123",
    "descripcion": "FORRO GRAN BARU 214 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026124",
    "descripcion": "FORRO GRAN BARU 214 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026125",
    "descripcion": "FORRO GRAN BARU 214 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026126",
    "descripcion": "FORRO GRAN BARU 214 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026127",
    "descripcion": "FORRO BASE GRAND 119 ELEMENTA AIRE",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30026128",
    "descripcion": "FORRO BASE GRAND 119 ELEMENTA BRUMA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30026129",
    "descripcion": "FORRO BASE GRAND 119 ELEMENTA AGUA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30026130",
    "descripcion": "FORRO BASE GRAND 119 ELEMENTA TIERRA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30026131",
    "descripcion": "FORRO BASE GRAND 119 ELEMENTA ARENA",
    "tiempoMin": 5.22
  },
  {
    "codigo": "30026132",
    "descripcion": "FORRO BASE GRAND 149 ELEMENTA AIRE",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30026133",
    "descripcion": "FORRO BASE GRAND 149 ELEMENTA BRUMA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30026134",
    "descripcion": "FORRO BASE GRAND 149 ELEMENTA AGUA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30026135",
    "descripcion": "FORRO BASE GRAND 149 ELEMENTA TIERRA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30026136",
    "descripcion": "FORRO BASE GRAND 149 ELEMENTA ARENA",
    "tiempoMin": 6.48
  },
  {
    "codigo": "30026137",
    "descripcion": "FORRO BASE GRAND 174 ELEMENTA AIRE",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30026138",
    "descripcion": "FORRO BASE GRAND 174 ELEMENTA BRUMA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30026139",
    "descripcion": "FORRO BASE GRAND 174 ELEMENTA AGUA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30026140",
    "descripcion": "FORRO BASE GRAND 174 ELEMENTA TIERRA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30026141",
    "descripcion": "FORRO BASE GRAND 174 ELEMENTA ARENA",
    "tiempoMin": 7.62
  },
  {
    "codigo": "30026142",
    "descripcion": "FORRO BASE GRAND 214 ELEMENTA AIRE",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30026143",
    "descripcion": "FORRO BASE GRAND 214 ELEMENTA BRUMA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30026144",
    "descripcion": "FORRO BASE GRAND 214 ELEMENTA AGUA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30026145",
    "descripcion": "FORRO BASE GRAND 214 ELEMENTA TIERRA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30026146",
    "descripcion": "FORRO BASE GRAND 214 ELEMENTA ARENA",
    "tiempoMin": 9.36
  },
  {
    "codigo": "30026207",
    "descripcion": "FORRO GRAN BERLIN 119 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026208",
    "descripcion": "FORRO GRAN BERLIN 119 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026209",
    "descripcion": "FORRO GRAN BERLIN 119 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026210",
    "descripcion": "FORRO GRAN BERLIN 119 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026211",
    "descripcion": "FORRO GRAN BERLIN 119 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026212",
    "descripcion": "FORRO GRAN BERLIN 149 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026213",
    "descripcion": "FORRO GRAN BERLIN 149 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026214",
    "descripcion": "FORRO GRAN BERLIN 149 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026215",
    "descripcion": "FORRO GRAN BERLIN 149 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026216",
    "descripcion": "FORRO GRAN BERLIN 149 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026217",
    "descripcion": "FORRO GRAN BERLIN 174 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026218",
    "descripcion": "FORRO GRAN BERLIN 174 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026219",
    "descripcion": "FORRO GRAN BERLIN 174 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026220",
    "descripcion": "FORRO GRAN BERLIN 174 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026221",
    "descripcion": "FORRO GRAN BERLIN 174 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026222",
    "descripcion": "FORRO GRAN BERLIN 214 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026223",
    "descripcion": "FORRO GRAN BERLIN 214 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026224",
    "descripcion": "FORRO GRAN BERLIN 214 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026225",
    "descripcion": "FORRO GRAN BERLIN 214 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026226",
    "descripcion": "FORRO GRAN BERLIN 214 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026247",
    "descripcion": "FORRO CAMA PRAGA 115 ELEMENTA AIRE",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30026248",
    "descripcion": "FORRO CAMA PRAGA 115 ELEMENTA BRUMA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30026249",
    "descripcion": "FORRO CAMA PRAGA 115 ELEMENTA AGUA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30026250",
    "descripcion": "FORRO CAMA PRAGA 115 ELEMENTA TIERRA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30026251",
    "descripcion": "FORRO CAMA PRAGA 115 ELEMENTA ARENA",
    "tiempoMin": 7.05
  },
  {
    "codigo": "30026252",
    "descripcion": "FORRO CAMA PRAGA 145 ELEMENTA AIRE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026253",
    "descripcion": "FORRO CAMA PRAGA 145 ELEMENTA BRUMA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026254",
    "descripcion": "FORRO CAMA PRAGA 145 ELEMENTA AGUA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026255",
    "descripcion": "FORRO CAMA PRAGA 145 ELEMENTA TIERRA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026256",
    "descripcion": "FORRO CAMA PRAGA 145 ELEMENTA ARENA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026257",
    "descripcion": "FORRO CAMA PRAGA 170 ELEMENTA AIRE",
    "tiempoMin": 8
  },
  {
    "codigo": "30026258",
    "descripcion": "FORRO CAMA PRAGA 170 ELEMENTA BRUMA",
    "tiempoMin": 8
  },
  {
    "codigo": "30026259",
    "descripcion": "FORRO CAMA PRAGA 170 ELEMENTA AGUA",
    "tiempoMin": 8
  },
  {
    "codigo": "30026260",
    "descripcion": "FORRO CAMA PRAGA 170 ELEMENTA TIERRA",
    "tiempoMin": 8
  },
  {
    "codigo": "30026261",
    "descripcion": "FORRO CAMA PRAGA 170 ELEMENTA ARENA",
    "tiempoMin": 8
  },
  {
    "codigo": "30026262",
    "descripcion": "FORRO CAMA PRAGA 200 ELEMENTA AIRE",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30026263",
    "descripcion": "FORRO CAMA PRAGA 200 ELEMENTA BRUMA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30026264",
    "descripcion": "FORRO CAMA PRAGA 200 ELEMENTA AGUA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30026265",
    "descripcion": "FORRO CAMA PRAGA 200 ELEMENTA TIERRA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30026266",
    "descripcion": "FORRO CAMA PRAGA 200 ELEMENTA ARENA",
    "tiempoMin": 8.55
  },
  {
    "codigo": "30026308",
    "descripcion": "FORRO CAMA LONDRES 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026309",
    "descripcion": "FORRO CAMA LONDRES 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026310",
    "descripcion": "FORRO CAMA LONDRES 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026311",
    "descripcion": "FORRO CAMA LONDRES 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026312",
    "descripcion": "FORRO CAMA LONDRES 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026313",
    "descripcion": "FORRO CAMA LONDRES 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026314",
    "descripcion": "FORRO CAMA LONDRES 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026315",
    "descripcion": "FORRO CAMA LONDRES 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026316",
    "descripcion": "FORRO CAMA LONDRES 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026317",
    "descripcion": "FORRO CAMA LONDRES 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026318",
    "descripcion": "FORRO CAMA LONDRES 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026319",
    "descripcion": "FORRO CAMA LONDRES 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026320",
    "descripcion": "FORRO CAMA LONDRES 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026321",
    "descripcion": "FORRO CAMA LONDRES 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026322",
    "descripcion": "FORRO CAMA LONDRES 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026323",
    "descripcion": "FORRO CAMA LONDRES 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026324",
    "descripcion": "FORRO CAMA LONDRES 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026325",
    "descripcion": "FORRO CAMA LONDRES 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026326",
    "descripcion": "FORRO CAMA LONDRES 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026327",
    "descripcion": "FORRO CAMA LONDRES 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026388",
    "descripcion": "FORRO CAMA BOSTON 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026389",
    "descripcion": "FORRO CAMA BOSTON 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026390",
    "descripcion": "FORRO CAMA BOSTON 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026391",
    "descripcion": "FORRO CAMA BOSTON 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026392",
    "descripcion": "FORRO CAMA BOSTON 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026393",
    "descripcion": "FORRO CAMA BOSTON 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026394",
    "descripcion": "FORRO CAMA BOSTON 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026395",
    "descripcion": "FORRO CAMA BOSTON 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026396",
    "descripcion": "FORRO CAMA BOSTON 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026397",
    "descripcion": "FORRO CAMA BOSTON 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026398",
    "descripcion": "FORRO CAMA BOSTON 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026399",
    "descripcion": "FORRO CAMA BOSTON 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026400",
    "descripcion": "FORRO CAMA BOSTON 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026401",
    "descripcion": "FORRO CAMA BOSTON 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026402",
    "descripcion": "FORRO CAMA BOSTON 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026403",
    "descripcion": "FORRO CAMA BOSTON 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026404",
    "descripcion": "FORRO CAMA BOSTON 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026405",
    "descripcion": "FORRO CAMA BOSTON 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026406",
    "descripcion": "FORRO CAMA BOSTON 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026407",
    "descripcion": "FORRO CAMA BOSTON 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026428",
    "descripcion": "FORRO CAMA FLORENCIA 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026429",
    "descripcion": "FORRO CAMA FLORENCIA 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026430",
    "descripcion": "FORRO CAMA FLORENCIA 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026431",
    "descripcion": "FORRO CAMA FLORENCIA 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026432",
    "descripcion": "FORRO CAMA FLORENCIA 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026433",
    "descripcion": "FORRO CAMA FLORENCIA 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026434",
    "descripcion": "FORRO CAMA FLORENCIA 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026435",
    "descripcion": "FORRO CAMA FLORENCIA 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026436",
    "descripcion": "FORRO CAMA FLORENCIA 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026437",
    "descripcion": "FORRO CAMA FLORENCIA 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026438",
    "descripcion": "FORRO CAMA FLORENCIA 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026439",
    "descripcion": "FORRO CAMA FLORENCIA 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026440",
    "descripcion": "FORRO CAMA FLORENCIA 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026441",
    "descripcion": "FORRO CAMA FLORENCIA 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026442",
    "descripcion": "FORRO CAMA FLORENCIA 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026443",
    "descripcion": "FORRO CAMA FLORENCIA 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026444",
    "descripcion": "FORRO CAMA FLORENCIA 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026445",
    "descripcion": "FORRO CAMA FLORENCIA 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026446",
    "descripcion": "FORRO CAMA FLORENCIA 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026447",
    "descripcion": "FORRO CAMA FLORENCIA 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026468",
    "descripcion": "FORRO CAMA NAPOLES 105 ELEMENTA AIRE",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30026469",
    "descripcion": "FORRO CAMA NAPOLES 105 ELEMENTA BRUMA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30026470",
    "descripcion": "FORRO CAMA NAPOLES 105 ELEMENTA AGUA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30026471",
    "descripcion": "FORRO CAMA NAPOLES 105 ELEMENTA TIERRA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30026472",
    "descripcion": "FORRO CAMA NAPOLES 105 ELEMENTA ARENA",
    "tiempoMin": 12.16
  },
  {
    "codigo": "30026473",
    "descripcion": "FORRO CAMA NAPOLES 135 ELEMENTA AIRE",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30026474",
    "descripcion": "FORRO CAMA NAPOLES 135 ELEMENTA BRUMA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30026475",
    "descripcion": "FORRO CAMA NAPOLES 135 ELEMENTA AGUA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30026476",
    "descripcion": "FORRO CAMA NAPOLES 135 ELEMENTA TIERRA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30026477",
    "descripcion": "FORRO CAMA NAPOLES 135 ELEMENTA ARENA",
    "tiempoMin": 15.64
  },
  {
    "codigo": "30026478",
    "descripcion": "FORRO CAMA NAPOLES 160 ELEMENTA AIRE",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30026479",
    "descripcion": "FORRO CAMA NAPOLES 160 ELEMENTA BRUMA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30026480",
    "descripcion": "FORRO CAMA NAPOLES 160 ELEMENTA AGUA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30026481",
    "descripcion": "FORRO CAMA NAPOLES 160 ELEMENTA TIERRA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30026482",
    "descripcion": "FORRO CAMA NAPOLES 160 ELEMENTA ARENA",
    "tiempoMin": 18.92
  },
  {
    "codigo": "30026483",
    "descripcion": "FORRO CAMA NAPOLES 200 ELEMENTA AIRE",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30026484",
    "descripcion": "FORRO CAMA NAPOLES 200 ELEMENTA BRUMA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30026485",
    "descripcion": "FORRO CAMA NAPOLES 200 ELEMENTA AGUA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30026488",
    "descripcion": "FORRO CAMA NAPOLES 200 ELEMENTA TIERRA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30026489",
    "descripcion": "FORRO CAMA NAPOLES 200 ELEMENTA ARENA",
    "tiempoMin": 22.5
  },
  {
    "codigo": "30026510",
    "descripcion": "FORRO CAMA CRETA 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026511",
    "descripcion": "FORRO CAMA CRETA 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026512",
    "descripcion": "FORRO CAMA CRETA 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026513",
    "descripcion": "FORRO CAMA CRETA 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026514",
    "descripcion": "FORRO CAMA CRETA 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026515",
    "descripcion": "FORRO CAMA CRETA 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026516",
    "descripcion": "FORRO CAMA CRETA 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026517",
    "descripcion": "FORRO CAMA CRETA 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026518",
    "descripcion": "FORRO CAMA CRETA 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026519",
    "descripcion": "FORRO CAMA CRETA 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026520",
    "descripcion": "FORRO CAMA CRETA 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026521",
    "descripcion": "FORRO CAMA CRETA 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026522",
    "descripcion": "FORRO CAMA CRETA 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026523",
    "descripcion": "FORRO CAMA CRETA 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026524",
    "descripcion": "FORRO CAMA CRETA 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026525",
    "descripcion": "FORRO CAMA CRETA 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026526",
    "descripcion": "FORRO CAMA CRETA 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026527",
    "descripcion": "FORRO CAMA CRETA 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026528",
    "descripcion": "FORRO CAMA CRETA 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026529",
    "descripcion": "FORRO CAMA CRETA 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026550",
    "descripcion": "FORRO CAMA BARU 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026551",
    "descripcion": "FORRO CAMA BARU 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026552",
    "descripcion": "FORRO CAMA BARU 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026553",
    "descripcion": "FORRO CAMA BARU 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026554",
    "descripcion": "FORRO CAMA BARU 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026555",
    "descripcion": "FORRO CAMA BARU 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026556",
    "descripcion": "FORRO CAMA BARU 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026557",
    "descripcion": "FORRO CAMA BARU 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026558",
    "descripcion": "FORRO CAMA BARU 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026559",
    "descripcion": "FORRO CAMA BARU 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026560",
    "descripcion": "FORRO CAMA BARU 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026561",
    "descripcion": "FORRO CAMA BARU 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026562",
    "descripcion": "FORRO CAMA BARU 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026563",
    "descripcion": "FORRO CAMA BARU 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026564",
    "descripcion": "FORRO CAMA BARU 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026565",
    "descripcion": "FORRO CAMA BARU 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026566",
    "descripcion": "FORRO CAMA BARU 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026567",
    "descripcion": "FORRO CAMA BARU 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026568",
    "descripcion": "FORRO CAMA BARU 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026569",
    "descripcion": "FORRO CAMA BARU 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026590",
    "descripcion": "FORRO CAMA BERLIN 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026591",
    "descripcion": "FORRO CAMA BERLIN 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026592",
    "descripcion": "FORRO CAMA BERLIN 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026593",
    "descripcion": "FORRO CAMA BERLIN 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026594",
    "descripcion": "FORRO CAMA BERLIN 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026595",
    "descripcion": "FORRO CAMA BERLIN 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026596",
    "descripcion": "FORRO CAMA BERLIN 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026597",
    "descripcion": "FORRO CAMA BERLIN 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026598",
    "descripcion": "FORRO CAMA BERLIN 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026599",
    "descripcion": "FORRO CAMA BERLIN 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026600",
    "descripcion": "FORRO CAMA BERLIN 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026601",
    "descripcion": "FORRO CAMA BERLIN 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026602",
    "descripcion": "FORRO CAMA BERLIN 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026603",
    "descripcion": "FORRO CAMA BERLIN 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026604",
    "descripcion": "FORRO CAMA BERLIN 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026605",
    "descripcion": "FORRO CAMA BERLIN 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026606",
    "descripcion": "FORRO CAMA BERLIN 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026607",
    "descripcion": "FORRO CAMA BERLIN 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026608",
    "descripcion": "FORRO CAMA BERLIN 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026609",
    "descripcion": "FORRO CAMA BERLIN 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026632",
    "descripcion": "FORRO CAMA IBIZA 145 ELEMENTA AIRE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026633",
    "descripcion": "FORRO CAMA IBIZA 145 ELEMENTA BRUMA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026634",
    "descripcion": "FORRO CAMA IBIZA 145 ELEMENTA AGUA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026635",
    "descripcion": "FORRO CAMA IBIZA 145 ELEMENTA TIERRA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026636",
    "descripcion": "FORRO CAMA IBIZA 145 ELEMENTA ARENA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026637",
    "descripcion": "FORRO CAMA IBIZA 170 ELEMENTA AIRE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026638",
    "descripcion": "FORRO CAMA IBIZA 170 ELEMENTA BRUMA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026639",
    "descripcion": "FORRO CAMA IBIZA 170 ELEMENTA AGUA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026640",
    "descripcion": "FORRO CAMA IBIZA 170 ELEMENTA TIERRA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026641",
    "descripcion": "FORRO CAMA IBIZA 170 ELEMENTA ARENA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026642",
    "descripcion": "FORRO CAMA IBIZA 210 ELEMENTA AIRE",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026643",
    "descripcion": "FORRO CAMA IBIZA 210 ELEMENTA BRUMA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026644",
    "descripcion": "FORRO CAMA IBIZA 210 ELEMENTA AGUA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026645",
    "descripcion": "FORRO CAMA IBIZA 210 ELEMENTA TIERRA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026646",
    "descripcion": "FORRO CAMA IBIZA 210 ELEMENTA ARENA",
    "tiempoMin": 7.5
  },
  {
    "codigo": "30026677",
    "descripcion": "FORRO CAMA ATENAS 105 ELEMENTA AIRE",
    "tiempoMin": 18
  },
  {
    "codigo": "30026678",
    "descripcion": "FORRO CAMA ATENAS 105 ELEMENTA BRUMA",
    "tiempoMin": 18
  },
  {
    "codigo": "30026679",
    "descripcion": "FORRO CAMA ATENAS 105 ELEMENTA AGUA",
    "tiempoMin": 18
  },
  {
    "codigo": "30026680",
    "descripcion": "FORRO CAMA ATENAS 105 ELEMENTA TIERRA",
    "tiempoMin": 18
  },
  {
    "codigo": "30026681",
    "descripcion": "FORRO CAMA ATENAS 105 ELEMENTA ARENA",
    "tiempoMin": 18
  },
  {
    "codigo": "30026682",
    "descripcion": "FORRO CAMA ATENAS 135 ELEMENTA AIRE",
    "tiempoMin": 20
  },
  {
    "codigo": "30026683",
    "descripcion": "FORRO CAMA ATENAS 135 ELEMENTA BRUMA",
    "tiempoMin": 20
  },
  {
    "codigo": "30026684",
    "descripcion": "FORRO CAMA ATENAS 135 ELEMENTA AGUA",
    "tiempoMin": 20
  },
  {
    "codigo": "30026685",
    "descripcion": "FORRO CAMA ATENAS 135 ELEMENTA TIERRA",
    "tiempoMin": 20
  },
  {
    "codigo": "30026686",
    "descripcion": "FORRO CAMA ATENAS 135 ELEMENTA ARENA",
    "tiempoMin": 20
  },
  {
    "codigo": "30026687",
    "descripcion": "FORRO CAMA ATENAS 160 ELEMENTA AIRE",
    "tiempoMin": 22
  },
  {
    "codigo": "30026688",
    "descripcion": "FORRO CAMA ATENAS 160 ELEMENTA BRUMA",
    "tiempoMin": 22
  },
  {
    "codigo": "30026689",
    "descripcion": "FORRO CAMA ATENAS 160 ELEMENTA AGUA",
    "tiempoMin": 22
  },
  {
    "codigo": "30026690",
    "descripcion": "FORRO CAMA ATENAS 160 ELEMENTA TIERRA",
    "tiempoMin": 22
  },
  {
    "codigo": "30026691",
    "descripcion": "FORRO CAMA ATENAS 160 ELEMENTA ARENA",
    "tiempoMin": 22
  },
  {
    "codigo": "30026692",
    "descripcion": "FORRO CAMA ATENAS 200 ELEMENTA AIRE",
    "tiempoMin": 24
  },
  {
    "codigo": "30026693",
    "descripcion": "FORRO CAMA ATENAS 200 ELEMENTA BRUMA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026694",
    "descripcion": "FORRO CAMA ATENAS 200 ELEMENTA AGUA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026695",
    "descripcion": "FORRO CAMA ATENAS 200 ELEMENTA TIERRA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026696",
    "descripcion": "FORRO CAMA ATENAS 200 ELEMENTA ARENA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026737",
    "descripcion": "FORRO MUNICH 2P ELEMENTA AIRE",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30026738",
    "descripcion": "FORRO MUNICH 2P ELEMENTA BRUMA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30026739",
    "descripcion": "FORRO MUNICH 2P ELEMENTA AGUA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30026740",
    "descripcion": "FORRO MUNICH 2P ELEMENTA TIERRA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30026741",
    "descripcion": "FORRO MUNICH 2P ELEMENTA ARENA",
    "tiempoMin": 250.8
  },
  {
    "codigo": "30026742",
    "descripcion": "FORRO MUNICH 3P ELEMENTA AIRE",
    "tiempoMin": 330
  },
  {
    "codigo": "30026743",
    "descripcion": "FORRO MUNICH 3P ELEMENTA BRUMA",
    "tiempoMin": 330
  },
  {
    "codigo": "30026744",
    "descripcion": "FORRO MUNICH 3P ELEMENTA AGUA",
    "tiempoMin": 330
  },
  {
    "codigo": "30026745",
    "descripcion": "FORRO MUNICH 3P ELEMENTA TIERRA",
    "tiempoMin": 330
  },
  {
    "codigo": "30026746",
    "descripcion": "FORRO MUNICH 3P ELEMENTA ARENA",
    "tiempoMin": 330
  },
  {
    "codigo": "30026747",
    "descripcion": "FORRO AUXILIAR MUNICH ELEMENTA AIRE",
    "tiempoMin": 100
  },
  {
    "codigo": "30026748",
    "descripcion": "FORRO AUXILIAR MUNICH ELEMENTA BRUMA",
    "tiempoMin": 100
  },
  {
    "codigo": "30026749",
    "descripcion": "FORRO CAMA PARIS 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026750",
    "descripcion": "FORRO CAMA PARIS 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026751",
    "descripcion": "FORRO CAMA PARIS 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026752",
    "descripcion": "FORRO CAMA PARIS 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026753",
    "descripcion": "FORRO CAMA PARIS 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026754",
    "descripcion": "FORRO CAMA PARIS 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026755",
    "descripcion": "FORRO CAMA PARIS 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026756",
    "descripcion": "FORRO CAMA PARIS 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026757",
    "descripcion": "FORRO CAMA PARIS 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026758",
    "descripcion": "FORRO CAMA PARIS 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026759",
    "descripcion": "FORRO CAMA PARIS 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026760",
    "descripcion": "FORRO CAMA PARIS 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026761",
    "descripcion": "FORRO CAMA PARIS 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026762",
    "descripcion": "FORRO CAMA PARIS 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026763",
    "descripcion": "FORRO CAMA PARIS 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026764",
    "descripcion": "FORRO CAMA PARIS 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026765",
    "descripcion": "FORRO CAMA PARIS 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026766",
    "descripcion": "FORRO CAMA PARIS 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026767",
    "descripcion": "FORRO CAMA PARIS 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026768",
    "descripcion": "FORRO CAMA PARIS 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026789",
    "descripcion": "FORRO CAB FLOREN 115X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026790",
    "descripcion": "FORRO CAB FLOREN 115X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026791",
    "descripcion": "FORRO CAB FLOREN 115X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026792",
    "descripcion": "FORRO CAB FLOREN 115X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026793",
    "descripcion": "FORRO CAB FLOREN 115X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026794",
    "descripcion": "FORRO CAB FLOREN 145X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026795",
    "descripcion": "FORRO CAB FLOREN 145X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026796",
    "descripcion": "FORRO CAB FLOREN 145X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026797",
    "descripcion": "FORRO CAB FLOREN 145X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026798",
    "descripcion": "FORRO CAB FLOREN 145X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026799",
    "descripcion": "FORRO CAB FLOREN 170X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026800",
    "descripcion": "FORRO CAB FLOREN 170X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026801",
    "descripcion": "FORRO CAB FLOREN 170X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026802",
    "descripcion": "FORRO CAB FLOREN 170X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026803",
    "descripcion": "FORRO CAB FLOREN 170X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026804",
    "descripcion": "FORRO CAB FLOREN 210X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026805",
    "descripcion": "FORRO CAB FLOREN 210X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026806",
    "descripcion": "FORRO CAB FLOREN 210X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026807",
    "descripcion": "FORRO CAB FLOREN 210X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026808",
    "descripcion": "FORRO CAB FLOREN 210X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026829",
    "descripcion": "FORRO CAB BERLIN 115X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026830",
    "descripcion": "FORRO CAB BERLIN 115X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026831",
    "descripcion": "FORRO CAB BERLIN 115X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026832",
    "descripcion": "FORRO CAB BERLIN 115X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026833",
    "descripcion": "FORRO CAB BERLIN 115X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026834",
    "descripcion": "FORRO CAB BERLIN 145X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026835",
    "descripcion": "FORRO CAB BERLIN 145X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026836",
    "descripcion": "FORRO CAB BERLIN 145X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026837",
    "descripcion": "FORRO CAB BERLIN 145X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026838",
    "descripcion": "FORRO CAB BERLIN 145X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026839",
    "descripcion": "FORRO CAB BERLIN 170X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026840",
    "descripcion": "FORRO CAB BERLIN 170X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026841",
    "descripcion": "FORRO CAB BERLIN 170X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026842",
    "descripcion": "FORRO CAB BERLIN 170X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026843",
    "descripcion": "FORRO CAB BERLIN 170X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026844",
    "descripcion": "FORRO CAB BERLIN 210X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026845",
    "descripcion": "FORRO CAB BERLIN 210X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026846",
    "descripcion": "FORRO CAB BERLIN 210X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026847",
    "descripcion": "FORRO CAB BERLIN 210X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026848",
    "descripcion": "FORRO CAB BERLIN 210X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026869",
    "descripcion": "FORRO CAB BARU 115X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026870",
    "descripcion": "FORRO CAB BARU115X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026871",
    "descripcion": "FORRO CAB BARU 115X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026872",
    "descripcion": "FORRO CAB BARU115X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026873",
    "descripcion": "FORRO CAB BARU115X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026874",
    "descripcion": "FORRO CAB BARU145X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026875",
    "descripcion": "FORRO CAB BARU145X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026876",
    "descripcion": "FORRO CAB BARU145X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026877",
    "descripcion": "FORRO CAB BARU145X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026878",
    "descripcion": "FORRO CAB BARU145X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026879",
    "descripcion": "FORRO CAB BARU170X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026880",
    "descripcion": "FORRO CAB BARU170X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026881",
    "descripcion": "FORRO CAB BARU170X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026882",
    "descripcion": "FORRO CAB BARU170X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026883",
    "descripcion": "FORRO CAB BARU170X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026884",
    "descripcion": "FORRO CAB BARU210X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026885",
    "descripcion": "FORRO CAB BARU210X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026886",
    "descripcion": "FORRO CAB BARU210X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026887",
    "descripcion": "FORRO CAB BARU210X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026888",
    "descripcion": "FORRO CAB BARU210X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026909",
    "descripcion": "FORRO CAB CRETA 115X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026910",
    "descripcion": "FORRO CAB CRETA 115X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026911",
    "descripcion": "FORRO CAB CRETA 115X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026912",
    "descripcion": "FORRO CAB CRETA 115X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026913",
    "descripcion": "FORRO CAB CRETA 115X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026914",
    "descripcion": "FORRO CAB CRETA 145X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026915",
    "descripcion": "FORRO CAB CRETA 145X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026916",
    "descripcion": "FORRO CAB CRETA 145X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026917",
    "descripcion": "FORRO CAB CRETA 145X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026918",
    "descripcion": "FORRO CAB CRETA 145X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026919",
    "descripcion": "FORRO CAB CRETA 170X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026920",
    "descripcion": "FORRO CAB CRETA 170X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026921",
    "descripcion": "FORRO CAB CRETA 170X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026922",
    "descripcion": "FORRO CAB CRETA 170X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026923",
    "descripcion": "FORRO CAB CRETA 170X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026924",
    "descripcion": "FORRO CAB CRETA 210X50 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026925",
    "descripcion": "FORRO CAB CRETA 210X50 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026926",
    "descripcion": "FORRO CAB CRETA 210X50 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026927",
    "descripcion": "FORRO CAB CRETA 210X50 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026928",
    "descripcion": "FORRO CAB CRETA 210X50 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30026949",
    "descripcion": "FORRO CAB MODULAR ELEMENTA AIRE",
    "tiempoMin": 24
  },
  {
    "codigo": "30026950",
    "descripcion": "FORRO CAB MODULAR ELEMENTA BRUMA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026951",
    "descripcion": "FORRO CAB MODULAR ELEMENTA AGUA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026952",
    "descripcion": "FORRO CAB MODULAR ELEMENTA TIERRA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026953",
    "descripcion": "FORRO CAB MODULAR ELEMENTA ARENA",
    "tiempoMin": 24
  },
  {
    "codigo": "30026959",
    "descripcion": "FORRO VELADOR FLORENCIA ELEMENTA BRUMA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30026960",
    "descripcion": "FORRO VELADOR FLORENCIA ELEMENTA AIRE",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30026961",
    "descripcion": "FORRO VELADOR FLORENCIA ELEMENTA AGUA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30026962",
    "descripcion": "FORRO VELADOR FLORENCIA ELEMENTA TIERRA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30026963",
    "descripcion": "FORRO VELADOR FLORENCIA ELEMENTA ARENA",
    "tiempoMin": 19.36
  },
  {
    "codigo": "30026969",
    "descripcion": "FORRO VELADOR E-TECH ELEMENTA BRUMA",
    "tiempoMin": 30
  },
  {
    "codigo": "30026970",
    "descripcion": "FORRO VELADOR E-TECH ELEMENTA AIRE",
    "tiempoMin": 30
  },
  {
    "codigo": "30026971",
    "descripcion": "FORRO VELADOR E-TECH ELEMENTA AGUA",
    "tiempoMin": 30
  },
  {
    "codigo": "30026972",
    "descripcion": "FORRO VELADOR E-TECH ELEMENTA TIERRA",
    "tiempoMin": 30
  },
  {
    "codigo": "30026973",
    "descripcion": "FORRO VELADOR E-TECH ELEMENTA ARENA",
    "tiempoMin": 30
  },
  {
    "codigo": "30026979",
    "descripcion": "FORRO BENCH 115 ELEMENTA BRUMA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30026980",
    "descripcion": "FORRO BENCH 115 ELEMENTA AIRE",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30026981",
    "descripcion": "FORRO BENCH 115 ELEMENTA AGUA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30026982",
    "descripcion": "FORRO BENCH 115 ELEMENTA TIERRA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30026983",
    "descripcion": "FORRO BENCH 115 ELEMENTA ARENA",
    "tiempoMin": 30.07
  },
  {
    "codigo": "30026989",
    "descripcion": "FORRO BENCH 145 ELEMENTA BRUMA",
    "tiempoMin": 35
  },
  {
    "codigo": "30026990",
    "descripcion": "FORRO BENCH 145 ELEMENTA AIRE",
    "tiempoMin": 35
  },
  {
    "codigo": "30026991",
    "descripcion": "FORRO BENCH 145 ELEMENTA AGUA",
    "tiempoMin": 35
  },
  {
    "codigo": "30026992",
    "descripcion": "FORRO BENCH 145 ELEMENTA TIERRA",
    "tiempoMin": 35
  },
  {
    "codigo": "30026993",
    "descripcion": "FORRO BENCH 145 ELEMENTA ARENA",
    "tiempoMin": 35
  },
  {
    "codigo": "30026999",
    "descripcion": "FORRO OTTOMAN 70 ELEMENTA BRUMA",
    "tiempoMin": 30
  },
  {
    "codigo": "30027000",
    "descripcion": "FORRO OTTOMAN 70 ELEMENTA AIRE",
    "tiempoMin": 30
  },
  {
    "codigo": "30027001",
    "descripcion": "FORRO OTTOMAN 70 ELEMENTA AGUA",
    "tiempoMin": 30
  },
  {
    "codigo": "30027002",
    "descripcion": "FORRO OTTOMAN 70 ELEMENTA TIERRA",
    "tiempoMin": 30
  },
  {
    "codigo": "30027003",
    "descripcion": "FORRO OTTOMAN 70 ELEMENTA ARENA",
    "tiempoMin": 30
  },
  {
    "codigo": "30027009",
    "descripcion": "FORRO BENCH AREZZO 70 ELEMENTA AIRE",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30027010",
    "descripcion": "FORRO BENCH AREZZO 70 ELEMENTA BRUMA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30027011",
    "descripcion": "FORRO BENCH AREZZO 70 ELEMENTA AGUA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30027012",
    "descripcion": "FORRO BENCH AREZZO 70 ELEMENTA TIERRA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30027013",
    "descripcion": "FORRO BENCH AREZZO 70 ELEMENTA ARENA",
    "tiempoMin": 4.61
  },
  {
    "codigo": "30027019",
    "descripcion": "FORRO OTTOMAN VIENA 80 ELEMENTA AGUA",
    "tiempoMin": 110
  },
  {
    "codigo": "30027020",
    "descripcion": "FORRO OTTOMAN VIENA 80 ELEMENTA AIRE",
    "tiempoMin": 110
  },
  {
    "codigo": "30027021",
    "descripcion": "FORRO OTTOMAN VIENA 80 ELEMENTA ARENA",
    "tiempoMin": 110
  },
  {
    "codigo": "30027022",
    "descripcion": "FORRO OTTOMAN VIENA 80 ELEMENTA BRUMA",
    "tiempoMin": 110
  },
  {
    "codigo": "30027023",
    "descripcion": "FORRO OTTOMAN VIENA 80 ELEMENTA TIERRA",
    "tiempoMin": 110
  },
  {
    "codigo": "30027049",
    "descripcion": "FORRO RECLINABLE APOLO ELEMENTA AIRE",
    "tiempoMin": 182
  },
  {
    "codigo": "30027050",
    "descripcion": "FORRO RECLINABLE APOLO ELEMENTA BRUMA",
    "tiempoMin": 182
  },
  {
    "codigo": "30027051",
    "descripcion": "FORRO RECLINABLE APOLO ELEMENTA AGUA",
    "tiempoMin": 182
  },
  {
    "codigo": "30027052",
    "descripcion": "FORRO RECLINABLE APOLO ELEMENTA TIERRA",
    "tiempoMin": 182
  },
  {
    "codigo": "30027053",
    "descripcion": "FORRO RECLINABLE APOLO ELEMENTA ARENA",
    "tiempoMin": 182
  },
  {
    "codigo": "30027054",
    "descripcion": "FORRO LOVE SEAT APOLO ELEMENTA AIRE",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30027055",
    "descripcion": "FORRO LOVE SEAT APOLO ELEMENTA BRUMA",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30027056",
    "descripcion": "FORRO LOVE SEAT APOLO ELEMENTA AGUA",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30027057",
    "descripcion": "FORRO LOVE SEAT APOLO ELEMENTA TIERRA",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30027058",
    "descripcion": "FORRO LOVE SEAT APOLO ELEMENTA ARENA",
    "tiempoMin": 264.77
  },
  {
    "codigo": "30027135",
    "descripcion": "FORRO MECEDORA ALMA ELEMENTA AIRE",
    "tiempoMin": 150
  },
  {
    "codigo": "30027136",
    "descripcion": "FORRO MECEDORA ALMA ELEMENTA BRUMA",
    "tiempoMin": 150
  },
  {
    "codigo": "30027137",
    "descripcion": "FORRO MECEDORA ALMA ELEMENTA AGUA",
    "tiempoMin": 150
  },
  {
    "codigo": "30027138",
    "descripcion": "FORRO MECEDORA ALMA ELEMENTA TIERRA",
    "tiempoMin": 150
  },
  {
    "codigo": "30027139",
    "descripcion": "FORRO MECEDORA ALMA ELEMENTA ARENA",
    "tiempoMin": 150
  },
  {
    "codigo": "30027216",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA AIRE",
    "tiempoMin": 142
  },
  {
    "codigo": "30027217",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA BRUMA",
    "tiempoMin": 142
  },
  {
    "codigo": "30027218",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA AGUA",
    "tiempoMin": 142
  },
  {
    "codigo": "30027219",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA TIERRA",
    "tiempoMin": 142
  },
  {
    "codigo": "30027220",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA ARENA",
    "tiempoMin": 142
  },
  {
    "codigo": "30027221",
    "descripcion": "FORRO MASSAGE ZEUS ELEMENTA AIRE",
    "tiempoMin": 180
  },
  {
    "codigo": "30027222",
    "descripcion": "FORRO MASSAGE ZEUS ELEMENTA BRUMA",
    "tiempoMin": 180
  },
  {
    "codigo": "30027223",
    "descripcion": "FORRO MASSAGE ZEUS ELEMENTA AGUA",
    "tiempoMin": 180
  },
  {
    "codigo": "30027224",
    "descripcion": "FORRO MASSAGE ZEUS ELEMENTA TIERRA",
    "tiempoMin": 180
  },
  {
    "codigo": "30027225",
    "descripcion": "FORRO MASSAGE ZEUS ELEMENTA ARENA",
    "tiempoMin": 180
  },
  {
    "codigo": "30027231",
    "descripcion": "FORRO CAMA MILOS 105 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027232",
    "descripcion": "FORRO CAMA MILOS 105 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027233",
    "descripcion": "FORRO CAMA MILOS 105 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027234",
    "descripcion": "FORRO CAMA MILOS 105 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027235",
    "descripcion": "FORRO CAMA MILOS 105 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027236",
    "descripcion": "FORRO CAMA MILOS 135 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027237",
    "descripcion": "FORRO CAMA MILOS 135 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027238",
    "descripcion": "FORRO CAMA MILOS 135 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027239",
    "descripcion": "FORRO CAMA MILOS 135 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027240",
    "descripcion": "FORRO CAMA MILOS 135 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027241",
    "descripcion": "FORRO CAMA MILOS 160 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027242",
    "descripcion": "FORRO CAMA MILOS 160 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027243",
    "descripcion": "FORRO CAMA MILOS 160 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027244",
    "descripcion": "FORRO CAMA MILOS 160 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027245",
    "descripcion": "FORRO CAMA MILOS 160 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027246",
    "descripcion": "FORRO CAMA MILOS 200 ELEMENTA AIRE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027247",
    "descripcion": "FORRO CAMA MILOS 200 ELEMENTA BRUMA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027248",
    "descripcion": "FORRO CAMA MILOS 200 ELEMENTA AGUA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027249",
    "descripcion": "FORRO CAMA MILOS 200 ELEMENTA TIERRA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027250",
    "descripcion": "FORRO CAMA MILOS 200 ELEMENTA ARENA",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027272",
    "descripcion": "FORRO CAB MILAN 115X50 PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027273",
    "descripcion": "FORRO CAB MILAN 115X50 AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027274",
    "descripcion": "FORRO CAB MILAN 115X50 CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027275",
    "descripcion": "FORRO CAB MILAN 115X50 BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027276",
    "descripcion": "FORRO CAB MILAN 145X50 PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027277",
    "descripcion": "FORRO CAB MILAN 145X50 AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027278",
    "descripcion": "FORRO CAB MILAN 145X50 CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027279",
    "descripcion": "FORRO CAB MILAN 145X50 BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027280",
    "descripcion": "FORRO CAB MILAN 170X50 PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027281",
    "descripcion": "FORRO CAB MILAN 170X50 AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027282",
    "descripcion": "FORRO CAB MILAN 170X50 CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027283",
    "descripcion": "FORRO CAB MILAN 170X50 BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027284",
    "descripcion": "FORRO CAB MILAN 210X50 PLOMO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027285",
    "descripcion": "FORRO CAB MILAN 210X50 AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027286",
    "descripcion": "FORRO CAB MILAN 210X50 CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027287",
    "descripcion": "FORRO CAB MILAN 210X50 BEIGE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027618",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA CACAO",
    "tiempoMin": 170
  },
  {
    "codigo": "30027619",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA CENIZA",
    "tiempoMin": 170
  },
  {
    "codigo": "30027620",
    "descripcion": "FORRO RECLINABLE ZEUS ELEMENTA TRIGO",
    "tiempoMin": 170
  },
  {
    "codigo": "30027885",
    "descripcion": "FORRO PARIS MARCIMEX 135 HARMON NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027886",
    "descripcion": "FORRO CRETA MARCIMEX 135 HARMON GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027887",
    "descripcion": "FORRO CRETA MARCIMEX 135 HARMON AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027888",
    "descripcion": "FORRO CRETA MARCIMEX 135 HARMON CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027889",
    "descripcion": "FORRO PARIS MARCIMEX 160 HARMON NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027890",
    "descripcion": "FORRO CRETA MARCIMEX 160 HARMON GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027891",
    "descripcion": "FORRO CRETA MARCIMEX 160 HARMON AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027892",
    "descripcion": "FORRO CRETA MARCIMEX 160 HARMON CAFE",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027893",
    "descripcion": "FORRO PARIS MARCIMEX 200 2C HARMON NEGRO",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027894",
    "descripcion": "FORRO CRETA MARCIMEX 200 2C HARMON GRIS",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027895",
    "descripcion": "FORRO CRETA MARCIMEX 200 2C HARMON AZUL",
    "tiempoMin": 4.46
  },
  {
    "codigo": "30027896",
    "descripcion": "FORRO CRETA MARCIMEX 200 2C HARMON CAFE",
    "tiempoMin": 4.46
  }
];
