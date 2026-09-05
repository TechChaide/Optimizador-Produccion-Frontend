
import React, { useState, useEffect, useMemo } from 'react';
import { MaintenanceEvent, ProductionLine, WorkstationDefinition, NotificationMessage, AppConstraints, Machine, ProcessType } from '@/types/types';
import { MaintenanceIcon, PlusIcon, EditIcon, DeleteIcon, PROCESS_TYPE_OPTIONS } from '@/constants/constants';
import { MACHINE_CATALOG } from '@/lib/catalogs/machineCatalog';
import { logger } from '@/services/LogService';
import { useRuntimeInspector } from '@/services/RuntimeInspector';

interface MaintenanceSectionProps {
  events: MaintenanceEvent[];
  setEvents: (events: MaintenanceEvent[]) => void;
  constraints: AppConstraints;
  onConstraintsUpdate: (newConstraints: AppConstraints) => void;
  addNotification: (type: NotificationMessage['type'], text: string) => void;
}

const initialFormState: Partial<MaintenanceEvent> = {
  title: '',
  processType: undefined,
  workstationDefinitionId: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: ''
};

export const MaintenanceSection: React.FC<MaintenanceSectionProps> = ({
  events,
  setEvents,
  constraints,
  onConstraintsUpdate,
  addNotification
}) => {
  const inspector = useRuntimeInspector('Maintenance');
  
  React.useEffect(() => {
    logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[MaintenanceSection] Montado.`);
  }, []);
  const [formState, setFormState] = useState<Partial<MaintenanceEvent>>(initialFormState);
  const [editingEvent, setEditingEvent] = useState<MaintenanceEvent | null>(null);
  useEffect(() => {
    logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[MaintenanceSection] Cambio en formState: ${JSON.stringify(formState)}`);
    inspector.captureVariable('formState', formState);
  }, [formState]);
  useEffect(() => {
    logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[MaintenanceSection] Cambio en editingEvent: ${JSON.stringify(editingEvent)}`);
    inspector.captureVariable('editingEvent', editingEvent);
  }, [editingEvent]);
  
  useEffect(() => {
    inspector.captureState({
      eventsCount: events.length,
      isEditing: !!editingEvent
    });
  }, [events, editingEvent]);
  
  const { productionLines, workstationDefinitions } = constraints;

  const activeProductionLines = useMemo(() => productionLines.filter(l => l.isActive !== false), [productionLines]);

  const availableWorkstationsForForm = useMemo(() => {
    if (!formState.processType) {
      return [];
    }
    const linesForProcess = activeProductionLines.filter(line => line.processType === formState.processType);
    const workstationIds = new Set<string>();
    linesForProcess.forEach(line => {
      line.assignedWorkstations.forEach(ws => workstationIds.add(ws.definitionId));
    });
    return workstationDefinitions.filter(wd => workstationIds.has(wd.id));
  }, [formState.processType, activeProductionLines, workstationDefinitions]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormState(prevState => {
        const newState: Partial<MaintenanceEvent> = { ...prevState, [name]: value };
        if (name === 'processType') {
            newState.workstationDefinitionId = ''; 
        }
        return newState;
    });
  };
  
  const handleMachineAssignmentChange = (wdId: string, newMachineCode: string) => {
    const updatedWds = workstationDefinitions.map(wd => 
      wd.id === wdId ? { ...wd, machineCode: newMachineCode || null } : wd
    );
    onConstraintsUpdate({ ...constraints, workstationDefinitions: updatedWds });
    addNotification('success', `Máquina para '${workstationDefinitions.find(wd => wd.id === wdId)?.name}' actualizada.`);
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title || !formState.processType || !formState.workstationDefinitionId || !formState.startDate || !formState.startTime || !formState.endDate || !formState.endTime) {
      addNotification('warning', 'Todos los campos son requeridos para crear un evento.');
      return;
    }

    const startDateTime = new Date(`${formState.startDate}T${formState.startTime}`);
    const endDateTime = new Date(`${formState.endDate}T${formState.endTime}`);

    if (startDateTime >= endDateTime) {
      addNotification('warning', 'La fecha y hora de fin deben ser posteriores a la de inicio.');
      return;
    }

    if (editingEvent) {
      const updatedEvents = events.map(event =>
        event.id === editingEvent.id ? { ...event, ...formState } as MaintenanceEvent : event
      );
      setEvents(updatedEvents);
      addNotification('success', 'Evento de mantenimiento actualizado exitosamente.');
    } else {
      const newEvent: MaintenanceEvent = {
        id: Date.now().toString(),
        ...formState
      } as MaintenanceEvent;
      setEvents([...events, newEvent]);
      addNotification('success', 'Nuevo evento de mantenimiento programado.');
    }
    resetForm();
  };

  const handleEdit = (event: MaintenanceEvent) => {
    setEditingEvent(event);
    setFormState({
      title: event.title,
      processType: event.processType,
      workstationDefinitionId: event.workstationDefinitionId,
      startDate: event.startDate,
      startTime: event.startTime,
      endDate: event.endDate,
      endTime: event.endTime,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este evento de mantenimiento?')) {
      setEvents(events.filter(event => event.id !== id));
      addNotification('info', 'Evento de mantenimiento eliminado.');
    }
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return 'N/A';
    const date = new Date(`${dateStr}T${timeStr}`);
    return date.toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  
  const getAvailableMachinesForWorkstation = (workstation: WorkstationDefinition): Machine[] => {
      // Find the process type for this workstation by looking at the lines it's assigned to.
      // This assumes a workstation is only used in one type of process, as confirmed.
      const assignedLine = activeProductionLines.find(line => 
          line.assignedWorkstations.some(as => as.definitionId === workstation.id)
      );
      if (!assignedLine) return []; 
      const processType = assignedLine.processType;
      
      // Get a set of machine codes that are already assigned to OTHER workstations.
      const assignedMachineCodes = new Set(
          workstationDefinitions
              .filter(wd => wd.id !== workstation.id && wd.machineCode)
              .map(wd => wd.machineCode)
      );
      
      // Return machines that match the process type AND are not already assigned elsewhere.
      return MACHINE_CATALOG.filter(machine => 
          machine.processType === processType && !assignedMachineCodes.has(machine.code)
      );
  };


  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center space-x-3">
        <MaintenanceIcon />
        <h2 className="text-2xl font-semibold text-gray-700">Mantenimiento Programado</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Machine Assignment */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
             <h3 className="text-lg font-semibold text-gray-800 mb-4">Asignación de Máquinas a Puestos de Trabajo</h3>
             <div className="max-h-[60vh] overflow-y-auto space-y-3">
                {workstationDefinitions.map(wd => {
                    const availableMachines = getAvailableMachinesForWorkstation(wd);
                    const assignedMachine = MACHINE_CATALOG.find(m => m.code === wd.machineCode);
                    return (
                        <div key={wd.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                            <span className="font-medium text-gray-700">{wd.name}</span>
                            <div className="flex items-center space-x-2">
                                <select
                                  value={wd.machineCode || ''}
                                  onChange={(e) => handleMachineAssignmentChange(wd.id, e.target.value)}
                                  className="w-48 border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm bg-white"
                                >
                                    <option value="">Operación Manual</option>
                                    {assignedMachine && <option key={assignedMachine.code} value={assignedMachine.code}>{assignedMachine.name}</option>}
                                    {availableMachines.map(machine => (
                                        <option key={machine.code} value={machine.code}>{machine.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    );
                })}
             </div>
          </div>
          
          {/* Maintenance Scheduling */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{editingEvent ? 'Editar Evento' : 'Programar Nuevo Mantenimiento'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">Título del Evento</label>
                  <input type="text" name="title" id="title" value={formState.title || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Ej: Cambio de rodamientos"/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="processType" className="block text-sm font-medium text-gray-700">Tipo de Proceso</label>
                        <select name="processType" id="processType" value={formState.processType || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 bg-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Seleccione un proceso</option>
                            {PROCESS_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="workstationDefinitionId" className="block text-sm font-medium text-gray-700">Puesto de Trabajo</label>
                        <select name="workstationDefinitionId" id="workstationDefinitionId" value={formState.workstationDefinitionId || ''} onChange={handleInputChange} disabled={!formState.processType} className="mt-1 block w-full border border-gray-300 bg-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100">
                            <option value="">Seleccione un puesto</option>
                            {availableWorkstationsForForm.map(ws => (
                            <option key={ws.id} value={ws.id}>{ws.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                     <input type="date" name="startDate" id="startDate" value={formState.startDate || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"/>
                   </div>
                   <div>
                     <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">Hora Inicio</label>
                     <input type="time" name="startTime" id="startTime" value={formState.startTime || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"/>
                   </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Fecha Fin</label>
                     <input type="date" name="endDate" id="endDate" value={formState.endDate || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"/>
                   </div>
                   <div>
                     <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">Hora Fin</label>
                     <input type="time" name="endTime" id="endTime" value={formState.endTime || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"/>
                   </div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  {editingEvent && <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400">Cancelar</button>}
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center">
                    <PlusIcon /> {editingEvent ? 'Guardar Cambios' : 'Programar'}
                  </button>
                </div>
              </form>
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Eventos Programados ({events.length})</h3>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Título</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Tipo Proceso</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Puesto/Máquina</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Desde</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Hasta</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.length > 0 ? (
                  events
                  .sort((a,b) => new Date(`${a.startDate}T${a.startTime}`).getTime() - new Date(`${b.startDate}T${b.startTime}`).getTime())
                  .map(event => {
                    const workstation = workstationDefinitions.find(wd => wd.id === event.workstationDefinitionId);
                    return (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">{event.title}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">{event.processType || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">{workstation?.name || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">{formatDateTime(event.startDate, event.startTime)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">{formatDateTime(event.endDate, event.endTime)}</td>
                        <td className="px-4 py-2 whitespace-nowrap space-x-2">
                          <button onClick={() => handleEdit(event)} className="text-indigo-600 hover:text-indigo-800"><EditIcon /></button>
                          <button onClick={() => handleDelete(event.id)} className="text-red-500 hover:text-red-700"><DeleteIcon /></button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-gray-500">No hay eventos de mantenimiento programados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
};
