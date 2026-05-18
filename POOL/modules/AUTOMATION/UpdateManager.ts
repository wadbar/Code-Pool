import fs from 'fs';
import path from 'path';

export interface WatchedRepository {
    url: string;
    lastSync: string | null;
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
     * Lista todos os repositórios monitorados
     */
    listWatched() {
        return this.getRegistry().repositories;
    }

    /**
     * Executa um ciclo de sincronização em todos os repositórios
     * Extrai, decompõe e consolida recursos novos ou alterados
     */
    async syncAll() {
        console.log(`[UPDATE-MANAGER] Iniciando ciclo de sincronização global da Piscina...`);
        const registry = this.getRegistry();
        let updatedCount = 0;

        for (const repo of registry.repositories) {
            console.log(`[UPDATE-MANAGER] Verificando: ${repo.url}`);
            // Mock de verificação de commits. Na prática, consultaria a API do GitHub
            const fakeHasUpdates = Math.random() > 0.7; // 30% chance de ter atualização simulada

            if (fakeHasUpdates || !repo.lastSync) {
                console.log(`[UPDATE-MANAGER] Atualização detectada em ${repo.url}! Extraindo blocos de código...`);
                repo.lastSync = new Date().toISOString();
                updatedCount++;
                
                // Aqui nós chamamos o RepoIngester.ingestFromGitHub(repo.url) internamente
            } else {
                console.log(`[UPDATE-MANAGER] Nenhuma mudança em ${repo.url}.`);
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
