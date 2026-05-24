import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CacheHealth {
  connected: boolean;
  engine: 'REDIS' | 'LOCAL_MEMORY';
  latency: 'LOW' | 'ZERO';
}

export const RedisHealthIndicator: React.FC = () => {
  const [health, setHealth] = useState<CacheHealth | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/cache/health');
        if (response.ok) {
          const data = await response.json();
          setHealth(data);
        }
      } catch (err) {
        console.error('Failed to poll cache health:', err);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] shadow-sm"
    >
      <div className={`p-1.5 rounded-full ${health.connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
        {health.connected ? <Database className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
      </div>
      
      <div className="flex flex-col">
        <span className="text-[10px] font-black on-surface tracking-widest uppercase opacity-40 leading-none mb-1">Cache Engine</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold on-surface tracking-tight whitespace-nowrap">
            {health.engine === 'REDIS' ? 'Redis Hybrid' : 'Local Memory'}
          </span>
          {health.connected ? (
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
          ) : (
            <ShieldAlert className="w-3 h-3 text-amber-500" />
          )}
        </div>
      </div>
    </motion.div>
  );
};
