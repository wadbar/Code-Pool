import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Activity, X, Trash2, Zap } from 'lucide-react';
import { socketHub } from '../POOL/modules/AUTOMATION/SocketHub';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  context: string;
  message: string;
  timestamp: string;
}

export const LiveLogDashboard: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketHub.onEvent('log', (newLog: LogEntry) => {
      setLogs(prev => [...prev, { ...newLog, timestamp: new Date().toLocaleTimeString() }].slice(-100));
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed top-0 right-0 h-full w-[450px] bg-[var(--md-sys-color-surface-container-high)] border-l border-[var(--md-sys-color-outline-variant)] shadow-2xl z-[100] flex flex-col"
    >
      <div className="p-6 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between bg-[var(--md-sys-color-surface-container-highest)]">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[var(--md-sys-color-primary)] rounded-xl text-white">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight on-surface">LiveLogDashboard</h3>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--md-sys-color-primary)] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-[var(--md-sys-color-primary)] animate-pulse" />
              Real-time System Audit
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-[var(--md-sys-color-surface-variant)] rounded-full transition-all">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 bg-[var(--md-sys-color-surface-container)] flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]">
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-black/10 rounded-lg text-xs font-mono font-bold uppercase">
              <Activity className="w-4 h-4" />
              {logs.length} entries
            </div>
          </div>
          <button 
            onClick={() => setLogs([])}
            className="p-2 hover:text-[var(--md-sys-color-error)] transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-[13px] custom-scrollbar bg-black/5"
        >
          <AnimatePresence initial={false}>
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                <Zap className="w-16 h-16" />
                <p className="font-bold uppercase tracking-widest text-xs">Waiting for events...</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-2 last:mb-0 border-l-2 border-transparent hover:border-[var(--md-sys-color-primary)] hover:bg-white/5 pl-3 py-1 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] on-surface-variant opacity-40 font-bold">{log.timestamp}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase text-white ${
                      log.level === 'ERROR' ? 'bg-[var(--md-sys-color-error)]' :
                      log.level === 'WARN' ? 'bg-[var(--md-sys-color-tertiary)]' :
                      log.level === 'DEBUG' ? 'bg-zinc-500' : 'bg-[var(--md-sys-color-primary)]'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-[10px] text-[var(--md-sys-color-primary)] font-black uppercase tracking-tighter">[{log.context}]</span>
                  </div>
                  <div className="on-surface font-medium leading-relaxed break-all">
                    {log.message}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
