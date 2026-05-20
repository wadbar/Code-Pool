// Bloco Unificado: WebCrawler (Dark/Deep Web mode)
// Inspirado em: Torch Dark Web Search
// Finalidade: Exploração profunda de grafos de web, com suporte a proxies (Tor, I2P).

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { SocksProxyAgent } from 'socks-proxy-agent';

export interface CrawlerResult {
    nodesVisited: number;
    graphMap: Map<string, string[]>;
}

export class WebCrawler {
    private client: AxiosInstance;
    private failedUrls: Set<string> = new Set();
    private maxRetries: number = 3;

    constructor(proxyUrl?: string) {
        const config: any = {};
        if (proxyUrl) {
            const agent = new SocksProxyAgent(proxyUrl);
            config.httpAgent = agent;
            config.httpsAgent = agent;
        }
        this.client = axios.create(config);
    }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async fetchWithRetry(url: string, retries: number = this.maxRetries): Promise<any> {
        try {
            return await this.client.get(url, { timeout: 15000 });
        } catch (error: any) {
            if (retries > 0) {
                const delay = Math.pow(2, this.maxRetries - retries) * 1000;
                console.warn(`[CRAWLER] Falha ao acessar ${url}. Tentando novamente em ${delay}ms... (${retries} tentativas restantes)`);
                await this.sleep(delay);
                return this.fetchWithRetry(url, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Inicia o spider a partir de nós semente (seed URLs)
     */
    async crawl(seedUrls: string[], depth: number = 3): Promise<CrawlerResult> {
        console.log(`[CRAWLER] Iniciando spider em ${seedUrls.length} seeds com profundidade ${depth}.`);
        
        const graphMap = new Map<string, string[]>();
        const visited = new Set<string>();
        const queue: { url: string; currentDepth: number }[] = seedUrls.map(url => ({ url, currentDepth: 0 }));

        while (queue.length > 0) {
            const { url, currentDepth } = queue.shift()!;

            if (visited.has(url) || this.failedUrls.has(url) || currentDepth >= depth) continue;
            
            visited.add(url);
            
            try {
                console.log(`[CRAWLER] Visitando: ${url} (Profundidade: ${currentDepth})`);
                const response = await this.fetchWithRetry(url);
                const $ = cheerio.load(response.data);
                const links: string[] = [];

                $('a').each((_, element) => {
                    const href = $(element).attr('href');
                    if (href && href.startsWith('http')) {
                        links.push(href);
                        if (currentDepth + 1 < depth) {
                            queue.push({ url: href, currentDepth: currentDepth + 1 });
                        }
                    }
                });

                graphMap.set(url, links);
            } catch (error) {
                console.error(`[CRAWLER] Falha persistente ao acessar ${url}:`, error);
                this.failedUrls.add(url);
                graphMap.set(url, []);
            }
        }

        return {
            nodesVisited: visited.size,
            graphMap
        };
    }
}
