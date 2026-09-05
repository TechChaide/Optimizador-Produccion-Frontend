import React, {
  useState,
  useMemo,
  useContext,
  useCallback,
  useEffect,
} from "react";
import { logger } from "@/services/LogService";
import { useRuntimeInspector } from "@/services/RuntimeInspector";
import {
  WorkShift,
  AppConstraints,
  Employee,
  AbsenteeismEvent,
  ProcessType,
  NotificationMessage,
  EmployeeSkill,
} from "@/types/types";
import { WorkShiftIcon, PROCESS_TYPE_OPTIONS } from "@/constants/constants";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppContext } from "@/context/AppProvider";

interface WorkShiftPlanningSectionProps {
  shifts: WorkShift[];
  setShifts: (shifts: WorkShift[]) => void;
  constraints: AppConstraints;
  employees: Employee[];
  absenteeismEvents: AbsenteeismEvent[];
  employeeSkills: EmployeeSkill[];
}

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
};

export const WorkShiftPlanningSection: React.FC<
  WorkShiftPlanningSectionProps
> = ({
  shifts,
  setShifts,
  constraints,
  employees,
  absenteeismEvents,
  employeeSkills,
}) => {
  const inspector = useRuntimeInspector('WorkShiftPlanning');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProcessType, setSelectedProcessType] = useState<
    ProcessType | ""
  >("");
  const { addNotification } = useAppContext();

  const weekStart = getWeekStart(currentDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const relevantLines = useMemo(() => {
    if (!selectedProcessType) return [];
    return constraints.productionLines.filter(
      (line) =>
        line.processType === selectedProcessType && line.isActive !== false
    );
  }, [selectedProcessType, constraints.productionLines]);

  const relevantWorkstations = useMemo(() => {
    const workstationIds = new Set<string>();
    relevantLines.forEach((line) => {
      line.assignedWorkstations.forEach((ws) =>
        workstationIds.add(ws.definitionId)
      );
    });
    return constraints.workstationDefinitions
      .filter((wd) => workstationIds.has(wd.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [relevantLines, constraints.workstationDefinitions]);

  // Performance: Memoize this function creation as it's used inside a loop.
  const getQualifiedEmployeesForWorkstation = useCallback(
    (workstationDefId: string) => {
      const qualifiedEmployeeIds = new Set(
        employeeSkills
          .filter(
            (skill) =>
              skill.qualifications.some((q) => q.skillLevel > 0) &&
              constraints.workstationDefinitions.find(
                (wd) => wd.id === workstationDefId
              )?.machineCode === skill.machineCode
          )
          .map((skill) => skill.employeeId)
      );
      return employees.filter(
        (emp) => qualifiedEmployeeIds.has(emp.id) && emp.isActive !== false
      );
    },
    [employeeSkills, employees, constraints.workstationDefinitions]
  );

  const isEmployeeAbsent = useCallback(
    (employeeId: string, date: Date): boolean => {
      const checkTime = date.getTime();
      return absenteeismEvents.some((event) => {
        if (!event.employeeIds.includes(employeeId)) return false;
        const start = new Date(
          `${event.startDate}T${event.startTime}`
        ).getTime();
        const end = new Date(`${event.endDate}T${event.endTime}`).getTime();
        return checkTime >= start && checkTime <= end;
      });
    },
    [absenteeismEvents]
  );

  const handleShiftChange = (
    date: Date,
    lineId: string,
    workstationDefId: string,
    shiftType: "day" | "night",
    employeeId: string | null,
    assignmentIndex: number
  ) => {
    const dateString = date.toISOString().split("T")[0];

    if (employeeId && isEmployeeAbsent(employeeId, date)) {
      addNotification(
        "warning",
        `El empleado seleccionado tiene un ausentismo programado para esta fecha.`
      );
      return;
    }

    const shiftId = `${dateString}-${lineId}-${workstationDefId}-${shiftType}`;
    const existingShift = shifts.find((s) => s.id === shiftId);

    let newShifts = [...shifts];

    if (existingShift) {
      const updatedEmployeeIds = [...existingShift.employeeIds];
      if (employeeId !== null) {
        updatedEmployeeIds[assignmentIndex] = employeeId;
      } else {
        updatedEmployeeIds[assignmentIndex] = "";
      }

      const finalEmployeeIds = updatedEmployeeIds.filter((id) => id);

      if (finalEmployeeIds.length === 0) {
        newShifts = newShifts.filter((s) => s.id !== shiftId);
      } else {
        const shiftIndex = newShifts.findIndex((s) => s.id === shiftId);
        newShifts[shiftIndex] = {
          ...existingShift,
          employeeIds: finalEmployeeIds as string[],
        };
      }
    } else if (employeeId) {
      const newEmployeeIds = [];
      newEmployeeIds[assignmentIndex] = employeeId;
      newShifts.push({
        id: shiftId,
        date: dateString,
        lineId,
        workstationDefId,
        shiftType,
        employeeIds: newEmployeeIds.filter((id) => id) as string[],
      });
    }

    setShifts(newShifts);
  };

  const getShiftAssignment = (
    date: Date,
    lineId: string,
    workstationDefId: string,
    shiftType: "day" | "night"
  ): (string | null)[] => {
    const dateString = date.toISOString().split("T")[0];
    const shift = shifts.find(
      (s) =>
        s.date === dateString &&
        s.lineId === lineId &&
        s.workstationDefId === workstationDefId &&
        s.shiftType === shiftType
    );
    return shift?.employeeIds || [];
  };

  const renderWeekControls = () => (
    <div className="flex justify-between items-center mb-4">
      <button
        onClick={() =>
          setCurrentDate(
            new Date(currentDate.setDate(currentDate.getDate() - 7))
          )
        }
        className="p-2 rounded-md hover:bg-gray-200"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <h3 className="text-xl font-semibold">
        Semana del{" "}
        {weekStart.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
        })}
      </h3>
      <button
        onClick={() =>
          setCurrentDate(
            new Date(currentDate.setDate(currentDate.getDate() + 7))
          )
        }
        className="p-2 rounded-md hover:bg-gray-200"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );

  const renderFilters = () => (
    <div className="mb-6">
      <label
        htmlFor="processTypeFilter"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Filtrar por Tipo de Proceso
      </label>
      <select
        id="processTypeFilter"
        value={selectedProcessType}
        onChange={(e) =>
          setSelectedProcessType(e.target.value as ProcessType | "")
        }
        className="w-full md:w-1/3 border border-gray-300 bg-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      >
        <option value="">-- Seleccionar Proceso --</option>
        {PROCESS_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <WorkShiftIcon />
        <h2 className="text-2xl font-semibold text-gray-700">
          Planificación de Turnos de Trabajo
        </h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        {renderFilters()}
        {renderWeekControls()}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100 sticky top-0 z-20">
              <tr>
                <th className="border border-gray-300 p-2 font-semibold text-gray-700 sticky left-0 bg-gray-100 z-30">
                  Puesto / Línea
                </th>
                {weekDates.map((date) => (
                  <th
                    key={date.toISOString()}
                    className="border border-gray-300 p-2 font-semibold text-gray-700"
                  >
                    {date.toLocaleDateString("es-ES", {
                      weekday: "short",
                      day: "2-digit",
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relevantLines.map((line) =>
                relevantWorkstations
                  .filter((ws) =>
                    line.assignedWorkstations.some(
                      (as) => as.definitionId === ws.id
                    )
                  )
                  .map((ws) => {
                    const qualifiedEmployeesForPost =
                      getQualifiedEmployeesForWorkstation(ws.id);
                    const assignedWs = line.assignedWorkstations.find(
                      (as) => as.definitionId === ws.id
                    );
                    const employeesRequired = assignedWs?.quantity || 1;

                    return (
                      <React.Fragment key={`${line.id}-${ws.id}`}>
                        <tr className="bg-gray-50">
                          <td className="border border-gray-300 p-2 font-medium text-gray-800 sticky left-0 bg-gray-50 z-10 align-top">
                            {ws.name} (Req: {employeesRequired})
                            <span className="block text-xs text-gray-500">
                              {line.name}
                            </span>
                          </td>
                          <td
                            colSpan={7}
                            className="p-0 border-transparent"
                          ></td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 p-2 text-right text-sm font-medium text-gray-600 align-top sticky left-0 bg-white z-10">
                            Día
                          </td>
                          {weekDates.map((date) => (
                            <td
                              key={`${date.toISOString()}-day`}
                              className="border border-gray-300 p-1 align-top space-y-1"
                            >
                              {Array.from({ length: employeesRequired }).map(
                                (_, i) => (
                                  <select
                                    key={i}
                                    value={
                                      getShiftAssignment(
                                        date,
                                        line.id,
                                        ws.id,
                                        "day"
                                      )[i] || ""
                                    }
                                    onChange={(e) =>
                                      handleShiftChange(
                                        date,
                                        line.id,
                                        ws.id,
                                        "day",
                                        e.target.value || null,
                                        i
                                      )
                                    }
                                    className="w-full text-xs p-1 border-gray-200 rounded"
                                  >
                                    <option value="">-- Asignar --</option>
                                    {qualifiedEmployeesForPost.map((emp) => (
                                      <option
                                        key={emp.id}
                                        value={emp.id}
                                        disabled={isEmployeeAbsent(
                                          emp.id,
                                          date
                                        )}
                                      >
                                        {emp.name}{" "}
                                        {isEmployeeAbsent(emp.id, date)
                                          ? "(Ausente)"
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                )
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="border border-gray-300 p-2 text-right text-sm font-medium text-gray-600 align-top sticky left-0 bg-white z-10">
                            Noche
                          </td>
                          {weekDates.map((date) => (
                            <td
                              key={`${date.toISOString()}-night`}
                              className="border border-gray-300 p-1 align-top space-y-1"
                            >
                              {Array.from({ length: employeesRequired }).map(
                                (_, i) => (
                                  <select
                                    key={i}
                                    value={
                                      getShiftAssignment(
                                        date,
                                        line.id,
                                        ws.id,
                                        "night"
                                      )[i] || ""
                                    }
                                    onChange={(e) =>
                                      handleShiftChange(
                                        date,
                                        line.id,
                                        ws.id,
                                        "night",
                                        e.target.value || null,
                                        i
                                      )
                                    }
                                    className="w-full text-xs p-1 border-gray-200 rounded"
                                  >
                                    <option value="">-- Asignar --</option>
                                    {qualifiedEmployeesForPost.map((emp) => (
                                      <option
                                        key={emp.id}
                                        value={emp.id}
                                        disabled={isEmployeeAbsent(
                                          emp.id,
                                          date
                                        )}
                                      >
                                        {emp.name}{" "}
                                        {isEmployeeAbsent(emp.id, date)
                                          ? "(Ausente)"
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                )
                              )}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  })
              )}
              {selectedProcessType && relevantLines.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center p-4 text-gray-500">
                    No hay líneas o puestos de trabajo configurados para el tipo
                    de proceso '{selectedProcessType}'.
                  </td>
                </tr>
              )}
              {!selectedProcessType && (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-gray-600">
                    Por favor, seleccione un tipo de proceso para comenzar a
                    planificar los turnos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
