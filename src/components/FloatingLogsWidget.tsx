"use client";
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogs } from '@/context/LogContext';
import { useOperations } from '@/context/OperationContext';
import { useWidgetsState } from '@/context/WidgetsStateContext';

export default function FloatingLogsWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  // avoid using `window` at module init to prevent SSR errors
  const [, setPosition] = useState({ x: 0, y: 0 });
  const [minimizedProps, setMinimizedProps] = useState({ y: 0, width: 56, height: 56 });
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const { logs, clearLogs } = useLogs();
  const { operations, activeOperations, summary } = useOperations();
  const [showOperations, setShowOperations] = useState(true);
  const { logsIsOpen, openLogs, closeLogs } = useWidgetsState();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const logsBottom = 88; // matches UI placement (chat bottom 32 + chatHeight 48 + gap 8)
      // set sensible initial position on client mount
      setPosition({ x: window.innerWidth - 420, y: window.innerHeight - 340 });
      setMinimizedProps({
        y: window.innerHeight - logsBottom - 48, // panel top candidate so it animates toward the button
        width: 48,
        height: 48,
      });
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPosition({
          x: e.clientX - offset.current.x,
          y: e.clientY - offset.current.y,
        });
      }
    };
    const handleMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleClose = () => {
    closeLogs();
    setIsMinimized(false);
  };

  return (
    <>
      <AnimatePresence>
        {!logsIsOpen && !isMinimized && (
          <motion.div
            key="logs-button-open"
            className="fixed"
            style={{ bottom: 88, right: 32, zIndex: 10000, width: 48, height: 48, borderRadius: '50%' }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 6px rgba(34,197,94,0.25)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Button
              size="icon"
              className="rounded-full flex items-center justify-center"
              style={{ height: 48, width: 48, background: '#10b981', boxShadow: '0 4px 12px rgba(16,185,129,0.10)', border: '2px solid rgba(255,255,255,0.06)' }}
              onClick={() => openLogs()}
              title="Abrir logs"
              aria-label="Abrir logs"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { openLogs(); } }}
            >
              <Terminal size={28} color="#ffffff" />
            </Button>
          </motion.div>
        )}
        {isMinimized && (
          <motion.div
            key="logs-button-minimized"
            className="fixed"
            style={{ bottom: 88, right: 32, zIndex: 10000, width: 48, height: 48, borderRadius: '50%' }}
            initial={{ scale: 0.78, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 6px rgba(34,197,94,0.25)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Button
              size="icon"
              className="rounded-full flex items-center justify-center"
              style={{ height: 48, width: 48, background: '#10b981', boxShadow: '0 6px 16px rgba(16,185,129,0.10)', border: '2px solid rgba(255,255,255,0.06)' }}
              onClick={() => { openLogs(); setIsMinimized(false); }}
              title="Abrir logs"
              aria-label="Abrir logs"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { openLogs(); setIsMinimized(false); } }}
            >
              <Terminal size={28} color="#ffffff" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {logsIsOpen && (
          <motion.div
            key="logs-widget"
            ref={widgetRef}
          initial={{ x: '100%' }}
          animate={isMinimized ? {
            x: 0,
            y: minimizedProps.y,
            width: minimizedProps.width,
            height: minimizedProps.height,
            borderRadius: 28,
            scale: 0.7,
          } : {
            x: 0,
            y: 0,
            width: 400,
            height: '100vh',
            borderRadius: 16,
            scale: 1,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            background: '#18181b',
            color: '#fafafa',
            borderLeft: '2px solid #e53935',
            boxShadow: '0 0 24px rgba(229,57,53,0.15)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e53935', background: '#18181b', borderTopLeftRadius: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 18 }}>Logs & Operations</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <motion.div
                whileTap={{ scale: 0.7, rotate: -10 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Minimizar: cerrar panel y mostrar solo el botón flotante
                    closeLogs();
                    setIsMinimized(true);
                  }}
                >
                  <Terminal className="h-5 w-5" />
                </Button>
              </motion.div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {!isMinimized && (
            <div style={{ display: 'flex', borderBottom: '1px solid #444', background: '#18181b', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
              <div style={{ display: 'flex', flex: 1 }}>
                <button
                  onClick={() => setShowOperations(false)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: showOperations ? '#18181b' : '#2a2a2d',
                    color: '#fafafa',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: showOperations ? 'normal' : 500,
                    borderBottom: showOperations ? 'none' : '2px solid #e53935'
                  }}
                >
                  Logs ({logs.length})
                </button>
                <button
                  onClick={() => setShowOperations(true)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: showOperations ? '#2a2a2d' : '#18181b',
                    color: '#fafafa',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: showOperations ? 500 : 'normal',
                    borderBottom: showOperations ? '2px solid #10b981' : 'none'
                  }}
                >
                  Operations ({operations.length})
                  {activeOperations.length > 0 && (
                    <span style={{ marginLeft: 4, color: '#10b981', fontWeight: 'bold' }}>
                      ●
                    </span>
                  )}
                </button>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearLogs}
                title="Limpiar todos los logs"
                style={{ padding: '4px 8px', height: 'auto' }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!isMinimized && (
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', background: '#18181b', color: '#fafafa', borderBottomLeftRadius: 16 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5, fontSize: 12 }}>
                {showOperations ? (
                  <>
                    {/* Mostrar resumen de operaciones */}
                    <div style={{ marginBottom: '12px', padding: '8px', background: '#232326', borderRadius: 8, borderLeft: '3px solid #10b981' }}>
                      <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: 4 }}>Operations Summary</div>
                      <div style={{ fontSize: 11, color: '#ccc' }}>
                        Total: {summary.total} | Active: {summary.active} | Completed: {summary.completed} | Failed: {summary.failed}
                      </div>
                    </div>

                    {/* Mostrar operaciones activas */}
                    {activeOperations.length > 0 && (
                      <>
                        <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: 8, fontSize: 12 }}>Active Operations</div>
                        {activeOperations.map((op) => {
                          // Usar id + timestamp para clave única y estable
                          const uniqueKey = `active-${op.id}-${op.timestamp.getTime()}`;
                          return (
                            <div key={uniqueKey} style={{ marginBottom: '8px', padding: '8px', background: '#232326', borderRadius: 8, borderLeft: '3px solid #fbbf24', fontSize: 12 }}>
                              <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                                [{op.section}] {op.description}
                              </div>
                              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                                Type: {op.type} | Status: {op.status}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Mostrar operaciones recientes */}
                    <div style={{ color: '#e53935', fontWeight: 'bold', marginBottom: 8, fontSize: 12, marginTop: 12 }}>Recent Operations</div>
                    {operations.slice(-15).map((op) => {
                      const statusColor = op.status === 'completed' ? '#10b981' : op.status === 'failed' ? '#ef4444' : '#fbbf24';
                      const duration = op.duration ? ` [${op.duration}ms]` : '';
                      const error = op.error ? ` - ERROR: ${op.error}` : '';
                      // Usar índice + id para crear clave única y estable
                      const uniqueKey = `${op.id}-${op.timestamp.getTime()}`;

                      return (
                        <div key={uniqueKey} style={{ marginBottom: '8px', padding: '8px', background: '#232326', borderRadius: 8, borderLeft: `3px solid ${statusColor}`, fontSize: 11 }}>
                          <div style={{ color: statusColor, fontWeight: 'bold' }}>
                            [{op.section}] {op.status.toUpperCase()}
                          </div>
                          <div style={{ color: '#ccc', marginTop: 2 }}>
                            {op.description}
                            {duration && <span style={{ color: '#999' }}>{duration}</span>}
                          </div>
                          {error && <div style={{ color: '#ef4444', marginTop: 2, fontSize: 10 }}>{error}</div>}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {logs.map((log) => {
                      let timeStr = '';
                      if (log.timestamp) {
                        if (typeof log.timestamp === 'string') {
                          timeStr = log.timestamp;
                        } else if (log.timestamp instanceof Date) {
                          const d = log.timestamp;
                          timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
                        }
                      }
                      // Usar id + timestamp para clave única y estable
                      const uniqueKey = `log-${log.id}-${typeof log.timestamp === 'object' ? log.timestamp.getTime() : log.timestamp}`;
                      return (
                        <div key={uniqueKey} style={{ marginBottom: '8px', padding: '8px', background: '#232326', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: '#e53935', fontSize: 10, minWidth: 70, flexShrink: 0 }}>{timeStr}</span>
                          <span>{log.message}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </pre>
            </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
