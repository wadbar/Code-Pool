import React from 'react';
import { 
  File, FolderOpen, ChevronUp, ChevronDown, 
  Search, Filter, Plus, MoreVertical 
} from 'lucide-react';
import { clsx } from 'clsx';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  category: string;
}

interface FileManagerSectionProps {
  files: FileItem[];
  currentSort: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: string) => void;
  onSelectFile: (file: FileItem) => void;
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
      <ChevronUp className="w-4 h-4 ml-1 transition-transform animate-in fade-in zoom-in duration-200" /> : 
      <ChevronDown className="w-4 h-4 ml-1 transition-transform animate-in fade-in zoom-in duration-200" />;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--md-sys-color-surface)]">
      {/* Toolbar */}
      <div className="p-6 border-b border-[var(--md-sys-color-outline-variant)] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold on-surface">File Explorer</h2>
          <div className="flex gap-2">
            <button className="m3-button-tonal !p-2 !rounded-xl">
              <Filter className="w-5 h-5" />
            </button>
            <button className="m3-button-filled !px-4 !py-2 !rounded-xl text-sm">
              <Plus className="w-4 h-4" />
              New Module
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 on-surface-variant opacity-60" />
          <input 
            type="text"
            placeholder="Search Pool modules..."
            className="m3-input !pl-12"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Sort Header */}
      <div className="px-6 py-3 bg-[var(--md-sys-color-surface-container)] flex items-center gap-4 text-[11px] font-bold on-surface-variant uppercase tracking-widest border-b border-[var(--md-sys-color-outline-variant)]">
        <button 
          onClick={() => onSort('name')}
          className="flex-1 flex items-center hover:on-surface transition-colors focus:outline-none group"
        >
          File Name
          <span className="flex-none inline-flex items-center justify-center">
            <SortIcon column="name" />
            {!currentSort.key || currentSort.key !== 'name' ? (
              <ChevronDown className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-30 transition-opacity" />
            ) : null}
          </span>
        </button>
        
        <button 
          onClick={() => onSort('type')}
          className="w-32 flex items-center hover:on-surface transition-colors focus:outline-none group"
        >
          Type
          <span className="flex-none inline-flex items-center justify-center">
            <SortIcon column="type" />
            {!currentSort.key || currentSort.key !== 'type' ? (
              <ChevronDown className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-30 transition-opacity" />
            ) : null}
          </span>
        </button>
        
        <div className="w-24 text-right pr-12">Size</div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
            <div className="p-6 rounded-full bg-[var(--md-sys-color-surface-container-high)]">
              <FolderOpen className="w-12 h-12 on-surface-variant opacity-40" />
            </div>
            <p className="on-surface font-medium">No results found</p>
            <p className="on-surface-variant text-sm max-w-xs">Try adjusting your search or filters to find specific modules in the Lego Pool.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => onSelectFile(file)}
                className="w-full group flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-left focus:outline-none active:scale-[0.99] border border-transparent hover:border-[var(--md-sys-color-outline-variant)]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--md-sys-color-primary-container)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <File className="w-5 h-5 text-[var(--md-sys-color-on-primary-container)]" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="on-surface font-bold text-sm truncate">{file.name}</p>
                  <p className="on-surface-variant text-[11px] font-mono opacity-70">{file.category}</p>
                </div>

                <div className="w-32 on-surface-variant text-xs font-mono">
                  {file.type}
                </div>

                <div className="w-24 text-right on-surface-variant text-xs pr-2">
                  {file.size}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity px-2">
                  <MoreVertical className="w-4 h-4 on-surface-variant" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
