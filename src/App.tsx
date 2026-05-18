import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Target, Github, Database, Layers, Box, Play, Pause, RotateCw } from 'lucide-react';

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

export default function App() {
  const [repositories, setRepositories] = useState<WatchedRepository[]>([]);
  const [inventory, setInventory] = useState<InventoryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'url' | 'lastSync'>('url');
  
  const [ingestUrl, setIngestUrl] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hunting, setHunting] = useState(false);
  const [logs, setLogs] = useState({ ingestion: '', blueprints: '' });

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pool/registry');
      const data = await res.json();
      setRepositories(data.watched || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch registry', error);
    }
    setLoading(false);
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/pool/inventory');
      const data = await res.json();
      setInventory(data.inventory || []);
    } catch (e) {
      console.error('Failed to fetch inventory', e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/pool/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch logs', e);
    }
  };

  const [workerStatus, setWorkerStatus] = useState<'running' | 'paused' | 'stop_after_current'>('running');

  const fetchWorkerStatus = async () => {
    try {
      const res = await fetch('/api/pool/worker/status');
      const data = await res.json();
      setWorkerStatus(data.status);
    } catch (e) {
      console.error(e);
    }
  };

  const handleControl = async (status: string) => {
    try {
      await fetch('/api/pool/worker/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchWorkerStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestartWorker = async () => {
    if (!confirm('This will kill all background processes and restart them. Continue?')) return;
    try {
      await fetch('/api/pool/worker/restart', { method: 'POST' });
      alert('Workers restarted.');
      fetchWorkerStatus();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRegistry();
    fetchInventory();
    fetchLogs();
    fetchWorkerStatus();
    
    // Auto-refresh logs and status every 2 seconds
    const interval = setInterval(() => {
      fetchLogs();
      fetchWorkerStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/pool/sync', { method: 'POST' });
      await fetchRegistry();
      await fetchInventory();
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const handleHunt = async () => {
    setHunting(true);
    try {
      await fetch('/api/pool/hunt', { method: 'POST' });
      await fetchRegistry();
      await fetchInventory();
    } catch (e) {
      console.error(e);
    }
    setHunting(false);
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrl) return;
    setIngesting(true);
    try {
      await fetch('/api/pool/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: ingestUrl }),
      });
      setIngestUrl('');
      await fetchRegistry();
    } catch (e) {
      console.error(e);
    }
    setIngesting(false);
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl) return;
    setScraping(true);
    try {
      const res = await fetch('/api/pool/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: scrapeUrl }),
      });
      const data = await res.json();
      alert(`Scraping complete: Found ${data.found || 0} repos. Added ${data.added || 0} uniquely.`);
      setScrapeUrl('');
      await fetchRegistry();
    } catch (e) {
      console.error(e);
    }
    setScraping(false);
  };

  // Derived state
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

  const filteredRepos = repositories.filter(repo => 
    repo.url.toLowerCase().includes(filter.toLowerCase())
  );
  
  const sortedRepos = [...filteredRepos].sort((a, b) => {
    if (sortOrder === 'url') {
      return a.url.localeCompare(b.url);
    } else {
      const timeA = a.lastSync ? new Date(a.lastSync).getTime() : 0;
      const timeB = b.lastSync ? new Date(b.lastSync).getTime() : 0;
      return timeB - timeA; // newest first
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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="text-blue-500" />
              Lego Pool Dashboard
              <span className="flex items-center gap-1.5 ml-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] uppercase tracking-tighter text-emerald-500 font-mono">Ingestion Active</span>
              </span>
            </h1>
            <p className="text-slate-400 mt-2">Managing {total} open-source repositories.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync All'}
            </button>
            <button 
              onClick={handleHunt}
              disabled={hunting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
            >
              <Target className={`w-4 h-4 ${hunting ? 'animate-pulse' : ''}`} />
              {hunting ? 'Hunting...' : 'Start Hunt'}
            </button>
          </div>
        </div>

        {/* Live Logs Section - Processo Mestre (Moved to Top) */}
        <div className="mb-6 bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Controls:</span>
                <div className="flex bg-black/40 p-1 rounded-lg border border-slate-700">
                    <button 
                      onClick={() => handleControl(workerStatus === 'paused' ? 'running' : 'paused')}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${workerStatus === 'paused' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    >
                      {workerStatus === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      {workerStatus === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button 
                      onClick={() => handleControl('stop_after_current')}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${workerStatus === 'stop_after_current' ? 'bg-amber-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    >
                      <RotateCw className="w-3 h-3" />
                      Finish current & Stop
                    </button>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      if (!confirm('This will create a git commit in the POOL directory. Continue?')) return;
                      const res = await fetch('/api/pool/worker/commit', { method: 'POST' });
                      const data = await res.json();
                      alert(data.status === 'Committed' ? 'Changes committed to POOL.' : data.message || data.error);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-all"
                  >
                    <Github className="w-3 h-3" />
                    Commit Pool
                  </button>
                  <button 
                    onClick={async () => {
                      if (!confirm('Clean up all temporary clone data?')) return;
                      await fetch('/api/pool/worker/purge-tmp', { method: 'POST' });
                      alert('Temp files purged.');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-xs font-bold transition-all"
                  >
                    <Layers className="w-3 h-3" />
                    Purge Temp
                  </button>
                  <button 
                    onClick={async () => {
                      if (!confirm('Clear all log files?')) return;
                      await fetch('/api/pool/worker/purge-logs', { method: 'POST' });
                      setLogs({ ingestion: '', blueprints: '' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-xs font-bold transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Clear Logs
                  </button>
                </div>

                <button 
                  onClick={handleRestartWorker}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  Hard Restart
                </button>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    workerStatus === 'running' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                    workerStatus === 'paused' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}>
                    {workerStatus.replace(/_/g, ' ')}
                </span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/60 border border-slate-800 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative overflow-hidden backdrop-blur-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                    <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                        Ingestion Engine Feed (Live)
                        {activeRepo && (
                          <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-[9px] text-emerald-300 font-bold animate-in fade-in slide-in-from-left-2 duration-500 flex items-center gap-2">
                             ACTIVE: {activeRepo}
                             {sliceProgress && (
                               <span className="bg-emerald-500/30 px-1 rounded text-[8px] text-emerald-200">
                                 {sliceProgress.current}/{sliceProgress.total} BATCH
                               </span>
                             )}
                          </span>
                        )}
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchLogs} className="hover:text-emerald-400 transition-colors">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[9px]">Master_Worker</span>
                    </div>
                </div>
                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-emerald-400/90 selection:bg-emerald-500/30">
                    {logs.ingestion || "Waiting for stream from Master Ingestor..."}
                </div>
            </div>

            <div className="bg-black/60 border border-slate-800 rounded-xl p-5 font-mono text-[11px] leading-relaxed relative overflow-hidden backdrop-blur-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                    <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]"></span>
                        Blueprint Generator Feed
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchLogs} className="hover:text-blue-400 transition-colors">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                        <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[9px]">Retro_Worker</span>
                    </div>
                </div>
                <div className="h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-blue-400/90 selection:bg-blue-500/30">
                    {logs.blueprints || "Waiting for stream from Blueprint Engine..."}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Github className="w-5 h-5 text-slate-400" />
                Watched Repositories
              </h2>
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Filter URLs..."
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <select 
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                >
                  <option value="url">Sort by URL</option>
                  <option value="lastSync">Sort by Recent Sync</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-medium">Repository</th>
                    <th className="pb-3 font-medium text-center">Digestion</th>
                    <th className="pb-3 font-medium text-right">Status</th>
                    <th className="pb-3 font-medium text-right">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-slate-500">Loading registry...</td>
                    </tr>
                  ) : sortedRepos.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-slate-500">No repositories found.</td>
                    </tr>
                  ) : (
                    sortedRepos.map((repo) => (
                      <tr key={repo.url} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                             <a href={repo.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">
                               {repo.url.replace('https://github.com/', '')}
                             </a>
                             {repo.isMonster && (
                               <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 rounded font-bold uppercase">Monster</span>
                             )}
                          </div>
                        </td>
                        <td className="py-3">
                           {repo.totalFiles ? (
                             <div className="w-32 mx-auto">
                                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                   <div 
                                     className={`h-full transition-all duration-1000 ${repo.lastSync ? 'bg-blue-500' : 'bg-emerald-500'}`}
                                     style={{ width: `${Math.min(100, ((repo.digestedCount || 0) / repo.totalFiles) * 100)}%` }}
                                   />
                                </div>
                                <div className="text-[8px] text-slate-500 mt-1 text-center font-mono">
                                  {repo.digestedCount}/{repo.totalFiles}
                                </div>
                             </div>
                           ) : (
                             <div className="text-center text-[10px] text-slate-600 italic">Pending scan</div>
                           )}
                        </td>
                        <td className="py-3 text-right">
                           <span className={`text-[10px] px-1.5 py-0.5 rounded ${repo.lastSync ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-500'}`}>
                              {repo.lastSync ? 'Synced' : 'Devouring...'}
                           </span>
                        </td>
                        <td className="py-3 text-right text-slate-400">
                          {repo.lastSync ? new Date(repo.lastSync).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-fit">
            <h2 className="text-xl font-semibold mb-4">Ingest Repository</h2>
            <p className="text-sm text-slate-400 mb-6">
              Manually add a new repository to the pool. The system will clone it, decompose it into modular blocks using AI, and add it to the monitoring registry.
            </p>
            <form onSubmit={handleIngest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Single GitHub URL</label>
                <input 
                  type="url"
                  placeholder="https://github.com/user/repo"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={ingesting || !ingestUrl}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ingesting ? 'Ingesting...' : 'Add Repo'}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-700">
               <h3 className="text-sm font-semibold text-slate-300 mb-2">Mass Scrapper (URL/Article)</h3>
               <p className="text-xs text-slate-500 mb-4">Provide any URL (blog post, documentation, list) to extract and queue all GitHub repos found.</p>
               <form onSubmit={handleScrape} className="space-y-4">
                  <input 
                    type="url"
                    placeholder="https://example.com/awesome-list"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                  />
                  <button 
                    disabled={scraping || !scrapeUrl}
                    className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {scraping ? 'Searching...' : 'Extract Repos'}
                  </button>
               </form>
            </div>
          </div>
        </div>

        {/* Module Inventory Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <Layers className="text-emerald-500 w-6 h-6" />
              <h2 className="text-2xl font-bold">Extracted Lego Blocks</h2>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search blocks or categories..."
                className="w-full md:w-64 bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-8">
            These are the individual conceptual modules decomposed from the watched repositories, ready for modular consumption.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInventory.length === 0 && !loading ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center text-slate-500 py-8 border border-dashed border-slate-700 rounded-lg">
                {inventory.length === 0 ? "No modules extracted yet. Start a sync or hunt to populate the pool." : "No blocks or categories match your search."}
              </div>
            ) : (
              filteredInventory.map((inv) => (
                <div key={inv.category} className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5 shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4 text-slate-200">
                    <Box className="w-5 h-5 text-blue-400" />
                    {inv.category}
                  </h3>
                  {inv.blocks.length === 0 ? (
                    <span className="text-sm text-slate-500 italic block py-2 border border-dashed border-slate-800 rounded bg-slate-800/30 text-center">Empty cluster</span>
                  ) : (
                    <ul className="space-y-2">
                      {inv.blocks.map(block => (
                        <li key={block} className="flex items-center gap-2 text-sm text-slate-300 font-mono bg-slate-800/80 px-3 py-2 rounded border border-slate-700/50 transition-colors hover:border-slate-600 hover:bg-slate-700/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                          {block.replace('.ts', '')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
