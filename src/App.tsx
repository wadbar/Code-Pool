import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Terminal, Database, Cpu, Layout, 
  Settings, Sun, Moon, Github, 
  Layers, Package, Code2, Sparkles
} from 'lucide-react';
import { Panel } from './components/Panel';
import { FileManagerSection } from './components/FileManagerSection';
import { clsx } from 'clsx';

// Mock Data for the Pool
const INITIAL_FILES = [
  { id: '1', name: 'AuthManager.ts', type: 'Logic', size: '2.4 KB', category: 'AUTH' },
  { id: '2', name: 'TokenStore.ts', type: 'Storage', size: '1.2 KB', category: 'AUTH' },
  { id: '3', name: 'DatabaseConnector.ts', type: 'Infrastructure', size: '4.8 KB', category: 'DB' },
  { id: '4', name: 'QueryBuilder.ts', type: 'Utility', size: '3.1 KB', category: 'DB' },
  { id: '5', name: 'GeminiInterface.ts', type: 'AI Service', size: '5.2 KB', category: 'AI' },
  { id: '6', name: 'StreamHandler.ts', type: 'Network', size: '2.9 KB', category: 'AI' },
  { id: '7', name: 'UIFactory.tsx', type: 'React Component', size: '7.4 KB', category: 'UI' },
  { id: '8', name: 'ThemeEngine.ts', type: 'Manager', size: '1.8 KB', category: 'UTILS' },
];

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [inspectingBlock, setInspectingBlock] = useState<any>(null);

  // Sync theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const handleSort = (key: string) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedFiles = useMemo(() => {
    let result = INITIAL_FILES.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a: any, b: any) => {
      const valA = a[sort.key].toLowerCase();
      const valB = b[sort.key].toLowerCase();
      if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, sort]);

  const handleSelectFile = (file: any) => {
    setInspectingBlock({
      ...file,
      file: file.name,
      loading: true,
      content: `// Source logic for ${file.name}\n\nimport { Pool } from '@wadbar/lego-core';\n\nexport const ${file.name.split('.')[0]} = async () => {\n  console.log("Executing Lego Block: ${file.category}");\n  const instance = await Pool.ingest('${file.id}');\n  return instance.evaluate();\n};\n\n/**\n * @metadata\n * Maturity: High\n * Stability: 98%\n * Coverage: Industrial-grade\n */`,
    });

    // Simulate loading
    setTimeout(() => {
      setInspectingBlock((prev: any) => ({ ...prev, loading: false }));
    }, 800);
  };

  const handleAction = (type: string, cat: string, file: string) => {
    setInspectingBlock((prev: any) => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setInspectingBlock((prev: any) => {
        const update: any = { [type]: false };
        if (type === 'auditing') {
          update.health = {
            score: 92,
            maturity: 'Industrial',
            stability_index: 98,
            findings: ['Strong typed interface', 'Efficient GC footprint']
          };
        }
        if (type === 'interopLoading') {
          update.interopMatrix = [
            { target_block: 'LegoCore.ts', affinity: 95, correlation: 'Direct', proximity: 98, stability: 100, similarity: 10, fit_result: 'Perfect architectural alignment detected.' }
          ];
        }
        return { ...prev, ...update };
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen flex bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] selection:bg-[var(--md-sys-color-primary-container)] selection:text-[var(--md-sys-color-on-primary-container)]">
      
      {/* Navigation Rail (M3 Style) */}
      <nav className="w-24 flex-none border-r border-[var(--md-sys-color-outline-variant)] flex flex-col items-center py-8 gap-8 bg-[var(--md-sys-color-surface)]">
        <div className="w-14 h-14 rounded-2xl bg-[var(--md-sys-color-primary)] flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
          <Layers className="w-8 h-8" />
        </div>
        
        <div className="flex-1 flex flex-col gap-4">
          <NavItem icon={<Package />} label="Pool" active />
          <NavItem icon={<Code2 />} label="Edit" />
          <NavItem icon={<Database />} label="State" />
          <NavItem icon={<Cpu />} label="Logs" />
        </div>

        <div className="flex flex-col gap-4 mb-4">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] transition-all"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <NavItem icon={<Settings />} label="Config" />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 flex-none px-10 flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)]">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black tracking-tighter flex items-center gap-3">
              LEGO POOL
              <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] ring-1 ring-inset ring-[var(--md-sys-color-outline)]">V1.0.0</span>
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] text-xs font-mono border border-[var(--md-sys-color-outline-variant)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ENGINE STATUS: LIVE
            </div>
            <button className="flex items-center gap-2 text-xs font-bold hover:text-[var(--md-sys-color-primary)] transition-colors">
              <Github className="w-4 h-4" />
              Source Pool
            </button>
          </div>
        </header>

        <section className="flex-1 flex overflow-hidden">
          {/* File Explorer Region */}
          <div className="w-[450px] flex-none border-r border-[var(--md-sys-color-outline-variant)] shadow-sm z-10">
            <FileManagerSection 
              files={filteredAndSortedFiles}
              currentSort={sort}
              onSort={handleSort}
              onSelectFile={handleSelectFile}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Workbench / Visualizer Region */}
          <div className="flex-1 bg-[var(--md-sys-color-surface-container)] flex items-center justify-center p-12 overflow-auto">
             <div className="w-full max-w-4xl space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black on-surface">Pool Visualization</h2>
                    <p className="on-surface-variant text-lg">Real-time modular synergy and health index.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <StatCard icon={<Cpu />} label="Active Neurons" value="1,240" />
                   <StatCard icon={<Database />} label="Total Logic Blocks" value={INITIAL_FILES.length.toString()} />
                </div>

                <div className="m3-card !bg-[var(--md-sys-color-surface-container-high)] border-dashed border-2 flex flex-col items-center justify-center py-20 text-center space-y-4">
                   <Terminal className="w-16 h-16 on-surface-variant opacity-20" />
                   <p className="on-surface-variant font-medium">Select a module from the Pool to inspect its source, synergy matrix, and health audit.</p>
                </div>
             </div>
          </div>
        </section>
      </main>

      {/* Inspector Overlay */}
      <AnimatePresence>
        {inspectingBlock && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setInspectingBlock(null)}
          >
            <Panel 
               inspectingBlock={inspectingBlock}
               onClose={() => setInspectingBlock(null)}
               onRunTest={() => handleAction('testing', '', '')}
               onAuditBlock={() => handleAction('auditing', '', '')}
               onPowerizeBlock={() => handleAction('powerizing', '', '')}
               onCheckInterop={() => handleAction('interopLoading', '', '')}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={clsx(
      "w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative",
      active ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] shadow-sm" : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
    )}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      <span className="absolute left-full ml-4 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none uppercase font-bold tracking-tighter">
        {label}
      </span>
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="m3-card flex items-center gap-6 !p-8 hover:scale-[1.02] transition-transform cursor-pointer group">
      <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] flex items-center justify-center group-hover:bg-[var(--md-sys-color-primary)] group-hover:text-white transition-colors">
        {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
      </div>
      <div>
        <p className="on-surface-variant text-sm font-bold uppercase tracking-widest">{label}</p>
        <p className="text-4xl font-black on-surface tracking-tighter">{value}</p>
      </div>
    </div>
  );
}
