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

    private getRegistry(): { repositories: WatchedRepository[] } {
        const data = fs.readFileSync(this.registryPath, 'utf8');
        const parsed = JSON.parse(data);
        const originalLength = parsed.repositories.length;
        parsed.repositories = parsed.repositories.filter((repo: WatchedRepository) => 
            UpdateManager.isValidGitHubRepoUrl(repo.url)
        );
        if (parsed.repositories.length < originalLength) {
            console.log(`[UPDATE-MANAGER] Removendo ${originalLength - parsed.repositories.length} repositórios inválidos/ruído do registro.`);
            this.saveRegistry(parsed);
        }
        return parsed;
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
            'build', 'temp', 'tmp'
        ];
        
        if (skipUsers.includes(user)) return false;
        
        const skipRepos = [
            'css', 'javascript', 'html', 'json', 'png', 'jpeg', 'gif', 'svg', 'x-icon', 
            'plain', 'octet-stream', 'regions', 'errors', 'test-error', 'error', 'test', 'demo',
            'styles', 'scripts', 'assets'
        ];
        
        if (skipRepos.includes(repo)) return false;
        
        if (repo.includes('test-error') || repo === 'error') {
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
                console.log(`[UPDATE-MANAGER] Atualização real do repositório: ${repo.url}. Extraindo blocos de código...`);
                
                // Se falhou 5 vezes, vamos parar de tentar essa presa e marcar lastSync com erro
                if ((repo.retryCount || 0) >= 5) {
                    console.log(`[UPDATE-MANAGER] Presa indigesta demais (${repo.url}). Abortando após 5 tentativas.`);
                    repo.lastSync = new Date().toISOString();
                    repo.status = "error";
                    registryArr[i] = repo;
                    this.saveRegistry({ repositories: registryArr });
                    continue;
                }

                // Ingestão autônoma e real
                const result = await RepoIngester.ingestFromGitHub(repo.url, repo.isMonster ? 180000 : 45000);
                
                if (result.status === "monster") {
                    console.log(`[UPDATE-MANAGER] REPO MONSTRO DETECTADO: ${repo.url}. Escalando prioridade e adiando para o próximo ciclo.`);
                    repo.isMonster = true;
                    repo.retryCount = (repo.retryCount || 0) + 1;
                    
                    // Joga pro final pra não bloquear, mas NÃO processar nesta mesma passada (o reposToProcess previne o loop)
                    registryArr.splice(i, 1);
                    registryArr.push(repo);
                    this.saveRegistry({ repositories: registryArr });
                    continue;
                }

                if (result.status === "partial") {
                    console.log(`[UPDATE-MANAGER] DIGESTÃO PARCIAL (${result.totalPending} restantes): ${repo.url}. Movendo para o fim da fila.`);
                    
                    repo.digestedCount = (repo.digestedCount || 0) + (result.filesProcessed || 0);
                    repo.totalFiles = result.totalFiles;
                    
                    // Somente é MONSTRO se tiver volume massivo REAL (> 600 arquivos elite)
                    if (result.totalFiles && result.totalFiles > 600) {
                        repo.isMonster = true;
                    } else if (result.totalFiles && result.totalFiles < 300) {
                        repo.isMonster = false; // Corrigindo injustiça: se é pequeno, não é monstro.
                    } else if (result.filesProcessed === 0 && (repo.retryCount || 0) > 3) {
                        // Se falhou repetidamente sem processar NADA, talvez precise de estômago reforçado
                        repo.isMonster = true; 
                    }
                    
                    if (result.totalFiles && result.totalFiles > 500) {
                        repo.isMonster = true;
                    } else if (result.totalFiles && result.totalFiles <= 500) {
                        // Se é pequeno mas deu timeout, tentamos de novo sem rotular como monstro pesado
                        repo.isMonster = false;
                    }
                    
                    // Move pro fim para não trancar a fila e tenta de novo no próximo ciclo de sync
                    registryArr.splice(i, 1);
                    registryArr.push(repo);
                    this.saveRegistry({ repositories: registryArr });
                    continue;
                }

                if (result.status === "success") {
                    repo.digestedCount = repo.totalFiles || result.totalFiles;
                    repo.lastSync = new Date().toISOString();
                    repo.status = "synced";
                    registryArr[i] = repo;
                }
                
                updatedCount++;
                this.saveRegistry({ repositories: registryArr });
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
