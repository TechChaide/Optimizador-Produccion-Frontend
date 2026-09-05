'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLogs } from '@/context/LogContext';
import { sendMessage, ChatMessage } from '@/app/actions/chat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ChatInterface() {
  const { logs } = useLogs();
  const appContext = require('@/context/AppProvider');
  const ctx = appContext.useAppContext();
  const {
    salesData,
    productionPlan,
    constraints,
    syncStatus,
    planningProgress,
    employees,
    maintenanceEvents,
    absenteeismEvents,
    workShifts,
    tacticalPlanResult
  } = ctx;
  
  const CHAT_HISTORY_KEY = 'production_assistant_chat_history';
  
  const loadMessagesFromStorage = (): ChatMessage[] => {
    if (typeof window === 'undefined') return [{ role: 'model', content: 'Hello! I am your Production Assistant. How can I help you today?' }];
    
    try {
      const stored = localStorage.getItem(CHAT_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
    
    return [{ role: 'model', content: 'Hello! I am your Production Assistant. How can I help you today?' }];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessagesFromStorage);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shareContext, setShareContext] = useState(true);
  const [shareFullData, setShareFullData] = useState(false);
  const [shareSales, setShareSales] = useState(true);
  const [sharePlan, setSharePlan] = useState(true);
  const [shareConstraints, setShareConstraints] = useState(true);
  const [shareEmployees, setShareEmployees] = useState(true);
  const [shareMaintenance, setShareMaintenance] = useState(true);
  const [shareAbsenteeism, setShareAbsenteeism] = useState(true);
  const [shareWorkShifts, setShareWorkShifts] = useState(true);
  const [shareTactical, setShareTactical] = useState(true);
  const [showSharingModal, setShowSharingModal] = useState(false);
  
  const [modalShareSales, setModalShareSales] = useState(shareSales);
  const [modalSharePlan, setModalSharePlan] = useState(sharePlan);
  const [modalShareConstraints, setModalShareConstraints] = useState(shareConstraints);
  const [modalShareEmployees, setModalShareEmployees] = useState(shareEmployees);
  const [modalShareMaintenance, setModalShareMaintenance] = useState(shareMaintenance);
  const [modalShareAbsenteeism, setModalShareAbsenteeism] = useState(shareAbsenteeism);
  const [modalShareWorkShifts, setModalShareWorkShifts] = useState(shareWorkShifts);
  const [modalShareTactical, setModalShareTactical] = useState(shareTactical);
  const [modalShareFullData, setModalShareFullData] = useState(shareFullData);

  useEffect(() => {
    if (showSharingModal) {
      setModalShareSales(shareSales);
      setModalSharePlan(sharePlan);
      setModalShareConstraints(shareConstraints);
      setModalShareEmployees(shareEmployees);
      setModalShareMaintenance(shareMaintenance);
      setModalShareAbsenteeism(shareAbsenteeism);
      setModalShareWorkShifts(shareWorkShifts);
      setModalShareTactical(shareTactical);
      setModalShareFullData(shareFullData);
    }
  }, [showSharingModal, shareSales, sharePlan, shareConstraints, shareEmployees, shareMaintenance, shareAbsenteeism, shareWorkShifts, shareTactical, shareFullData]);

  const selectedCount = [shareSales, sharePlan, shareConstraints, shareEmployees, shareMaintenance, shareAbsenteeism, shareWorkShifts, shareTactical].filter(Boolean).length;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving chat history:', error);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const recentLogs = logs.slice(-50);
      const contextData: any = {};
      
      if (shareSales) {
        contextData.salesDataSample = salesData?.slice(0, 10);
        if (shareFullData) contextData.salesDataFull = salesData?.slice(0, Math.min(salesData?.length || 0, 500));
      }
      if (sharePlan) {
        contextData.productionPlanSample = productionPlan?.monthlyPlan?.slice(0, 10);
        if (shareFullData) contextData.productionPlanFull = productionPlan?.monthlyPlan?.slice(0, Math.min(productionPlan?.monthlyPlan?.length || 0, 500));
      }
      if (shareEmployees) {
        contextData.employeesSample = employees?.slice?.(0, 5);
        if (shareFullData) contextData.employeesFull = employees?.slice?.(0, Math.min(employees?.length || 0, 500));
      }
      if (shareMaintenance) {
        contextData.maintenanceSample = maintenanceEvents?.slice?.(0, 5);
        if (shareFullData) contextData.maintenanceFull = maintenanceEvents?.slice?.(0, Math.min(maintenanceEvents?.length || 0, 500));
      }
      if (shareAbsenteeism) {
        contextData.absenteeismSample = absenteeismEvents?.slice?.(0, 5);
        if (shareFullData) contextData.absenteeismFull = absenteeismEvents?.slice?.(0, Math.min(absenteeismEvents?.length || 0, 500));
      }
      if (shareWorkShifts) {
        contextData.workShiftSample = workShifts?.slice?.(0, 5);
        if (shareFullData) contextData.workShiftsFull = workShifts?.slice?.(0, Math.min(workShifts?.length || 0, 500));
      }
      if (shareTactical) {
        contextData.tacticalPlanSample = tacticalPlanResult?.plan?.slice?.(0, 5);
        if (shareFullData) contextData.tacticalPlanFull = tacticalPlanResult?.plan?.slice?.(0, Math.min(tacticalPlanResult?.plan?.length || 0, 500));
      }
      if (shareConstraints) {
        contextData.constraintsSummary = {
          workCenters: constraints?.workCenters?.length,
          productionLines: constraints?.productionLines?.length,
          workstationDefinitions: constraints?.workstationDefinitions?.length
        };
      }
      
      contextData.syncStatus = syncStatus;
      contextData.planningProgress = planningProgress;
      contextData.includeFull = shareFullData;
      
      const response = await sendMessage([...messages, userMessage], recentLogs, shareContext ? contextData : undefined);
      setMessages(prev => [...prev, { role: 'model', content: response.text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: 'Sorry, something went wrong.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('¿Estás seguro de que deseas limpiar todo el historial de conversación?');
      if (confirmed) {
        const initialMessage: ChatMessage[] = [{ role: 'model', content: 'Hello! I am your Production Assistant. How can I help you today?' }];
        setMessages(initialMessage);
        localStorage.removeItem(CHAT_HISTORY_KEY);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar de configuración */}
      <div className="p-3 border-b bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center text-sm fontle-medium cursor-pointer">
              <input 
                type="checkbox" 
                checked={shareContext} 
                onChange={(e) => setShareContext(e.target.checked)} 
                className="mr-2"
              />
              Share app data
            </label>
            
            <Dialog open={showSharingModal} onOpenChange={setShowSharingModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Configure {selectedCount > 0 && `(${selectedCount})`}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure shared data</DialogTitle>
                  <DialogDescription>Choose which data the assistant may use.</DialogDescription>
                </DialogHeader>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareSales} onChange={e => setModalShareSales(e.target.checked)} className="mr-2" />
                    Sales ({salesData?.length || 0})
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalSharePlan} onChange={e => setModalSharePlan(e.target.checked)} className="mr-2" />
                    Plan ({productionPlan?.monthlyPlan?.length || 0})
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareConstraints} onChange={e => setModalShareConstraints(e.target.checked)} className="mr-2" />
                    Constraints
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareEmployees} onChange={e => setModalShareEmployees(e.target.checked)} className="mr-2" />
                    Employees ({employees?.length || 0})
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareMaintenance} onChange={e => setModalShareMaintenance(e.target.checked)} className="mr-2" />
                    Maintenance ({maintenanceEvents?.length || 0})
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareAbsenteeism} onChange={e => setModalShareAbsenteeism(e.target.checked)} className="mr-2" />
                    Absentees ({absenteeismEvents?.length || 0})
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareWorkShifts} onChange={e => setModalShareWorkShifts(e.target.checked)} className="mr-2" />
                    Work Shifts ({workShifts?.length || 0})
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={modalShareTactical} onChange={e => setModalShareTactical(e.target.checked)} className="mr-2" />
                    Tactical Plan ({tacticalPlanResult?.plan?.length || 0})
                  </label>
                </div>
                <div className="mt-4">
                  <label className="inline-flex items-center text-sm">
                    <input type="checkbox" checked={modalShareFullData} onChange={(e) => {
                      if (e.target.checked) {
                        const ok = typeof window !== 'undefined' ? window.confirm('Sharing full data may expose sensitive information. Proceed?') : true;
                        if (ok) setModalShareFullData(true);
                      } else {
                        setModalShareFullData(false);
                      }
                    }} className="mr-2" />
                    Include full data (may include PII)
                  </label>
                  {modalShareFullData && (
                    <div className="text-xs text-red-600 mt-1">⚠️ Full data mode enabled</div>
                  )}
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="ghost" onClick={() => {
                    setModalShareSales(shareSales);
                    setModalSharePlan(sharePlan);
                    setModalShareConstraints(shareConstraints);
                    setModalShareEmployees(shareEmployees);
                    setModalShareMaintenance(shareMaintenance);
                    setModalShareAbsenteeism(shareAbsenteeism);
                    setModalShareWorkShifts(shareWorkShifts);
                    setModalShareTactical(shareTactical);
                    setModalShareFullData(shareFullData);
                    setShowSharingModal(false);
                  }}>Cancel</Button>
                  <Button onClick={() => {
                    setShareSales(modalShareSales);
                    setSharePlan(modalSharePlan);
                    setShareConstraints(modalShareConstraints);
                    setShareEmployees(modalShareEmployees);
                    setShareMaintenance(modalShareMaintenance);
                    setShareAbsenteeism(modalShareAbsenteeism);
                    setShareWorkShifts(modalShareWorkShifts);
                    setShareTactical(modalShareTactical);
                    setShareFullData(modalShareFullData);
                    setShowSharingModal(false);
                  }}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {shareFullData && <span className="text-xs font-semibold text-red-600 px-2 py-1 rounded bg-red-50">Full Data</span>}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{messages.length} msgs</span>
            <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-xs h-7">
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <div className="prose prose-sm dark:prose-invert">
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the system status..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
