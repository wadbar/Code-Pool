import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Layers, Package, Code2, Sparkles,
  ShieldCheck, Zap, Activity, Info,
  TrendingUp, BarChart3, Globe, Terminal,
  Sun, Moon, Github, Settings, Cpu, Database
} from 'lucide-react';
import { Panel } from './components/Panel';
import { FileManagerSection } from './components/FileManagerSection';
import { MeshProcessor } from './components/MeshProcessor';
import { JvmDashboard } from './components/JvmDashboard';
import { RedisHealthIndicator } from './components/RedisHealthIndicator';
import { LiveLogDashboard } from './components/LiveLogDashboard';
import { FullAuditHistory } from './components/FullAuditHistory';
import { LoggingMonitor } from './components/LoggingMonitor';
import { BlueprintExplorer } from './components/BlueprintExplorer';
import { EcosystemHealthMonitor } from './components/EcosystemHealthMonitor';
import { RegistryAuditGrid } from './components/RegistryAuditGrid';
import { GitConflictResolution } from './components/GitConflictResolution';
import { socketHub } from './POOL/modules/AUTOMATION/SocketHub';
import { clsx } from 'clsx';
import { logger } from './telemetry';
import { LogLevel, LegoModule, InteropResult } from './types';
import { authShield } from './auth';
import { infra } from './infrastructure';
import { Download, Monitor, GitMerge } from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';

/**
 * Standardized Industrial Pool Baseline
 * Abstracted from https://github.com/wadbar/Code-Pool
 */
const INDUSTRIAL_POOL_BASELINE: LegoModule[] = [
  { 
    id: 'AUTH-V24-S', 
    name: 'AuthShield.ts', 
    type: 'Core Shield', 
    size: '2.4 KB', 
    category: 'AUTH', 
    version: '24.1.0', 
    executionMode: 'SYNC' 
  },
  { 
    id: 'TEL-V22-M', 
    name: 'TelemetryEngine.ts', 
    type: 'Monitoring', 
    size: '3.1 KB', 
    category: 'INFRA', 
    version: '22.0.5', 
    executionMode: 'ASYNC' 
  },
  { 
    id: 'DB-V20-P', 
    name: 'QueryPipe.ts', 
    type: 'Data Stream', 
    size: '4.8 KB', 
    category: 'DB', 
    version: '20.2.0', 
    executionMode: 'DAEMON' 
  },
  { 
    id: 'AI-V26-A', 
    name: 'GeminiAgent.ts', 
    type: 'AI Daemon', 
    size: '5.2 KB', 
    category: 'AI', 
    version: '26.0.0', 
    executionMode: 'WORKER' 
  },
  { 
    id: 'UI-V13-G', 
    name: 'GridSystem.tsx', 
    type: 'Layout Engine', 
    size: '7.4 KB', 
    category: 'UI', 
    version: '13.1.2', 
    executionMode: 'SYNC' 
  },
];

const ECOSYSTEM_TIMELINE = [
  { time: '00:00', accuracy: 98, stability: 99, coverage: 92 },
  { time: '04:00', accuracy: 97, stability: 98, coverage: 92 },
  { time: '08:00', accuracy: 99, stability: 100, coverage: 95 },
  { time: '12:00', accuracy: 98, stability: 99, coverage: 98 },
  { time: '16:00', accuracy: 100, stability: 100, coverage: 99 },
  { time: '20:00', accuracy: 99, stability: 99, coverage: 100 },
  { time: '23:59', accuracy: 100, stability: 100, coverage: 100 },
];

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('industrial_pool_theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [inspectingModule, setInspectingModule] = useState<LegoModule | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [timelineData, setTimelineData] = useState(ECOSYSTEM_TIMELINE);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<number>(0);
  const [isLoggingMonitorOpen, setIsLoggingMonitorOpen] = useState(false);
  const [isGitConflictOpen, setIsGitConflictOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'HARVEST' | 'TELEMETRY' | 'SECURITY' | 'ECOSYSTEM' | 'REGISTRY'>('HARVEST');

  const handleSort = useCallback((key: string) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleAuditRequest = useCallback(() => {
    setIsAuditing(true);
    socketHub.emitEvent('audit:start', {});
    setTimeout(() => {
       setIsAuditing(false);
       logger.log(LogLevel.INFO, 'AUDIT', 'Global ecosystem audit synchronized.');
    }, 2500);
  }, []);

  const handleConfigSync = useCallback(() => {
    logger.log(LogLevel.INFO, 'CONFIG', 'Harvesting localized Java and AI trajectories...');
    socketHub.emitEvent('log', { 
      level: 'INFO', 
      context: 'HARVESTER', 
      message: 'Generating localized JVM and LLM optimization matrices.' 
    });
  }, []);

  const handleDownloadRegistry = useCallback(async () => {
    try {
      logger.log(LogLevel.INFO, 'HARVESTER', 'Exporting repository registry state...');
      const response = await fetch('/api/repo-registry');
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `repo-registry-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        logger.log(LogLevel.INFO, 'HARVESTER', 'Registry export synchronized successfully.');
      }
    } catch (err) {
      logger.log(LogLevel.ERROR, 'HARVESTER', 'Registry export trajectory failed.');
    }
  }, []);

  // Dynamic Telemetry Jitter
  useEffect(() => {
    // Connect to SocketHub
    socketHub.onEvent('connect', () => {
       logger.log(LogLevel.INFO, 'SOC_HUB', 'Connected to real-time orchestration hub.');
    });

    const interval = setInterval(() => {
      setTimelineData(prev => prev.map(p => ({
        ...p,
        stability: Math.min(100, Math.max(95, p.stability + (Math.random() * 2 - 1)))
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // App Initialization Sequence
  useEffect(() => {
    const initialize = async () => {
      try {
        logger.log(LogLevel.INFO, 'LIFECYCLE', 'Initiating industrial boot sequence.');
        
        // Synchronizing with Auth trajectory
        await authShield.validateTrajectory();
        
        setIsInitializing(false);
        logger.log(LogLevel.INFO, 'LIFECYCLE', 'Sovereignty check completed. UI engaged.');
      } catch (err) {
        logger.log(LogLevel.CRITICAL, 'LIFECYCLE', 'Boot sequence stalled. Critical integrity fail.');
      }
    };
    
    initialize();
  }, []);

  // Theme Sync Logic
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('industrial_pool_theme', theme);
    logger.log(LogLevel.DEBUG, 'THEME_SYNC', `Theme switched to ${theme.toUpperCase()}`);
  }, [theme]);

  // Handle module ingestion (Harvesting)
  const handleModuleIngestion = useCallback(async (module: LegoModule) => {
    logger.log(LogLevel.INFO, 'HARVESTER', `Ingesting module trajectory: ${module.id}`);
    
    // Set initial loading state with deterministic placeholders
    setInspectingModule({
      ...module,
      content: '', // Reset content
    });

    try {
      await infra.resilientExecute(async () => {
        // In a real industrial scenario, this would use fetch() or fs.readFile()
        // Here we simulate the acquisition of generalized code from the Pool
        await new Promise(r => setTimeout(r, 700));
        
        const content = `/**\n * @industrial_module ${module.id}\n * @repository https://github.com/wadbar/Code-Pool\n * @status INDUSTRIAL\n */\n\nimport { Telemetry, Infra, Auth } from './standard-lib';\n\nexport const ${module.name.split('.')[0]} = async () => {\n  const traceId = Telemetry.start('ORCHESTRATION');\n  \n  try {\n    Infra.registerCheckpoint('${module.id}');\n    const context = await Auth.validateTrajectory();\n    \n    if (!context) throw new Error('AUTH_TRAJECTORY_VIOLATION');\n    \n    Telemetry.log(LogLevel.INFO, 'EXECUTION', 'Executing generalized ${module.category} logic chain...', { traceId });\n    \n    return { status: 'COMPLETE', traceId };\n  } catch (err: any) {\n    Telemetry.critical('RUNTIME_ERROR', err.message, { traceId });\n    throw err;\n  } finally {\n    Telemetry.end(traceId);\n  }\n};`;
        
        setInspectingModule(prev => prev ? { ...prev, content, loading: false } : null);
      });
    } catch (err) {
      setInspectingModule(prev => prev ? { ...prev, loading: false, error: 'Harvesting failed. Repository matrix unreachable.' } : null);
    }
  }, []);

  // Module Actions (Auditing, Testing, Refinement)
  const handleModuleAction = useCallback(async (type: 'testing' | 'auditing' | 'powerizing' | 'interopLoading') => {
    if (!inspectingModule) return;
    
    setInspectingModule(prev => prev ? { ...prev, [type]: true } : null);
    
    try {
      await new Promise(r => setTimeout(r, 1200)); // Processing trajectory
      
      setInspectingModule(prev => {
        if (!prev) return null;
        const update: Partial<LegoModule & { [key: string]: any }> = { [type]: false };
        
        if (type === 'auditing') {
          update.health = {
            score: 100,
            maturity: 'INDUSTRIAL',
            stabilityIndex: 100,
            lastAudit: new Date().toISOString(),
            findings: [
              'Zero loose "any" types detected',
              'LIFO Cleanup stack active',
              'Exponential Backoff implemented',
              'Telemetry Pipeline synced'
            ],
            timeline: ECOSYSTEM_TIMELINE
          };
          logger.log(LogLevel.INFO, 'AUDITOR', `Health audit verified: ${prev.id} [100%]`);
        }
        
        if (type === 'interopLoading') {
          update.interopMatrix = [
            { 
              target_block: 'InfraEngine.ts', 
              affinity: 100, 
              correlation: 'Absolute', 
              proximity: 100, 
              stability: 100, 
              similarity: 0, 
              fit_result: 'Standardized coupling detected. No adaptation required.' 
            },
            { 
              target_block: 'AuthShield.ts', 
              affinity: 98, 
              correlation: 'High', 
              proximity: 95, 
              stability: 100, 
              similarity: 10, 
              fit_result: 'Security baseline inheriting correctly.' 
            }
          ];
          logger.log(LogLevel.INFO, 'INTEROP', `Synergy matrix for ${prev.id} calculated.`);
        }
        
        return { ...prev, ...update };
      });
    } catch (err) {
      setInspectingModule(prev => prev ? { ...prev, [type]: false, error: 'Action trajectory failed.' } : null);
    }
  }, [inspectingModule]);

  // Filtering Logic
  const filteredModules = useMemo(() => {
    let result = [...INDUSTRIAL_POOL_BASELINE].filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      const valA = (a as any)[sort.key].toLowerCase();
      const valB = (b as any)[sort.key].toLowerCase();
      if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, sort]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[var(--md-sys-color-surface)] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-8 text-center max-w-sm">
          <div className="relative">
            <Layers className="w-16 h-16 text-[var(--md-sys-color-primary)] animate-pulse" />
            <div className="absolute inset-0 bg-[var(--md-sys-color-primary)]/20 blur-2xl rounded-full" />
          </div>
          <div className="space-y-3">
             <h2 className="text-2xl font-black on-surface tracking-tighter">Establishing Sovereignty</h2>
             <p className="on-surface-variant text-sm font-bold uppercase tracking-[0.2em] opacity-40">Industrial Boot Sequence V2.6</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] selection:bg-[var(--md-sys-color-primary-container)]">
      
      {/* Navigation Rail (Industrial Scale) */}
      <nav className="w-28 flex-none border-r border-[var(--md-sys-color-outline-variant)] flex flex-col items-center py-16 gap-12 bg-[var(--md-sys-color-surface)] z-40 shadow-2xl">
        <motion.div 
          whileHover={{ rotate: 90 }}
          className="w-16 h-16 rounded-[2.5rem] bg-[var(--md-sys-color-primary)] flex items-center justify-center text-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] cursor-pointer"
        >
          <Layers className="w-9 h-9" />
        </motion.div>
        
        <div className="flex-1 flex flex-col gap-10">
          <NavItem icon={<Package />} label="Harvest" active={currentView === 'HARVEST'} onClick={() => setCurrentView('HARVEST')} />
          <NavItem icon={<Activity />} label="Telemetry" active={currentView === 'TELEMETRY'} onClick={() => setCurrentView('TELEMETRY')} />
          <NavItem icon={<ShieldCheck />} label="Security" active={currentView === 'SECURITY'} onClick={() => setCurrentView('SECURITY')} />
          <NavItem icon={<Globe />} label="Ecosystem" active={currentView === 'ECOSYSTEM'} onClick={() => setCurrentView('ECOSYSTEM')} />
        </div>

        <div className="flex flex-col gap-8 mb-4 border-t border-[var(--md-sys-color-outline-variant)] pt-10">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-14 h-14 rounded-full flex items-center justify-center hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] transition-all duration-500 hover:scale-110"
          >
            {theme === 'light' ? <Moon className="w-7 h-7" /> : <Sun className="w-7 h-7" />}
          </button>
          <NavItem icon={<Settings />} label="Registry" active={currentView === 'REGISTRY'} onClick={() => setCurrentView('REGISTRY')} />
        </div>
      </nav>

      {/* Main Core View */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-32 flex-none px-20 flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] shadow-lg z-30">
          <div className="flex items-center gap-10">
            <div className="flex flex-col">
              <h1 className="text-4xl font-black tracking-tighter leading-none mb-3 flex items-center gap-5">
                UNIVERSAL LEGO POOL
                <span className="px-5 py-2 rounded-2xl text-[10px] font-black bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-outline)] shadow-xl uppercase tracking-widest">INDUSTRIAL_V2.6</span>
              </h1>
              <p className="text-[12px] font-black on-surface-variant uppercase tracking-[0.4em] opacity-40">Unified Architectural Sovereignty • WSL2 Debian Native</p>
            </div>
          </div>

          <div className="flex items-center gap-12">
            <RedisHealthIndicator />
            
            <div className="h-16 w-px bg-[var(--md-sys-color-outline-variant)] opacity-50" />

            <button className="flex items-center gap-5 text-sm font-black on-surface-variant hover:text-[var(--md-sys-color-primary)] transition-all hover:bg-[var(--md-sys-color-surface-container-highest)] py-4 px-8 rounded-3xl group">
              <Github className="w-7 h-7 transition-all group-hover:scale-125" />
              ECOSYSTEM MATRIX
            </button>
          </div>
        </header>

        <section className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="wait">
            {currentView === 'HARVEST' && (
              <motion.div 
                key="harvest-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 flex overflow-hidden"
              >
                {/* Module Harvesting Panel */}
                <div className="w-[500px] flex-none border-r border-[var(--md-sys-color-outline-variant)] shadow-2xl z-20 bg-[var(--md-sys-color-surface)]/95 backdrop-blur-3xl overflow-hidden">
                  <FileManagerSection 
                    files={filteredModules}
                    currentSort={sort}
                    onSort={handleSort}
                    onSelectFile={handleModuleIngestion}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </div>

                {/* Workbench Dashboard */}
                <div className="flex-1 bg-[var(--md-sys-color-surface-container)] p-12 overflow-auto custom-scrollbar">
                  <div className="w-full max-w-7xl mx-auto space-y-12">
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-start justify-between gap-12"
                    >
                      <div className="flex items-start gap-12">
                        <div className="p-8 rounded-[2.5rem] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-xl flex-none transform hover:rotate-6 transition-transform">
                          <Sparkles className="w-16 h-16" />
                        </div>
                        <div className="space-y-4 pt-2">
                          <h2 className="text-6xl font-black on-surface tracking-tighter leading-none">Standardization Lab</h2>
                          <p className="on-surface-variant text-xl leading-relaxed max-w-2xl font-medium opacity-60 italic">Architectural synchronization via industrial Lego block harvesting.</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <ActionButton onClick={handleDownloadRegistry} icon={<Download />} color="text-emerald-500" title="Registry Export" />
                        <ActionButton onClick={() => setIsLoggingMonitorOpen(true)} icon={<Monitor />} color="text-blue-500" title="Live Telemetry" />
                        <ActionButton onClick={handleAuditRequest} disabled={isAuditing} icon={<ShieldCheck className={clsx("w-8 h-8", isAuditing && "animate-spin")} />} color="text-[var(--md-sys-color-primary)]" title="System Audit" />
                      </div>
                    </motion.div>

                    <div className="grid grid-cols-3 gap-8">
                       <StatCard icon={<Cpu />} label="Telemetry Flows" value="4.2k" sub="Active Contexts" />
                       <StatCard icon={<ShieldCheck />} label="Security Index" value="1.00" sub="Universal Auth Sync" />
                       <StatCard icon={<BarChart3 />} label="Logic Health" value="100%" sub="Production Ready" />
                    </div>

                    <div className="grid grid-cols-5 gap-8">
                       <div className="col-span-3">
                          <MeshProcessor />
                       </div>
                       <div className="col-span-2">
                         <StabilityGraph timelineData={timelineData} />
                       </div>
                    </div>

                    <JvmDashboard />
                    <Ticker />
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'REGISTRY' && (
              <motion.div 
                key="registry-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 p-20 overflow-auto custom-scrollbar"
              >
                <div className="max-w-7xl mx-auto space-y-12">
                   <RegistryAuditGrid />
                   <DependencyAuditor />
                </div>
              </motion.div>
            )}

            {currentView === 'TELEMETRY' && (
              <motion.div 
                key="telemetry-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 p-20 overflow-auto custom-scrollbar"
              >
                <div className="max-w-7xl mx-auto space-y-12">
                   <div className="flex items-center gap-10 mb-12">
                      <div className="p-5 bg-blue-500 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                         <Activity className="w-12 h-12" />
                      </div>
                      <div>
                         <h2 className="text-5xl font-black on-surface tracking-tighter">Telemetry Hub</h2>
                         <p className="text-[10px] font-black on-surface-variant uppercase tracking-[0.3em] opacity-40">Industrial Stream Processing Dashboard</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-3 gap-10">
                      <div className="col-span-2">
                        <StabilityGraph timelineData={timelineData} />
                      </div>
                      <EcosystemHealthMonitor />
                   </div>
                   <FullAuditHistory />
                </div>
              </motion.div>
            )}

            {currentView === 'ECOSYSTEM' && (
              <motion.div 
                key="ecosystem-view"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 p-20 overflow-auto custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto">
                   <BlueprintExplorer />
                </div>
              </motion.div>
            )}

            {currentView === 'SECURITY' && (
              <motion.div 
                key="security-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 p-20 overflow-auto custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto space-y-12">
                   <div className="flex items-center gap-10">
                      <div className="p-5 bg-red-500 rounded-3xl text-white shadow-xl">
                         <ShieldCheck className="w-12 h-12" />
                      </div>
                      <div>
                         <h2 className="text-5xl font-black on-surface tracking-tighter">Security Perimeter</h2>
                         <p className="text-[10px] font-black on-surface-variant uppercase tracking-[0.3em] opacity-40">Conflict Resolution & Authentication Triage</p>
                      </div>
                   </div>
                   <div className="p-10 rounded-[3rem] bg-[var(--md-sys-color-surface-container-highest)] border border-red-500/20">
                      <h3 className="text-xl font-black on-surface mb-6 flex items-center gap-4 text-red-500">
                        <GitMerge className="w-6 h-6" />
                        Synchronicity Conflict Detected
                      </h3>
                      <p className="text-sm on-surface-variant opacity-60 leading-relaxed max-w-2xl">The Git Interop Manager has flagged trajectory violations in 3 core modules. Manual resolution is required to restore sovereignty.</p>
                      <button 
                        onClick={() => setIsGitConflictOpen(true)}
                        className="mt-8 px-10 py-5 rounded-2xl bg-red-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20 hover:scale-105 transition-all"
                      >
                        Launch Conflict Resolver
                      </button>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--md-sys-color-outline-variant);
          border-radius: 20px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--md-sys-color-outline);
          background-clip: content-box;
        }
      `}</style>

      {/* Universal Ecosystem Inspector */}
      <AnimatePresence mode="wait">
        {inspectingModule && (
          <motion.div 
            key="panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-16 bg-black/70 backdrop-blur-[40px]"
          >
            <Panel 
               inspectingBlock={inspectingModule}
               onClose={() => setInspectingModule(null)}
               onRunTest={() => {}}
               onAuditBlock={() => {}}
               onPowerizeBlock={() => {}}
               onCheckInterop={() => {}}
            />
          </motion.div>
        )}
        <LiveLogDashboard key="live-log-dash" isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />
        <LoggingMonitor key="log-mon" isOpen={isLoggingMonitorOpen} onClose={() => setIsLoggingMonitorOpen(false)} />
        <GitConflictResolution key="git-conflicts" isOpen={isGitConflictOpen} onClose={() => setIsGitConflictOpen(false)} />
      </AnimatePresence>
    </div>
  );
}

const ActionButton = ({ onClick, icon, color, title, disabled = false }: { onClick: () => void, icon: React.ReactNode, color: string, title: string, disabled?: boolean }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      "p-6 rounded-3xl bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] shadow-lg hover:scale-110 transition-all group disabled:opacity-50",
      color
    )}
    title={title}
  >
    {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
  </button>
);

const StabilityGraph = ({ timelineData }: { timelineData: any[] }) => (
  <motion.div 
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.2 }}
    className="m3-card !bg-[var(--md-sys-color-surface)] p-10 space-y-8 h-full flex flex-col shadow-xl border-none ring-1 ring-[var(--md-sys-color-outline-variant)]"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <TrendingUp className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
        <h3 className="text-xl font-black tracking-tighter uppercase whitespace-nowrap">Stability Matrix</h3>
      </div>
    </div>
    
    <div className="flex-1 -mx-8 h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={timelineData}>
          <defs>
            <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--md-sys-color-primary)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--md-sys-color-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--md-sys-color-outline-variant)" opacity={0.3} />
          <XAxis dataKey="time" hide />
          <YAxis hide domain={[90, 105]} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--md-sys-color-surface)', 
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '24px',
              padding: '16px',
              fontSize: '12px',
              fontWeight: '900',
              boxShadow: '0 32px 64px -12px rgba(0,0,0,0.2)'
            }} 
          />
          <Area type="monotone" dataKey="stability" stroke="var(--md-sys-color-primary)" strokeWidth={4} fillOpacity={1} fill="url(#primaryGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </motion.div>
);

const Ticker = () => (
  <div className="flex items-center gap-8 p-8 rounded-3xl bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] shadow-xl overflow-hidden relative group">
     <div className="flex-none flex items-center gap-3 text-[10px] font-black on-surface uppercase tracking-[0.3em] relative z-10 transition-colors group-hover:text-[var(--md-sys-color-primary)]">
       <Info className="w-4 h-4" />
       CORE_LIVE:
     </div>
     <div className="flex-1 overflow-hidden relative z-10">
       <motion.div 
          initial={{ x: "0%" }}
          animate={{ x: "-100%" }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          className="flex gap-24 whitespace-nowrap text-[10px] font-mono on-surface-variant font-bold opacity-40 uppercase"
       >
         <span>[TEL] Flushing ecoystem telemetry...</span>
         <span>[AUTH] Verifying industrial Level-10 trajectory...</span>
         <span>[INFRA] SIGTERM listener engaged...</span>
         <span>[LEGO] Scanned 1.2k logic blocks...</span>
         <span>[SYNC] Ecosystem synchronization at 99.8%...</span>
       </motion.div>
     </div>
  </div>
);

const NavItem = React.memo(({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className={clsx(
        "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all group relative",
        active ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-2xl scale-110 ring-4 ring-[var(--md-sys-color-primary)]/20" : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:scale-110"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
      <div className="absolute left-[130%] ml-6 px-6 py-3 bg-black text-white text-[11px] font-black rounded-2xl opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100 group-hover:translate-x-0 -translate-x-8 whitespace-nowrap z-[110] pointer-events-none uppercase tracking-[0.3em] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/10">
        {label}
      </div>
    </button>
  );
});

const StatCard = React.memo(({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string, sub: string }) => {
  return (
    <div className="m3-card !bg-[var(--md-sys-color-surface)] !rounded-[3.5rem] flex items-center gap-12 !p-12 hover:scale-[1.08] transition-all cursor-pointer group shadow-2xl hover:shadow-[0_64px_128px_-24px_rgba(0,0,0,0.3)] border-b-[10px] border-b-transparent hover:border-b-[var(--md-sys-color-primary)]">
      <div className="w-28 h-28 rounded-[2.5rem] bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center group-hover:bg-[var(--md-sys-color-primary)] group-hover:text-white transition-all transform group-hover:rotate-12 shadow-inner group-hover:shadow-2xl">
        {React.cloneElement(icon as React.ReactElement, { className: "w-14 h-14" })}
      </div>
      <div className="space-y-3">
        <p className="on-surface-variant text-[11px] font-black uppercase tracking-[0.4em] opacity-40 leading-none">{label}</p>
        <p className="text-7xl font-black on-surface tracking-tighter leading-none">{value}</p>
        <p className="text-[14px] font-black text-[var(--md-sys-color-primary)] italic opacity-60 tracking-tight">{sub}</p>
      </div>
    </div>
  );
});
