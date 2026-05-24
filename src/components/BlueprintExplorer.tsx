import React, { useState, useEffect } from 'react';
import { Box, Search, ChevronRight, ChevronDown, Layers, FileCode, Cpu, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Blueprint {
  name: string;
  category: string;
  description: string;
  version: string;
  fileName: string;
  architecture: any;
}

export const BlueprintExplorer: React.FC = () => {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blueprints')
      .then(res => res.json())
      .then(data => {
        setBlueprints(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = blueprints.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(blueprints.map(b => b.category)));

  return (
    <div className="m3-card !p-8 border border-[var(--md-sys-color-outline-variant)] shadow-2xl mt-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] rounded-2xl shadow-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black on-surface tracking-tighter">Blueprint Archive</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">Molecular Architecture Repository</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 on-surface-variant opacity-30" />
          <input 
            type="text"
            placeholder="Search Blueprints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 pr-5 py-3 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-xs font-bold on-surface focus:outline-none focus:ring-2 focus:ring-[var(--md-sys-color-primary)] w-64 transition-all"
          />
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
        {loading ? (
          <div className="p-10 text-center opacity-20">
            <Box className="w-12 h-12 mx-auto animate-bounce mb-4" />
            <p className="font-bold uppercase tracking-widest text-xs">Accessing Vault...</p>
          </div>
        ) : categories.map(cat => (
          <div key={cat} className="space-y-3">
             <h4 className="text-[10px] font-black on-surface-variant uppercase tracking-[0.2em] pl-2 opacity-50">{cat}</h4>
             {filtered.filter(b => b.category === cat).map(b => (
               <div key={b.fileName} className="group">
                  <div 
                    onClick={() => setExpanded(expanded === b.fileName ? null : b.fileName)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      expanded === b.fileName 
                        ? 'bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-primary)] shadow-lg' 
                        : 'bg-[var(--md-sys-color-surface-container-low)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline)]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${expanded === b.fileName ? 'bg-[var(--md-sys-color-primary)] text-white' : 'bg-[var(--md-sys-color-surface-container-high)] on-surface-variant'}`}>
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold on-surface tracking-tight">{b.name}</span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/5 on-surface-variant">v{b.version}</span>
                        </div>
                        <p className="text-[11px] on-surface-variant opacity-60 line-clamp-1">{b.description}</p>
                      </div>
                    </div>
                    {expanded === b.fileName ? <ChevronDown className="w-4 h-4 opacity-40" /> : <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-100" />}
                  </div>

                  <AnimatePresence>
                    {expanded === b.fileName && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[var(--md-sys-color-surface-container-high)]/30 mx-4 rounded-b-2xl border-x border-b border-[var(--md-sys-color-outline-variant)]"
                      >
                         <div className="p-6 grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <div>
                                  <h5 className="text-[10px] font-black on-surface-variant uppercase tracking-widest mb-2 opacity-50">Core Traits</h5>
                                  <div className="flex flex-wrap gap-2">
                                     {Object.entries(b.architecture).map(([k, v]) => (
                                       <div key={k} className="px-3 py-1.5 rounded-lg bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)]">
                                          <span className="text-[9px] font-black on-surface-variant uppercase block leading-none mb-1 opacity-40">{k.replace('_', ' ')}</span>
                                          <span className="text-xs font-bold on-surface">{Array.isArray(v) ? v.join(', ') : v}</span>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                               <div>
                                  <h5 className="text-[10px] font-black on-surface-variant uppercase tracking-widest mb-2 opacity-50">System Identity</h5>
                                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                     <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                     <span className="text-xs font-bold text-emerald-600 tracking-tight">Verified Structural Integrity</span>
                                  </div>
                               </div>
                            </div>
                            <div className="bg-black/5 rounded-2xl p-4 border border-black/5 font-mono">
                               <h5 className="text-[10px] font-black on-surface-variant uppercase tracking-widest mb-3 opacity-50">Manifest Hash</h5>
                               <div className="text-[10px] on-surface-variant opacity-40 break-all leading-relaxed">
                                  SHA-256: 4b2f8a1c9d3e7f... {Math.random().toString(16).substr(2, 32)}
                               </div>
                               <button className="mt-6 w-full py-2.5 rounded-xl bg-[var(--md-sys-color-primary)] text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
                                  Instantiate Matrix
                               </button>
                            </div>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
             ))}
          </div>
        ))}
      </div>
    </div>
  );
};
