import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, HardDrive, Zap, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HealthData {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  workersActive: number;
  daemons: Array<{ name: string; status: string; load: string }>;
}

export const EcosystemHealthMonitor: React.FC = () => {
  const [data, setData] = useState<HealthData | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/ecosystem/health');
        if (res.ok) setData(await res.json());
      } catch {}
    };

    fetchHealth();
    const inv = setInterval(fetchHealth, 5000);
    return () => clearInterval(inv);
  }, []);

  if (!data) return null;

  return (
    <div className="m3-card !p-8 border border-[var(--md-sys-color-outline-variant)] shadow-2xl bg-[var(--md-sys-color-surface-container-low)]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black on-surface tracking-tighter">Ecosystem Health</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">ScannerAgent Runtime Metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]">
          <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="text-[11px] font-black on-surface tracking-tight uppercase">{data.workersActive} Units Online</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* CPU Metric */}
        <div className="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] group">
           <div className="flex items-center justify-between mb-4">
             <Cpu className="w-5 h-5 on-surface-variant opacity-40 group-hover:text-blue-500 transition-colors" />
             <span className="text-xl font-black on-surface tabular-nums">{data.cpu.toFixed(1)}%</span>
           </div>
           <div className="h-2 bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
             <motion.div 
               animate={{ width: `${data.cpu}%` }}
               className="h-full bg-blue-500"
             />
           </div>
           <span className="text-[10px] font-black on-surface-variant uppercase tracking-[0.2em] mt-3 block opacity-40">CPU Processing</span>
        </div>

        {/* Memory Metric */}
        <div className="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] group">
           <div className="flex items-center justify-between mb-4">
             <Database className="w-5 h-5 on-surface-variant opacity-40 group-hover:text-emerald-500 transition-colors" />
             <span className="text-xl font-black on-surface tabular-nums">{data.memory.toFixed(1)}%</span>
           </div>
           <div className="h-2 bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
             <motion.div 
               animate={{ width: `${data.memory}%` }}
               className="h-full bg-emerald-500"
             />
           </div>
           <span className="text-[10px] font-black on-surface-variant uppercase tracking-[0.2em] mt-3 block opacity-40">Memory Heap</span>
        </div>

        {/* Disk Metric */}
        <div className="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] group">
           <div className="flex items-center justify-between mb-4">
             <HardDrive className="w-5 h-5 on-surface-variant opacity-40 group-hover:text-purple-500 transition-colors" />
             <span className="text-xl font-black on-surface tabular-nums">{data.disk.toFixed(1)}%</span>
           </div>
           <div className="h-2 bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
             <motion.div 
               animate={{ width: `${data.disk}%` }}
               className="h-full bg-purple-500"
             />
           </div>
           <span className="text-[10px] font-black on-surface-variant uppercase tracking-[0.2em] mt-3 block opacity-40">Storage Matrix</span>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-[var(--md-sys-color-outline-variant)] border-dashed">
         <h4 className="text-[10px] font-black on-surface-variant uppercase tracking-[0.3em] mb-5 opacity-40">Daemon Persistence</h4>
         <div className="grid grid-cols-2 gap-4">
            {data.daemons.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/50 border border-[var(--md-sys-color-outline-variant)]">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold on-surface tracking-tight">{d.name}</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      d.load === 'LOW' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>LOAD: {d.load}</span>
                    <span className="text-[10px] font-black on-surface opacity-40 italic">{d.status}</span>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
