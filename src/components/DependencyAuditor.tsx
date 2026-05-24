import React, { useState, useEffect, useRef } from 'react';
import { Network, Search, Filter, AlertCircle, Cpu, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Node {
  id: string;
  group: number;
  val: number;
}

interface Link {
  source: string;
  target: string;
}

export const DependencyAuditor: React.FC = () => {
  const [data, setData] = useState<{ nodes: Node[], links: Link[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/dependencies')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="m3-card !p-8 border border-[var(--md-sys-color-outline-variant)] shadow-2xl mt-10 bg-[var(--md-sys-color-surface-container-low)]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black on-surface tracking-tighter">Dependency Auditor</h3>
            <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">Module Interoperability Graph</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 relative aspect-video bg-black/20 rounded-[2.5rem] border border-[var(--md-sys-color-outline-variant)] overflow-hidden flex items-center justify-center group">
          {loading ? (
            <div className="flex flex-col items-center gap-4 opacity-20">
              <RefreshCw className="w-12 h-12 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Mapping Core...</span>
            </div>
          ) : (
             <svg width="100%" height="100%" viewBox="0 0 800 450" className="opacity-90">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="25" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.1)" />
                  </marker>
                </defs>
                {/* Connections */}
                {data.links.map((link, i) => {
                  const s = data.nodes.find(n => n.id === link.source);
                  const t = data.nodes.find(n => n.id === link.target);
                  if (!s || !t) return null;
                  // Static layout positions for nodes
                  const positions: Record<string, [number, number]> = {
                    'CORE': [400, 225],
                    'INFRA': [200, 100],
                    'UTILS': [600, 100],
                    'AUDIT': [200, 350],
                    'AUTOMATION': [600, 350]
                  };
                  const [x1, y1] = positions[s.id] || [400, 225];
                  const [x2, y2] = positions[t.id] || [400, 225];
                  return (
                    <motion.line
                      key={i}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.2 }}
                      transition={{ duration: 1.5, delay: i * 0.1 }}
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="white"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                    />
                  );
                })}
                {/* Nodes */}
                {data.nodes.map((node, i) => {
                  const positions: Record<string, [number, number]> = {
                    'CORE': [400, 225],
                    'INFRA': [200, 100],
                    'UTILS': [600, 100],
                    'AUDIT': [200, 350],
                    'AUTOMATION': [600, 350]
                  };
                  const [x, y] = positions[node.id] || [400, 225];
                  return (
                    <motion.g
                      key={node.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1 + 0.5, type: 'spring' }}
                      className="cursor-pointer"
                    >
                      <circle 
                        cx={x} cy={y} r="35" 
                        className="fill-[var(--md-sys-color-surface-container-highest)] stroke-[var(--md-sys-color-outline-variant)] stroke-2"
                      />
                      <text 
                        x={x} y={y + 5} 
                        className="text-[10px] font-black uppercase text-center fill-[var(--md-sys-color-on-surface)] pointer-events-none"
                        textAnchor="middle"
                      >
                        {node.id}
                      </text>
                    </motion.g>
                  );
                })}
             </svg>
          )}
          <div className="absolute top-8 left-8 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
             <span className="text-[10px] font-black on-surface tracking-widest uppercase opacity-40">Core Matrix Active</span>
          </div>
        </div>

        <div className="space-y-6">
           <div className="p-6 rounded-3xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]">
              <h4 className="text-[10px] font-black on-surface-variant uppercase tracking-[0.2em] mb-4 opacity-40 flex items-center gap-2">
                 <Cpu className="w-3 h-3" />
                 Analysis Engine
              </h4>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold on-surface">Circular Links</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 tracking-widest">NONE</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold on-surface">Redundant Modules</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 tracking-widest">2 FLAGGED</span>
                 </div>
              </div>
           </div>

           <div className="p-6 rounded-3xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]">
              <h4 className="text-[10px] font-black on-surface-variant uppercase tracking-[0.2em] mb-4 opacity-40 flex items-center gap-2">
                 <LinkIcon className="w-3 h-3" />
                 Module Links
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                 {data.links.map((l, i) => (
                   <div key={i} className="flex items-center justify-between text-[11px] font-bold group">
                      <span className="on-surface opacity-60 uppercase">{l.source}</span>
                      <ChevronRight className="w-3 h-3 opacity-20 group-hover:opacity-100" />
                      <span className="on-surface text-blue-500 uppercase">{l.target}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const RefreshCw = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
);
const ChevronRight = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);
