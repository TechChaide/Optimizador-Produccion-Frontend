"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLogs } from "@/context/LogContext";
import { useWidgetsState } from "@/context/WidgetsStateContext";
import ChatInterface from "./ChatInterface";
import BotMessageSquare from "@/components/ui/BotMessageSquare";

export default function FloatingChatWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  const { chatIsOpen, openChat, closeChat } = useWidgetsState();

  const constraintsRef = useRef(null);
  const { logs } = useLogs();

  const handleClose = () => {
    closeChat();
    setIsMinimized(false);
  };

  return (
    <>
      {!isMinimized && !chatIsOpen && (
        <motion.div
          drag={false}
          whileHover={{ scale: 1.05, boxShadow: '0 0 6px rgba(99,102,241,0.25)' }}
          whileTap={{ scale: 0.96 }}
          className="fixed"
          style={{ bottom: 32, right: 32, zIndex: 10001, width: 48, height: 48, borderRadius: '50%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <Button
            size="icon"
            className="rounded-full flex items-center justify-center"
            style={{ height: 48, width: 48, background: '#18181b', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '2px solid rgba(255,255,255,0.12)' }}
            onClick={() => openChat()}
            title="Abrir chat"
          >
            <BotMessageSquare width={46} height={46} />
          </Button>
        </motion.div>
      )}
      {isMinimized && (
        <motion.div
          className="fixed"
          style={{ bottom: 32, right: 32, zIndex: 10001, width: 48, height: 48, borderRadius: '50%' }}
          initial={{ scale: 0.78, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ boxShadow: '0 0 6px rgba(99,102,241,0.25)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <Button
            size="icon"
            className="rounded-full flex items-center justify-center"
            style={{ height: 48, width: 48, background: '#18181b', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '2px solid rgba(255,255,255,0.12)' }}
            onClick={() => { openChat(); setIsMinimized(false); }}
            title="Abrir chat"
            aria-label="Abrir chat"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { openChat(); setIsMinimized(false); } }}
          >
            <BotMessageSquare width={46} height={46} />
          </Button>
        </motion.div>
      )}

      <AnimatePresence>
        {chatIsOpen && !isMinimized && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-50"
              style={{ pointerEvents: "none" }}
            />
            {/* Panel dividido */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{
                  x: 0,
                  y: 0,
                  width: 700,
                  height: '100vh',
                  borderRadius: 16,
                  scale: 1,
                }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 z-50 flex"
              style={{ minWidth: isMinimized ? 56 : 700, background: '#ffffff', color: '#111827', boxShadow: '0 8px 40px rgba(16,24,40,0.12)', borderLeft: '1px solid #e6e6e6', overflow: 'hidden' }}
            >
              <div className="flex flex-col w-full h-full">
                <div className="flex items-center justify-between p-4 border-b" style={{ borderBottomColor: '#e6e6e6' }}>
                  <h2 className="font-semibold text-lg" style={{ color: '#111827' }}>Production Assistant</h2>
                  <div className="flex gap-2">
                    <motion.div
                      whileTap={{ scale: 0.78, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          // Minimizar: cerrar panel y mostrar solo el botón flotante
                          closeChat();
                          setIsMinimized(true);
                        }}
                        style={{ color: '#111827' }}
                      >
                        <Terminal className="h-6 w-6" />
                      </Button>
                    </motion.div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClose}
                      style={{ color: '#111827' }}
                    >
                      <X className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
                {!isMinimized && (
                  <div className="flex-1 overflow-hidden bg-white">
                    <ChatInterface />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
