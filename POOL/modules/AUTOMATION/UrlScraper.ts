import { UpdateManager } from './UpdateManager';

export class UrlScraper {
    /**
     * Scarpes a given URL (webpage, article, markdown) for GitHub repository links 
     * and adds them to the ingestion pool.
     */
    static async scrapeAndQueueRepos(sourceUrl: string) {
        console.log(`[URL-SCRAPER] Buscando links de repositórios em: ${sourceUrl}`);
        
        try {
            // Se for um link de github direto, adiciona direto
            if (sourceUrl.includes('github.com')) {
                const match = sourceUrl.match(/https?:\/\/github\.com\/[^\s/"'#?]+/);
                if (match) {
                    const repoUrl = match[0];
                    const manager = new UpdateManager();
                    if (manager.addRepository(repoUrl)) {
                        console.log(`[URL-SCRAPER] Repositório único adicionado via URL: ${repoUrl}`);
                        return { status: "success", found: 1, url: repoUrl };
                    }
                    return { status: "success", found: 0, message: "Já estava na piscina." };
                }
            }

            const response = await fetch(sourceUrl);
            if (!response.ok) {
                 throw new Error(`HTTP ${response.status}`);
            }
            const text = await response.text();
            
            // Regex heurística para pegar repositórios github
            const githubRegex = /https?:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/g;
            const matches = text.match(githubRegex) || [];
            
            // Deduplica
            const uniqueRepos = [...new Set(matches.map(url => url.replace(/\.git$/, '')))];
            
            const manager = new UpdateManager();
            let addedCount = 0;
            
            for (const repoUrl of uniqueRepos) {
                const add = manager.addRepository(repoUrl);
                if (add) addedCount++;
            }
            
            console.log(`[URL-SCRAPER] Encontrados ${uniqueRepos.length} repositorios na página. Adicionados à fila de ingestão: ${addedCount}`);
            return {
                status: "success",
                found: uniqueRepos.length,
                added: addedCount
            };

        } catch (err: any) {
             console.error(`[URL-SCRAPER] Falha ao extrair links da URL ${sourceUrl}:`, err.message);
             return { status: "error", message: err.message };
        }
    }
}
