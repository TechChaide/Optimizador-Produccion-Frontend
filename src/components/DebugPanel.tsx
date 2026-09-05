
"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bug, Eye, Activity, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runtimeInspector, VariableSnapshot, ExecutionContext, StateSnapshot } from '@/services/RuntimeInspector';
import { useWidgetsState } from '@/context/WidgetsStateContext';

export default function DebugPanel() {
  const { debugIsOpen, closeDebug, openDebug } = useWidgetsState();
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'variables' | 'contexts' | 'states'>('variables');
  const [variables, setVariables] = useState<VariableSnapshot[]>([]);
  const [contexts, setContexts] = useState<ExecutionContext[]>([]);
  const [states, setStates] = useState<Record<string, StateSnapshot>>({});
  const [selectedSection, setSelectedSection] = useState<string>('all');
  
  // Actualizar datos periódicamente
  useEffect(() => {
    const updateData = () => {
      setVariables(runtimeInspector.getVariables(selectedSection === 'all' ? undefined : selectedSection, 30));
      setContexts(runtimeInspector.getContexts(selectedSection === 'all' ? undefined : selectedSection, 20));
      setStates(runtimeInspector.getAllStates());
    };
    
    updateData();
    const interval = setInterval(updateData, 1000); // Actualizar cada segundo
    
    return () => clearInterval(interval);
  }, [selectedSection]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    const unsubscribe = runtimeInspector.subscribe(() => {
      setVariables(runtimeInspector.getVariables(selectedSection === 'all' ? undefined : selectedSection, 30));
      setContexts(runtimeInspector.getContexts(selectedSection === 'all' ? undefined : selectedSection, 20));
      setStates(runtimeInspector.getAllStates());
    });
    
    return unsubscribe;
  }, [selectedSection]);

  const summary = runtimeInspector.getSummary();
  const sections = summary.sections ? [...new Set(['all', ...summary.sections])] : ['all'];

  const renderValue = (value: any, depth = 0): React.ReactNode => {
    if (depth > 3) return '...';
    
    if (value === null) return <span style={{ color: '#888' }}>null</span>;
    if (value === undefined) return <span style={{ color: '#888' }}>undefined</span>;
    
    if (typeof value === 'string') {
      if (value.length > 100) {
        return <span style={{ color: '#a8e6cf' }}>"{value.substring(0, 100)}..."</span>;
      }
      return <span style={{ color: '#a8e6cf' }}>"{value}"</span>;
    }
    
    if (typeof value === 'number') {
      return <span style={{ color: '#ffd93d' }}>{value}</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span style={{ color: '#ff6b9d' }}>{value ? 'true' : 'false'}</span>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return <span>[]</span>;
      if (value.length > 5) {
        return <span>[Array({value.length})]</span>;
      }
      return <span>[{value.map((v, i) => <span key={i}>{i > 0 && ', '}{renderValue(v, depth + 1)}</span>)}]</span>;
    }
    
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return <span>{'{'}</span>;
      if (keys.length > 5) {
        return <span>{'{'}{keys.length} keys{'}'}</span>;
      }
      return (
        <div style={{ marginLeft: depth * 10 }}>
          {'{'}
          {keys.map((key, i) => (
            <div key={key} style={{ marginLeft: 10 }}>
              <span style={{ color: '#c7b3e5' }}>{key}</span>: {renderValue(value[key], depth + 1)}
              {i < keys.length - 1 && ','}
            </div>
          ))}
          {'}'}
        </div>
      );
    }
    
    return String(value);
  };

  return (
    <>
      <AnimatePresence>
        {!debugIsOpen && !isMinimized && (
          <motion.div
            key="debug-button"
            className="fixed"
            style={{ bottom: 144, right: 32, zIndex: 10000, width: 48, height: 48, borderRadius: '50%' }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 6px rgba(168,85,247,0.25)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Button
              size="icon"
              className="rounded-full flex items-center justify-center"
              style={{ 
                height: 48, 
                width: 48, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                boxShadow: '0 4px 12px rgba(102,126,234,0.10)', 
                border: '2px solid rgba(255,255,255,0.06)' 
              }}
              onClick={() => openDebug()}
              title="Abrir Debug Panel"
              aria-label="Abrir Debug Panel"
            >
              <Bug size={28} color="#ffffff" />
            </Button>
          </motion.div>
        )}
        {isMinimized && (
          <motion.div
            key="debug-button-minimized"
            className="fixed"
            style={{ bottom: 144, right: 32, zIndex: 10000, width: 48, height: 48, borderRadius: '50%' }}
            initial={{ scale: 0.78, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 6px rgba(168,85,247,0.25)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Button
              size="icon"
              className="rounded-full flex items-center justify-center"
              style={{ 
                height: 48, 
                width: 48, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                boxShadow: '0 6px 16px rgba(102,126,234,0.10)', 
                border: '2px solid rgba(255,255,255,0.06)' 
              }}
              onClick={() => { openDebug(); setIsMinimized(false); }}
              title="Abrir Debug Panel"
              aria-label="Abrir Debug Panel"
            >
              <Bug size={28} color="#ffffff" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {debugIsOpen && (
          <motion.div
            key="debug-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 600,
              height: '100vh',
              background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
              color: '#fafafa',
              borderLeft: '2px solid #667eea',
              boxShadow: '0 0 24px rgba(102,126,234,0.15)',
              zIndex: 9998,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '16px', 
              borderBottom: '1px solid #667eea', 
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bug size={24} />
                <span style={{ fontWeight: 600, fontSize: 18 }}>Runtime Inspector</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.div
                  whileTap={{ scale: 0.7, rotate: -10 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      closeDebug();
                      setIsMinimized(true);
                    }}
                    title="Minimizar"
                  >
                    <Activity className="h-5 w-5" />
                  </Button>
                </motion.div>
                <Button variant="ghost" size="icon" onClick={() => { closeDebug(); setIsMinimized(false); }} title="Cerrar">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Stats Bar */}
            <div style={{ 
              display: 'flex', 
              gap: 16, 
              padding: '12px 16px', 
              background: '#0f1419', 
              borderBottom: '1px solid #333',
              fontSize: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={14} color="#a8e6cf" />
                <span>{summary.totalVariables} vars</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color="#ffd93d" />
                <span>{summary.activeContexts} active</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} color="#ff6b9d" />
                <span>{summary.sections.length} sections</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', color: '#10b981', fontWeight: 600 }}>
                <Database size={14} color="#10b981" />
                <span>DataStore: {(() => {
                  try {
                    const { dataStore } = require('@/services/DataStore');
                    return dataStore.getSummary().availableKeys.length;
                  } catch {
                    return 0;
                  }
                })()} datasets</span>
              </div>
            </div>

            {/* Section Filter */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', background: '#0f1419' }}>
              <select 
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1a1a2e',
                  color: '#fafafa',
                  border: '1px solid #667eea',
                  borderRadius: 6,
                  fontSize: 13
                }}
              >
                {sections.map((sec, index) => (
                  <option key={`${sec}-${index}`} value={sec}>
                    {sec === 'all' ? 'All Sections' : sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #333', background: '#0f1419' }}>
              <button
                onClick={() => setActiveTab('variables')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'variables' ? '#1a1a2e' : 'transparent',
                  color: activeTab === 'variables' ? '#667eea' : '#aaa',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === 'variables' ? 600 : 'normal',
                  borderBottom: activeTab === 'variables' ? '2px solid #667eea' : 'none'
                }}
              >
                Variables ({variables.length})
              </button>
              <button
                onClick={() => setActiveTab('contexts')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'contexts' ? '#1a1a2e' : 'transparent',
                  color: activeTab === 'contexts' ? '#667eea' : '#aaa',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === 'contexts' ? 600 : 'normal',
                  borderBottom: activeTab === 'contexts' ? '2px solid #667eea' : 'none'
                }}
              >
                Contexts ({contexts.length})
              </button>
              <button
                onClick={() => setActiveTab('states')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'states' ? '#1a1a2e' : 'transparent',
                  color: activeTab === 'states' ? '#667eea' : '#aaa',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === 'states' ? 600 : 'normal',
                  borderBottom: activeTab === 'states' ? '2px solid #667eea' : 'none'
                }}
              >
                States ({Object.keys(states).length})
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#0f1419' }}>
              {activeTab === 'variables' && (
                <div>
                  {variables.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                      No variables captured yet
                    </div>
                  ) : (
                    variables.slice().reverse().map((v) => {
                      const uniqueKey = `${v.id}-${v.timestamp.getTime()}`;
                      return (
                        <div 
                          key={uniqueKey}
                          style={{ 
                            marginBottom: 12, 
                            padding: 12, 
                            background: '#1a1a2e', 
                            borderRadius: 8,
                            borderLeft: '3px solid #667eea',
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: '#667eea', fontWeight: 600 }}>
                              [{v.section}] {v.scope}
                            </span>
                            <span style={{ color: '#888', fontSize: 10 }}>
                              {v.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ color: '#c7b3e5', fontWeight: 500 }}>{v.name}</span>
                            <span style={{ color: '#888', marginLeft: 8 }}>({v.type})</span>
                          </div>
                          <div style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 11 }}>
                            {renderValue(v.value)}
                          </div>
                          {v.metadata?.description && (
                            <div style={{ marginTop: 6, color: '#888', fontSize: 10, fontStyle: 'italic' }}>
                              {v.metadata.description}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'contexts' && (
                <div>
                  {contexts.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                      No execution contexts captured yet
                    </div>
                  ) : (
                    contexts.slice().reverse().map((ctx) => {
                      const statusColor = ctx.status === 'completed' ? '#a8e6cf' : 
                                        ctx.status === 'failed' ? '#ff6b9d' : '#ffd93d';
                      const uniqueKey = `${ctx.id}-${ctx.timestamp.getTime()}`;
                      return (
                        <div 
                          key={uniqueKey}
                          style={{ 
                            marginBottom: 12, 
                            padding: 12, 
                            background: '#1a1a2e', 
                            borderRadius: 8,
                            borderLeft: `3px solid ${statusColor}`,
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: statusColor, fontWeight: 600 }}>
                              [{ctx.section}] {ctx.action}
                            </span>
                            <span style={{ color: '#888', fontSize: 10 }}>
                              {ctx.duration ? `${ctx.duration}ms` : 'running...'}
                            </span>
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ 
                              color: statusColor, 
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              fontSize: 10
                            }}>
                              {ctx.status}
                            </span>
                          </div>
                          {ctx.inputs && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>Inputs:</div>
                              <div style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 11 }}>
                                {renderValue(ctx.inputs)}
                              </div>
                            </div>
                          )}
                          {ctx.outputs && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>Outputs:</div>
                              <div style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 11 }}>
                                {renderValue(ctx.outputs)}
                              </div>
                            </div>
                          )}
                          {ctx.error && (
                            <div style={{ marginTop: 6, color: '#ff6b9d', fontSize: 11 }}>
                              Error: {ctx.error}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'states' && (
                <div>
                  {Object.keys(states).length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                      No component states captured yet
                    </div>
                  ) : (
                    Object.entries(states).map(([section, state]) => {
                      const uniqueKey = `state-${section}-${state.timestamp.getTime()}`;
                      return (
                        <div 
                          key={uniqueKey}
                          style={{ 
                            marginBottom: 12, 
                            padding: 12, 
                            background: '#1a1a2e', 
                            borderRadius: 8,
                            borderLeft: '3px solid #764ba2',
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ color: '#764ba2', fontWeight: 600 }}>
                              {section}
                            </span>
                            <span style={{ color: '#888', fontSize: 10 }}>
                              {state.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div style={{ marginTop: 8 }}>
                            <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>State:</div>
                            <div style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 11 }}>
                              {renderValue(JSON.parse(state.state as string))}
                            </div>
                          </div>
                          
                          {state.props && Object.keys(JSON.parse(state.props as string)).length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>Props:</div>
                              <div style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 11 }}>
                                {renderValue(JSON.parse(state.props as string))}
                              </div>
                            </div>
                          )}
                          
                          {state.computed && Object.keys(JSON.parse(state.computed as string)).length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>Computed:</div>
                              <div style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 11 }}>
                                {renderValue(JSON.parse(state.computed as string))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
