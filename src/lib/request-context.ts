import { AsyncLocalStorage } from 'node:async_hooks';
import type { Operation } from '@/services/OperationTracker';
import type { VariableSnapshot, StateSnapshot } from '@/services/RuntimeInspector';
import type { SyncStatus, PlanningProgress } from '@/types/types';

export interface ChatOperationsSummary {
  total: number;
  active: number;
  completed: number;
  failed: number;
  bySection: Record<string, number>;
}

export interface ChatRuntimeInspectorSummary {
  totalVariables: number;
  totalContexts: number;
  activeContexts: number;
  sections: string[];
  recentActivity: Array<{ section: string; action: string; timestamp: Date }>;
}

export interface ChatRuntimeInspectorContext {
  summary: ChatRuntimeInspectorSummary;
  variables: VariableSnapshot[];
  states: Record<string, StateSnapshot>;
}

/**
 * Loosely-shaped bag of context assembled ad-hoc by ChatInterface.tsx before being
 * sent to the AI assistant server actions. Sample/full arrays hold rows sourced from
 * several different app slices (sales, plan, employees, etc.) whose individual field
 * names are accessed defensively with multiple aliases inside chat-tools.ts, so their
 * element shape is intentionally left as a generic record rather than a canonical type.
 */
export interface ChatContextData {
  operationsSummary?: ChatOperationsSummary;
  activeOperations?: Operation[];
  recentOperations?: Operation[];
  runtimeInspector?: ChatRuntimeInspectorContext;
  salesDataSample?: Array<Record<string, unknown>>;
  salesDataFull?: Array<Record<string, unknown>>;
  productionPlanSample?: Array<Record<string, unknown>>;
  productionPlanFull?: Array<Record<string, unknown>>;
  employeesSample?: Array<Record<string, unknown>>;
  employeesFull?: Array<Record<string, unknown>>;
  maintenanceSample?: Array<Record<string, unknown>>;
  maintenanceFull?: Array<Record<string, unknown>>;
  absenteeismSample?: Array<Record<string, unknown>>;
  absenteeismFull?: Array<Record<string, unknown>>;
  workShiftSample?: Array<Record<string, unknown>>;
  workShiftsFull?: Array<Record<string, unknown>>;
  tacticalPlanSample?: Array<Record<string, unknown>>;
  tacticalPlanFull?: Array<Record<string, unknown>>;
  constraintsSummary?: Record<string, unknown>;
  syncStatus?: SyncStatus | null;
  planningProgress?: PlanningProgress | null;
  includeFull?: boolean;
  [key: string]: unknown;
}

export const requestContext = new AsyncLocalStorage<ChatContextData>();

export function getRequestContext() {
  return requestContext.getStore();
}
