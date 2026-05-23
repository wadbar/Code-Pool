import { LogEntry, LogLevel, TelemetryConfig } from './types';

export class TelemetryEngine {
  private static instance: TelemetryEngine;
  private config: TelemetryConfig;
  private buffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  private constructor(config: TelemetryConfig) {
    this.config = config;
    this.initGlobalHandlers();
  }

  public static getInstance(config?: TelemetryConfig): TelemetryEngine {
    if (!TelemetryEngine.instance) {
      TelemetryEngine.instance = new TelemetryEngine(config || {
        minLevel: LogLevel.DEBUG,
        enableConsole: true,
        serviceName: 'LegoPoolEngine'
      });
    }
    return TelemetryEngine.instance;
  }

  private initGlobalHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.log(LogLevel.CRITICAL, 'UNHANDLED_REJECTION', event.reason?.message || 'Unknown rejection', { 
          reason: event.reason instanceof Error ? event.reason.stack : event.reason 
        });
      });

      window.addEventListener('error', (event) => {
        this.log(LogLevel.CRITICAL, 'UNCAUGHT_EXCEPTION', event.message, { 
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error?.stack 
        });
      });
    }
  }

  public log(level: LogLevel, context: string, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      metadata,
      traceId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : this.generateSafeId()
    };

    this.pushToBuffer(entry);

    if (this.config.enableConsole) {
      this.flushToConsole(entry);
    }
  }

  private generateSafeId(): string {
    const array = new Uint32Array(4);
    if (typeof crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(array);
    }
    return Array.from(array).map(b => b.toString(16).padStart(8, '0')).join('-');
  }

  private pushToBuffer(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  private flushToConsole(entry: LogEntry) {
    const color = this.getLevelColor(entry.level);
    const styles = [
      `color: #ffffff; background: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;`,
      `color: ${color}; font-weight: 900;`,
      'color: inherit; font-weight: 500;'
    ];

    console.groupCollapsed(
      `%c${entry.level}%c [${entry.context}] %c${entry.message}`,
      styles[0], styles[1], styles[2]
    );
    console.log('Timestamp:', entry.timestamp);
    console.log('Trace ID:', entry.traceId);
    if (entry.metadata) {
      console.log('Metadata:', entry.metadata);
    }
    console.groupEnd();
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '#6B7280';
      case LogLevel.INFO: return '#3B82F6';
      case LogLevel.WARN: return '#F59E0B';
      case LogLevel.ERROR: return '#EF4444';
      case LogLevel.CRITICAL: return '#7F1D1D';
      default: return '#000000';
    }
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.buffer];
  }

  public clearBuffer() {
    this.buffer = [];
  }
}

export const logger = TelemetryEngine.getInstance();
