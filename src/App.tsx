import React, { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  Search, 
  Target, 
  Github, 
  Database, 
  Layers, 
  Box, 
  Play, 
  Pause, 
  RotateCw, 
  Trash2, 
  Cpu, 
  Activity, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Terminal, 
  HelpCircle 
} from 'lucide-react';


interface WatchedRepository {
  url: string;
  lastSync: string | null;
  isMonster?: boolean;
  retryCount?: number;
  digestedCount?: number;
  totalFiles?: number;
}

interface InventoryCategory {
  category: string;
  blocks: string[];
}

export interface RealScanEvent {
  timestamp: string;
  type: 'DISC' | 'LEGO' | 'BLUEPRINT' | 'WATCHLIST' | 'SERVER';
  message: string;
}

export interface RealScanData {
  lastScanTime: string;
  totalRepos: number;
  totalBlocks: number;
  totalBlueprints: number;
  totalDigestedFiles: number;
  diskSizeKB: number;
  categoriesCount: Record<string, number>;
  events: RealScanEvent[];
}

export default function App() {
  const [repositories, setRepositories] = useState<WatchedRepository[]>([]);
  const [inventory, setInventory] = useState<InventoryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [realScanData, setRealScanData] = useState<RealScanData | null>(null);
  
  // Custom states requested by user
  const [activeTab, setActiveTab] = useState<'overview' | 'repos' | 'legos' | 'logs'>('overview');
  const [blueprintInfo, setBlueprintInfo] = useState<{ count: number; blueprints: any[] }>({ count: 0, blueprints: [] });
  
  // Filtering and Input states
  const [filter, setFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'url' | 'lastSync'>('url');
  
  const [ingestUrl, setIngestUrl] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hunting, setHunting] = useState(false);
  
  const [logs, setLogs] = useState({ ingestion: '', blueprints: '', system: '' });
  const [status, setStatus] = useState<{ message: string, type: 'info' | 'error' | 'success' | null }>({ message: '', type: null });

  const showAlert = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: null }), 6000);
  };

  const showConfirm = (message: React.ReactNode, onConfirm: () => void) => {
    // Routine actions execute directly to maintain fluent automated flow
    onConfirm();
  };

  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!res.ok) {
        if (isJson) {
          try {
            const data = await res.json();
            throw new Error(data.error || data.message || `HTTP ${res.status}`);
          } catch (e: any) {
            throw new Error(e.message || `HTTP ${res.status}`);
          }
        } else {
          throw new Error(`Erro na conexão (HTTP ${res.status}). O servidor pode estar indisponível ou reiniciando.`);
        }
      }

      if (!isJson) {
        throw new Error("O servidor retornou uma resposta inválida (não JSON). Tente novamente em alguns instantes.");
      }

      try {
        return await res.json();
      } catch {
        throw new Error("Falha ao descriptografar dados JSON do servidor.");
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("fetch failed"))) {
        throw new Error("Não foi possível conectar ao servidor. Verifique se ele está ativo e tente novamente.");
      }
      throw err;
    }
  };

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/pool/registry');
      setRepositories(data.watched || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.warn(`[Background Poll Info] Failed to fetch registry: ${error.message}`);
    }
    setLoading(false);
  };

  const fetchInventory = async () => {
    try {
      const data = await safeFetchJson('/api/pool/inventory');
      setInventory(data.inventory || []);
    } catch (e: any) {
      console.warn(`[Background Poll Info] Failed to fetch inventory: ${e.message}`);
    }
  };

  const fetchBlueprints = async () => {
    try {
      const data = await safeFetchJson('/api/pool/blueprints');
      setBlueprintInfo(data || { count: 0, blueprints: [] });
    } catch (e: any) {
      console.warn(`[Background Poll Info] Failed to fetch blueprints: ${e.message}`);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await safeFetchJson('/api/pool/logs');
      setLogs(data);
    } catch (e: any) {
      console.warn(`[Background Poll Info] Failed to fetch logs: ${e.message}`);
    }
  };

  const [workerStatus, setWorkerStatus] = useState<'running' | 'paused' | 'stop_after_current'>('running');

  const fetchWorkerStatus = async () => {
    try {
      const data = await safeFetchJson('/api/pool/worker/status');
      setWorkerStatus(data.status);
    } catch (e: any) {
      console.warn(`[Background Poll Info] Failed to fetch worker status: ${e.message}`);
    }
  };

  const handleControl = async (status: string) => {
    try {
      await fetch('/api/pool/worker/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (status === 'running') {
        fetch('/api/pool/worker/restart', { method: 'POST' }).catch(() => {});
      }
      
      fetchWorkerStatus();
      showAlert(`Estado de execução alterado para: ${status.replace(/_/g, ' ').toUpperCase()}`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveRepo = async (url: string) => {
    try {
      await safeFetchJson('/api/pool/registry/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      showAlert('Repositório removido da watchlist.', 'success');
      await fetchRegistry();
    } catch (e: any) {
      showAlert('Falha ao remover repositório: ' + e.message, 'error');
    }
  };

  const handleRestartWorker = async () => {
    try {
      await fetch('/api/pool/worker/restart', { method: 'POST' });
      showAlert('Workers e Daemons reiniciados com sucesso.', 'success');
      fetchWorkerStatus();
    } catch (e) {
      console.error(e);
      showAlert('Erro ao reiniciar trabalhadores da Pool.', 'error');
    }
  };

  const [commitStatus, setCommitStatus] = useState<{ total: number, done: number, active: boolean }>({ total: 0, done: 0, active: false });

  const fetchCommitStatus = async () => {
    try {
      const data = await safeFetchJson('/api/pool/worker/commit-status');
      setCommitStatus(data);
    } catch (e: any) {
      console.warn(`[Background Poll Info] Failed to fetch commit status: ${e.message}`);
    }
  };

  const fetchRealScanData = async () => {
    try {
      const data = await safeFetchJson('/api/pool/real-scan-data');
      setRealScanData(data);
    } catch (e: any) {
      console.warn(`[Background Scanner Poll Info] Failed to fetch real scan data: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchRegistry();
    fetchInventory();
    fetchLogs();
    fetchWorkerStatus();
    fetchBlueprints();
    fetchRealScanData();
    
    const interval = setInterval(() => {
      fetchLogs();
      fetchWorkerStatus();
      fetchCommitStatus();
      fetchBlueprints();
      fetchRealScanData();
      fetchRegistry();
      fetchInventory();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/pool/sync', { method: 'POST' });
      showAlert('Sincronização global executada!', 'success');
      await fetchRegistry();
      await fetchInventory();
      await fetchBlueprints();
    } catch (e) {
      console.error(e);
      showAlert('Houve um erro durante a sincronização.', 'error');
    }
    setSyncing(false);
  };

  const handleHunt = async () => {
    setHunting(true);
    try {
      const data = await safeFetchJson('/api/pool/hunt', { method: 'POST' });
      showAlert(`Caçada de código finalizada! Encontrados ${data.hunted || 0} novos alvos do GitHub.`, 'success');
      await fetchRegistry();
      await fetchInventory();
      await fetchBlueprints();
    } catch (e: any) {
      showAlert('A caçada falhou: ' + e.message, 'error');
    }
    setHunting(false);
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrl) return;
    setIngesting(true);
    try {
      const data = await safeFetchJson('/api/pool/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: ingestUrl }),
      });
      showAlert(data.message || 'Alvo adicionado com sucesso para decomposição.', 'success');
      setIngestUrl('');
      await fetchRegistry();
    } catch (e: any) {
      showAlert('Falha na ingestão: ' + e.message, 'error');
    }
    setIngesting(false);
  };

  const [scrapeMode, setScrapeMode] = useState<'url' | 'raw'>('url');
  const [rawContent, setRawContent] = useState('');

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scrapeMode === 'url' && !scrapeUrl) return;
    if (scrapeMode === 'raw' && !rawContent) return;
    
    setScraping(true);
    try {
      const data = await safeFetchJson('/api/pool/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceUrl: scrapeMode === 'url' ? scrapeUrl : undefined,
          rawContent: scrapeMode === 'raw' ? rawContent : undefined
        }),
      });
      showAlert(`Varredura completa! ${data.found || 0} repositórios identificados. ${data.added || 0} novos enfileirados.`, 'success');
      setScrapeUrl('');
      setRawContent('');
      await fetchRegistry();
    } catch (e: any) {
      showAlert('Erro no Scraper: ' + e.message, 'error');
    }
    setScraping(false);
  };

  // Live log analysis helpers
  const getCurrentRepo = (logString: string) => {
    if (!logString) return null;
    const lines = logString.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('https://github.com/')) {
        const match = line.match(/https?:\/\/github\.com\/([^\s/]+\/[^\s/]+)/);
        if (match) return match[1].replace('.git', '');
      }
    }
    return null;
  };

  const activeRepo = getCurrentRepo(logs.ingestion);
  
  const getSliceProgress = (logString: string) => {
    if (!logString) return null;
    const lines = logString.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(/\[(\d+)\/(\d+)\] Decompondo/);
      if (match) return { current: match[1], total: match[2] };
    }
    return null;
  };
  const sliceProgress = getSliceProgress(logs.ingestion);

  // Math metrics (100% Real, non-simulated numbers computed on active arrays or fallback to realScanData from filesystem scanner)
  const totalRepos = realScanData ? realScanData.totalRepos : repositories.length;
  const totalBlocks = realScanData ? realScanData.totalBlocks : inventory.reduce((acc, cat) => acc + cat.blocks.length, 0);
  const totalBlueprints = realScanData ? realScanData.totalBlueprints : blueprintInfo.count;
  
  const syncedRepos = repositories.filter(repo => repo.lastSync).length;
  const pendingRepos = repositories.filter(repo => !repo.lastSync).length;
  const monsterRepos = repositories.filter(repo => repo.isMonster).length;
  const errorRepos = repositories.filter(repo => (repo.retryCount || 0) > 3).length;

  const totalDigestedFiles = realScanData ? realScanData.totalDigestedFiles : repositories.reduce((acc, repo) => acc + (repo.digestedCount || 0), 0);
  const totalExpectedFiles = repositories.reduce((acc, repo) => acc + (repo.totalFiles || 0), 0);

  const globalSyncPercentage = totalRepos > 0 ? Math.round((syncedRepos / totalRepos) * 100) : 0;
  // Fallback se totalExpectedFiles for zero para mostrar estimativa ou progresso alternativo baseado em realScanData se disponível
  const globalFilesPercentage = totalExpectedFiles > 0 
    ? Math.round((totalDigestedFiles / totalExpectedFiles) * 100) 
    : (totalRepos > 0 ? Math.round((syncedRepos / totalRepos) * 100) : 0);

  // Filtering actions
  const filteredRepos = repositories.filter(repo => 
    repo.url.toLowerCase().includes(filter.toLowerCase())
  );
  
  const sortedRepos = [...filteredRepos].sort((a, b) => {
    if (sortOrder === 'url') {
      return a.url.localeCompare(b.url);
    } else {
      const timeA = a.lastSync ? new Date(a.lastSync).getTime() : 0;
      const timeB = b.lastSync ? new Date(b.lastSync).getTime() : 0;
      return timeB - timeA; 
    }
  });

  const filteredInventory = inventory.map(inv => {
    if (inv.category.toLowerCase().includes(blockFilter.toLowerCase())) {
      return inv;
    }
    const matchingBlocks = inv.blocks.filter(b => b.toLowerCase().includes(blockFilter.toLowerCase()));
    return { ...inv, blocks: matchingBlocks };
  }).filter(inv => inv.blocks.length > 0 || inv.category.toLowerCase().includes(blockFilter.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Superior Branding & Main Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-blue-600/10 text-blue-500 rounded-lg border border-blue-500/20">
                <Database className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Lego Pool
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded-full font-mono font-normal">
                    v1.0.4-live
                  </span>
                </h1>
                <p className="text-slate-400 text-xs mt-0.5 font-mono">
                  Sincronização de Conhecimento & Decomposição Modular
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Tudo'}
            </button>
            <button 
              onClick={handleHunt}
              disabled={hunting}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50"
            >
              <Target className={`w-4 h-4 ${hunting ? 'animate-pulse' : ''}`} />
              {hunting ? 'Caçando...' : 'Shark Mode'}
            </button>
            <button
              onClick={async () => {
                if (commitStatus.active) return;
                try {
                  const data = await safeFetchJson('/api/pool/worker/commit', { method: 'POST' });
                  showAlert(data.message || 'Auditoria de salvaguarda iniciada em background.', 'success');
                } catch (e: any) {
                  showAlert('Falha ao acionar a engine de commit: ' + e.message, 'error');
                }
              }}
              disabled={commitStatus.active}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Github className="w-4 h-4" />
              {commitStatus.active ? 'Commitando...' : 'Commit Pool'}
            </button>
          </div>
        </div>

        {/* Global Alert Notification Band */}
        {commitStatus.active && (
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Github className="w-4 h-4 animate-spin text-indigo-400" />
                Salvaguardando Peças Lego ({commitStatus.done}/{commitStatus.total})
              </span>
              <span className="text-[9px] font-mono text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Auditoria de Commit no Servidor
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                style={{ width: `${(commitStatus.done / Math.max(1, commitStatus.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Modular Navigation Tabs */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-850 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'overview' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Activity className="w-4 h-4" />
            📊 Visão Geral da Pool
          </button>
          <button
            onClick={() => setActiveTab('repos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'repos' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Github className="w-4 h-4" />
            📦 Repositórios ({totalRepos})
          </button>
          <button
            onClick={() => setActiveTab('legos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'legos' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            🧱 Blocos Lego Extraídos ({totalBlocks})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'logs' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Terminal className="w-4 h-4" />
            📝 Logs e Terminais
          </button>
        </div>

        {/* Tab Content Rendering */}
        
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Bento Grid layout with real quantifiable numbers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Repositories */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium text-xs font-mono uppercase tracking-wider">Watchlist</span>
                    <div className="text-4xl font-extrabold text-white tracking-tight">{totalRepos}</div>
                  </div>
                  <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/10">
                    <Github className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t border-slate-850 pt-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Sincronizados:</span>
                    <span className="font-bold text-slate-200">{syncedRepos} de {totalRepos}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Fila Ingestão:</span>
                    <span className="font-bold text-amber-400">{pendingRepos} aguardando</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${globalSyncPercentage}%` }} />
                    </div>
                    <div className="text-[10px] text-right font-mono text-slate-500">{globalSyncPercentage}% sincronizados</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Lego Blocks */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium text-xs font-mono uppercase tracking-wider">Peças Lego Extraídas</span>
                    <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">{totalBlocks}</div>
                  </div>
                  <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/10">
                    <Box className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t border-slate-850 pt-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Divisão Física:</span>
                    <span className="font-bold text-slate-200">{inventory.length} diretórios/clusters</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Média por diretório:</span>
                    <span className="font-bold text-slate-200">
                      {inventory.length > 0 ? (totalBlocks / inventory.length).toFixed(1) : 0} pç
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-2">
                    {inventory.map(inv => (
                      <span key={inv.category} className="text-[8px] font-mono select-none px-2 py-0.5 rounded bg-slate-950 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors">
                        {inv.category.substring(0,4)}:{inv.blocks.length}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: Blueprints */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium text-xs font-mono uppercase tracking-wider">Blueprints Gerados</span>
                    <div className="text-4xl font-extrabold text-indigo-400 tracking-tight">{totalBlueprints}</div>
                  </div>
                  <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/10">
                    <FileText className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t border-slate-850 pt-4 text-xs text-slate-400">
                  <p className="leading-normal">
                    Cada blueprint contém um mapeamento arquitetural estruturado por IA de todo o ecossistema.
                  </p>
                  <div className="bg-slate-950 p-2 rounded text-[10px] font-mono text-slate-500 border border-slate-900 flex justify-between mt-1">
                    <span>Destino:</span>
                    <span className="text-indigo-400">POOL/blueprints/</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Files Ingested */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium text-xs font-mono uppercase tracking-wider">Arquivos Decompostos</span>
                    <div className="text-4xl font-extrabold text-purple-400 tracking-tight">{totalDigestedFiles}</div>
                  </div>
                  <span className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/10">
                    <Cpu className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t border-slate-850 pt-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Em Alvos Robustos:</span>
                    <span className="font-bold text-slate-200">{monsterRepos} monster targets</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Erros / Retentados:</span>
                    <span className="font-bold text-red-400">{errorRepos}</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 animate-pulse" style={{ width: `${globalFilesPercentage}%` }} />
                    </div>
                    <div className="text-[10px] text-right font-mono text-slate-500">{globalFilesPercentage}% arquivos de meta globais</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Devourer Ingestion Engaged Feed & Control Terminal */}
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 relative overflow-hidden space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Devourer Ingestion Engaged Feed
                  {activeRepo && (
                    <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded text-[9px] font-bold">
                      ACTIVE: {activeRepo} {sliceProgress && `[${sliceProgress.current}/${sliceProgress.total} BATCH]`}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Daemon Processo Mestre</span>
              </div>
              <div className="bg-black/60 p-4 rounded-lg font-mono text-[11px] h-[450px] overflow-y-auto whitespace-pre-wrap select-text custom-scrollbar text-emerald-400/90 border border-slate-950">
                {logs.ingestion || "Waiting for stream from master ingestor..."}
              </div>

              <div className="pt-4 flex flex-wrap gap-3 border-t border-slate-850 mt-4">
                <button
                  onClick={async () => {
                    if (commitStatus.active) return;
                    try {
                      const data = await safeFetchJson('/api/pool/worker/commit', { method: 'POST' });
                      showAlert(data.message || 'Auditoria de salvaguarda iniciada em background.', 'success');
                    } catch (e: any) {
                      showAlert('Falha ao acionar a engine de commit: ' + e.message, 'error');
                    }
                  }}
                  disabled={commitStatus.active}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4.5 py-2.5 rounded-lg transition-all flex items-center gap-2 border border-indigo-500/10 shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                >
                  <Github className="w-3.5 h-3.5" />
                  {commitStatus.active ? 'Auditoria em Andamento...' : 'Commit Pool para Salvaguarda (Git)'}
                </button>
                <button
                  onClick={() => setActiveTab('repos')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4.5 py-2.5 rounded-lg transition-all flex items-center gap-2 border border-slate-700"
                >
                  Gerenciar Watchlist
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Watched Repositories */}
        {activeTab === 'repos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            
            {/* Left/Middle Column - Repositories management table */}
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Watchlist Ativa</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Repositórios na esteira de devoramento ou sincronização</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Filtrar URL..."
                      className="bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-44"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  <select 
                    className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                  >
                    <option value="url">URL Alfabética</option>
                    <option value="lastSync">Sincronização Recente</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-xs">
                      <th className="pb-3 font-semibold">Repositório</th>
                      <th className="pb-3 font-semibold text-center">Fatias/Ficheiros</th>
                      <th className="pb-3 font-semibold text-right">Last Sync</th>
                      <th className="pb-3 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/50 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">Recuperando base de dados...</td>
                      </tr>
                    ) : sortedRepos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">Nenhum repositório localizado.</td>
                      </tr>
                    ) : (
                      sortedRepos.map((repo) => (
                        <tr key={repo.url} className="hover:bg-slate-850/30 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <a 
                                href={repo.url} 
                                target="_blank" 
                                referrerPolicy="no-referrer"
                                rel="noreferrer" 
                                className="text-blue-400 hover:text-blue-300 font-semibold"
                              >
                                {repo.url.replace('https://github.com/', '')}
                              </a>
                              {repo.isMonster && (
                                <span className="text-[7px] bg-red-500/15 text-red-400 border border-red-500/20 px-1 py-0.5 rounded font-extrabold uppercase tracking-tight">MONSTER</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            {repo.totalFiles ? (
                              <div className="w-28 mx-auto space-y-1">
                                <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${repo.lastSync ? 'bg-blue-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, ((repo.digestedCount || 0) / repo.totalFiles) * 100)}%` }}
                                  />
                                </div>
                                <div className="text-[8px] text-slate-500 text-center font-mono">
                                  {repo.digestedCount}/{repo.totalFiles} deconst.
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-[9px] text-slate-600 italic">Varredura Pendente</div>
                            )}
                          </td>
                          <td className="py-3 text-right text-slate-400 font-mono text-[10px]">
                            {repo.lastSync ? new Date(repo.lastSync).toLocaleString() : 'Fila de espera'}
                          </td>
                          <td className="py-3 text-right">
                            <button 
                              onClick={() => handleRemoveRepo(repo.url)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                              title="Remover repositório da Pool"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right/Sidebar Column - Forms for adding or scraping repos */}
            <div className="space-y-6">
              
              {/* Ingest Repo form */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-500" />
                  Alimentar Ingestão (GitHub)
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Adicione um endereço GitHub avulso abaixo. A esteira irá clonar o código, separar em fatias procedimentais e criar blocos na biblioteca.
                </p>
                <form onSubmit={handleIngest} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Link de Repositório</label>
                    <input 
                      type="url"
                      placeholder="https://github.com/usuario/projeto"
                      required
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      value={ingestUrl}
                      onChange={(e) => setIngestUrl(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={ingesting || !ingestUrl}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {ingesting ? 'Adicionando...' : 'Adicionar Repositório'}
                  </button>
                </form>
              </div>

              {/* Deep Web page scraper */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-400" />
                    Deep Scraper
                  </h3>
                  <div className="flex bg-slate-950 border border-slate-850 p-0.5 rounded-md">
                    <button 
                      onClick={() => setScrapeMode('url')}
                      className={`px-2 py-0.5 text-[9px] rounded font-semibold transition-all ${scrapeMode === 'url' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                    >
                      URL
                    </button>
                    <button 
                      onClick={() => setScrapeMode('raw')}
                      className={`px-2 py-0.5 text-[9px] rounded font-semibold transition-all ${scrapeMode === 'raw' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                    >
                      TEXTO
                    </button>
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Varra qualquer página web para achar repositórios ocultos e encher a watchlist de novos alvos de aprendizagem.
                </p>

                <form onSubmit={handleScrape} className="space-y-4 mt-4">
                  {scrapeMode === 'url' ? (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Endereço Web</label>
                      <input 
                        type="url"
                        placeholder="https://reddit.com/r/webdev/..."
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">HTML ou Texto Fonte</label>
                      <textarea 
                        placeholder="Cole códigos markdown, fontes HTML ou parágrafos..."
                        rows={4}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 custom-scrollbar"
                        value={rawContent}
                        onChange={(e) => setRawContent(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <button 
                    disabled={scraping || (scrapeMode === 'url' ? !scrapeUrl : !rawContent)}
                    className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/25 text-xs font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {scraping ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Varrendo...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        {scrapeMode === 'url' ? 'Monitorar Página' : 'Analisar Texto'}
                      </>
                    )}
                  </button>
                </form>
              </div>

            </div>

          </div>
        )}

        {/* Tab 3: Extracted Lego Blocks grouped in categories with real counts */}
        {activeTab === 'legos' && (
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="text-emerald-500 w-5 h-5" />
                  Biblioteca de Blocos Lego Extraídos
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Listagem autêntica de arquivos físicos gerados organizados por diretório correspondente
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Pesquisar bloco ou cluster..."
                  className="bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full md:w-56"
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex bg-slate-950/80 p-4 border border-slate-850 rounded-xl text-xs text-slate-400 gap-3 items-center">
              <span className="p-1 px-2.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold uppercase">Consolidado</span>
              <p>
                Temos exatamente <strong className="text-slate-100">{totalBlocks} peças funcionais reutilizáveis</strong> extraídas e mapeadas. Elas foram sintetizadas em TypeScript e preparadas de forma autônoma pelo motor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredInventory.length === 0 ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center text-slate-500 py-12 border border-dashed border-slate-850 rounded-xl bg-slate-950/40">
                  Nenhum bloco localizado sob o filtro informado. Altere o termo de pesquisa.
                </div>
              ) : (
                filteredInventory.map((inv) => (
                  <div key={inv.category} className="bg-slate-950/45 border border-slate-850 rounded-xl p-4.5 hover:border-slate-800 transition-colors">
                    <h4 className="font-bold text-sm flex items-center justify-between mb-4 text-slate-200">
                      <span className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-blue-400" />
                        {inv.category}
                      </span>
                      <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-blue-400 border border-slate-850">
                        {inv.blocks.length} arquivos
                      </span>
                    </h4>
                    
                    {inv.blocks.length === 0 ? (
                      <span className="text-xs text-slate-600 block py-4 text-center border border-dashed border-slate-900 rounded bg-slate-900/10">
                        Nenhum bloco extraído
                      </span>
                    ) : (
                      <ul className="space-y-2">
                        {inv.blocks.map(block => (
                          <li 
                            key={block} 
                            className="flex items-center justify-between gap-2 text-xs text-slate-300 font-mono bg-slate-900/60 hover:bg-slate-900 px-3 py-2 rounded border border-slate-850 transition-colors"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="truncate text-slate-200">{block.replace('.ts', '')}</span>
                            </span>
                            <span className="text-[8px] bg-slate-950 text-slate-500 border border-slate-900 px-1 py-0.2 rounded font-semibold uppercase">TS</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Logs and System Terminals */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Developer power-actions control bar */}
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest font-mono">Controle dos Daemons:</span>
                <div className="flex bg-black/40 p-1 rounded-lg border border-slate-850">
                  <button 
                    onClick={() => handleControl(workerStatus === 'paused' ? 'running' : 'paused')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${workerStatus === 'paused' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    {workerStatus === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {workerStatus === 'paused' ? 'Resume Workers' : 'Pause Workers'}
                  </button>
                  <button 
                    onClick={() => handleControl('stop_after_current')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${workerStatus === 'stop_after_current' ? 'bg-amber-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Terminar Execução Atual
                  </button>
                </div>
              </div>

              <div className="flex bg-slate-950/60 p-1 py-0.5 rounded border border-slate-850 text-xs font-semibold items-center gap-2">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-mono">Estado Atual:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  workerStatus === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  workerStatus === 'paused' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                  'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {workerStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Three standard live log terminal consoles */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Ingestion feed */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative flex flex-col justify-between shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <span className="flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Terminal de Ingestão de Código
                  </span>
                  <button onClick={fetchLogs} className="text-slate-500 hover:text-emerald-400 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-emerald-400/90 select-text bg-black/45 p-3 rounded border border-slate-900">
                  {logs.ingestion || "Processo mestre ocioso. Aguardando novos alvos..."}
                </div>
              </div>

              {/* Blueprint feed */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative flex flex-col justify-between shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <span className="flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Terminal do Blueprint Engine
                  </span>
                  <button onClick={fetchLogs} className="text-slate-500 hover:text-blue-400 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-blue-400/90 select-text bg-black/45 p-3 rounded border border-slate-900">
                  {logs.blueprints || "Trabalhador de blueprints ocioso..."}
                </div>
              </div>

              {/* System logs */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative flex flex-col justify-between shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <span className="flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Eventos e Auditoria Git
                  </span>
                  <button onClick={fetchLogs} className="text-slate-500 hover:text-amber-400 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-amber-400/95 select-text bg-black/45 p-3 rounded border border-slate-900">
                  {logs.system || "Aguardando inicialização do servidor..."}
                </div>
              </div>

            </div>

            {/* Powertools action triggers */}
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5">
              <h4 className="text-sm font-bold text-slate-300 font-mono tracking-wider uppercase mb-3">Power Developer Tools</h4>
              <p className="text-xs text-slate-400 mb-4">Ações estruturais e administrativas no servidor de arquivos</p>
              
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={async () => {
                    await fetch('/api/pool/worker/purge-tmp', { method: 'POST' });
                    showAlert('Pasta temporária (.tmp) expurgada da Pool.', 'success');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold transition-all"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  Purgar Pasta Temporária (.tmp)
                </button>
                <button 
                  onClick={async () => {
                    await fetch('/api/pool/worker/purge-logs', { method: 'POST' });
                    setLogs({ ingestion: '', blueprints: '', system: '' });
                    showAlert('Todos os arquivos de log limpos.', 'success');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  Limpar Arquivos de Log
                </button>
                <button 
                  onClick={handleRestartWorker}
                  className="flex items-center gap-2 px-4 py-2 bg-red-950 hover:bg-red-900 text-red-200 border border-red-500/20 rounded-lg text-xs font-semibold transition-all"
                >
                  <RotateCw className="w-4 h-4 text-red-400" />
                  Forçar Reinicialização (Hard Reset)
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Floating Status / Toast Toasting */}
      {status.message && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-5 duration-300 ${
          status.type === 'error' ? 'bg-red-900/90 border-red-500/40 text-red-100' :
          status.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100' :
          'bg-slate-900/95 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`p-1 rounded ${status.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold">{status.message}</span>
            <button onClick={() => setStatus({ message: '', type: null })} className="ml-3 hover:text-white opacity-50 hover:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
