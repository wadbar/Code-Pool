import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Activity, CheckCircle2, AlertCircle, Zap, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketHub } from '../POOL/modules/AUTOMATION/SocketHub';

interface JvmProcess {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  startTime: string;
  command: string;
}

interface OptimizationResult {
  timestamp: string;
  processesIdentified: number;
  actionsTaken: string[];
  report: JvmProcess[];
}

export const JvmDashboard: React.FC = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      const response = await fetch('/api/jvm/optimize', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reach JVM Management Daemon');
      const data = await response.json();
      setLastResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="m3-card !bg-[var(--md-sys-color-surface-container-low)] !p-8 border border-[var(--md-sys-color-outline-variant)] shadow-xl relative overflow-hidden group">
      {/* Background Accent */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--md-sys-color-primary)] opacity-[0.03] rounded-full blur-3xl pointer-events-none group-hover:opacity-[0.07] transition-opacity" />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-[var(--md-sys-color-primary)] rounded-[1.5rem] text-white shadow-lg">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-black on-surface tracking-tighter leading-none mb-1">JVM Manager</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-[0.3em] opacity-40">System-Wide Heap Optimization Daemon</p>
          </div>
        </div>
        
        <button 
          onClick={runOptimization}
          disabled={isOptimizing}
          className="flex items-center gap-3 px-8 py-4 bg-[var(--md-sys-color-primary)] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 group"
        >
          {isOptimizing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Zap className="w-5 h-5 fill-current" />
          )}
          {isOptimizing ? 'Optimizing...' : 'Execute Sweep'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8 relative z-10">
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-[var(--md-sys-color-primary)]" />
              <span className="text-[11px] font-black uppercase tracking-widest on-surface-variant opacity-60">Memory Topology</span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black on-surface tracking-tighter">
                {lastResult?.processesIdentified ?? 0}
              </span>
              <span className="on-surface-variant text-sm font-bold mb-2">Active Daemons</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]">
             <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-[11px] font-black uppercase tracking-widest on-surface-variant opacity-60">Priority Status</span>
            </div>
            <div className="space-y-2">
              {error ? (
                <div className="flex items-center gap-2 text-[var(--md-sys-color-error)] font-bold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-tighter">
                  <CheckCircle2 className="w-4 h-4" />
                  Ecosystem Stable
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-black/90 rounded-[2.5rem] p-8 font-mono text-[11px] h-[350px] overflow-hidden flex flex-col border border-white/5 shadow-2xl">
           <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <span className="text-white/40 uppercase tracking-widest font-black">Optimization_Log_V1.0</span>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500/30" />
                <div className="w-2 h-2 rounded-full bg-amber-500/30" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 text-white/60">
              {lastResult ? (
                <>
                  <div className="text-emerald-400">[{lastResult.timestamp}] Initialization start...</div>
                  {lastResult.actionsTaken.map((action, i) => (
                    <div key={i} className="pl-4 border-l border-white/10">{`> ${action}`}</div>
                  ))}
                  <div className="text-white font-black mt-4">■ SWEEP_COMPLETE_STATUS_OPTIMIZED</div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center opacity-20 italic">
                  WAITING_FOR_IGNITION_SIGNAL
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
