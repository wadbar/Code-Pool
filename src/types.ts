export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
}

export interface TelemetryConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  serviceName: string;
}

export interface AuthContext {
  userId: string;
  roles: string[];
  permissions: string[];
  metadata: Record<string, any>;
}

export interface ChartPoint {
  time: string;
  accuracy: number;
  stability: number;
  coverage: number;
}

export interface ModuleHealth {
  score: number;
  maturity: 'EXPERIMENTAL' | 'STABLE' | 'INDUSTRIAL';
  stabilityIndex: number;
  lastAudit: string;
  findings: string[];
  timeline: ChartPoint[];
}

export interface LegoModule {
  id: string;
  version: string;
  name: string;
  type: string;
  size: string;
  category: string;
  executionMode: 'SYNC' | 'ASYNC' | 'WORKER' | 'DAEMON';
  health?: ModuleHealth;
  content?: string;
  interopMatrix?: InteropResult[];
  // UI State Properties (Extracted for optimization)
  loading?: boolean;
  error?: string | null;
  testing?: boolean;
  auditing?: boolean;
  powerizing?: boolean;
  interopLoading?: boolean;
}

export interface InteropResult {
  target_block: string;
  affinity: number;
  correlation: string;
  proximity: number;
  stability: number;
  similarity: number;
  fit_result: string;
}

export interface RuntimeState {
  isInitialized: boolean;
  activeThreads: number;
  memoryUsage: number;
  lastSync: string;
}
