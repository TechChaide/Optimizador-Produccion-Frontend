// Contador de cambios en Plan Grupo / Detalle Táctico. Los servicios lo suben al guardar o borrar, y
// datos-sap-compartidos descarta su copia si el contador cambió desde que la descargó. Va en un archivo
// aparte para que los servicios no importen datos-sap-compartidos (que a su vez importa los servicios).
let versionTablasPropias = 0;

export const marcarCambioTablasPropias = (): void => { versionTablasPropias++; };

export const leerVersionTablasPropias = (): number => versionTablasPropias;
