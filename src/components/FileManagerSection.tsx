import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, History, X, Folder, FileCode, Trash2, Sliders, CheckCircle2 } from 'lucide-react';

interface FileManagerSectionProps {
  inventory: any[];
  onViewBlock: (category: string, blockName: string) => void;
}

export const FileManagerSection: React.FC<FileManagerSectionProps> = ({ inventory, onViewBlock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Platform / ROM Validation Mock states as requested by directives
  const [platform, setPlatform] = useState('GBA');
  const [romFile, setRomFile] = useState('');
  const [romError, setRomError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('pool_search_history');
    if (saved) setSearchHistory(JSON.parse(saved));
  }, []);

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    setSearchTerm(term);
    if (!searchHistory.includes(term.trim())) {
      const newHistory = [term.trim(), ...searchHistory].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem('pool_search_history', JSON.stringify(newHistory));
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('pool_search_history');
  };

  // ROM Validation Logic
  useEffect(() => {
    if (!romFile) {
      setRomError('');
      return;
    }
    const ext = romFile.split('.').pop()?.toLowerCase();
    const validMap: Record<string, string[]> = {
      'GBA': ['gba'],
      'SNES': ['sfc', 'smc'],
      'NES': ['nes']
    };
    if (validMap[platform] && !validMap[platform].includes(ext || '')) {
      setRomError(`Incompatível: ${platform} espera extensões [${validMap[platform].join(', ')}]`);
    } else {
      setRomError('');
    }
  }, [platform, romFile]);

  return (
    <div className="space-y-6">
      {/* ROM/Platform Validation Demonstration (As per directive) */}
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3">
        <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5" /> Configuração de Plataforma
        </h4>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Arquitetura</label>
            <motion.div
              layout
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={platform}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <select 
                id="platform-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 border-slate-300 rounded-lg px-3 py-2 text-xs transition-all focus:ring-1 focus:ring-amber-500 outline-none cursor-pointer"
              >
                <option value="GBA">Game Boy Advance</option>
                <option value="SNES">Super Nintendo</option>
                <option value="NES">NES Classic</option>
              </select>
            </motion.div>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px] relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Arquivo ROM</label>
            <input 
              type="text"
              id="file-manager-rom-input"
              placeholder="ex: pokemon.gba"
              value={romFile}
              onChange={(e) => setRomFile(e.target.value)}
              className={`w-full bg-slate-100 dark:bg-slate-900 border ${romError ? 'border-red-500 mb-0' : 'dark:border-slate-800 border-slate-300'} rounded-lg px-3 py-2 text-xs outline-none transition-all`}
            />
            <AnimatePresence>
              {romError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-1 z-10 p-2 bg-red-600 text-white text-[9px] font-bold rounded shadow-lg"
                >
                  {romError}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!!romError || !romFile}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${romError || !romFile ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'}`}
          >
            Carregar na Build
          </motion.button>
        </div>
      </div>

      {/* Code Pool Inventory Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-200 rounded-2xl shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Busca de Blocos</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Pesquisar na piscina..."
                className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
              />
            </div>
            
            {searchHistory.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <History className="w-3 h-3" /> Histórico
                  </span>
                  <button onClick={clearHistory} className="text-[9px] text-slate-500 hover:text-red-500 font-bold uppercase">Limpar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((h, i) => (
                    <button 
                      key={i}
                      onClick={() => setSearchTerm(h)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-md text-[9px] text-slate-500 hover:text-indigo-500 transition-all flex items-center gap-1"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventory.filter(c => c.category.toLowerCase().includes(searchTerm.toLowerCase()) || c.blocks.some((b: string) => b.toLowerCase().includes(searchTerm.toLowerCase()))).map((cat) => (
              <div key={cat.category} className="p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Folder className="w-4 h-4 text-indigo-500" />
                    </div>
                    <span className="text-sm font-bold dark:text-slate-200 text-slate-800 capitalize tracking-tight">{cat.category}</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-500">{cat.blocks.length} blocos</span>
                </div>
                <div className="space-y-1.5">
                  {cat.blocks.filter((b: string) => b.toLowerCase().includes(searchTerm.toLowerCase())).map((block: string) => (
                    <button 
                      key={block}
                      onClick={() => onViewBlock(cat.category, block)}
                      className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group/item transition-colors"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileCode className="w-3.5 h-3.5 text-slate-400 group-hover/item:text-indigo-400 transition-colors shrink-0" />
                        <span className="text-[11px] text-slate-500 group-hover/item:text-slate-300 transition-colors truncate">{block}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity font-mono">INSPIRE</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
