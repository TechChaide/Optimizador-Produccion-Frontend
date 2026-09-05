"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  canClickSteps?: boolean;
}

export default function Stepper({
  steps,
  currentStep,
  onStepClick,
  canClickSteps = false,
}: StepperProps) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const isClickable = canClickSteps && step.id < currentStep;

        return (
          <div key={step.id} className="flex gap-4">
            {/* Círculo con número */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => isClickable && onStepClick?.(step.id)}
                className={cn(
                  "flex items-center justify-center w-14 h-14 rounded-full font-bold text-lg transition-all duration-300 flex-shrink-0",
                  isActive && "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg scale-110",
                  isCompleted && "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md",
                  !isActive && !isCompleted && "bg-gray-100 text-gray-400",
                  isClickable && "cursor-pointer hover:shadow-lg hover:scale-105"
                )}
                disabled={!isClickable}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  step.id
                )}
              </button>

              {/* Línea conectora */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-1.5 h-12 mt-2 rounded-full transition-all duration-300",
                    isCompleted ? "bg-gradient-to-b from-emerald-500 to-emerald-300" : 
                    isActive ? "bg-gradient-to-b from-blue-600 to-blue-300" : 
                    "bg-gray-100"
                  )}
                />
              )}
            </div>

            {/* Contenido del paso */}
            <div className={cn(
              "flex-1 pt-2 px-3 py-2 rounded-lg transition-all duration-300",
              isActive && "bg-blue-50 border border-blue-200",
              isCompleted && "opacity-75"
            )}>
              <h3
                className={cn(
                  "font-bold text-base transition-all duration-300",
                  isActive && "text-blue-700",
                  isCompleted && "text-emerald-700",
                  !isActive && !isCompleted && "text-gray-500"
                )}
              >
                {step.title}
              </h3>
              <p className={cn(
                "text-xs mt-1 transition-all duration-300",
                isActive && "text-blue-600",
                isCompleted && "text-emerald-600",
                !isActive && !isCompleted && "text-gray-400"
              )}>
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
