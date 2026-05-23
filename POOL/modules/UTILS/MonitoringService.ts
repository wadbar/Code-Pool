import os from 'os';
import { logSystem } from '../../../server/utils/logger';

export class MonitoringService {
    private static thresholds = {
        cpu: 85,
        memory: 85
    };

    private static violations = {
        cpu: 0,
        memory: 0
    };

    private static checkInterval: NodeJS.Timeout | null = null;

    /**
     * Inicia o monitoramento de recursos do sistema.
     * @param intervalMs Intervalo de checagem.
     */
    static startMonitoring(intervalMs: number = 60000) {
        if (this.checkInterval) return;

        console.log(`[MONITORING] Iniciando serviço de monitoramento de limites (${intervalMs}ms)...`);
        
        this.checkInterval = setInterval(() => {
            this.checkResources();
        }, intervalMs);
    }

    private static checkResources() {
        try {
            const cpus = os.cpus();
            const loadavg = os.loadavg()[0];
            const cpuUsage = (loadavg / cpus.length) * 100;

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memUsage = ((totalMem - freeMem) / totalMem) * 100;

            // Monitoramento de CPU
            if (cpuUsage > this.thresholds.cpu) {
                this.violations.cpu++;
                if (this.violations.cpu >= 5) { // 5 minutos se o intervalo for 60s
                    this.triggerNotification('CPU', cpuUsage);
                    this.violations.cpu = 0; // Reset para evitar spam se persistir
                }
            } else {
                this.violations.cpu = 0;
            }

            // Monitoramento de Memória
            if (memUsage > this.thresholds.memory) {
                this.violations.memory++;
                if (this.violations.memory >= 5) {
                    this.triggerNotification('MEMÓRIA', memUsage);
                    this.violations.memory = 0;
                }
            } else {
                this.violations.memory = 0;
            }

        } catch (err: any) {
            console.error(`[MONITORING] Erro ao checar recursos:`, err.message);
        }
    }

    private static triggerNotification(type: 'CPU' | 'MEMÓRIA', value: number) {
        const msg = `[ALERTA CRÍTICO] Uso de ${type} excedeu ${this.thresholds[type === 'CPU' ? 'cpu' : 'memory']}% por mais de 5 minutos (${value.toFixed(2)}%).`;
        console.warn(msg);
        logSystem(msg);
        // Aqui poderíamos emitir um evento via Socket.io se estivéssemos integrados, ou salvar um log especial.
    }

    static stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}
