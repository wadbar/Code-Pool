// Bloco Unificado: GitHubSpider
// Finalidade: Explorar a API do GitHub com robustez industrial (rate-limit handling, typing, retry logic).
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface GitHubRepo {
    id: number;
    html_url: string;
    stargazers_count: number;
}

export class GitHubSpider {
    private client: AxiosInstance;

    constructor(token?: string) {
        this.client = axios.create({
            baseURL: 'https://api.github.com',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'LegoPool-IndustrialSpider',
                ...(token ? { 'Authorization': `token ${token}` } : {})
            }
        });

        // Interceptor para Rate Limiting
        this.client.interceptors.response.use(
            (response) => {
                const remaining = response.headers['x-ratelimit-remaining'];
                if (remaining && parseInt(remaining) < 10) {
                    console.warn(`[SPIDER] ATENÇÃO: Rate limit baixo no GitHub: ${remaining} requisições restantes.`);
                }
                return response;
            },
            async (error: AxiosError) => {
                if (error.response?.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                    const resetTime = parseInt(error.response.headers['x-ratelimit-reset'] || '0') * 1000;
                    const delay = Math.max(resetTime - Date.now(), 0) + 1000;
                    console.error(`[SPIDER] Rate limit atingido. Aguardando até ${new Date(resetTime).toLocaleTimeString()} (${delay}ms)...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.client.request(error.config!);
                }
                return Promise.reject(error);
            }
        );
    }

    private async fetchWithRetry<T>(url: string, params?: any, retries: number = 3): Promise<T> {
        try {
            const { data } = await this.client.get<T>(url, { params });
            return data;
        } catch (err: any) {
            if (retries > 0) {
                const remaining = err.response?.headers?.['x-ratelimit-remaining'];
                const reset = err.response?.headers?.['x-ratelimit-reset'];

                if (err.response?.status === 403 && remaining === '0' && reset) {
                    const resetTime = parseInt(reset, 10) * 1000;
                    const delay = Math.max(resetTime - Date.now(), 0) + 1000;
                    console.warn(`[SPIDER] Rate limit excedido para ${url}. Aguardando reset em ${delay}ms... (${retries} tentativas restantes)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.fetchWithRetry<T>(url, params, retries - 1);
                } else if (err.response?.status >= 500) {
                    let delay = Math.pow(2, 3 - retries) * 1000;
                    console.warn(`[SPIDER] Erro ${err.response.status} ao acessar ${url}. Tentando em ${delay}ms... (${retries} tentativas restantes)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.fetchWithRetry<T>(url, params, retries - 1);
                }
            }
            throw err;
        }
    }

    /**
     * Busca os forks mais ativos de um repositório alvo com tratamento de erros robusto.
     */
    async discoverForks(repoSlug: string, maxResults: number = 5): Promise<string[]> {
        console.log(`[SPIDER] Vasculhando forks de github.com/${repoSlug}...`);
        
        try {
            const data = await this.fetchWithRetry<GitHubRepo[]>(`/repos/${repoSlug}/forks`, { sort: 'stargazers', per_page: maxResults });
            return data.map(fork => fork.html_url);
        } catch (err: any) {
            console.error(`[SPIDER] Erro crítico ao buscar forks ${repoSlug}:`, err.message);
            throw new Error(`Falha na busca de forks: ${err.message}`);
        }
    }

    /**
     * Busca projetos relacionados com tipagem estrita de resposta.
     */
    async discoverRelatedByTopics(topics: string[], maxResults: number = 3): Promise<string[]> {
        if (topics.length === 0) return [];
        console.log(`[SPIDER] Bisbilhotando repositórios com tópicos: [${topics.join(', ')}]...`);
        
        try {
            const query = topics.map(t => `topic:${t}`).join(' ');
            const data = await this.fetchWithRetry<{items: GitHubRepo[]}>(`/search/repositories`, { q: query, sort: 'stars', order: 'desc', per_page: maxResults });
            return (data.items || []).map(repo => repo.html_url);
        } catch (err: any) {
            console.error(`[SPIDER] Erro crítico na busca por tópicos:`, err.message);
            return [];
        }
    }

    /**
     * Busca repositórios de um usuário específico.
     */
    async discoverUserRepos(username: string, maxResults: number = 30): Promise<string[]> {
        console.log(`[SPIDER] Listando repositórios do usuário: ${username}...`);
        
        try {
            const data = await this.fetchWithRetry<GitHubRepo[]>(`/users/${username}/repos`, { type: 'all', sort: 'updated', per_page: maxResults });
            return data.map(repo => repo.html_url);
        } catch (err: any) {
            console.error(`[SPIDER] Erro crítico ao buscar repos do usuário ${username}:`, err.message);
            return [];
        }
    }
}
