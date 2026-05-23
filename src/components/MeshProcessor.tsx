import React, { useState, useEffect, useRef } from 'react';
import { Cpu, CpuIcon, Loader2, Play, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export const MeshProcessor: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize WebWorker
    workerRef.current = new Worker(new URL('../worker/meshProcessor.worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e) => {
      const { type, payload, telemetry } = e.data;
      if (type === 'MESH_PROCESSED') {
        setResult(payload);
        setTelemetry(telemetry);
        setIsProcessing(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleProcess = () => {
    if (!workerRef.current) return;
    setIsProcessing(true);
    workerRef.current.postMessage({
      type: 'PROCESS_MESH',
      data: {
        id: 'MESH-' + Math.random().toString(36).substr(2, 9),
        blocks: 1200,
        matrix: 'RETRO_FORGE_L5'
      }
    });
  };

  return (
    <div className="m3-card !bg-[var(--md-sys-color-surface-container-low)] !p-10 border border-[var(--md-sys-color-outline-variant)]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--md-sys-color-tertiary)] rounded-2xl text-white">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black on-surface tracking-tight">RetroForge MeshProcessor</h3>
            <p className="text-xs font-bold font-mono on-surface-variant opacity-60 uppercase tracking-widest">Off-Main-Thread Logic Accelerator</p>
          </div>
        </div>
        <button 
          onClick={handleProcess}
          disabled={isProcessing}
          className="m3-button !bg-[var(--md-sys-color-primary)] text-white flex items-center gap-2 group overflow-hidden relative"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          )}
          <span className="font-black uppercase text-xs">Execute Forge</span>
          {isProcessing && (
            <motion.div 
               layoutId="processing-shimmer"
               className="absolute inset-0 bg-white/20"
               animate={{ x: ['-100%', '100%'] }}
               transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]">
            <div className="text-[10px] uppercase font-black tracking-widest on-surface-variant opacity-40 mb-2">Worker Status</div>
            <div className="flex items-center gap-3">
               <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
               <span className="font-mono text-sm font-black on-surface">{isProcessing ? 'COMPUTING_MATRIX' : 'IO_WAIT_STATE'}</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]">
            <div className="text-[10px] uppercase font-black tracking-widest on-surface-variant opacity-40 mb-2">Telemetry</div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="on-surface-variant font-bold">Latency</span>
                <span className="on-surface font-black">{telemetry ? telemetry.duration.toFixed(2) + 'ms' : '0.00ms'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="on-surface-variant font-bold">Priority</span>
                <span className="on-surface font-black">HIGH_RELIABILITY</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/90 rounded-[2rem] p-8 font-mono text-[11px] text-emerald-400 overflow-hidden relative group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-40 transition-opacity">
              <Sparkles className="w-16 h-16" />
           </div>
           
           <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4 border-b border-emerald-400/20 pb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-black uppercase tracking-widest">FORGE_OUTPUT_STREAM</span>
              </div>
              
              <div className="flex-1 space-y-2">
                 {result ? (
                   <>
                     <div className="text-white/40">{'>'} MESH_ID: {result.id}</div>
                     <div className="text-white/40">{'>'} HASH: {result.computedHash}</div>
                     <div className="text-white font-black">{'>'} STATUS: {result.status}</div>
                     <div className="text-emerald-400 mt-4 animate-pulse">■ PROCESS_COMPLETE_HANDSHAKE_READY</div>
                   </>
                 ) : (
                   <div className="flex items-center justify-center h-full opacity-40">
                      NO_DATA_STREAM_CAPTURED
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
