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
    status?: string;
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

    private updateRegistry(updater: (registry: { repositories: WatchedRepository[] }) => void) {
        const lockPath = this.registryPath + '.lock';
        let retries = 0;
        while (retries < 1000) {
            try {
                fs.mkdirSync(lockPath);
                break;
            } catch (err: any) {
                if (err.code === 'EEXIST') {
                    try {
                        const stats = fs.statSync(lockPath);
                        if (Date.now() - stats.mtimeMs > 15000) {
                            fs.rmdirSync(lockPath); continue;
                        }
                    } catch (e) {}
                    const start = Date.now(); while (Date.now() - start < 20) {} // spin lock 20ms
                    retries++;
                } else throw err;
            }
        }

        try {
            const data = fs.readFileSync(this.registryPath, 'utf8');
            let parsed;
            try {
                parsed = JSON.parse(data);
            } catch (e) {
                parsed = { repositories: [] };
            }
            
            // Clean invalid urls automatically during update
            const originalLength = parsed.repositories.length;
            parsed.repositories = parsed.repositories.filter((repo: WatchedRepository) => 
                UpdateManager.isValidGitHubRepoUrl(repo.url)
            );
            if (parsed.repositories.length < originalLength) {
                console.log(`[UPDATE-MANAGER] Removendo ${originalLength - parsed.repositories.length} repositórios corrompidos.`);
            }

            updater(parsed);

            fs.writeFileSync(this.registryPath, JSON.stringify(parsed, null, 2));
        } finally {
            try { fs.rmdirSync(lockPath); } catch(e) {}
        }
    }

    private getRegistry(): { repositories: WatchedRepository[] } {
        try {
            const data = fs.readFileSync(this.registryPath, 'utf8');
            return JSON.parse(data);
        } catch {
            return { repositories: [] };
        }
    }

    public static isValidGitHubRepoUrl(url: string | null | undefined): boolean {
        if (!url || typeof url !== 'string') return false;
        const clean = url.replace(/\.git$/, '').replace(/\/$/, '');
        const parts = clean.split('github.com/')[1]?.split('/');
        if (!parts || parts.length < 2) return false;
        
        const user = parts[0].toLowerCase();
        const repo = parts[1].toLowerCase();
        
        const skipUsers = [
            'explore', 'trending', 'marketplace', 'features', 'topics', 'collections', 
            'events', 'settings', 'notifications', 'orgs', 'site', 'contact', 'about', 
            'security', 'pricing', 'blog', 'search', 'pulls', 'issues', 'privacy', 'terms',
            'solutions', 'resources', 'sponsors', 'apps', 'image', 'text', 'application', 
            'rank_only', 'countries', 'css', 'javascript', 'html', 'json', 'png', 'jpeg', 
            'gif', 'svg', 'assets', 'styles', 'scripts', 'dist', 'node_modules', 'public', 
            'build', 'temp', 'tmp',
            'organizations', 'business', 'enterprise', 'features', 'github', 'login', 'signup'
        ];
        
        if (skipUsers.includes(user)) return false;
        
        const skipRepos = [
            'css', 'javascript', 'html', 'json', 'png', 'jpeg', 'gif', 'svg', 'x-icon', 
            'plain', 'octet-stream', 'regions', 'errors', 'test-error', 'error', 'test', 'demo',
            'styles', 'scripts', 'assets'
        ];
        
        if (skipRepos.includes(repo)) return false;
        
        if (repo.includes('test-error') || repo === 'error' || repo.startsWith('website')) {
            return false;
        }
        
        return true;
    }

    private saveRegistry(data: { repositories: WatchedRepository[] }) {
        fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
    }

    /**
     * Adiciona um novo repositório à lista de monitoramento
     */
    addRepository(url: string) {
        if (!UpdateManager.isValidGitHubRepoUrl(url)) {
            console.log(`[UPDATE-MANAGER] Repositório rejeitado (verificação de integridade/ruído falhou): ${url}`);
            return false;
        }

        // Ignora o repositório da própria piscina para evitar loop/redução redundante
        const excludedRepos = [
            'https://github.com/wadbar/Code-Pool',
            'https://github.com/wadbar/Code-Pool.git'
        ];

        if (excludedRepos.includes(url.replace(/\/$/, ''))) {
            console.log(`[UPDATE-MANAGER] Ignorando repositório de infraestrutura (a própria pool): ${url}`);
            return false;
        }

        let added = false;
        this.updateRegistry((registry) => {
            if (!registry.repositories.find(repo => repo.url === url)) {
                registry.repositories.push({ url, lastSync: null });
                added = true;
                console.log(`[UPDATE-MANAGER] Novo repositório adicionado à vigilância: ${url}`);
            }
        });
        return added;
    }

    /**
     * Remove um repositório da lista de monitoramento
     */
    removeRepository(url: string) {
        let removed = false;
        this.updateRegistry((registry) => {
            const initialLength = registry.repositories.length;
            registry.repositories = registry.repositories.filter(repo => repo.url !== url);
            if (registry.repositories.length < initialLength) {
                removed = true;
                console.log(`[UPDATE-MANAGER] Repositório removido da vigilância: ${url}`);
            }
        });
        return removed;
    }

    /**
     * Lista todos os repositórios monitorados, opcionalmente filtrados por URL
     */
    listWatched(filter?: string) {
        const repos = this.getRegistry().repositories;
        if (filter) {
            return repos.filter(repo => repo.url.includes(filter));
        }
        return repos;
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
        
        // Cópia para iterar sem cair em loop infinito ao empurrar itens para o fim
        const reposToProcess = [...registry.repositories];

        for (const currentRepo of reposToProcess) {
            // Re-fetch registry index just in case
            const registryArr = this.getRegistry().repositories;
            let i = registryArr.findIndex(r => r.url === currentRepo.url);
            if (i === -1) continue;

            const repo = registryArr[i];

            // Check for pause/stop
            await this.waitIfPaused();
            const control = this.getControlStatus();
            if (control.status === 'stop_after_current') {
                console.log(`[UPDATE-MANAGER] Comando STOP_AFTER_CURRENT detectado. Encerrando ciclo prematuramente.`);
                break;
            }

            console.log(`[UPDATE-MANAGER] Verificando: ${repo.url}`);

            if (force || !repo.lastSync) {
                console.log(`[UPDATE-MANAGER] Atualizando repositório: ${repo.url}. Extraindo blocos de código...`);
                
                // Se falhou 5 vezes, vamos parar de tentar essa presa e marcar lastSync com erro
                if ((repo.retryCount || 0) >= 5) {
                    console.log(`[UPDATE-MANAGER] Presa indigesta demais (${repo.url}). Abortando após 5 tentativas.`);
                    this.updateRegistry(registry => {
                        let idx = registry.repositories.findIndex(r => r.url === repo.url);
                        if (idx !== -1) {
                            registry.repositories[idx].lastSync = new Date().toISOString();
                            registry.repositories[idx].status = "error";
                        }
                    });
                    continue;
                }

                // Ingestão autônoma de código
                const result = await RepoIngester.ingestFromGitHub(repo.url, repo.isMonster ? 180000 : 45000);
                
                // ATUALIZAÇÃO SEGURA E ATÔMICA DO REGISTRO
                this.updateRegistry(freshRegistry => {
                    let freshIndex = freshRegistry.repositories.findIndex(r => r.url === repo.url);
                    if (freshIndex !== -1) {
                        const freshRepo = freshRegistry.repositories[freshIndex];
                        if (result.status === "monster") {
                            console.log(`[UPDATE-MANAGER] REPO MONSTRO DETECTADO: ${repo.url}. Escalando prioridade e adiando para o próximo ciclo.`);
                            freshRepo.isMonster = true;
                            freshRepo.retryCount = (freshRepo.retryCount || 0) + 1;
                            
                            freshRegistry.repositories.splice(freshIndex, 1);
                            freshRegistry.repositories.push(freshRepo);
                        } else if (result.status === "partial") {
                            console.log(`[UPDATE-MANAGER] DIGESTÃO PARCIAL (${result.totalPending} restantes): ${repo.url}. Movendo para o fim da fila.`);
                            
                            freshRepo.digestedCount = (freshRepo.digestedCount || 0) + (result.filesProcessed || 0);
                            freshRepo.totalFiles = result.totalFiles;
                            
                            if (result.totalFiles && result.totalFiles > 600) {
                                freshRepo.isMonster = true;
                            } else if (result.totalFiles && result.totalFiles < 300) {
                                freshRepo.isMonster = false; 
                            } else if (result.filesProcessed === 0 && (freshRepo.retryCount || 0) > 3) {
                                freshRepo.isMonster = true; 
                            }
                            
                            if (result.totalFiles && result.totalFiles > 500) {
                                freshRepo.isMonster = true;
                            } else if (result.totalFiles && result.totalFiles <= 500) {
                                freshRepo.isMonster = false;
                            }
                            
                            freshRegistry.repositories.splice(freshIndex, 1);
                            freshRegistry.repositories.push(freshRepo);
                        } else if (result.status === "success") {
                            freshRepo.digestedCount = freshRepo.totalFiles || result.totalFiles;
                            freshRepo.lastSync = new Date().toISOString();
                            freshRepo.status = "synced";
                        }
                        
                        updatedCount++;
                    }
                });
            } else {
                console.log(`[UPDATE-MANAGER] Repositório já persistido no registro: ${repo.url}. (Use force=true para re-ingestão).`);
            }
        }

        // Final save
        console.log(`[UPDATE-MANAGER] Sincronização de ciclo concluída. ${updatedCount} repositórios atualizados.`);
        
        return {
            totalChecked: reposToProcess.length,
            updated: updatedCount,
            status: "Synced"
        };
    }
}
