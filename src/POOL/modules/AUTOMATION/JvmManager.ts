import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { configHarvester, ServerConfig } from '../INFRA/ConfigurationHarvester';

const execAsync = promisify(exec);

/**
 * JvmManager - Automation Module
 * Purpose: Orchestrates system-level Java process optimization in Linux/WSL2 environments.
 * Utilizes ps for identification and renice for priority harvesting.
 */
export interface JvmProcess {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  startTime: string;
  command: string;
}

export interface OptimizationScanResult {
  timestamp: string;
  processesIdentified: number;
  actionsTaken: string[];
  report: JvmProcess[];
}

export class JvmManager {
  private static instance: JvmManager;

  private constructor() {}

  public static getInstance(): JvmManager {
    if (!JvmManager.instance) {
      JvmManager.instance = new JvmManager();
    }
    return JvmManager.instance;
  }

  /**
   * Scans the operating system for active Java processes and applies resource prioritization.
   */
  public async optimizeRunningDaemons(): Promise<OptimizationScanResult> {
    const actionsTaken: string[] = [];
    const scanTime = new Date().toISOString();

    try {
      const processes = await this.listJavaProcesses();
      
      for (const proc of processes) {
        // High-affinity renice for performance daemons
        if (proc.cpu > 10 || proc.mem > 5) {
          await this.adjustProcessPriority(proc.pid, -10); // Elevated priority
          actionsTaken.push(`Priority elevated for PID ${proc.pid} (High Resource Usage)`);
        } else {
          await this.adjustProcessPriority(proc.pid, 5); // Background priority
          actionsTaken.push(`Priority normalized for PID ${proc.pid}`);
        }
      }

      return {
        timestamp: scanTime,
        processesIdentified: processes.length,
        actionsTaken,
        report: processes
      };
    } catch (error: any) {
      console.error('[JvmManager] Optimization sequence failed:', error.message);
      throw new Error(`JVM_OPTIMIZATION_ABORT: ${error.message}`);
    }
  }

  /**
   * Generates a fully optimized startup command string based on ConfigurationHarvester trajectories.
   */
  public generateOptimizedStartupCommand(jarPath: string, memoryGb: number): string {
    const config: ServerConfig = configHarvester.getJavaServerConfig(memoryGb);
    const jarName = path.basename(jarPath);
    
    const args = [
      'java',
      `-Xms${config.maxMemory}`,
      `-Xmx${config.maxMemory}`,
      ...config.jvmArgs,
      '-jar',
      jarName
    ];

    return args.join(' ');
  }

  /**
   * Internal logic: Parses 'ps' output to map Java process topology.
   */
  private async listJavaProcesses(): Promise<JvmProcess[]> {
    try {
      // Standard ps call with headers: user, pid, %cpu, %mem, start, command
      const { stdout } = await execAsync("ps -eo user,pid,pcpu,pmem,start,comm --sort=-pcpu | grep 'java' | grep -v 'grep'");
      
      return stdout.trim().split('\n').filter(line => line.length > 0).map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          pid: parseInt(parts[1], 10),
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          startTime: parts[4],
          command: parts.slice(5).join(' ')
        };
      });
    } catch (error: any) {
      if (error.code === 1) return []; // Grep found nothing
      throw error;
    }
  }

  /**
   * Internal logic: Executes 'renice' to modify process priority levels.
   * Requires sudo or appropriate capabilities in native Linux environments.
   */
  private async adjustProcessPriority(pid: number, priority: number): Promise<void> {
    try {
      // Priority range in Linux: -20 (highest) to 19 (lowest)
      const validPriority = Math.max(-20, Math.min(19, priority));
      await execAsync(`renice -n ${validPriority} -p ${pid}`);
    } catch (error: any) {
      console.warn(`[JvmManager] Priority adjustment failed for PID ${pid}: ${error.message}`);
    }
  }
}

export const jvmManager = JvmManager.getInstance();
