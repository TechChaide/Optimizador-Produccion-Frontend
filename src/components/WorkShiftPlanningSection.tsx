import React, {
  useState,
  useMemo,
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
  EmployeeSkill,
} from "@/types/types";
import { PROCESS_TYPE_OPTIONS } from "@/constants/constants";
import { ChevronLeft, ChevronRight, CalendarRange, Sun, Moon, UserX, Users2, LayoutGrid } from "lucide-react";
import { useAppContext } from "@/context/AppProvider";
import { toFechaEcuador } from '@/lib/fecha-ecuador';
import { cn } from "@/lib/utils";

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
  const weekEnd = weekDates[6];

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
    const dateString = toFechaEcuador(date);

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
    const dateString = toFechaEcuador(date);
    const shift = shifts.find(
      (s) =>
        s.date === dateString &&
        s.lineId === lineId &&
        s.workstationDefId === workstationDefId &&
        s.shiftType === shiftType
    );
    return shift?.employeeIds || [];
  };

  const rangeLabel = `${weekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} – ${weekEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`;

  const renderShiftSelect = (
    date: Date,
    line: (typeof relevantLines)[number],
    ws: (typeof relevantWorkstations)[number],
    shiftType: "day" | "night",
    slotIndex: number,
    qualifiedEmployeesForPost: Employee[],
  ) => {
    const value = getShiftAssignment(date, line.id, ws.id, shiftType)[slotIndex] || "";
    return (
      <select
        key={slotIndex}
        value={value}
        onChange={(e) =>
          handleShiftChange(date, line.id, ws.id, shiftType, e.target.value || null, slotIndex)
        }
        className={cn(
          "w-full rounded-lg border px-1.5 py-1 text-[11px] font-medium outline-none transition-colors focus:ring-2",
          value
            ? shiftType === "day"
              ? "border-amber-200 bg-amber-50 text-amber-800 focus:ring-amber-100"
              : "border-indigo-200 bg-indigo-50 text-indigo-800 focus:ring-indigo-100"
            : "border-dashed border-gray-200 bg-white text-gray-400 focus:ring-gray-100"
        )}
      >
        <option value="">Sin asignar</option>
        {qualifiedEmployeesForPost.map((emp) => (
          <option
            key={emp.id}
            value={emp.id}
            disabled={isEmployeeAbsent(emp.id, date)}
          >
            {emp.name}
            {isEmployeeAbsent(emp.id, date) ? " (Ausente)" : ""}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/10">
          <LayoutGrid className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Planificación de Turnos</h1>
          <p className="text-sm text-gray-500">Asigna operadores a cada puesto de trabajo por día y turno.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-5">
        {/* Selector de proceso */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
            Tipo de Proceso
          </label>
          <div className="flex flex-wrap gap-2">
            {PROCESS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedProcessType(opt.value)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  selectedProcessType === opt.value
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navegación de semana */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <button
            onClick={() =>
              setCurrentDate(
                new Date(new Date(currentDate).setDate(currentDate.getDate() - 7))
              )
            }
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CalendarRange className="h-4 w-4 text-emerald-600" />
            {rangeLabel}
          </div>
          <button
            onClick={() =>
              setCurrentDate(
                new Date(new Date(currentDate).setDate(currentDate.getDate() + 7))
              )
            }
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {!selectedProcessType ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
            <Users2 className="h-10 w-10" />
            <p className="text-sm">Selecciona un tipo de proceso para comenzar a planificar los turnos.</p>
          </div>
        ) : relevantLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
            <Users2 className="h-10 w-10" />
            <p className="text-sm">
              No hay líneas o puestos de trabajo configurados para el proceso &apos;{selectedProcessType}&apos;.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5 text-amber-500" /> Turno día</span>
              <span className="flex items-center gap-1.5"><Moon className="h-3.5 w-3.5 text-indigo-500" /> Turno noche</span>
              <span className="flex items-center gap-1.5"><UserX className="h-3.5 w-3.5 text-red-400" /> Empleado con ausentismo (no seleccionable)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20 bg-gray-50">
                  <tr>
                    <th className="sticky left-0 z-30 border-b border-r border-gray-100 bg-gray-50 p-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Puesto / Línea
                    </th>
                    {weekDates.map((date) => (
                      <th
                        key={date.toISOString()}
                        className="border-b border-gray-100 p-2 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500"
                      >
                        {date.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" })}
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
                            <tr>
                              <td colSpan={8} className="sticky left-0 border-b border-gray-100 bg-gray-50/70 px-3 py-1.5">
                                <span className="text-sm font-semibold text-gray-800">{ws.name}</span>
                                <span className="ml-2 text-xs text-gray-400">{line.name} · Req: {employeesRequired}</span>
                              </td>
                            </tr>
                            <tr className="border-b border-gray-50">
                              <td className="sticky left-0 z-10 bg-white p-2 text-right align-top">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                  <Sun className="h-3.5 w-3.5" /> Día
                                </span>
                              </td>
                              {weekDates.map((date) => (
                                <td
                                  key={`${date.toISOString()}-day`}
                                  className="space-y-1 p-1.5 align-top"
                                >
                                  {Array.from({ length: employeesRequired }).map((_, i) =>
                                    renderShiftSelect(date, line, ws, "day", i, qualifiedEmployeesForPost)
                                  )}
                                </td>
                              ))}
                            </tr>
                            <tr className="border-b border-gray-100">
                              <td className="sticky left-0 z-10 bg-white p-2 text-right align-top">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                                  <Moon className="h-3.5 w-3.5" /> Noche
                                </span>
                              </td>
                              {weekDates.map((date) => (
                                <td
                                  key={`${date.toISOString()}-night`}
                                  className="space-y-1 p-1.5 align-top"
                                >
                                  {Array.from({ length: employeesRequired }).map((_, i) =>
                                    renderShiftSelect(date, line, ws, "night", i, qualifiedEmployeesForPost)
                                  )}
                                </td>
                              ))}
                            </tr>
                          </React.Fragment>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
