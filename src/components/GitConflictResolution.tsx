import React, { useState, useEffect } from 'react';
import { GitBranch, AlertTriangle, Check, X, ShieldAlert, GitMerge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Conflict {
  id: string;
  path: string;
  status: string;
  myChange: string;
  theirChange: string;
}

export const GitConflictResolution: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/git/conflicts')
        .then(res => res.json())
        .then(setConflicts);
    }
  }, [isOpen]);

  const resolve = async (id: string, resolution: 'MINE' | 'THEIRS') => {
    try {
      const res = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolution })
      });
      if (res.ok) {
        setConflicts(prev => prev.filter(c => c.id !== id));
      }
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed top-0 right-0 h-full w-[500px] bg-[var(--md-sys-color-surface-container-highest)] border-l border-[var(--md-sys-color-outline-variant)] shadow-[-20px_0_60px_rgba(0,0,0,0.3)] z-[110] flex flex-col"
    >
      <div className="p-8 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between bg-[var(--md-sys-color-surface-container-high)]">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500 rounded-xl text-white shadow-lg shadow-red-500/20">
            <GitMerge className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black on-surface tracking-tighter">Sync Conflicts</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">Git Interop Manager</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-full on-surface-variant transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
        {conflicts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4 text-center">
             <Check className="w-16 h-16 text-emerald-500" />
             <span className="text-sm font-black uppercase tracking-[0.3em]">Code Pool Purified</span>
             <p className="max-w-[200px] text-[10px] font-bold">All trajectories are currently synchronized with the master matrix.</p>
          </div>
        ) : (
          conflicts.map(c => (
            <motion.div 
              key={c.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="m3-card !p-6 border border-red-500/30 bg-red-500/5"
            >
               <div className="flex items-center gap-3 mb-5 pb-4 border-b border-red-500/10">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-black on-surface tabular-nums break-all">{c.path}</span>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-black/5 border border-black/5">
                     <span className="text-[9px] font-black uppercase tracking-widest block opacity-40 mb-2">Mine (Local)</span>
                     <p className="text-[11px] font-bold on-surface-variant italic">"{c.myChange}"</p>
                  </div>
                  <div className="p-4 rounded-xl bg-black/5 border border-black/5">
                     <span className="text-[9px] font-black uppercase tracking-widest block opacity-40 mb-2">Theirs (Remote)</span>
                     <p className="text-[11px] font-bold on-surface-variant italic">"{c.theirChange}"</p>
                  </div>
               </div>

               <div className="flex gap-4">
                  <button 
                    onClick={() => resolve(c.id, 'MINE')}
                    className="flex-1 py-3 rounded-xl bg-[var(--md-sys-color-primary)] text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Accept Mine
                  </button>
                  <button 
                    onClick={() => resolve(c.id, 'THEIRS')}
                    className="flex-1 py-3 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] on-surface text-[10px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Accept Theirs
                  </button>
               </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="p-6 bg-[var(--md-sys-color-surface-container-high)] border-t border-[var(--md-sys-color-outline-variant)]">
         <div className="flex items-center gap-3 text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">
            <GitBranch className="w-4 h-4" />
            <span>Branch: main-synchronization-lab</span>
         </div>
      </div>
    </motion.div>
  );
};
