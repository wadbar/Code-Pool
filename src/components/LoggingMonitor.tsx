import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Shield, Activity, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketHub } from '../POOL/modules/AUTOMATION/SocketHub';

interface LogEntry {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  context: string;
  message: string;
  timestamp: string;
}

export const LoggingMonitor: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLog = (data: any) => {
      setLogs(prev => [...prev.slice(-49), {
        id: Math.random().toString(36).substr(2, 9),
        level: data.level || 'INFO',
        context: data.context || 'SYS',
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };

    socketHub.onEvent('log', handleLog);
    return () => { /* Persistent singleton stream */ };
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
      className="fixed top-0 right-0 h-full w-[450px] bg-[var(--md-sys-color-surface-container-highest)] border-l border-[var(--md-sys-color-outline-variant)] shadow-[-20px_0_40px_rgba(0,0,0,0.2)] z-[100] flex flex-col"
    >
      <div className="p-8 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between bg-[var(--md-sys-color-surface-container-high)]">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--md-sys-color-primary)] rounded-xl text-white">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black on-surface tracking-tighter">Live Telemetry</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">SocketHub Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={() => setLogs([])}
            className="p-3 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-full on-surface-variant transition-colors"
           >
            <Trash2 className="w-5 h-5 opacity-40 hover:opacity-100" />
           </button>
           <button 
            onClick={onClose}
            className="p-3 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-full on-surface-variant transition-colors"
           >
            <X className="w-6 h-6" />
           </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 font-mono text-[11px] space-y-3 custom-scrollbar bg-black/95 select-text"
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-4 group"
            >
              <span className="text-white/20 whitespace-nowrap">[{log.timestamp}]</span>
              <span className={`font-black whitespace-nowrap min-w-[50px] ${
                log.level === 'ERROR' ? 'text-red-400' : 
                log.level === 'WARN' ? 'text-amber-400' : 
                log.level === 'DEBUG' ? 'text-blue-400' : 'text-emerald-400'
              }`}>
                {log.level}
              </span>
              <span className="text-white/40 uppercase font-black truncate max-w-[80px]">{log.context}</span>
              <span className="text-white/80 leading-relaxed break-all">{log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4">
            <Activity className="w-16 h-16" />
            <span className="text-sm font-black uppercase tracking-[0.3em]">No Active Streams</span>
          </div>
        )}
      </div>

      <div className="p-6 bg-[var(--md-sys-color-surface-container-high)] border-t border-[var(--md-sys-color-outline-variant)] text-[10px] font-black on-surface-variant uppercase tracking-widest flex items-center justify-between">
         <span>Buffer Size: {logs.length} / 50</span>
         <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connection: Stabilized</span>
         </div>
      </div>
    </motion.div>
  );
};
