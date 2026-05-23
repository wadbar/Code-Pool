import React from 'react';
import { motion } from 'framer-motion';
import { 
  Play, Activity, Zap, RefreshCw, AlertTriangle, 
  CheckCircle2, X
} from 'lucide-react';
import { clsx } from 'clsx';

interface PanelProps {
  inspectingBlock: any;
  onClose: () => void;
  onRunTest: (category: string, file: string) => void;
  onAuditBlock: (category: string, file: string) => void;
  onPowerizeBlock: (category: string, file: string) => void;
  onCheckInterop: (category: string, file: string) => void;
}

export const Panel: React.FC<PanelProps> = ({
  inspectingBlock,
  onClose,
  onRunTest,
  onAuditBlock,
  onPowerizeBlock,
  onCheckInterop
}) => {
  if (!inspectingBlock) return null;

  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: 20 }}
      className="m3-card w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative p-0"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]">
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-mono text-xs font-bold ring-1 ring-inset ring-[var(--md-sys-color-outline)]">
            {inspectingBlock.category}
          </span>
          <div>
            <h2 className="text-lg font-bold on-surface tracking-tight leading-none mb-1">
              {inspectingBlock.file}
            </h2>
            <p className="text-xs on-surface-variant font-mono opacity-80">
              POOL/modules/{inspectingBlock.category}/{inspectingBlock.file}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => onRunTest(inspectingBlock.category, inspectingBlock.file)}
            disabled={inspectingBlock.testing}
            className="m3-button-tonal !px-4 !py-1.5 text-xs"
          >
            <Play className={clsx("w-3.5 h-3.5", inspectingBlock.testing && "animate-spin")} />
            {inspectingBlock.testing ? 'Testando...' : 'Teste de Pré-Voo'}
          </button>
          <button 
            onClick={() => onAuditBlock(inspectingBlock.category, inspectingBlock.file)}
            disabled={inspectingBlock.auditing}
            className="m3-button-tonal !px-4 !py-1.5 text-xs"
          >
            <Activity className={clsx("w-3.5 h-3.5", inspectingBlock.auditing && "animate-spin")} />
            Auditar Saúde
          </button>
          <button 
            onClick={onClose}
            className="p-3 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] transition-all"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Code Area */}
        <div className="flex-1 overflow-auto p-6 bg-[var(--md-sys-color-surface-container-highest)] custom-scrollbar relative min-h-[400px]">
          {inspectingBlock.loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--md-sys-color-on-surface-variant)] font-mono text-sm">
              <RefreshCw className="w-10 h-10 text-[var(--md-sys-color-primary)] animate-spin" />
              <span className="animate-pulse">Desmontando e indexando fatias procedimentais...</span>
            </div>
          ) : inspectingBlock.error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--md-sys-color-error)] font-mono text-sm p-8 text-center">
              <AlertTriangle className="w-12 h-12" />
              <p className="font-bold text-lg">Falha na verificação de integridade física</p>
              <p className="max-w-md on-surface-variant text-xs leading-relaxed">{inspectingBlock.error}</p>
            </div>
          ) : (
            <div className="font-mono text-[13px] on-surface leading-relaxed overflow-x-auto whitespace-pre select-text h-full">
              <div className="flex text-left">
                {/* Line Numbers */}
                <div className="text-[var(--md-sys-color-on-surface-variant)] opacity-40 text-right pr-6 select-none border-r border-[var(--md-sys-color-outline-variant)] mr-6 font-normal min-w-[40px]">
                  {inspectingBlock.content?.split('\n').map((_: string, index: number) => (
                    <div key={index}>{index + 1}</div>
                  ))}
                </div>
                {/* Code Content */}
                <pre className="font-mono leading-relaxed">
                  <code>
                    {inspectingBlock.content?.split('\n').map((line: string, idx: number) => (
                      <div key={idx} className="min-h-[1.5rem]">{line}</div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel: Auditor & Interop */}
        <div className="w-80 border-l border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] overflow-y-auto custom-scrollbar p-6 space-y-8">
          
          {/* Health Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold on-surface-variant uppercase tracking-widest">Auditoria de Saúde</h3>
              {inspectingBlock.health && (
                <span className={clsx(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full",
                  inspectingBlock.health.score > 80 ? 'bg-emerald-500/10 text-emerald-600' :
                  inspectingBlock.health.score > 50 ? 'bg-amber-500/10 text-amber-600' :
                  'bg-red-500/10 text-red-600'
                )}>
                  Score: {inspectingBlock.health.score}
                </span>
              )}
            </div>

            {!inspectingBlock.health ? (
              <div className="bg-[var(--md-sys-color-surface)] rounded-2xl p-4 border border-[var(--md-sys-color-outline-variant)] text-center shadow-sm">
                <p className="text-xs on-surface-variant italic mb-4">Nenhum dado de saúde disponível para este bloco.</p>
                <button 
                  onClick={() => onAuditBlock(inspectingBlock.category, inspectingBlock.file)}
                  className="text-xs text-[var(--md-sys-color-primary)] font-bold underline underline-offset-4"
                >
                  Disparar Auditoria agora
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-[var(--md-sys-color-surface)] p-3 rounded-xl border border-[var(--md-sys-color-outline-variant)]">
                     <span className="block text-[9px] on-surface-variant uppercase font-bold mb-1">Maturidade</span>
                     <span className="text-xs on-surface font-mono font-bold">{inspectingBlock.health.maturity}</span>
                   </div>
                   <div className="bg-[var(--md-sys-color-surface)] p-3 rounded-xl border border-[var(--md-sys-color-outline-variant)]">
                     <span className="block text-[9px] on-surface-variant uppercase font-bold mb-1">Estabilidade</span>
                     <span className="text-xs on-surface font-mono font-bold">{inspectingBlock.health.stability_index}%</span>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <h4 className="text-[10px] font-bold on-surface-variant uppercase">Riscos Encontrados</h4>
                   <div className="flex flex-wrap gap-2">
                     {inspectingBlock.health.findings?.map((f: string, i: number) => (
                       <span key={i} className="bg-[var(--md-sys-color-error)]/10 text-[var(--md-sys-color-error)] px-2.5 py-1 rounded-lg text-[10px] font-medium border border-[var(--md-sys-color-error)]/20">
                         {f}
                       </span>
                     ))}
                   </div>
                 </div>

                 <button 
                  onClick={() => onPowerizeBlock(inspectingBlock.category, inspectingBlock.file)}
                  disabled={inspectingBlock.powerizing}
                  className="m3-button-filled w-full font-bold shadow-none"
                 >
                   <Zap className={clsx("w-4 h-4", inspectingBlock.powerizing && "animate-pulse")} />
                   {inspectingBlock.powerizing ? 'Refinando...' : 'Powerize & Blindar'}
                 </button>
              </div>
            )}
          </div>

          <div className="h-px bg-[var(--md-sys-color-outline-variant)]" />

          {/* Sinergia LEGO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold on-surface-variant uppercase tracking-widest">Sinergia LEGO</h3>
              <button 
                onClick={() => onCheckInterop(inspectingBlock.category, inspectingBlock.file)}
                disabled={inspectingBlock.interopLoading}
                className="text-[11px] text-[var(--md-sys-color-primary)] font-bold hover:underline"
              >
                {inspectingBlock.interopLoading ? 'Analisando...' : 'Verificar'}
              </button>
            </div>

            {inspectingBlock.interopMatrix ? (
              <div className="space-y-3">
                {inspectingBlock.interopMatrix?.map((m: any, idx: number) => (
                  <div key={idx} className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="on-surface font-bold text-xs truncate max-w-[140px]">{m.target_block}</span>
                      <span className="text-[var(--md-sys-color-primary)] font-black text-xs font-mono">{m.affinity}% AFFINITY</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                       {['Correlation', 'Proximity', 'Stability', 'Similarity'].map((key) => (
                         <div key={key} className="bg-[var(--md-sys-color-surface-container)] p-2 rounded-lg">
                           <span className="block text-[8px] on-surface-variant uppercase font-bold">{key}</span>
                           <span className="text-[10px] on-surface font-semibold">{m[key.toLowerCase()] || '--'}</span>
                         </div>
                       ))}
                    </div>

                    <p className="text-[11px] on-surface-variant italic leading-snug border-l-2 border-[var(--md-sys-color-outline)] pl-3 py-1">
                       &quot;{m.fit_result}&quot;
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs on-surface-variant italic leading-relaxed">
                Execute a análise de sinergia para descobrir compatibilidade com outros módulos da Pool.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs on-surface-variant font-mono">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            V8 Optimized
          </span>
          <span className="w-1 h-1 rounded-full bg-[var(--md-sys-color-outline)]" />
          <span>
            {inspectingBlock.content ? `${inspectingBlock.content.length} bytes` : '0 bytes'}
          </span>
          <span className="w-1 h-1 rounded-full bg-[var(--md-sys-color-outline)]" />
          <span>
            {inspectingBlock.content?.split('\n').length || 0} lines
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="m3-button-tonal !px-8"
          >
            Fechar
          </button>
          {!inspectingBlock.loading && !inspectingBlock.error && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(inspectingBlock.content || '');
              }}
              className="m3-button-filled !px-8 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              Copiar Código
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
