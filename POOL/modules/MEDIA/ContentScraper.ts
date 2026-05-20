// Bloco Unificado: ContentScraper
// Inspirado em: CocoScrapers, Kodi Scrapers
// Finalidade: Crawling e extração de metadados, links magnéticos e streams de fontes diversas.
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
    title: string;
    magnetLink?: string;
    streamUrl?: string;
    quality: string;
    seeders?: number;
}

export interface ScrapeSelectors {
    itemSelector: string;
    titleSelector: string;
    magnetSelector?: string;
}

export class ContentScraper {
    private sources: string[];
    private selectors: Map<string, ScrapeSelectors> = new Map();

    constructor(allowedSources: string[] = []) {
        this.sources = allowedSources;
    }

    public setSelectors(url: string, selectors: ScrapeSelectors) {
        this.selectors.set(url, selectors);
    }

    /**
     * Executa a extração em múltiplas fontes em paralelo
     */
    async aggregate(query: string, overrideSelectors?: Map<string, ScrapeSelectors>): Promise<ScrapeResult[]> {
        console.log(`[SCRAPER] Buscando '${query}' nas fontes indexadas...`);
        
        const results = await Promise.all(this.sources.map(async (url) => {
            try {
                const response = await axios.get(`${url}/search?q=${encodeURIComponent(query)}`, { timeout: 10000 });
                const selectors = overrideSelectors?.get(url) || this.selectors.get(url);
                return this.parseDOM(response.data, selectors);
            } catch (error) {
                console.error(`[SCRAPER] Erro ao buscar fonte ${url}:`, error);
                return [];
            }
        }));

        return results.flat();
    }

    /**
     * Parseia dados brutos (HTML ou JSON) para extrair padrões de links de vídeo usando seletores dinâmicos
     */
    parseDOM(data: any, selectors?: ScrapeSelectors): ScrapeResult[] {
        // Tenta parsear como JSON se for string
        if (typeof data === 'string') {
            try {
                const json = JSON.parse(data);
                return this.parseJSON(json);
            } catch (e) {
                // Se falhar, assume que é HTML
            }
        } else if (typeof data === 'object') {
            return this.parseJSON(data);
        }

        const $ = cheerio.load(data);
        const results: ScrapeResult[] = [];

        const itemSelector = selectors?.itemSelector || '.search-result, .item, .entry';
        const titleSelector = selectors?.titleSelector || '.title, h2, a';
        const magnetSelector = selectors?.magnetSelector || 'a[href^="magnet:"]';

        $(itemSelector).each((_, element) => {
            const title = $(element).find(titleSelector).text().trim();
            const magnetLink = $(element).find(magnetSelector).attr('href');
            
            if (title) {
                results.push({
                    title,
                    quality: 'Unknown',
                    magnetLink
                });
            }
        });

        return results;
    }

    private parseJSON(data: any): ScrapeResult[] {
        const results: ScrapeResult[] = [];
        const items = Array.isArray(data) ? data : (data.items || [data]);
        
        for (const item of items) {
             if (item.title || item.name) {
                 results.push({
                     title: item.title || item.name || 'Unknown',
                     magnetLink: item.magnet || item.magnetLink || item.url,
                     quality: item.quality || 'Unknown',
                     seeders: item.seeders || 0
                 });
             }
        }
        return results;
    }
}
