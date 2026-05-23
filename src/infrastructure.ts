import { LogLevel } from './types';
import { logger } from './telemetry';

export class InfrastructureEngine {
  private static instance: InfrastructureEngine;
  private isShuttingDown: boolean = false;
  private cleanupStack: Array<() => Promise<void>> = [];

  private constructor() {
    this.initLifecycleOrchestrator();
  }

  public static getInstance(): InfrastructureEngine {
    if (!InfrastructureEngine.instance) {
      InfrastructureEngine.instance = new InfrastructureEngine();
    }
    return InfrastructureEngine.instance;
  }

  private initLifecycleOrchestrator() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', (e) => {
        // Trigger non-blocking shutdown
        this.shutdown();
      });
    }

    // Capture standard process signals if running in Node mode (via WSL2/Debian)
    if (typeof process !== 'undefined' && typeof process.on === 'function') {
      process.on('SIGINT', () => this.handleProcessSignal('SIGINT'));
      process.on('SIGTERM', () => this.handleProcessSignal('SIGTERM'));
    }
  }

  private async handleProcessSignal(signal: string) {
    logger.log(LogLevel.WARN, 'INFRA', `Received ${signal}. Initiating emergency teardown.`);
    await this.shutdown();
    if (typeof process !== 'undefined' && typeof process.exit === 'function') process.exit(0);
  }

  /**
   * Registers an atomic cleanup task to the LIFO stack
   */
  public registerResourceCleanup(cleanup: () => Promise<void>) {
    this.cleanupStack.push(cleanup);
    logger.log(LogLevel.DEBUG, 'INFRA', 'Resource cleanup task registered in stack.');
  }

  /**
   * Graceful Shutdown Orchestration (LIFO)
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.log(LogLevel.WARN, 'INFRA', 'GRACEFUL_SHUTDOWN: Beginning resource deallocation sequence.');

    while (this.cleanupStack.length > 0) {
      const task = this.cleanupStack.pop();
      if (task) {
        try {
          await task();
        } catch (error: any) {
          logger.log(LogLevel.ERROR, 'INFRA', 'DEALLOCATION_FAILURE: Step in shutdown chain failed.', { 
            error: error.message,
            stack: error.stack 
          });
        }
      }
    }

    logger.log(LogLevel.INFO, 'INFRA', 'SHUTDOWN_COMPLETE: Ecosystem reached ground state.');
  }

  /**
   * Exponential Backoff Wrapper with Jitter
   */
  public async resilientExecute<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxAttempts) break;

        const jitter = Math.random() * 200;
        const delay = (initialDelay * Math.pow(2, attempt - 1)) + jitter;

        logger.log(LogLevel.WARN, 'INFRA', `ADAPTIVE_RETRY: Attempt ${attempt} failed. Backoff: ${Math.round(delay)}ms`, { 
          error: error.message 
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.log(LogLevel.CRITICAL, 'INFRA', 'ADAPTIVE_FAILURE: Max retry threshold reached.', { lastError: lastError?.message });
    throw lastError;
  }
}

export const infra = InfrastructureEngine.getInstance();
