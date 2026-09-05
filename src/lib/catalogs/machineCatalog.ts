
import { Machine } from '@/types/types';

/**
 * @fileoverview Fixed machine catalog data.
 * This file serves as a mock database for machines. In a production environment,
 * this data would be fetched from a database.
 */

export const MACHINE_CATALOG: Machine[] = [
    { code: 'M001', name: 'Máquina cerradora', processType: 'Colchones' },
    { code: 'M002', name: 'Mesa Armado', processType: 'Colchones' },
    { code: 'M003', name: 'Maquina Plastificadora 1', processType: 'Colchones' },
    { code: 'M004', name: 'Máquina axcolchadora 1', processType: 'Forros' },
    { code: 'M005', name: 'Máquina axcolchadora 2', processType: 'Forros' },
    { code: 'M006', name: 'Máquina P. Top', processType: 'Forros' },
    // Future machines can be added here.
];
