
import React, { useState, useMemo, useEffect } from 'react';
import { logger } from '@/services/LogService';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { Employee, EmployeeSkill, Machine, AppConstraints, Qualification, WorkCenter } from '@/types/types';
import { PersonnelIcon, PlusIcon, EditIcon, DeleteIcon, DataImportIcon } from '@/constants/constants';
import { useAppContext } from '@/context/AppProvider';
import { MACHINE_CATALOG } from '@/lib/catalogs/machineCatalog';
import { exportSkillsToExcel } from '@/services/OptimizationService';

interface PersonnelManagementSectionProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  skills: EmployeeSkill[];
  setSkills: (skills: EmployeeSkill[]) => void;
  constraints: AppConstraints;
}
// ...existing code...

const ROLES: Array<Qualification['role']> = ['Operador', 'Ayudante'];

// --- Modal Component for Skill Editing ---
const SkillEditModal: React.FC<{
  employee: Employee;
  employeeSkills: EmployeeSkill[]; // All skills for all employees
  availableMachines: Machine[];
  workCenters: WorkCenter[];
  onSave: (employeeId: string, machineCode: string, qualifications: Qualification[]) => void;
  onClose: () => void;
  machineToEditCode?: string;
}> = ({ employee, employeeSkills, availableMachines, workCenters, onSave, onClose, machineToEditCode }) => {
  
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>(machineToEditCode || '');
  
  // State to hold the matrix of qualifications: { 'centerId-role': skillLevel }
  const [qualificationsMatrix, setQualificationsMatrix] = useState<Record<string, number>>({});

  // Pre-populate the matrix when the component loads or the machine to edit changes
  React.useEffect(() => {
    if (machineToEditCode) {
      const existingSkill = employeeSkills.find(s => s.employeeId === employee.id && s.machineCode === machineToEditCode);
      const initialMatrix: Record<string, number> = {};
      if (existingSkill) {
        existingSkill.qualifications.forEach(q => {
          initialMatrix[`${q.centerId}-${q.role}`] = q.skillLevel;
        });
      }
      setQualificationsMatrix(initialMatrix);
    }
  }, [machineToEditCode, employee.id, employeeSkills]);

  const handleQualificationChange = (centerId: string, role: Qualification['role'], value: string) => {
    const skillLevel = Math.max(0, Math.min(100, Number(value) || 0));
    setQualificationsMatrix(prev => ({
      ...prev,
      [`${centerId}-${role}`]: skillLevel,
    }));
  };

  const handleSave = () => {
    if (!selectedMachineCode) return;
    
    const newQualifications: Qualification[] = [];
    Object.entries(qualificationsMatrix).forEach(([key, skillLevel]) => {
      if (skillLevel > 0) {
        const [centerId, role] = key.split('-');
        newQualifications.push({
          centerId,
          role: role as Qualification['role'],
          skillLevel,
        });
      }
    });
    
    onSave(employee.id, selectedMachineCode, newQualifications);
    onClose();
  };
  
  const selectedMachine = MACHINE_CATALOG.find(m => m.code === selectedMachineCode);
  const isEditing = !!machineToEditCode;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {isEditing ? 'Editar' : 'Añadir'} Competencia para: <span className="text-indigo-600">{employee.name}</span>
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="machine-select" className="block text-sm font-medium text-gray-700">Máquina</label>
            {isEditing ? (
               <input type="text" value={selectedMachine?.name || ''} disabled className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm bg-gray-100" />
            ) : (
              <select 
                id="machine-select" 
                value={selectedMachineCode} 
                onChange={e => setSelectedMachineCode(e.target.value)}
                className="mt-1 block w-full border border-gray-300 bg-white rounded-md shadow-sm py-2 px-3 sm:text-sm"
              >
                <option value="">-- Seleccionar Máquina --</option>
                {availableMachines.map(machine => (
                  <option key={machine.code} value={machine.code}>{machine.name} ({machine.processType})</option>
                ))}
              </select>
            )}
          </div>

          {selectedMachineCode && (
            <div className="p-2 border rounded-md bg-gray-50 overflow-x-auto">
               <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-semibold text-gray-600">Rol</th>
                      {workCenters.map(wc => (
                        <th key={wc.id} className="p-2 text-center font-semibold text-gray-600">{wc.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map(role => (
                      <tr key={role} className="border-b last:border-0">
                        <td className="p-2 font-medium text-gray-700">{role}</td>
                        {workCenters.map(wc => (
                          <td key={wc.id} className="p-1">
                            <input 
                              type="number" 
                              min="0" 
                              max="100"
                              placeholder="0"
                              value={qualificationsMatrix[`${wc.id}-${role}`] || ''}
                              onChange={e => handleQualificationChange(wc.id, role, e.target.value)}
                              className="w-20 text-center border border-gray-300 rounded-md shadow-sm py-1 px-2"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400">Cancelar</button>
          <button onClick={handleSave} disabled={!selectedMachineCode} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
};


export const PersonnelManagementSection: React.FC<PersonnelManagementSectionProps> = ({
    employees,
    setEmployees,
    skills,
    setSkills,
    constraints,
  }) => {
    const inspector = useRuntimeInspector('PersonnelManagement');
    
    useEffect(() => {
      logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[PersonnelManagementSection] Montado.`);
    }, []);
    useEffect(() => {
      logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[PersonnelManagementSection] Cambio en employees: ${JSON.stringify(employees)}`);
      inspector.captureVariable('employees', employees, { count: employees.length });
    }, [employees]);
    useEffect(() => {
      logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[PersonnelManagementSection] Cambio en skills: ${JSON.stringify(skills)}`);
      inspector.captureVariable('employeeSkills', skills, { count: skills.length });
    }, [skills]);
  const { addNotification } = useAppContext();
  
  // Capturar estado
  useEffect(() => {
    inspector.captureState({
      employeesCount: employees.length,
      skillsCount: skills.length,
      availableMachinesCount: MACHINE_CATALOG.length
    });
  }, [employees, skills]);
  
  const [employeeForm, setEmployeeForm] = useState<Omit<Employee, 'id' | 'isActive'>>({ name: '', employeeCode: '' });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [machineToEditCode, setMachineToEditCode] = useState<string | undefined>(undefined);

  const filteredEmployees = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    if (!lowercasedQuery) return employees;
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(lowercasedQuery) || emp.employeeCode.toLowerCase().includes(lowercasedQuery)
    );
  }, [employees, searchQuery]);


  const resetEmployeeForm = () => {
    setEmployeeForm({ name: '', employeeCode: '' });
    setEditingEmployee(null);
  };

  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name.trim() || !employeeForm.employeeCode.trim()) {
      logger.log(`[PersonnelManagementSection] Inicializando sección de gestión de personal.`);
      logger.log(`[PersonnelManagementSection] empleados: ${JSON.stringify(employees)}`);
      logger.log(`[PersonnelManagementSection] habilidades: ${JSON.stringify(skills)}`);
      addNotification('warning', 'Nombre y código de empleado son requeridos.');
      return;
    }
    const trimmedCode = employeeForm.employeeCode.trim();

    if (editingEmployee) {
      if (employees.some(emp => emp.id !== editingEmployee.id && emp.employeeCode === trimmedCode)) {
        addNotification('error', `El código de empleado '${trimmedCode}' ya existe.`);
        return;
      }
      const updatedEmployees = employees.map(emp =>
        emp.id === editingEmployee.id ? { ...editingEmployee, ...employeeForm, employeeCode: trimmedCode } : emp
      );
      setEmployees(updatedEmployees);
      if (selectedEmployee?.id === editingEmployee.id) {
        setSelectedEmployee(updatedEmployees.find(e => e.id === editingEmployee.id) || null);
      }
      addNotification('success', 'Empleado actualizado.');
      resetEmployeeForm();

    } else {
      if (employees.some(emp => emp.employeeCode === trimmedCode)) {
        addNotification('error', `El código de empleado '${trimmedCode}' ya existe.`);
        return;
      }
      const newEmployee: Employee = { id: Date.now().toString(), ...employeeForm, employeeCode: trimmedCode, isActive: true };
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      addNotification('success', 'Nuevo empleado agregado. Defina sus competencias.');
      setSelectedEmployee(newEmployee);
      resetEmployeeForm();
    }
  };
  
  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({ name: employee.name, employeeCode: employee.employeeCode });
  };
  
  const handleDeleteEmployee = (id: string) => {
    if (window.confirm('¿Está seguro? Esto también eliminará todas las competencias asignadas a este empleado.')) {
      setEmployees(employees.filter(emp => emp.id !== id));
      setSkills(skills.filter(skill => skill.employeeId !== id));
      addNotification('info', 'Empleado eliminado.');
      if(selectedEmployee?.id === id) setSelectedEmployee(null);
    }
  };

  const handleSaveSkill = (
    employeeId: string,
    machineCode: string,
    qualifications: Qualification[]
  ) => {
    let skillFound = false;
    const updatedSkills = skills.map(s => {
      if (s.employeeId === employeeId && s.machineCode === machineCode) {
        skillFound = true;
        // If no qualifications are left, filter out this skill entirely
        if (qualifications.length === 0) return null;
        return { ...s, qualifications: qualifications };
      }
      return s;
    }).filter((s): s is EmployeeSkill => s !== null);

    if (!skillFound && qualifications.length > 0) {
      updatedSkills.push({ employeeId, machineCode, qualifications });
    }
    
    setSkills(updatedSkills);
    addNotification('success', `Competencias para ${MACHINE_CATALOG.find(m=>m.code===machineCode)?.name} actualizadas.`);
  };

  const handleOpenSkillModal = (machineCode?: string) => {
    setMachineToEditCode(machineCode);
    setIsSkillModalOpen(true);
  };

  const handleExport = () => {
    exportSkillsToExcel(employees, skills, MACHINE_CATALOG, constraints);
    addNotification('success', 'Exportando tabla de calificaciones...');
  };
  
  const employeeSkills = useMemo(() => {
      if (!selectedEmployee) return [];
      return skills.filter(s => s.employeeId === selectedEmployee.id);
  }, [selectedEmployee, skills]);

  const availableMachinesForNewSkill = useMemo(() => {
    if (!selectedEmployee) return [];
    const assignedMachineCodes = new Set(skills.filter(s => s.employeeId === selectedEmployee.id).map(s => s.machineCode));
    return MACHINE_CATALOG.filter(m => !assignedMachineCodes.has(m.code));
  }, [selectedEmployee, skills]);
  
  const activeWorkCenters = useMemo(() => constraints.workCenters.filter(wc => wc.isActive !== false), [constraints.workCenters]);


  return (
    <div className="p-6 md:p-8 space-y-6">
      {isSkillModalOpen && selectedEmployee && (
        <SkillEditModal 
          employee={selectedEmployee}
          employeeSkills={skills}
          availableMachines={availableMachinesForNewSkill}
          workCenters={activeWorkCenters}
          onSave={handleSaveSkill}
          onClose={() => setIsSkillModalOpen(false)}
          machineToEditCode={machineToEditCode}
        />
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
            <PersonnelIcon />
            <h2 className="text-2xl font-semibold text-gray-700">Calificación Técnica del Personal</h2>
        </div>
        <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            disabled={skills.length === 0}
        >
            <DataImportIcon /> Exportar a Excel
        </button>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employee List and Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Lista de Empleados ({filteredEmployees.length})</h3>
            <input
                type="text"
                placeholder="Buscar empleado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm mb-4"
            />
            <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                {filteredEmployees.sort((a,b) => a.name.localeCompare(b.name)).map(emp => (
                    <div key={emp.id} 
                         className={`p-3 cursor-pointer border-b last:border-b-0 ${selectedEmployee?.id === emp.id ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
                         onClick={() => setSelectedEmployee(emp)}>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-medium text-gray-900">{emp.name}</p>
                                <p className="text-sm text-gray-500">Código: {emp.employeeCode}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={(e) => {e.stopPropagation(); handleEditEmployee(emp);}} className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full"><EditIcon /></button>
                                <button onClick={(e) => {e.stopPropagation(); handleDeleteEmployee(emp.id);}} className="text-red-500 hover:text-red-700 p-1 rounded-full"><DeleteIcon /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-t pt-4">{editingEmployee ? 'Editar Empleado' : 'Agregar Nuevo Empleado'}</h3>
            <form onSubmit={handleEmployeeSubmit} className="space-y-4">
              <div>
                <label htmlFor="employeeName" className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <input type="text" name="name" id="employeeName" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" placeholder="Ej: Juan Pérez"/>
              </div>
              <div>
                <label htmlFor="employeeCode" className="block text-sm font-medium text-gray-700">Código de Empleado</label>
                <input type="text" name="employeeCode" id="employeeCode" value={employeeForm.employeeCode} onChange={e => setEmployeeForm({...employeeForm, employeeCode: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" placeholder="Ej: 12345"/>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                {editingEmployee && <button type="button" onClick={resetEmployeeForm} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400">Cancelar</button>}
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"><PlusIcon /> {editingEmployee ? 'Guardar Cambios' : 'Agregar'}</button>
              </div>
            </form>
          </div>
        </div>

        {/* Competency Profile */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          {selectedEmployee ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Competencias de: <span className="text-indigo-600">{selectedEmployee.name}</span></h3>
                <button onClick={() => handleOpenSkillModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                  <PlusIcon /> Añadir Competencia
                </button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto space-y-3">
                 {employeeSkills.length > 0 ? (
                    employeeSkills.map(skill => {
                        const machine = MACHINE_CATALOG.find(m => m.code === skill.machineCode);
                        return (
                            <div key={skill.machineCode} className="bg-gray-50 p-4 rounded-lg border flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-800">{machine?.name || skill.machineCode}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                                        {skill.qualifications.map(q => {
                                            const center = constraints.workCenters.find(c => c.id === q.centerId);
                                            return (
                                                <span key={q.centerId + q.role}>
                                                    {center?.name}: <span className="font-semibold text-blue-600">{q.role} ({q.skillLevel}%)</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button onClick={() => handleOpenSkillModal(skill.machineCode)} className="text-indigo-600 hover:text-indigo-800"><EditIcon /></button>
                            </div>
                        )
                    })
                 ) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500">Este empleado aún no tiene competencias registradas.</p>
                        <p className="text-sm text-gray-400">Haga clic en &quot;Añadir Competencia&quot; para empezar.</p>
                    </div>
                 )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <PersonnelIcon />
                <p className="mt-2 text-lg text-gray-600">Seleccione un empleado de la lista</p>
                <p className="text-sm text-gray-400">o agregue uno nuevo para definir sus competencias.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
