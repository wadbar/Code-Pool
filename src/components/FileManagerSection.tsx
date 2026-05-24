import React from 'react';
import { 
  File, FolderOpen, ChevronUp, ChevronDown, 
  Search, Filter, Plus, MoreVertical,
  Activity, ShieldCheck, Zap
} from 'lucide-react';
import { LegoModule } from '../types';

interface FileManagerSectionProps {
  files: LegoModule[];
  currentSort: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: string) => void;
  onSelectFile: (file: LegoModule) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const FileManagerSection: React.FC<FileManagerSectionProps> = ({
  files,
  currentSort,
  onSort,
  onSelectFile,
  searchQuery,
  onSearchChange
}) => {
  const SortIcon = ({ column }: { column: string }) => {
    if (currentSort.key !== column) return null;
    return currentSort.direction === 'asc' ? 
      <ChevronUp className="w-5 h-5 ml-3 transition-all animate-in fade-in zoom-in duration-300 text-[var(--md-sys-color-primary)]" /> : 
      <ChevronDown className="w-5 h-5 ml-3 transition-all animate-in fade-in zoom-in duration-300 text-[var(--md-sys-color-primary)]" />;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--md-sys-color-surface)] relative overflow-hidden">
      {/* Search & Toolbelt Area */}
      <div className="p-12 border-b border-[var(--md-sys-color-outline-variant)] space-y-10 bg-[var(--md-sys-color-surface)]/80 backdrop-blur-3xl sticky top-0 z-20 shadow-[0_32px_64px_-24px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-4xl font-black on-surface tracking-tighter leading-none">Repository Pool</h2>
            <p className="text-[11px] font-black on-surface-variant uppercase tracking-[0.3em] opacity-40">Industrial Module Harvester Pipeline</p>
          </div>
          <div className="flex gap-4">
            <button className="m3-button-tonal !p-5 !rounded-2xl shadow-xl hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)] transition-all group active:scale-90">
              <Filter className="w-7 h-7 transition-all group-hover:rotate-12 group-hover:text-[var(--md-sys-color-primary)]" />
            </button>
            <button className="m3-button-filled !px-8 !py-4 !rounded-[1.75rem] text-[12px] font-black uppercase tracking-[0.2em] shadow-[0_32px_64px_-16px_rgba(59,130,246,0.3)] active:scale-95 group">
              <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
              NEW LEGO
            </button>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="w-6 h-6 on-surface-variant opacity-30 group-focus-within:opacity-100 group-focus-within:text-[var(--md-sys-color-primary)] transition-all" />
          </div>
          <input 
            type="text"
            placeholder="Scrape modules by trajectory identity..."
            className="m3-input !pl-16 !py-6 bg-[var(--md-sys-color-surface-container-high)] border-[3px] border-transparent focus:border-[var(--md-sys-color-primary)] !rounded-[2rem] shadow-inner transition-all font-black text-base placeholder:opacity-30 selection:bg-[var(--md-sys-color-primary-container)]"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Sorting Navigation Track */}
      <div className="px-12 py-6 bg-[var(--md-sys-color-surface-container)] flex items-center gap-8 text-[11px] font-black on-surface-variant uppercase tracking-[0.4em] border-b border-[var(--md-sys-color-outline-variant)] sticky top-[244px] z-10 shadow-sm shadow-black/5 opacity-80 backdrop-blur-xl">
        <button 
          onClick={() => onSort('name')}
          className="flex-1 flex items-center hover:on-surface transition-colors focus:outline-none group"
        >
          Structural Identifier
          <span className="flex-none">
            <SortIcon column="name" />
          </span>
        </button>
        
        <button 
          onClick={() => onSort('type')}
          className="w-48 flex items-center hover:on-surface transition-colors focus:outline-none group px-6 border-l border-[var(--md-sys-color-outline-variant)]"
        >
          Trajectory
          <span className="flex-none">
            <SortIcon column="type" />
          </span>
        </button>
        
        <div className="w-24 text-right pr-6 border-l border-[var(--md-sys-color-outline-variant)] whitespace-nowrap">Payload</div>
      </div>

      {/* Atomic Module Stream */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-[var(--md-sys-color-surface-container-lowest)]/20 shadow-inner">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-20 space-y-10 animate-in fade-in duration-700">
            <div className="p-16 rounded-[4rem] bg-[var(--md-sys-color-surface-container-high)] shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-1000" />
               <FolderOpen className="w-32 h-32 on-surface-variant opacity-10 relative z-10 transition-transform group-hover:scale-110" />
            </div>
            <div className="space-y-6">
              <p className="on-surface text-4xl font-black tracking-tighter leading-none whitespace-nowrap">Null Ingestion Point</p>
              <p className="on-surface-variant text-base max-w-sm mx-auto leading-relaxed font-bold opacity-30 uppercase tracking-[0.2em]">Adjust reconnaissance filters to mapping available Lego units in the trajectory matrix.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => onSelectFile(file)}
                className="w-full group flex items-center gap-6 p-6 rounded-3xl bg-[var(--md-sys-color-surface-container-low)] hover:bg-[var(--md-sys-color-surface-container-highest)] border-2 border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] transition-all duration-300 text-left focus:outline-none active:scale-[0.98] shadow-sm hover:shadow-xl relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center group-hover:bg-[var(--md-sys-color-primary)] group-hover:text-white transition-all transform group-hover:rotate-6 shadow-inner relative z-10">
                  <File className="w-8 h-8 transition-colors" />
                </div>
                
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="on-surface font-black text-xl truncate tracking-tighter leading-none">{file.name}</p>
                    <span className="text-[9px] font-black bg-[var(--md-sys-color-surface-container-high)] px-3 py-1 rounded-lg border border-[var(--md-sys-color-outline-variant)] uppercase tracking-widest opacity-60">V.{file.version}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black on-surface-variant opacity-40 uppercase tracking-[0.2em]">
                    <span>{file.category}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{file.type}</span>
                  </div>
                </div>

                <div className="w-20 text-right text-[10px] font-black on-surface-variant opacity-30 font-mono tracking-tighter px-4">
                  {file.size}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-all p-2 relative z-10">
                  <div className="w-10 h-10 rounded-full hover:bg-[var(--md-sys-color-primary-container)] flex items-center justify-center transition-colors">
                    <MoreVertical className="w-5 h-5 text-[var(--md-sys-color-primary)]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
