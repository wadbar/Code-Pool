import fs from 'fs';
import path from 'path';
import { RepoIngester } from './RepoIngester';

export interface WatchedRepository {
    url: string;
    lastSync: string | null;
    isMonster?: boolean;
    retryCount?: number;
    digestedCount?: number;
    totalFiles?: number;
}

export class UpdateManager {
    private registryPath: string;

    constructor() {
        this.registryPath = path.join(process.cwd(), 'POOL', 'pool-registry.json');
        this.ensureRegistryExists();
    }

    private ensureRegistryExists() {
        if (!fs.existsSync(this.registryPath)) {
            fs.writeFileSync(this.registryPath, JSON.stringify({ repositories: [] }, null, 2));
        }
    }

    private getRegistry(): { repositories: WatchedRepository[] } {
        const data = fs.readFileSync(this.registryPath, 'utf8');
        return JSON.parse(data);
    }

    private saveRegistry(data: { repositories: WatchedRepository[] }) {
        fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
    }

    /**
     * Adiciona um novo repositório à lista de monitoramento
     */
    addRepository(url: string) {
        // Ignora o repositório da própria piscina para evitar loop/redução redundante
        const excludedRepos = [
            'https://github.com/wadbar/Code-Pool',
            'https://github.com/wadbar/Code-Pool.git'
        ];

        if (excludedRepos.includes(url.replace(/\/$/, ''))) {
            console.log(`[UPDATE-MANAGER] Ignorando repositório de infraestrutura (a própria pool): ${url}`);
            return false;
        }

        const registry = this.getRegistry();
        if (!registry.repositories.find(repo => repo.url === url)) {
            registry.repositories.push({ url, lastSync: null });
            this.saveRegistry(registry);
            console.log(`[UPDATE-MANAGER] Novo repositório adicionado à vigilância: ${url}`);
            return true;
        }
        return false;
    }

    /**
     * Remove um repositório da lista de monitoramento
     */
    removeRepository(url: string) {
        const registry = this.getRegistry();
        const initialLength = registry.repositories.length;
        registry.repositories = registry.repositories.filter(repo => repo.url !== url);
        
        if (registry.repositories.length < initialLength) {
            this.saveRegistry(registry);
            console.log(`[UPDATE-MANAGER] Repositório removido da vigilância: ${url}`);
            return true;
        }
        return false;
    }

    /**
     * Lista todos os repositórios monitorados
     */
    listWatched() {
        return this.getRegistry().repositories;
    }

    public static getControlStatus(): { status: 'running' | 'paused' | 'stop_after_current' } {
        const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
        if (!fs.existsSync(controlPath)) {
            try {
                if (!fs.existsSync(path.join(process.cwd(), 'POOL'))) {
                    fs.mkdirSync(path.join(process.cwd(), 'POOL'), { recursive: true });
                }
                fs.writeFileSync(controlPath, JSON.stringify({ status: 'running' }));
            } catch (e) {}
            return { status: 'running' };
        }
        try {
            return JSON.parse(fs.readFileSync(controlPath, 'utf8'));
        } catch (e) {
            return { status: 'running' };
        }
    }

    public static async waitIfPaused() {
        while (this.getControlStatus().status === 'paused') {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s
        }
    }

    private getControlStatus() {
        return UpdateManager.getControlStatus();
    }

    private async waitIfPaused() {
        return UpdateManager.waitIfPaused();
    }

    /**
     * Executa um ciclo de sincronização em todos os repositórios
     * Extrai, decompõe e consolida recursos novos ou alterados
     */
    async syncAll(force: boolean = false) {
        console.log(`[UPDATE-MANAGER] Iniciando ciclo de sincronização global da Piscina...`);
        const registry = this.getRegistry();
        let updatedCount = 0;

        for (let i = 0; i < registry.repositories.length; i++) {
            // Check for pause/stop
            await this.waitIfPaused();
            const control = this.getControlStatus();
            if (control.status === 'stop_after_current') {
                console.log(`[UPDATE-MANAGER] Comando STOP_AFTER_CURRENT detectado. Encerrando ciclo prematuramente.`);
                break;
            }

            const repo = registry.repositories[i];
            console.log(`[UPDATE-MANAGER] Verificando: ${repo.url}`);

            if (force || !repo.lastSync) {
                console.log(`[UPDATE-MANAGER] Atualização real do repositório: ${repo.url}. Extraindo blocos de código...`);
                
                // Ingestão autônoma e real
                const result = await RepoIngester.ingestFromGitHub(repo.url, repo.isMonster ? 180000 : 45000);
                
                if (result.status === "monster") {
                    console.log(`[UPDATE-MANAGER] REPO MONSTRO DETECTADO: ${repo.url}. Escalando prioridade e movendo para o fim da fila.`);
                    repo.isMonster = true;
                    repo.retryCount = (repo.retryCount || 0) + 1;
                    
                    registry.repositories.splice(i, 1);
                    registry.repositories.push(repo);
                    i--;
                    this.saveRegistry(registry);
                    continue;
                }

                if (result.status === "partial") {
                    console.log(`[UPDATE-MANAGER] DIGESTÃO PARCIAL (${result.totalPending} restantes): ${repo.url}. Movendo para o fim da fila para continuar.`);
                    
                    repo.digestedCount = (repo.digestedCount || 0) + (result.filesProcessed || 0);
                    repo.totalFiles = result.totalFiles;
                    repo.isMonster = true; // Se é parcial, tratamos como monstro/grande
                    
                    // Move pro fim para não trancar a fila, mas NÃO marca lastSync final
                    registry.repositories.splice(i, 1);
                    registry.repositories.push(repo);
                    i--;
                    this.saveRegistry(registry);
                    continue;
                }

                if (result.status === "success") {
                    repo.digestedCount = repo.totalFiles || result.totalFiles;
                    repo.lastSync = new Date().toISOString();
                }
                
                updatedCount++;
                this.saveRegistry(registry);
            } else {
                console.log(`[UPDATE-MANAGER] Repositório já persistido no registro: ${repo.url}. (Use force=true para re-ingestão).`);
            }
        }

        this.saveRegistry(registry);
        console.log(`[UPDATE-MANAGER] Sincronização concluída. ${updatedCount} repositórios atualizados.`);
        
        return {
            totalChecked: registry.repositories.length,
            updated: updatedCount,
            status: "Synced"
        };
    }
}
