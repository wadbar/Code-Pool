import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Target, Github, Database, Layers, Box } from 'lucide-react';

interface WatchedRepository {
  url: string;
  lastSync: string | null;
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
  const [ingesting, setIngesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hunting, setHunting] = useState(false);

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

  useEffect(() => {
    fetchRegistry();
    fetchInventory();
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
      await fetchInventory();
    } catch (e) {
      console.error(e);
    }
    setIngesting(false);
  };

  // Derived state
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
                          <a href={repo.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                            {repo.url.replace('https://github.com/', '')}
                          </a>
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
                <label className="block text-sm font-medium text-slate-300 mb-1">GitHub URL</label>
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
                {ingesting ? 'Ingesting...' : 'Add to Pool'}
              </button>
            </form>
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
