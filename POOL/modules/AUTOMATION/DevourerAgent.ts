import fs from 'fs';
import path from 'path';

export interface DevourTask {
    repoUrl: string;
    targetModule: string; // e.g., 'AUTH', 'AI', 'DB'
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'processing' | 'devoured' | 'failed';
}

/**
 * Agente Devourer: Responsável por identificar partes suculentas de repositórios,
 * extrair blocos lógicos e encaminhá-los para o registro final.
 */
export class DevourerAgent {
    private queuePath: string;

    constructor() {
        this.queuePath = path.join(process.cwd(), 'POOL', 'devourer-queue.json');
        this.initQueue();
    }

    private initQueue() {
        if (!fs.existsSync(this.queuePath)) {
            fs.writeFileSync(this.queuePath, JSON.stringify([], null, 2));
        }
    }

    private getQueue(): DevourTask[] {
        try {
            return JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
        } catch (e) {
            return [];
        }
    }

    private saveQueue(queue: DevourTask[]) {
        fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
    }

    public addTask(task: DevourTask) {
        const queue = this.getQueue();
        queue.push({ ...task, status: 'pending' });
        this.saveQueue(queue);
        console.log(`[DEVOURER] Nova tarefa adicionada: ${task.repoUrl} (${task.targetModule})`);
    }

    /**
     * Processa a fila de tarefas identificando e extraindo os blocos "suculentos".
     */
    public async processQueue() {
        const queue = this.getQueue();
        const pendingTasks = queue.filter(t => t.status === 'pending');

        if (pendingTasks.length === 0) return;

        console.log(`[DEVOURER] Iniciando devoração de ${pendingTasks.length} tarefas...`);

        for (const task of pendingTasks) {
            task.status = 'processing';
            this.saveQueue(queue);

            try {
                const { RepoIngester } = await import('./RepoIngester');
                console.log(`[DEVOURER] Analisando e extraindo partes suculentas reais de: ${task.repoUrl}`);
                
                const result = await RepoIngester.ingestFromGitHub(task.repoUrl);
                
                if (result.status === 'success' || result.status === 'partial') {
                    task.status = 'devoured';
                } else {
                    task.status = 'failed';
                }
            } catch (error) {
                console.error(`[DEVOURER] Erro ao devorar ${task.repoUrl}:`, error);
                task.status = 'failed';
            } finally {
                this.saveQueue(queue);
            }
        }
    }
}
