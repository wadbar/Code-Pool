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
  Moon,
  Sun,
  Terminal, 
  HelpCircle,
  Clock,
  Globe,
  GitCommit
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

interface User {
  id: number;
  login: string;
  avatar_url: string;
}

export default function App() {
  const [repositories, setRepositories] = useState<WatchedRepository[]>([]);
  const [inventory, setInventory] = useState<InventoryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  
  const [geminiIssues, setGeminiIssues] = useState<any>(null);
  
  const checkGeminiKey = async () => {
    try {
      const data = await safeFetchJson('/api/check-gemini');
      if (!data.hasKey || data.isDefault) {
        setGeminiIssues(data);
      } else {
        setGeminiIssues(null);
      }
    } catch (e) {}
  };
  
  useEffect(() => {
    // Check for user token
    const tokenCookie = document.cookie.split('; ').find(row => row.startsWith('token='));
    if (tokenCookie) {
      const token = tokenCookie.split('=')[1];
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch(e) {}
    }
  }, []);

  const fetchActivity = async () => {
    try {
      const data = await safeFetchJson('/api/pool/activity');
      setActivityLogs(data.logs || []);
    } catch(e) {}
  };
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  
  const [realScanData, setRealScanData] = useState<RealScanData | null>(null);
  
  // Custom states requested by user
  const [activeTab, setActiveTab] = useState<'overview' | 'repos' | 'legos' | 'activity' | 'logs'>('overview');
  const [blueprintInfo, setBlueprintInfo] = useState<{ count: number; blueprints: any[] }>({ count: 0, blueprints: [] });
  
  // High fidelity block inspector state definitions
  const [inspectingBlock, setInspectingBlock] = useState<{
    category: string;
    file: string;
    content: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleViewBlock = async (category: string, blockName: string) => {
    setInspectingBlock({
      category,
      file: blockName,
      content: null,
      loading: true,
      error: null
    });
    try {
      const data = await safeFetchJson(`/api/pool/block-content?category=${encodeURIComponent(category)}&file=${encodeURIComponent(blockName)}`);
      setInspectingBlock(prev => prev ? {
        ...prev,
        content: data.content,
        loading: false
      } : null);
    } catch (e: any) {
      setInspectingBlock(prev => prev ? {
        ...prev,
        loading: false,
        error: e.message || 'Falha ao recuperar o conteúdo do arquivo.'
      } : null);
    }
  };

  const handleCopyBlock = () => {
    if (!inspectingBlock || !inspectingBlock.content) return;
    navigator.clipboard.writeText(inspectingBlock.content);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };
  
  // Filtering and Input states
  const [filter, setFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'url' | 'lastSync'>('url');
  
  // Real-time log terminal searching filters
  const [ingestionLogFilter, setIngestionLogFilter] = useState('');
  const [blueprintLogFilter, setBlueprintLogFilter] = useState('');
  const [systemLogFilter, setSystemLogFilter] = useState('');
  
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

  const safeFetchJson = async (url: string, options: RequestInit = {}) => {
    try {
      const headers = new Headers(options.headers || {});
      if (user && user.login) {
        headers.set('x-user-id', user.login);
      }
      const res = await fetch(url, { ...options, headers });
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

  // Git Remote Safeguard Sync Config and States
  const [gitRemoteUrl, setGitRemoteUrl] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitAutoPush, setGitAutoPush] = useState(true);
  const [gitHasToken, setGitHasToken] = useState(false);
  const [gitPushing, setGitPushing] = useState(false);
  const [isSavingGit, setIsSavingGit] = useState(false);

  const fetchGitConfig = async () => {
    try {
      const data = await safeFetchJson('/api/pool/git/config');
      setGitRemoteUrl(data.remoteUrl || '');
      setGitBranch(data.branch || 'main');
      setGitAutoPush(data.autoPush !== undefined ? data.autoPush : true);
      setGitHasToken(data.hasToken || false);
    } catch (e: any) {
      console.warn(`[Background Git config parse] Failed to load: ${e.message}`);
    }
  };

  const handleSaveGitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGit(true);
    try {
      const payload: any = { remoteUrl: gitRemoteUrl, branch: gitBranch, autoPush: gitAutoPush };
      if (gitToken) {
        payload.token = gitToken;
      }
      const data = await safeFetchJson('/api/pool/git/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showAlert(data.message || 'Configuração de backup salva com sucesso!', 'success');
      setGitToken('');
      await fetchGitConfig();
    } catch (e: any) {
      showAlert('Erro ao salvar configuração: ' + e.message, 'error');
    }
    setIsSavingGit(false);
  };

  const handleForceGitPush = async () => {
    setGitPushing(true);
    try {
      showAlert('Sincronizando todas as peças com o repositório remoto...', 'info');
      const data = await safeFetchJson('/api/pool/git/push', { method: 'POST' });
      showAlert(data.message || 'Persistência completa na piscina remota e estável!', 'success');
      await fetchLogs();
    } catch (e: any) {
      showAlert('Falha na persistência: ' + e.message, 'error');
    }
    setGitPushing(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectingBlock(null);
      }
    };
    if (inspectingBlock) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inspectingBlock]);

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
    const fetchData = () => {
      if (document.hidden) return; // Skip polling if tab is hidden
      fetchLogs();
      fetchWorkerStatus();
      fetchCommitStatus();
      fetchBlueprints();
      fetchRealScanData();
      fetchRegistry();
      fetchInventory();
      checkGeminiKey();
    };

    fetchRegistry();
    fetchInventory();
    fetchLogs();
    fetchWorkerStatus();
    fetchBlueprints();
    fetchRealScanData();
    fetchGitConfig();
    checkGeminiKey();
    
    // Initial data fetch
    fetchData();

    // Set up polling
    const interval = setInterval(fetchData, 15000); 

    // Handle visibility changes
    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchData(); // Fetch immediately when tab becomes visible
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

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

  const paginatedRepos = sortedRepos.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sortedRepos.length / pageSize);

  const filteredInventory = inventory.map(inv => {
    if (inv.category.toLowerCase().includes(blockFilter.toLowerCase())) {
      return inv;
    }
    const matchingBlocks = inv.blocks.filter(b => b.toLowerCase().includes(blockFilter.toLowerCase()));
    return { ...inv, blocks: matchingBlocks };
  }).filter(inv => inv.blocks.length > 0 || inv.category.toLowerCase().includes(blockFilter.toLowerCase()));

  return (
    <div className="min-h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-100 text-slate-900 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Superior Branding & Main Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b dark:border-slate-800 border-slate-300 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-blue-600/10 text-blue-500 rounded-lg border border-blue-500/20">
                <Database className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight dark:text-white text-black flex items-center gap-2">
                  Gerenciador de Repositórios
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded-full font-mono font-normal">
                    v1.0.4
                  </span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="dark:text-slate-400 text-slate-600 text-xs font-mono">
                    Auditoria e Indexação de Conhecimento
                  </p>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-mono font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    IA Studio Native Engine Ativo
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-2 dark:bg-slate-900 bg-slate-100 hover:dark:bg-slate-800 bg-slate-200 dark:text-slate-300 text-slate-700 border dark:border-slate-800 border-slate-300 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user ? (
               <div className="flex items-center gap-2 mr-2">
                 <img src={user.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt="Avatar" />
                 <span className="text-sm font-semibold dark:text-slate-300 text-slate-700">{user.login}</span>
                 <button onClick={() => { document.cookie = 'token=; Max-Age=0'; setUser(null); }} className="text-xs text-red-500 ml-2 hover:underline">Sair</button>
               </div>
            ) : (
               <a
                 href="/api/auth/github/login"
                 className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all"
               >
                 <Github className="w-4 h-4" />
                 Login GitHub
               </a>
            )}
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 dark:bg-slate-900 bg-slate-100 hover:dark:bg-slate-800 bg-slate-200 dark:text-slate-300 text-slate-700 border dark:border-slate-800 border-slate-300 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Tudo'}
            </button>
            <button 
              onClick={handleHunt}
              disabled={hunting}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 dark:text-white text-black px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50"
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
              className="flex items-center gap-2 dark:bg-slate-900 bg-slate-100 hover:dark:bg-slate-800 bg-slate-200 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
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
            <div className="h-1.5 w-full dark:bg-slate-900 bg-slate-100 rounded-full overflow-hidden border dark:border-slate-800 border-slate-300">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                style={{ width: `${(commitStatus.done / Math.max(1, commitStatus.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Modular Navigation Tabs */}
        <div className="flex dark:bg-slate-900 bg-slate-100/60 p-1.5 rounded-xl border dark:border-slate-850 border-slate-300 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'overview' 
                ? 'bg-blue-600 dark:text-white text-black shadow-md' 
                : 'dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 text-slate-800 hover:dark:bg-slate-800 bg-slate-200/40'
            }`}
          >
            <Activity className="w-4 h-4" />
            📊 Visão Geral da Pool
          </button>
          <button
            onClick={() => setActiveTab('repos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'repos' 
                ? 'bg-blue-600 dark:text-white text-black shadow-md' 
                : 'dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 text-slate-800 hover:dark:bg-slate-800 bg-slate-200/40'
            }`}
          >
            <Github className="w-4 h-4" />
            📦 Repositórios ({totalRepos})
          </button>
          <button
            onClick={() => setActiveTab('legos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'legos' 
                ? 'bg-blue-600 dark:text-white text-black shadow-md' 
                : 'dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 text-slate-800 hover:dark:bg-slate-800 bg-slate-200/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            🧱 Blocos Lego Extraídos ({totalBlocks})
          </button>
          <button
    onClick={() => { setActiveTab('activity'); fetchActivity(); }}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
      activeTab === 'activity' 
        ? 'bg-blue-600 dark:text-white text-black shadow-md' 
        : 'dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 text-slate-800 hover:dark:bg-slate-800 bg-slate-200/40'
    }`}
  >
    <Activity className="w-4 h-4" />
    Activity
  </button>
  <button
    onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'logs' 
                ? 'bg-blue-600 dark:text-white text-black shadow-md' 
                : 'dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 text-slate-800 hover:dark:bg-slate-800 bg-slate-200/40'
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
              <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 hover:dark:border-slate-800 border-slate-300 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="dark:text-slate-400 text-slate-600 font-medium text-xs font-mono uppercase tracking-wider">Watchlist</span>
                    <div className="text-4xl font-extrabold dark:text-white text-black tracking-tight">{totalRepos}</div>
                  </div>
                  <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/10">
                    <Github className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t dark:border-slate-850 border-slate-300 pt-4">
                  <div className="flex justify-between text-xs dark:text-slate-400 text-slate-600">
                    <span>Sincronizados:</span>
                    <span className="font-bold dark:text-slate-200 text-slate-800">{syncedRepos} de {totalRepos}</span>
                  </div>
                  <div className="flex justify-between text-xs dark:text-slate-400 text-slate-600">
                    <span>Fila Ingestão:</span>
                    <span className="font-bold text-amber-400">{pendingRepos} aguardando</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full dark:bg-slate-950 bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${globalSyncPercentage}%` }} />
                    </div>
                    <div className="text-[10px] text-right font-mono text-slate-500">{globalSyncPercentage}% sincronizados</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Lego Blocks */}
              <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 hover:dark:border-slate-800 border-slate-300 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="dark:text-slate-400 text-slate-600 font-medium text-xs font-mono uppercase tracking-wider">Blocos Extraídos</span>
                    <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">{totalBlocks}</div>
                  </div>
                  <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/10">
                    <Box className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t dark:border-slate-850 border-slate-300 pt-4">
                  <div className="flex justify-between text-xs dark:text-slate-400 text-slate-600">
                    <span>Divisão Física:</span>
                    <span className="font-bold dark:text-slate-200 text-slate-800">{inventory.length} diretórios/clusters</span>
                  </div>
                  <div className="flex justify-between text-xs dark:text-slate-400 text-slate-600">
                    <span>Média por diretório:</span>
                    <span className="font-bold dark:text-slate-200 text-slate-800">
                      {inventory.length > 0 ? (totalBlocks / inventory.length).toFixed(1) : 0} pç
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-2">
                    {inventory.map(inv => (
                      <span key={inv.category} className="text-[8px] font-mono select-none px-2 py-0.5 rounded dark:bg-slate-950 bg-slate-50 dark:text-slate-400 text-slate-600 hover:text-emerald-400 hover:dark:bg-slate-800 bg-slate-200 transition-colors">
                        {inv.category.substring(0,4)}:{inv.blocks.length}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: Blueprints */}
              <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 hover:dark:border-slate-800 border-slate-300 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="dark:text-slate-400 text-slate-600 font-medium text-xs font-mono uppercase tracking-wider">Blueprints Gerados</span>
                    <div className="text-4xl font-extrabold text-indigo-400 tracking-tight">{totalBlueprints}</div>
                  </div>
                  <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/10">
                    <FileText className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t dark:border-slate-850 border-slate-300 pt-4 text-xs dark:text-slate-400 text-slate-600">
                  <p className="leading-normal">
                    Cada blueprint contém um mapeamento arquitetural estruturado por IA de todo o ecossistema.
                  </p>
                  <div className="dark:bg-slate-950 bg-slate-50 p-2 rounded text-[10px] font-mono text-slate-500 border border-slate-900 flex justify-between mt-1">
                    <span>Destino:</span>
                    <span className="text-indigo-400">POOL/blueprints/</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Files Ingested */}
              <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 hover:dark:border-slate-800 border-slate-300 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="dark:text-slate-400 text-slate-600 font-medium text-xs font-mono uppercase tracking-wider">Arquivos Decompostos</span>
                    <div className="text-4xl font-extrabold text-purple-400 tracking-tight">{totalDigestedFiles}</div>
                  </div>
                  <span className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/10">
                    <Cpu className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-2 border-t dark:border-slate-850 border-slate-300 pt-4">
                  <div className="flex justify-between text-xs dark:text-slate-400 text-slate-600">
                    <span>Em Alvos Robustos:</span>
                    <span className="font-bold dark:text-slate-200 text-slate-800">{monsterRepos} monster targets</span>
                  </div>
                  <div className="flex justify-between text-xs dark:text-slate-400 text-slate-600">
                    <span>Erros / Retentados:</span>
                    <span className="font-bold text-red-400">{errorRepos}</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full dark:bg-slate-950 bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 animate-pulse" style={{ width: `${globalFilesPercentage}%` }} />
                    </div>
                    <div className="text-[10px] text-right font-mono text-slate-500">{globalFilesPercentage}% arquivos de meta globais</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controle de Daemons Integrado */}
            <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold dark:text-slate-400 text-slate-600 uppercase tracking-widest font-mono">Controle dos Daemons:</span>
                <div className="flex bg-black/40 p-1 rounded-lg border dark:border-slate-850 border-slate-300 gap-1">
                  <button 
                    onClick={() => handleControl(workerStatus === 'paused' ? 'running' : 'paused')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${workerStatus === 'paused' ? 'bg-emerald-600 hover:bg-emerald-500 dark:text-white text-black shadow-md' : 'dark:bg-slate-900/80 hover:dark:bg-slate-800 bg-slate-200 hover:bg-slate-300 dark:text-slate-300 text-slate-700'}`}
                  >
                    {workerStatus === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {workerStatus === 'paused' ? 'Resume Workers' : 'Pause Workers'}
                  </button>
                  <button 
                    onClick={() => handleControl('stop_after_current')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${workerStatus === 'stop_after_current' ? 'bg-amber-600 dark:text-white text-black shadow-md' : 'dark:bg-slate-900/80 hover:dark:bg-slate-800 bg-slate-200 hover:bg-slate-300 dark:text-slate-300 text-slate-700'}`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Terminar Execução Atual
                  </button>
                </div>
              </div>

              <div className="flex dark:bg-slate-950 bg-slate-50/60 p-1 py-0.5 rounded border dark:border-slate-850 border-slate-300 text-xs font-semibold items-center gap-2">
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

            {/* Devourer Ingestion Engaged Feed & Control Terminal */}
            <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 relative overflow-hidden space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold dark:text-slate-400 text-slate-600 uppercase tracking-widest flex items-center gap-2">
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

              <div className="pt-4 flex flex-wrap gap-3 border-t dark:border-slate-850 border-slate-300 mt-4">
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
                  className="bg-indigo-600 hover:bg-indigo-500 dark:text-white text-black text-xs font-bold px-4.5 py-2.5 rounded-lg transition-all flex items-center gap-2 border border-indigo-500/10 shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                >
                  <Github className="w-3.5 h-3.5" />
                  {commitStatus.active ? 'Auditoria em Andamento...' : 'Commit Pool para Salvaguarda (Git)'}
                </button>
                <button
                  onClick={() => setActiveTab('repos')}
                  className="dark:bg-slate-800 bg-slate-200 hover:bg-slate-700 dark:text-slate-300 text-slate-700 text-xs font-bold px-4.5 py-2.5 rounded-lg transition-all flex items-center gap-2 border border-slate-700"
                >
                  Gerenciar Watchlist
                </button>
              </div>
            </div>

            {/* Git Remote Preservation and Sync Section */}
            <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-slate-850 border-slate-300 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold dark:text-white text-black flex items-center gap-2">
                    <Github className="w-5 h-5 text-indigo-400" />
                    Configuração de Backup Git
                  </h3>
                  <p className="dark:text-slate-400 text-slate-600 text-xs mt-0.5">
                    Conecte o ambiente ao seu repositório remoto para salvar os blocos e blueprints extraídos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    gitRemoteUrl ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'dark:bg-slate-950 bg-slate-50 text-slate-500 dark:border-slate-850 border-slate-300'
                  }`}>
                    {gitRemoteUrl ? 'Mapeado (Online)' : 'Local Apenas'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form to configure remote URL and Token */}
                <form onSubmit={handleSaveGitConfig} className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 font-mono">
                      <label className="text-[11px] font-bold dark:text-slate-400 text-slate-600 uppercase tracking-wide">URL HTTPS do Repositório</label>
                      <input 
                        type="url"
                        placeholder="https://github.com/usuario/meu-repositorio"
                        value={gitRemoteUrl}
                        onChange={(e) => setGitRemoteUrl(e.target.value)}
                        className="w-full dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-300 rounded-lg px-3 py-2 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1.5 font-mono">
                      <label className="text-[11px] font-bold dark:text-slate-400 text-slate-600 uppercase tracking-wide flex items-center justify-between">
                        <span>GitHub Token / PAT</span>
                        {gitHasToken && (
                          <span className="text-[9px] text-emerald-400 normal-case">✓ Token Configurado</span>
                        )}
                      </label>
                      <input 
                        type="password"
                        placeholder={gitHasToken ? "••••••••••••••••••••" : "ghp_..."}
                        value={gitToken}
                        onChange={(e) => setGitToken(e.target.value)}
                        className="w-full dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-300 rounded-lg px-3 py-2 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-1.5 font-mono">
                      <label className="text-[11px] font-bold dark:text-slate-400 text-slate-600 uppercase tracking-wide">Branch</label>
                      <input 
                        type="text"
                        placeholder="main"
                        value={gitBranch}
                        onChange={(e) => setGitBranch(e.target.value)}
                        className="w-full dark:bg-slate-950 bg-slate-50 border dark:border-slate-800 border-slate-300 rounded-lg px-3 py-2 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2.5 pt-4">
                      <input 
                        type="checkbox"
                        id="autoPushCheck"
                        checked={gitAutoPush}
                        onChange={(e) => setGitAutoPush(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 dark:bg-slate-950 bg-slate-50 dark:border-slate-800 border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      />
                      <label htmlFor="autoPushCheck" className="text-xs dark:text-slate-300 text-slate-700 font-semibold cursor-pointer select-none">
                        Push automático após auditoria
                      </label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSavingGit}
                      className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSavingGit ? 'animate-spin' : ''}`} />
                      {isSavingGit ? 'Salvando...' : 'Salvar Configuração'}
                    </button>
                  </div>
                </form>

                {/* Direct Action triggers panel */}
                <div className="dark:bg-slate-950 bg-slate-50/60 border dark:border-slate-850 border-slate-300 p-4 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold dark:text-slate-400 text-slate-600 uppercase tracking-wider font-mono">Sincronização Manual</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                      Força a sincronização dos dados locais com o repositório GitHub configurado.
                    </p>
                  </div>

                  {gitRemoteUrl ? (
                    <button
                      onClick={handleForceGitPush}
                      disabled={gitPushing || !gitRemoteUrl}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 dark:text-white text-black font-bold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-950/30 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${gitPushing ? 'animate-spin' : ''}`} />
                      {gitPushing ? 'Sincronizando...' : 'Forçar Push'}
                    </button>
                  ) : (
                    <div className="text-center p-3 border border-dashed dark:border-slate-850 border-slate-300 rounded-lg dark:bg-slate-950 bg-slate-50/40 text-[10px] text-slate-500">
                      Configure um repositório remoto para habilitar a sincronização.
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Watched Repositories */}
        {activeTab === 'repos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            
            {/* Left/Middle Column - Repositories management table */}
            <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-6 lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold dark:text-white text-black">Watchlist Ativa</h3>
                  <p className="dark:text-slate-400 text-slate-600 text-xs mt-0.5">Repositórios na esteira de devoramento ou sincronização</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-600" />
                    <input 
                      type="text"
                      placeholder="Filtrar URL..."
                      className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 w-full sm:w-44"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  <select 
                    className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg px-2 py-1.5 text-xs dark:text-slate-300 text-slate-700 focus:outline-none focus:border-blue-500"
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
                    <tr className="border-b dark:border-slate-850 border-slate-300 dark:text-slate-400 text-slate-600 text-xs">
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
                    ) : paginatedRepos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">Nenhum repositório localizado.</td>
                      </tr>
                    ) : (
                      paginatedRepos.map((repo) => (
                        <tr key={repo.url} className="hover:dark:bg-slate-850 bg-slate-200/30 transition-colors">
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
                            </div>
                          </td>
                          <td className="py-3">
                            {repo.totalFiles ? (
                              <div className="w-28 mx-auto space-y-1">
                                <div className="h-1 dark:bg-slate-950 bg-slate-50 rounded-full overflow-hidden border border-slate-900">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${repo.lastSync ? 'bg-blue-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, ((repo.digestedCount || 0) / repo.totalFiles) * 100)}%` }}
                                  />
                                </div>
                                <div className="text-[8px] text-slate-500 text-center font-mono">
                                  {repo.digestedCount}/{repo.totalFiles}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-[9px] text-slate-600 italic">Varredura Pendente</div>
                            )}
                          </td>
                          <td className="py-3 text-right dark:text-slate-400 text-slate-600 font-mono text-[10px]">
                            {repo.lastSync ? new Date(repo.lastSync).toLocaleString() : 'Fila'}
                          </td>
                          <td className="py-3 text-right">
                            <button 
                              onClick={() => handleRemoveRepo(repo.url)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                              title="Remover repositório"
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
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t dark:border-slate-850 border-slate-300">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded text-[10px] dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 bg-slate-200 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded text-[10px] dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 bg-slate-200 disabled:opacity-50"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right/Sidebar Column - Forms for adding or scraping repos */}
            <div className="space-y-6">
              
              {/* Ingest Repo form */}
              <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5">
                <h3 className="font-bold text-sm dark:text-white text-black flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-500" />
                  Alimentar Ingestão (GitHub)
                </h3>
                <p className="text-xs dark:text-slate-400 text-slate-600 mt-2 leading-relaxed">
                  Adicione um endereço GitHub avulso abaixo. A esteira irá clonar o código, separar em fatias procedimentais e criar blocos na biblioteca.
                </p>
                
                <div className="mt-3 p-3 dark:bg-blue-500/10 bg-blue-100 border border-blue-500/20 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                      <strong>Sobre Monorepos (Monolithic Repository):</strong>
                      <br/>
                      Contêm de forma agrupada <i>códigos-fonte não compilados</i>, dependências e instruções de montagem de múltiplos serviços num único local. Nosso sistema digere o código estrito para blocos reutilizáveis brutos, não gerando binários finais ou instaláveis. 
                    </p>
                  </div>
                </div>

                <form onSubmit={handleIngest} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono tracking-wider dark:text-slate-400 text-slate-600 block">Link de Repositório</label>
                    <input 
                      type="url"
                      placeholder="https://github.com/usuario/projeto"
                      required
                      className="w-full dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg px-3 py-2 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
                      value={ingestUrl}
                      onChange={(e) => setIngestUrl(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={ingesting || !ingestUrl}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 dark:text-white text-black text-xs font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {ingesting ? 'Adicionando...' : 'Adicionar Repositório'}
                  </button>
                </form>
              </div>

              {/* Deep Web page scraper */}
              <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm dark:text-white text-black flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-400" />
                    Deep Scraper
                  </h3>
                  <div className="flex dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 p-0.5 rounded-md">
                    <button 
                      onClick={() => setScrapeMode('url')}
                      className={`px-2 py-0.5 text-[9px] rounded font-semibold transition-all ${scrapeMode === 'url' ? 'bg-blue-600 dark:text-white text-black' : 'text-slate-500'}`}
                    >
                      URL
                    </button>
                    <button 
                      onClick={() => setScrapeMode('raw')}
                      className={`px-2 py-0.5 text-[9px] rounded font-semibold transition-all ${scrapeMode === 'raw' ? 'bg-blue-600 dark:text-white text-black' : 'text-slate-500'}`}
                    >
                      TEXTO
                    </button>
                  </div>
                </div>
                
                <p className="text-xs dark:text-slate-400 text-slate-600 mt-2 leading-relaxed">
                  Varra qualquer página web para achar repositórios ocultos e encher a watchlist de novos alvos de aprendizagem.
                </p>

                <form onSubmit={handleScrape} className="space-y-4 mt-4">
                  {scrapeMode === 'url' ? (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] uppercase font-mono tracking-wider dark:text-slate-400 text-slate-600 block">Endereço Web</label>
                      <input 
                        type="url"
                        placeholder="https://reddit.com/r/webdev/..."
                        className="w-full dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg px-3 py-2 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] uppercase font-mono tracking-wider dark:text-slate-400 text-slate-600 block">HTML ou Texto Fonte</label>
                      <textarea 
                        placeholder="Cole códigos markdown, fontes HTML ou parágrafos..."
                        rows={4}
                        className="w-full dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg px-3 py-2 text-xs font-mono dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 custom-scrollbar"
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
          <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b dark:border-slate-850 border-slate-300 pb-4">
              <div>
                <h3 className="text-lg font-bold dark:text-white text-black flex items-center gap-2">
                  <Layers className="text-emerald-500 w-5 h-5" />
                  Biblioteca de Blocos Lego Extraídos
                </h3>
                <p className="text-xs dark:text-slate-400 text-slate-600 mt-1">
                  Listagem autêntica de arquivos físicos gerados organizados por diretório correspondente
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-600" />
                <input 
                  type="text"
                  placeholder="Pesquisar bloco ou cluster..."
                  className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 w-full md:w-56"
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex dark:bg-slate-950 bg-slate-50/80 p-4 border dark:border-slate-850 border-slate-300 rounded-xl text-xs dark:text-slate-400 text-slate-600 gap-3 items-center">
              <span className="p-1 px-2.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold uppercase">Consolidado</span>
              <p>
                Temos exatamente <strong className="dark:text-slate-100 text-slate-900">{totalBlocks} peças funcionais reutilizáveis</strong> extraídas e mapeadas. Elas foram sintetizadas em TypeScript e preparadas de forma autônoma pelo motor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredInventory.length === 0 ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center text-slate-500 py-12 border border-dashed dark:border-slate-850 border-slate-300 rounded-xl dark:bg-slate-950 bg-slate-50/40">
                  Nenhum bloco localizado sob o filtro informado. Altere o termo de pesquisa.
                </div>
              ) : (
                filteredInventory.map((inv) => (
                  <div key={inv.category} className="dark:bg-slate-950 bg-slate-50/45 border dark:border-slate-850 border-slate-300 rounded-xl p-4.5 hover:dark:border-slate-800 border-slate-300 transition-colors">
                    <h4 className="font-bold text-sm flex items-center justify-between mb-4 dark:text-slate-200 text-slate-800">
                      <span className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-blue-400" />
                        {inv.category}
                      </span>
                      <span className="text-[10px] font-mono dark:bg-slate-900 bg-slate-100 px-2 py-0.5 rounded text-blue-400 border dark:border-slate-850 border-slate-300">
                        {inv.blocks.length} arquivos
                      </span>
                    </h4>
                    
                    {inv.blocks.length === 0 ? (
                      <span className="text-xs text-slate-600 block py-4 text-center border border-dashed border-slate-900 rounded dark:bg-slate-900 bg-slate-100/10">
                        Nenhum bloco extraído
                      </span>
                    ) : (
                      <ul className="space-y-2">
                        {inv.blocks.map(block => (
                          <li 
                            key={block} 
                            onClick={() => handleViewBlock(inv.category, block)}
                            className="group flex items-center justify-between gap-2 text-xs dark:text-slate-300 text-slate-700 font-mono dark:bg-slate-900/60 bg-slate-100/60 hover:dark:bg-slate-800/80 hover:bg-slate-200/50 px-3 py-2 rounded-lg border dark:border-slate-850 hover:dark:border-blue-500/40 hover:border-blue-500/30 border-slate-300 transition-all cursor-pointer active:scale-[0.985]"
                            title="Clique para inspecionar código fonte"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:animate-ping"></span>
                              <span className="truncate dark:text-slate-200 text-slate-800 font-semibold group-hover:text-blue-400 transition-colors">
                                {block.replace('.ts', '')}
                              </span>
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[8px] dark:bg-slate-950 bg-slate-50 text-slate-500 border border-slate-900 px-1 py-0.2 rounded font-semibold uppercase">TS</span>
                              <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                            </div>
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

        {/* Tab 3.5: Activity Logs */}
        {activeTab === 'activity' && (
          <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b dark:border-slate-850 border-slate-300 pb-4">
              <div>
                <h3 className="text-lg font-bold dark:text-white text-black flex items-center gap-2">
                  <Activity className="text-blue-500 w-5 h-5 animate-pulse" />
                  Registro de Atividades do Ecossistema
                </h3>
                <p className="text-xs dark:text-slate-400 text-slate-600 mt-1">
                  Ações de ingestão, mutações de código, salvaguarda e indexação registradas pelo servidor
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchActivity}
                  className="flex items-center gap-1.5 px-3 py-1.5 dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-lg text-xs font-semibold dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-200 transition-all active:scale-[0.985]"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Atualizar Atividades
                </button>
              </div>
            </div>

            <div className="relative border-l-2 dark:border-slate-800 border-slate-300 pl-6 ml-3 space-y-6">
              {activityLogs.length === 0 ? (
                <div className="text-center text-slate-500 py-12 border border-dashed dark:border-slate-850 border-slate-300 rounded-xl dark:bg-slate-950 bg-slate-50/40 -ml-6">
                  Nenhuma atividade registrada no momento. Atividades virtuosas surgirão automaticamente conforme interage com os repositórios.
                </div>
              ) : (
                activityLogs.map((log, index) => {
                  const dateStr = new Date(log.timestamp).toLocaleString();
                  let icon = <Activity className="w-4 h-4 text-blue-400" />;
                  let actionLabel = log.action;
                  let bgBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";

                  if (log.action === 'ingest_repository') {
                    icon = <Cpu className="w-4 h-4 text-emerald-400" />;
                    actionLabel = "Ingestão de Repositório";
                    bgBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                  } else if (log.action === 'global_ingest_started') {
                    icon = <Globe className="w-4 h-4 text-purple-400" />;
                    actionLabel = "Ingestão Global Iniciada";
                    bgBadge = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                  } else if (log.action?.includes('commit')) {
                    icon = <GitCommit className="w-4 h-4 text-indigo-400" />;
                    actionLabel = "Commit de Salvaguarda";
                    bgBadge = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                  } else if (log.action === 'database_sync' || log.action === 'sync') {
                    icon = <RefreshCw className="w-4 h-4 text-sky-400" />;
                    actionLabel = "Sincronização do Banco";
                    bgBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                  }

                  return (
                    <div key={index} className="relative group animate-in slide-in-from-left-2 duration-150">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[31px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full dark:bg-slate-900 bg-slate-100 border-2 dark:border-slate-800 border-slate-300 group-hover:border-blue-500 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      </span>

                      <div className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-xl p-4 hover:dark:border-slate-800 hover:border-slate-400 transition-colors space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-slate-850 border-slate-300/60 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 dark:bg-slate-900 bg-slate-100/80 rounded-lg">
                              {icon}
                            </span>
                            <div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${bgBadge}`}>
                                {actionLabel}
                              </span>
                              <span className="text-xs dark:text-slate-400 text-slate-500 font-mono ml-2.5">
                                por {log.userId || "Sistema"}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] dark:text-slate-500 text-slate-600 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                          </span>
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="dark:bg-slate-900 bg-slate-100 p-3 rounded-lg border dark:border-slate-850 border-slate-300 space-y-1.5 text-xs">
                            <span className="text-[9px] uppercase tracking-wider dark:text-slate-500 text-slate-600 font-bold block mb-1 font-mono">Detalhes da Transação:</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {Object.entries(log.details).map(([key, val]) => (
                                <div key={key} className="flex flex-col md:flex-row md:items-center justify-between gap-1 border-b dark:border-slate-850/40 border-slate-200/50 py-1">
                                  <span className="font-mono dark:text-slate-400 text-slate-500 capitalize">{key}:</span>
                                  <span className="font-mono dark:text-slate-200 text-slate-700 font-semibold truncate max-w-[240px]">
                                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Logs and System Terminals */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Developer power-actions control bar */}
            <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold dark:text-slate-400 text-slate-600 uppercase tracking-widest font-mono">Controle dos Daemons:</span>
                <div className="flex bg-black/40 p-1 rounded-lg border dark:border-slate-850 border-slate-300 gap-1">
                  <button 
                    onClick={() => handleControl(workerStatus === 'paused' ? 'running' : 'paused')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${workerStatus === 'paused' ? 'bg-emerald-600 hover:bg-emerald-500 dark:text-white text-black shadow-md' : 'dark:bg-slate-900/80 hover:dark:bg-slate-800 bg-slate-200 hover:bg-slate-300 dark:text-slate-300 text-slate-700'}`}
                  >
                    {workerStatus === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {workerStatus === 'paused' ? 'Resume Workers' : 'Pause Workers'}
                  </button>
                  <button 
                    onClick={() => handleControl('stop_after_current')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${workerStatus === 'stop_after_current' ? 'bg-amber-600 dark:text-white text-black shadow-md' : 'dark:bg-slate-900/80 hover:dark:bg-slate-800 bg-slate-200 hover:bg-slate-300 dark:text-slate-300 text-slate-700'}`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Terminar Execução Atual
                  </button>
                </div>
              </div>

              <div className="flex dark:bg-slate-950 bg-slate-50/60 p-1 py-0.5 rounded border dark:border-slate-850 border-slate-300 text-xs font-semibold items-center gap-2">
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
              <div className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-950 pb-2">
                    <span className="flex items-center gap-2 dark:text-slate-400 text-slate-600 text-[10px] uppercase tracking-widest font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Terminal de Ingestão de Código
                    </span>
                    <button onClick={fetchLogs} className="text-slate-500 hover:text-emerald-400 transition-colors">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Search inside Terminal */}
                  <div className="mb-3 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filtrar console de ingestão..."
                      className="w-full bg-slate-900/60 dark:border-slate-850 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-emerald-500/50 font-mono transition-all"
                      value={ingestionLogFilter}
                      onChange={(e) => setIngestionLogFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-emerald-400/90 select-text bg-black/45 p-3 rounded-lg border border-slate-950 font-mono text-[10.5px]">
                  {(() => {
                    const original = logs.ingestion || "Processo mestre ocioso. Aguardando novos alvos...";
                    if (!ingestionLogFilter) return original;
                    const filtered = original.split('\n').filter(line => line.toLowerCase().includes(ingestionLogFilter.toLowerCase())).join('\n');
                    return filtered || `--- Nenhum registro para "${ingestionLogFilter}" ---`;
                  })()}
                </div>
              </div>

              {/* Blueprint feed */}
              <div className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-950 pb-2">
                    <span className="flex items-center gap-2 dark:text-slate-400 text-slate-600 text-[10px] uppercase tracking-widest font-bold">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      Terminal do Blueprint Engine
                    </span>
                    <button onClick={fetchLogs} className="text-slate-500 hover:text-blue-400 transition-colors">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Search inside Terminal */}
                  <div className="mb-3 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filtrar console de blueprints..."
                      className="w-full bg-slate-900/60 dark:border-slate-850 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500/50 font-mono transition-all"
                      value={blueprintLogFilter}
                      onChange={(e) => setBlueprintLogFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-blue-400/90 select-text bg-black/45 p-3 rounded-lg border border-slate-950 font-mono text-[10.5px]">
                  {(() => {
                    const original = logs.blueprints || "Trabalhador de blueprints ocioso...";
                    if (!blueprintLogFilter) return original;
                    const filtered = original.split('\n').filter(line => line.toLowerCase().includes(blueprintLogFilter.toLowerCase())).join('\n');
                    return filtered || `--- Nenhum registro para "${blueprintLogFilter}" ---`;
                  })()}
                </div>
              </div>

              {/* System logs */}
              <div className="dark:bg-slate-950 bg-slate-50 border dark:border-slate-850 border-slate-300 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-950 pb-2">
                    <span className="flex items-center gap-2 dark:text-slate-400 text-slate-600 text-[10px] uppercase tracking-widest font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Eventos e Auditoria Git
                    </span>
                    <button onClick={fetchLogs} className="text-slate-500 hover:text-amber-400 transition-colors">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Search inside Terminal */}
                  <div className="mb-3 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filtrar logs globais/Git..."
                      className="w-full bg-slate-900/60 dark:border-slate-850 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
                      value={systemLogFilter}
                      onChange={(e) => setSystemLogFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-amber-400/95 select-text bg-black/45 p-3 rounded-lg border border-slate-950 font-mono text-[10.5px]">
                  {(() => {
                    const original = logs.system || "Aguardando inicialização do servidor...";
                    if (!systemLogFilter) return original;
                    const filtered = original.split('\n').filter(line => line.toLowerCase().includes(systemLogFilter.toLowerCase())).join('\n');
                    return filtered || `--- Nenhum registro para "${systemLogFilter}" ---`;
                  })()}
                </div>
              </div>

            </div>

            {/* Powertools action triggers */}
            <div className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-850 border-slate-300 rounded-xl p-5">
              <h4 className="text-sm font-bold dark:text-slate-300 text-slate-700 font-mono tracking-wider uppercase mb-3">Power Developer Tools</h4>
              <p className="text-xs dark:text-slate-400 text-slate-600 mb-4">Ações estruturais e administrativas no servidor de arquivos</p>
              
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={async () => {
                    await fetch('/api/pool/worker/purge-tmp', { method: 'POST' });
                    showAlert('Pasta temporária (.tmp) expurgada da Pool.', 'success');
                  }}
                  className="flex items-center gap-2 px-4 py-2 dark:bg-slate-950 bg-slate-50 hover:dark:bg-slate-850 bg-slate-200 dark:text-slate-300 text-slate-700 border dark:border-slate-800 border-slate-300 rounded-lg text-xs font-semibold transition-all"
                >
                  <Trash2 className="w-4 h-4 dark:text-slate-400 text-slate-600" />
                  Purgar Pasta Temporária (.tmp)
                </button>
                <button 
                  onClick={async () => {
                    await fetch('/api/pool/worker/purge-logs', { method: 'POST' });
                    setLogs({ ingestion: '', blueprints: '', system: '' });
                    showAlert('Todos os arquivos de log limpos.', 'success');
                  }}
                  className="flex items-center gap-2 px-4 py-2 dark:bg-slate-950 bg-slate-50 hover:dark:bg-slate-850 bg-slate-200 dark:text-slate-300 text-slate-700 border dark:border-slate-800 border-slate-300 rounded-lg text-xs font-semibold transition-all"
                >
                  <RefreshCw className="w-4 h-4 dark:text-slate-400 text-slate-600" />
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

      {/* Dynamic High Fidelity Block Inspector overlay Modal */}
      {inspectingBlock && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 md:p-6 animate-in fade-in duration-200"
          onClick={() => setInspectingBlock(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Head */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-3">
                <span className="p-1.5 px-2.5 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-[10px] font-bold border border-blue-500/20">
                  {inspectingBlock.category}
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-white font-mono flex items-center gap-2 tracking-tight">
                    {inspectingBlock.file}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">
                    POOL/modules/{inspectingBlock.category}/{inspectingBlock.file}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setInspectingBlock(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all font-mono text-[11px] uppercase tracking-wide border border-transparent hover:border-slate-700 select-none pb-1"
                title="Fechar painel (Esc)"
              >
                [ ESC ] ×
              </button>
            </div>

            {/* Code Area Core Content */}
            <div className="flex-1 overflow-auto p-5 bg-slate-950 custom-scrollbar relative min-h-[300px]">
              {inspectingBlock.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="animate-pulse">Desmontando e indexando fatias procedimentais...</span>
                </div>
              ) : inspectingBlock.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400 font-mono text-xs p-6 text-center">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                  <p className="font-bold text-sm">Falha na verificação de integridade física</p>
                  <p className="max-w-md text-slate-400 text-[11px] leading-relaxed">{inspectingBlock.error}</p>
                </div>
              ) : (
                <div className="font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto whitespace-pre select-text h-full">
                  <div className="flex text-left">
                    {/* Lines bar */}
                    <div className="text-slate-600 text-right pr-4 select-none border-r border-slate-900 leading-relaxed mr-4 font-normal text-[11px] min-w-[30px]">
                      {inspectingBlock.content?.split('\n').map((_, index) => (
                        <div key={index}>{index + 1}</div>
                      ))}
                    </div>
                    {/* Code output with tokenizer-like highlighting */}
                    <pre className="font-mono leading-relaxed text-[11px] text-left">
                      <code>
                        {inspectingBlock.content?.split('\n').map((line, idx) => {
                          const parts = line.split(/(\b(?:import|from|export|interface|const|let|async|await|function|class|return|string|number|any|boolean|true|false)\b)/g);
                          return (
                            <div key={idx} className="min-h-[1.5rem]">
                              {parts.map((p, pIdx) => {
                                if (['import', 'from', 'export'].includes(p)) {
                                  return <span key={pIdx} className="text-purple-400 font-semibold">{p}</span>;
                                }
                                if (['interface', 'class', 'function', 'return'].includes(p)) {
                                  return <span key={pIdx} className="text-pink-400 font-semibold">{p}</span>;
                                }
                                if (['const', 'let'].includes(p)) {
                                  return <span key={pIdx} className="text-blue-400 font-semibold">{p}</span>;
                                }
                                if (['async', 'await'].includes(p)) {
                                  return <span key={pIdx} className="text-amber-400 font-semibold">{p}</span>;
                                }
                                if (['string', 'number', 'any', 'boolean'].includes(p)) {
                                  return <span key={pIdx} className="text-emerald-400">{p}</span>;
                                }
                                if (['true', 'false'].includes(p)) {
                                  return <span key={pIdx} className="text-indigo-400 font-semibold">{p}</span>;
                                }
                                return p;
                              })}
                            </div>
                          );
                        })}
                      </code>
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono text-[10px]">
                {inspectingBlock.content ? `${inspectingBlock.content.length} caracteres | ${inspectingBlock.content.split('\n').length} linhas` : '---'}
              </span>

              <div className="flex gap-2">
                {!inspectingBlock.loading && !inspectingBlock.error && (
                  <button
                    onClick={handleCopyBlock}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 select-none text-xs"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 transition-transform ${copiedNotification ? 'scale-110 text-emerald-400' : ''}`} />
                    {copiedNotification ? 'Código Copiado!' : 'Copiar Código'}
                  </button>
                )}
                <button
                  onClick={() => setInspectingBlock(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-all border border-slate-700 text-xs"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status / Toast Toasting */}
      {status.message && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-5 duration-300 ${
          status.type === 'error' ? 'bg-red-900/90 border-red-500/40 text-red-100' :
          status.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100' :
          'dark:bg-slate-900 bg-slate-100/95 dark:border-slate-800 border-slate-300 dark:text-slate-100 text-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`p-1 rounded ${status.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold">{status.message}</span>
            <button onClick={() => setStatus({ message: '', type: null })} className="ml-3 hover:dark:text-white text-black opacity-50 hover:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
