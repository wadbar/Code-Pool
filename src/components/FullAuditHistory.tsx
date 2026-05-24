import React, { useState, useEffect } from 'react';
import { History, FileText, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuditReport {
  timestamp: string;
  id: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE';
  score: number;
  summary: string;
}

export const FullAuditHistory: React.FC = () => {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/audit-history');
        if (response.ok) {
          const data = await response.json();
          setReports(data.slice(0, 10)); // Top 10
        }
      } catch (err) {
        console.error('Audit history fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="m3-card !bg-[var(--md-sys-color-surface-container-low)] !p-8 border border-[var(--md-sys-color-outline-variant)] shadow-xl mt-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-[var(--md-sys-color-secondary)] rounded-2xl text-white">
          <History className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-black on-surface tracking-tighter">Audit Chronology</h3>
          <p className="text-[10px] font-black on-surface-variant uppercase tracking-widest opacity-40">Last 10 System Scans</p>
        </div>
      </div>

      <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[var(--md-sys-color-outline-variant)] before:opacity-30">
        <AnimatePresence>
          {loading ? (
            <div className="text-sm font-bold on-surface-variant animate-pulse">Scanning Archive...</div>
          ) : reports.length === 0 ? (
            <div className="text-sm font-bold on-surface-variant opacity-40 italic">No historical data recorded.</div>
          ) : (
            reports.map((report, idx) => (
              <motion.div 
                key={report.id || idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative group"
              >
                <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 border-[var(--md-sys-color-surface-container-low)] shadow-sm z-10 ${
                  report.status === 'SUCCESS' ? 'bg-emerald-500' : 
                  report.status === 'WARNING' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                
                <div className="flex items-start justify-between gap-6 p-5 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] transition-all cursor-default group-hover:scale-[1.01]">
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3 h-3 on-surface-variant opacity-40" />
                        <span className="text-[10px] font-black on-surface-variant opacity-60 tabular-nums">
                          {new Date(report.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold on-surface mb-1 flex items-center gap-2">
                        {report.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
                        {report.summary || 'Standard System Audit'}
                      </h4>
                      <p className="text-[11px] on-surface-variant opacity-50 font-medium">Report ID: <span className="font-mono">{report.id.slice(0, 8)}...</span></p>
                   </div>
                   <div className="text-right">
                      <span className="text-lg font-black on-surface">{report.score}%</span>
                      <div className="w-16 h-1 bg-[var(--md-sys-color-outline-variant)] rounded-full mt-1 overflow-hidden">
                        <div 
                          className={`h-full ${report.score > 80 ? 'bg-emerald-500' : report.score > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${report.score}%` }}
                        />
                      </div>
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
