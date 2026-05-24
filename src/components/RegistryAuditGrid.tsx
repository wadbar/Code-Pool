import React, { useState, useEffect, useMemo } from 'react';
import { Grid, ShieldCheck, Clock, AlertCircle, RefreshCw, Search, Download, Zap, ZapOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RepoModule {
  name: string;
  category: string;
  path: string;
  mtime: number;
}

export const RegistryAuditGrid: React.FC = () => {
  const [modules, setModules] = useState<RepoModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/repo-registry');
      const data = await res.json();
      setModules(data.modules || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const toggleSelection = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedPaths(next);
  };

  const handleBulkAction = async (action: 'RESYNC' | 'AUDIT' | 'REMOVE') => {
    console.log(`[BulkAction] Executing ${action} on:`, Array.from(selectedPaths));
    // Simulation of bulk logic
    setSelectedPaths(new Set());
    await fetchRegistry();
  };

  useEffect(() => {
    fetchRegistry();
  }, []);

  const getStatusColor = (mtime: number) => {
    const diff = (Date.now() - mtime) / (1000 * 60 * 60); // Hours
    if (diff < 24) return 'bg-emerald-500';
    if (diff < 72) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusLabel = (mtime: number) => {
    const diff = (Date.now() - mtime) / (1000 * 60 * 60);
    if (diff < 24) return 'Optimum';
    if (diff < 72) return 'Stale';
    return 'Critical';
  };

  const filtered = useMemo(() => {
    return modules.filter(m => 
      m.name.toLowerCase().includes(search.toLowerCase()) || 
      m.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [modules, search]);

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Category', 'Path', 'Last Modified', 'Status'];
    const rows = filtered.map(m => {
      const status = getStatusLabel(m.mtime);
      const date = new Date(m.mtime).toISOString();
      return `"${m.name}","${m.category}","${m.path}","${date}","${status}"`;
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registry-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="m3-card !p-8 border border-[var(--md-sys-color-outline-variant)] shadow-2xl mt-10 relative overflow-hidden bg-[var(--md-sys-color-surface-container-low)]">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Grid className="w-64 h-64" />
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-10 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black on-surface tracking-tighter">Registry Audit</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">Industrial Synchronization Monitoring</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {selectedPaths.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white shadow-lg"
            >
               <span className="text-[10px] font-black uppercase tracking-widest">{selectedPaths.size} Selected</span>
               <div className="w-px h-4 bg-white/20 mx-2" />
               <button onClick={() => handleBulkAction('RESYNC')} className="text-[10px] font-black uppercase hover:underline">Resync</button>
               <button onClick={() => handleBulkAction('AUDIT')} className="text-[10px] font-black uppercase hover:underline ml-3">Audit</button>
               <button onClick={() => handleBulkAction('REMOVE')} className="text-[10px] font-black uppercase hover:underline ml-3 text-red-200">Remove</button>
            </motion.div>
          )}

          <div className="relative flex-1 lg:flex-none lg:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 on-surface-variant opacity-30" />
            <input 
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-5 py-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-xs font-bold on-surface focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
             <button 
              onClick={() => setAutoSync(!autoSync)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                autoSync 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
                  : 'bg-black/5 border-black/10 on-surface-variant'
              }`}
            >
              {autoSync ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
              Auto-Sync: {autoSync ? 'ON' : 'OFF'}
            </button>

            <button 
              onClick={handleDownloadCSV}
              className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] on-surface-variant hover:on-surface transition-all active:scale-95"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            <button 
              onClick={fetchRegistry}
              className={`p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] on-surface transition-all active:scale-95 ${loading ? 'animate-spin opacity-40' : 'hover:bg-white/5'}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <AnimatePresence mode="popLayout">
          {filtered.map((m, i) => (
            <motion.div
              layout
              key={m.path}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.01 }}
              onClick={() => toggleSelection(m.path)}
              className={`p-5 rounded-3xl border transition-all group overflow-hidden cursor-pointer relative ${
                selectedPaths.has(m.path) 
                  ? 'bg-indigo-500/10 border-indigo-500 shadow-xl' 
                  : 'bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline-variant)] hover:border-indigo-500/50'
              }`}
            >
               <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedPaths.has(m.path) ? 'bg-indigo-500 border-indigo-500' : 'border-black/20'}`}>
                      {selectedPaths.has(m.path) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      m.category === 'CORE' ? 'bg-indigo-500/10 text-indigo-500' : 
                      m.category === 'INFRA' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {m.category}
                    </span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(m.mtime)} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
               </div>
               <h4 className="text-sm font-black on-surface tracking-tight mb-2 truncate group-hover:text-indigo-500 transition-colors uppercase">{m.name}</h4>
               <div className="flex items-center gap-2 opacity-40">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold tabular-nums">
                    {new Date(m.mtime).toLocaleDateString()}
                  </span>
               </div>
               
               <div className="mt-4 pt-4 border-t border-[var(--md-sys-color-outline-variant)] flex items-center justify-between">
                  <span className="text-[9px] font-black on-surface-variant uppercase tracking-widest opacity-30">Integrity</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    getStatusColor(m.mtime).replace('bg-', 'text-')
                  }`}>
                    {getStatusLabel(m.mtime)}
                  </span>
               </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-20 opacity-20 bg-black/5 rounded-[2.5rem] mt-4 border border-dashed border-black/10">
           <AlertCircle className="w-12 h-12 mx-auto mb-4" />
           <p className="font-black uppercase tracking-[0.3em] text-[10px]">No Modules Match Trajectory</p>
        </div>
      )}
    </div>
  );
};
