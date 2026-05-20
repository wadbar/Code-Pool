// Bloco Unificado: HungryPoolEngine
// Finalidade: O sistema autônomo da piscina que investiga repositórios relacionados e forks dos repos que já estão na lista.
// Comportamento: "A Piscina que se alimenta de Open Code"

import { GitHubSpider } from '../SEARCH/GitHubSpider';
import { UpdateManager } from './UpdateManager';

export class HungryPoolEngine {
    private spider: GitHubSpider;
    private updateManager: UpdateManager;

    constructor(updateManager: UpdateManager) {
        this.spider = new GitHubSpider();
        this.updateManager = updateManager;
    }

    /**
     * Busca tópicos específicos no ecossistema GitHub e adiciona ao Registro.
     */
    async searchForTopics(topics: string[]) {
        console.log(`[HUNGRY-POOL] 🦈 Caçada por tópico: [${topics.join(', ')}]...`);
        const newTargets = await this.spider.discoverRelatedByTopics(topics, 10);
        
        let accepted = 0;
        for (const targetUrl of newTargets) {
            const added = this.updateManager.addRepository(targetUrl);
            if (added) accepted++;
        }

        console.log(`[HUNGRY-POOL] 🦈 Caçada por tópico concluída! ${accepted} novos alvos encontrados.`);
        return { hunted: accepted, newTargets };
    }

    /**
     * Caça todos os repositórios de um usuário e adiciona ao Registro.
     */
    async devourUser(username: string) {
        console.log(`[HUNGRY-POOL] 🦈 Devorando repositórios do usuário: ${username}...`);
        const userRepos = await this.spider.discoverUserRepos(username, 50);
        
        let accepted = 0;
        for (const targetUrl of userRepos) {
            const added = this.updateManager.addRepository(targetUrl);
            if (added) accepted++;
        }

        console.log(`[HUNGRY-POOL] 🦈 Devoração concluída para ${username}! ${accepted} novos alvos integrados.`);
        return { devoured: accepted, userRepos };
    }

    /**
     * Ciclo de Expansão Autônoma (Hunting)
     * Olha para a base atual e busca ativamente por variantes, forks e bibliotecas similares
     * para extração modular.
     */
    async huntForCode() {
        console.log(`[HUNGRY-POOL] 🦈 Acordando a Piscina Faminta... Iniciando caçada por open-code.`);
        
        const watched = this.updateManager.listWatched();
        let newTargets: string[] = [];
        
        // Escolhe alguns repos aleatoriamente para investigar forks e dependências
        const sampleSize = Math.min(3, watched.length);
        const targets = watched.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

        for (const repo of targets) {
            const slugMatch = repo.url.match(/github\.com\/([^\/]+\/[^\/]+)/);
            if (slugMatch && slugMatch[1]) {
                const slug = slugMatch[1];
                
                // Explora os forks
                const forks = await this.spider.discoverForks(slug);
                newTargets.push(...forks);
            }
        }
        
        // Adiciona novos repositórios descobertos ao Registro da Piscina
        let accepted = 0;
        for (const targetUrl of newTargets) {
            const added = this.updateManager.addRepository(targetUrl);
            if (added) accepted++;
        }

        console.log(`[HUNGRY-POOL] 🦈 Caçada concluída! ${accepted} novos alvos encontrados e adicionados ao cardápio.`);
        return {
            hunted: accepted,
            newTargets
        };
    }
}
