import React from 'react';
import { motion } from 'framer-motion';
import { 
  Play, Activity, Zap, RefreshCw, AlertTriangle, 
  CheckCircle2, X, Package, TrendingUp, ShieldAlert,
  Layers
} from 'lucide-react';
import { clsx } from 'clsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { logger } from '../telemetry';
import { LogLevel, LegoModule } from '../types';

interface PanelProps {
  inspectingBlock: LegoModule;
  onClose: () => void;
  onRunTest: () => void;
  onAuditBlock: () => void;
  onPowerizeBlock: () => void;
  onCheckInterop: () => void;
}

export const Panel: React.FC<PanelProps> = React.memo(({
  inspectingBlock,
  onClose,
  onRunTest,
  onAuditBlock,
  onPowerizeBlock,
  onCheckInterop
}) => {
  if (!inspectingBlock) return null;

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0, y: 100 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 100 }}
      transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      className="m3-card w-full max-w-[90vw] max-h-[94vh] flex flex-col overflow-hidden shadow-[0_128px_256px_-64px_rgba(0,0,0,0.6)] relative p-0 border-none ring-1 ring-white/10"
      onClick={e => e.stopPropagation()}
    >
      {/* Universal Module Header */}
      <div className="flex items-center justify-between p-12 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]">
        <div className="flex items-center gap-10">
          <div className="w-20 h-20 rounded-[2.5rem] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shadow-2xl relative group">
            <Package className="w-10 h-10 group-hover:scale-110 transition-transform" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[var(--md-sys-color-surface-container)] animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-6">
              <h2 className="text-5xl font-black on-surface tracking-tighter leading-none">
                {inspectingBlock.name}
              </h2>
              <div className="flex items-center gap-2">
                <span className="px-5 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-variant)] text-[var(--md-sys-color-on-surface-variant)] font-mono text-[11px] font-black border border-[var(--md-sys-color-outline-variant)] shadow-inner uppercase tracking-widest">
                  ID: {inspectingBlock.id}
                </span>
                <span className="px-5 py-1.5 rounded-xl bg-blue-500/10 text-blue-500 font-mono text-[11px] font-black border border-blue-500/20 shadow-inner uppercase tracking-widest">
                  VER: {inspectingBlock.version}
                </span>
              </div>
            </div>
            <p className="text-xs on-surface-variant font-black uppercase tracking-[0.4em] opacity-50">
              {inspectingBlock.category} STRUCTURE • MODE: {inspectingBlock.executionMode || 'UNSET'} • INDUSTRIAL_CERTIFIED
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex bg-[var(--md-sys-color-surface-container-high)] p-2 rounded-[2rem] border border-[var(--md-sys-color-outline-variant)] shadow-inner">
            <button 
              onClick={onRunTest}
              disabled={inspectingBlock.testing}
              className="m3-button-tonal !px-10 !py-4 text-[11px] font-black uppercase tracking-[0.2em] relative group disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--md-sys-color-primary)] transform translate-y-full group-hover:translate-y-0 transition-transform" />
              <Play className={clsx("w-5 h-5", inspectingBlock.testing && "animate-spin")} />
              {inspectingBlock.testing ? 'SYNCHRONIZING...' : 'PRE-FLIGHT TEST'}
            </button>
            <button 
              onClick={onAuditBlock}
              disabled={inspectingBlock.auditing}
              className="m3-button-tonal !px-10 !py-4 text-[11px] font-black uppercase tracking-[0.2em] border-l border-[var(--md-sys-color-outline-variant)] relative group disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--md-sys-color-primary)] transform translate-y-full group-hover:translate-y-0 transition-transform" />
              <Activity className={clsx("w-5 h-5", inspectingBlock.auditing && "animate-spin")} />
              HEALTH AUDIT
            </button>
          </div>
          <div className="w-px h-16 bg-[var(--md-sys-color-outline-variant)] mx-6 opacity-50" />
          <button 
            onClick={onClose}
            className="w-20 h-20 rounded-[2.5rem] hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] transition-all flex items-center justify-center border border-[var(--md-sys-color-outline-variant)] hover:rotate-90 hover:scale-90 active:scale-75 shadow-xl"
          >
            <X className="w-10 h-10" />
          </button>
        </div>
      </div>

      {/* Main Pulse Lab */}
      <div className="flex-1 flex overflow-hidden">
        {/* Atomic Code Canvas */}
        <div className="flex-1 overflow-auto p-12 bg-[#0d1117] custom-scrollbar relative min-h-[600px] shadow-inner">
          {inspectingBlock.loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 text-[var(--md-sys-color-primary)] font-mono text-lg bg-black/40 backdrop-blur-3xl transition-all">
              <div className="relative">
                <RefreshCw className="w-24 h-24 animate-spin opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-current rounded-full animate-ping" />
                </div>
              </div>
              <div className="space-y-4 text-center">
                <span className="font-black tracking-[0.4em] uppercase block">Scraping Repository Delta</span>
                <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-full h-full bg-current"
                  />
                </div>
              </div>
            </div>
          ) : inspectingBlock.error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 text-[var(--md-sys-color-error)] font-mono p-16 text-center bg-[var(--md-sys-color-error)]/5">
              <ShieldAlert className="w-28 h-28" />
              <div className="space-y-4">
                <p className="font-black text-5xl tracking-tighter uppercase leading-none">Integrity Violation</p>
                <p className="max-w-3xl mx-auto on-surface-variant text-base leading-relaxed font-bold opacity-60 uppercase tracking-[0.2em]">{inspectingBlock.error}</p>
              </div>
              <button onClick={onRunTest} className="m3-button-filled mt-8 !px-16 !py-6 font-black tracking-widest shadow-2xl">RE-INITIALIZE HANDSHAKE</button>
            </div>
          ) : (
            <div className="font-mono text-[15px] text-[#e6edf3] leading-[2] overflow-x-auto whitespace-pre select-text h-full selection:bg-blue-500/30">
              <div className="flex text-left">
                {/* Line Buffer */}
                <div className="text-white/20 text-right pr-12 select-none border-r border-white/5 mr-12 font-black min-w-[80px]">
                  {inspectingBlock.content?.split('\n').map((_: string, index: number) => (
                    <div key={index} className="h-[30px]">{index + 1}</div>
                  ))}
                </div>
                {/* Code Body */}
                <pre className="font-mono leading-[2]">
                  <code>
                    {inspectingBlock.content?.split('\n').map((line: string, idx: number) => (
                      <div key={idx} className="min-h-[30px] hover:bg-white/5 px-4 -mx-4 transition-all duration-150 rounded-lg group cursor-pointer">
                        <span className="text-white/40 group-hover:text-white transition-colors">{line}</span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Industrial Auditor Sidebar */}
        <div className="w-[500px] border-l border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] overflow-y-auto custom-scrollbar p-12 space-y-16 shadow-2xl">
          
          {/* Health Audit Pipeline */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-black on-surface-variant uppercase tracking-[0.3em] opacity-60">System Health Audit</h3>
              {inspectingBlock.health && (
                <div className={clsx(
                  "text-[12px] font-black px-6 py-2 rounded-2xl border-2 shadow-2xl transition-all",
                  inspectingBlock.health.score > 80 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  inspectingBlock.health.score > 50 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                  'bg-red-500/10 text-red-500 border-red-500/20'
                )}>
                  PULSE: {inspectingBlock.health.score}%
                </div>
              )}
            </div>

            {!inspectingBlock.health ? (
              <div className="bg-[var(--md-sys-color-surface)] rounded-[3rem] p-12 border-2 border-dashed border-[var(--md-sys-color-outline-variant)] text-center space-y-10 group hover:border-[var(--md-sys-color-primary)] transition-all">
                <div className="p-10 rounded-full bg-[var(--md-sys-color-surface-container-high)] w-fit mx-auto shadow-inner group-hover:rotate-12 transition-transform">
                  <Activity className="w-16 h-16 on-surface-variant opacity-20" />
                </div>
                <div className="space-y-2">
                   <p className="text-xl font-black on-surface tracking-tighter">Null Pulse Detected</p>
                   <p className="text-sm on-surface-variant font-medium leading-relaxed opacity-60 px-4">No industrial health telemetry found for this trajectory segment.</p>
                </div>
                <button 
                  onClick={onAuditBlock}
                  className="m3-button-tonal w-full font-black text-[12px] uppercase tracking-[0.3em] py-5 shadow-xl"
                >
                  TRIGGER AUDIT PULSE
                </button>
              </div>
            ) : (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
                 <div className="grid grid-cols-2 gap-6">
                   <div className="bg-[var(--md-sys-color-surface)] p-8 rounded-[2rem] border border-[var(--md-sys-color-outline-variant)] shadow-2xl group hover:border-[var(--md-sys-color-primary)] transition-all">
                     <span className="block text-[11px] on-surface-variant uppercase font-black tracking-[0.2em] mb-3 opacity-40">Maturity Trajectory</span>
                     <span className="text-lg on-surface font-mono font-black text-[var(--md-sys-color-primary)] uppercase tracking-tighter">{inspectingBlock.health.maturity}</span>
                   </div>
                   <div className="bg-[var(--md-sys-color-surface)] p-8 rounded-[2rem] border border-[var(--md-sys-color-outline-variant)] shadow-2xl group hover:border-[var(--md-sys-color-primary)] transition-all">
                     <span className="block text-[11px] on-surface-variant uppercase font-black tracking-[0.2em] mb-3 opacity-40">Stability Core</span>
                     <span className="text-lg on-surface font-mono font-black text-emerald-500 tracking-tighter">{inspectingBlock.health.stabilityIndex}.0%</span>
                   </div>
                 </div>

                 {inspectingBlock.health.timeline && (
                   <div className="space-y-6">
                     <div className="flex items-center gap-4 text-[12px] font-black on-surface-variant uppercase tracking-[0.2em] opacity-40">
                       <TrendingUp className="w-5 h-5" />
                       Trajectory Stability Log
                     </div>
                     <div className="h-44 bg-black rounded-[2.5rem] border border-white/5 p-4 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={inspectingBlock.health.timeline}>
                            <Area type="monotone" dataKey="stability" stroke="var(--md-sys-color-primary)" strokeWidth={3} fill="var(--md-sys-color-primary)" fillOpacity={0.2} />
                          </AreaChart>
                        </ResponsiveContainer>
                     </div>
                   </div>
                 )}

                 <div className="space-y-6">
                   <h4 className="text-[12px] font-black on-surface-variant uppercase tracking-[0.25em] opacity-40">Audit Findings Pipeline</h4>
                   <div className="flex flex-wrap gap-3">
                     {inspectingBlock.health.findings?.map((f: string, i: number) => (
                       <span key={i} className="bg-[var(--md-sys-color-surface-container-highest)] px-5 py-3 rounded-2xl text-[11px] font-black on-surface border border-[var(--md-sys-color-outline-variant)] shadow-lg hover:bg-[var(--md-sys-color-primary)] hover:text-white transition-all cursor-crosshair">
                         {f.toUpperCase()}
                       </span>
                     ))}
                   </div>
                 </div>

                 <button 
                  onClick={onPowerizeBlock}
                  disabled={inspectingBlock.powerizing}
                  className="m3-button-filled w-full font-black text-[13px] py-8 rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(59,130,246,0.3)] group relative overflow-hidden active:scale-95"
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0 group-hover:opacity-20 transition-opacity" />
                   <Zap className={clsx("w-6 h-6 relative z-10 transition-all group-hover:scale-150 group-hover:rotate-12", inspectingBlock.powerizing && "animate-pulse")} />
                   <span className="relative z-10 tracking-[0.3em]">STANDARDIZE & ENFORCE</span>
                 </button>
              </div>
            )}
          </div>

          <div className="h-px bg-[var(--md-sys-color-outline-variant)] opacity-20" />

          {/* Ecosystem Synergy Matrix */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-black on-surface-variant uppercase tracking-[0.3em] opacity-60">Synergy Matrix</h3>
              <button 
                onClick={onCheckInterop}
                disabled={inspectingBlock.interopLoading}
                className="text-[11px] text-[var(--md-sys-color-primary)] font-black hover:tracking-[0.4em] transition-all disabled:opacity-50 uppercase tracking-[0.2em]"
              >
                {inspectingBlock.interopLoading ? 'SYNCHRONIZING...' : 'CHECK ECOSYSTEM FIT'}
              </button>
            </div>

            {inspectingBlock.interopMatrix ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-700">
                {inspectingBlock.interopMatrix?.map((m: any, idx: number) => (
                  <div key={idx} className="bg-[var(--md-sys-color-surface)] border-2 border-[var(--md-sys-color-outline-variant)] p-8 rounded-[2.5rem] space-y-8 shadow-2xl relative overflow-hidden group hover:border-[var(--md-sys-color-primary)]/50 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] translate-x-10 -translate-y-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-1000">
                      <Layers className="w-40 h-40" />
                    </div>
                    
                    <div className="flex items-center justify-between relative z-10">
                      <span className="on-surface font-black text-lg tracking-tighter uppercase">{m.target_block}</span>
                      <span className="text-[var(--md-sys-color-primary)] font-black text-xs font-mono bg-[var(--md-sys-color-primary-container)] px-5 py-2 rounded-xl shadow-lg uppercase tracking-widest">{m.affinity}% Affinity</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                       {['Correlation', 'Proximity', 'Stability', 'Similarity'].map((key) => (
                         <div key={key} className="bg-[var(--md-sys-color-surface-container)] p-5 rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-inner group-hover:bg-white/5 transition-colors">
                           <span className="block text-[10px] on-surface-variant uppercase font-black opacity-30 tracking-widest mb-2">{key}</span>
                           <span className="text-[12px] on-surface font-black font-mono tracking-tighter">{m[key.toLowerCase()] || '--'}</span>
                         </div>
                       ))}
                    </div>

                    <div className="relative z-10 p-6 rounded-3xl bg-[var(--md-sys-color-surface-container-highest)] border-l-[6px] border-[var(--md-sys-color-primary)] shadow-2xl">
                      <p className="text-[13px] on-surface font-bold italic leading-relaxed tracking-tight opacity-70">
                         &quot;{m.fit_result}&quot;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[var(--md-sys-color-surface-container)] p-12 rounded-[3rem] border-4 border-dashed border-[var(--md-sys-color-outline-variant)] text-center opacity-40 hover:opacity-100 transition-all group">
                <p className="text-sm on-surface font-black leading-relaxed uppercase tracking-[0.2em]">
                  Execute synergy auditor to mapping trajectory coupling across the repository pool.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Industrial Footer Ticker */}
      <div className="p-10 border-t border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] flex items-center justify-between z-20 shadow-[0_-32px_64px_-24px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-10 text-[11px] on-surface-variant font-black tracking-[0.3em] uppercase opacity-60">
          <span className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            V8 COMPILER: OPTIMIZED
          </span>
          <div className="w-2 h-2 rounded-full bg-[var(--md-sys-color-outline)]" />
          <span>PAYLOAD SIZE: {inspectingBlock.content ? `${(inspectingBlock.content.length / 1024).toFixed(2)} KB` : '0.00 KB'}</span>
          <div className="w-2 h-2 rounded-full bg-[var(--md-sys-color-outline)]" />
          <span>LOGIC NODES: {inspectingBlock.content?.split('\n').length || 0}</span>
        </div>

        <div className="flex gap-6">
          <button
            onClick={onClose}
            className="m3-button-tonal !px-16 !py-5 font-black text-[12px] tracking-[0.3em] hover:bg-black hover:text-white transition-all shadow-xl"
          >
            DISMISS
          </button>
          {!inspectingBlock.loading && !inspectingBlock.error && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(inspectingBlock.content || '');
                logger.log(LogLevel.INFO, 'UI_ACTION', `Module ${inspectingBlock.id} ingested to clipboard.`);
              }}
              className="m3-button-filled !px-16 !py-5 font-black text-[12px] tracking-[0.3em] shadow-[0_32px_64px_-12px_rgba(59,130,246,0.3)] group active:scale-95"
            >
              <CheckCircle2 className="w-6 h-6 transition-transform group-hover:scale-125" />
              INGEST UNIT
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
