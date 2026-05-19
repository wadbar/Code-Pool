// Bloco Unificado: GitHubSpider
// Finalidade: Explorar a API do GitHub buscando forks, projetos similares (por tópicos/linguagens) e tendências, alimentando a fome da piscina.

export class GitHubSpider {
    private personalAccessToken?: string;

    constructor(token?: string) {
        this.personalAccessToken = token;
    }

    /**
     * Busca os forks mais ativos de um repositório alvo.
     */
    async discoverForks(repoSlug: string, maxResults: number = 5): Promise<string[]> {
        console.log(`[SPIDER] Vasculhando forks de github.com/${repoSlug}...`);
        
        try {
            const response = await fetch(`https://api.github.com/repos/${repoSlug}/forks?sort=stargazers&per_page=${maxResults}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'LegoPool-Spider'
                }
            });

            if (!response.ok) {
                console.warn(`[SPIDER] Falha ao acessar API do GitHub: ${response.status}`);
                return [];
            }

            const data = await response.json() as any[];
            return data.map((fork: any) => fork.html_url);
        } catch (err) {
            console.error(`[SPIDER] Erro ao buscar forks:`, err);
            return [];
        }
    }

    /**
     * Busca projetos relacionados baseados nas tags e stack técnica (topics).
     */
    async discoverRelatedByTopics(topics: string[], maxResults: number = 3): Promise<string[]> {
        if (topics.length === 0) return [];
        console.log(`[SPIDER] Bisbilhotando repositórios com os tópicos: [${topics.join(', ')}]...`);
        
        try {
            const query = topics.map(t => `topic:${t}`).join(' ');
            const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxResults}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'LegoPool-Spider'
                }
            });

            if (!response.ok) {
                console.warn(`[SPIDER] Falha na busca por tópicos: ${response.status}`);
                return [];
            }

            const data = await response.json() as any;
            return (data.items || []).map((repo: any) => repo.html_url);
        } catch (err) {
            console.error(`[SPIDER] Erro na busca por tópicos:`, err);
            return [];
        }
    }
}
