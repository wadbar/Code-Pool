import { UpdateManager } from './UpdateManager';
import { GoogleGenAI } from '@google/genai';

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
            let matches = text.match(githubRegex) || [];
            
            // Failsafe: search for "username/repo" text patterns inside href or strong tags for blog posts like GeeksforGeeks
            if (matches.length === 0) {
                const textMatches = text.match(/>\s*([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)\s*</g) || [];
                const impliedUrls = textMatches.map(m => {
                    const clean = m.replace(/[><\s]/g, '');
                    // Ignora strings comuns que não são repositórios
                    if (clean.includes('.') || clean.includes('118/0') || clean.toLowerCase() === 'dsa/placements' || clean.length < 5) return null;
                    return `https://github.com/${clean}`;
                }).filter(u => u !== null) as string[];
                
            // Extra failsafe: Search for headings OR bold text patterns that might imply famous repos
            const headingMatches = text.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>|<b>(.*?)<\/b>|<strong>(.*?)<\/strong>|<span>(.*?)<\/span>/gi) || [];
            const possibleNames = headingMatches.map(h => {
                return h.replace(/<[^>]+>/g, '')
                        .replace(/^[0-9]+[\.\-\)\s]+/, '') // Remove "1. ", "1)", etc
                        .trim();
            }).filter(name => name.length > 3 && name.length < 50 && !name.toLowerCase().includes('github') && !name.toLowerCase().includes('explore'));
            
            const customMapping: Record<string, string> = {
                'freecodecamp': 'freeCodeCamp/freeCodeCamp',
                'free programming books': 'EbookFoundation/free-programming-books',
                'coding interview university': 'jwasham/coding-interview-university',
                'developer roadmap': 'kamranahmedse/developer-roadmap',
                'tensorflow': 'tensorflow/tensorflow',
                'bootstrap': 'twbs/bootstrap',
                'public apis': 'public-apis/public-apis',
                'the algorithms - python': 'TheAlgorithms/Python',
                'the algorithms python': 'TheAlgorithms/Python',
                'react': 'facebook/react',
                'vue': 'vuejs/vue',
                'linux': 'torvalds/linux',
                'javascript': 'trekhleb/javascript-algorithms',
                'd3': 'd3/d3',
                'system design primer': 'donnemartin/system-design-primer',
                'awesome mackenzie': 'mackenziep/awesome-repositories'
            };
            
            for (const name of possibleNames) {
                const lowName = name.toLowerCase();
                // Match exact mapping
                if (customMapping[lowName]) {
                    impliedUrls.push(`https://github.com/${customMapping[lowName]}`);
                } else {
                    // Try exact "user/repo" hidden in text
                    const slashIdx = lowName.indexOf('/');
                    if (slashIdx > 0 && slashIdx < lowName.length - 1 && !lowName.includes(' ')) {
                        impliedUrls.push(`https://github.com/${lowName}`);
                    }
                    // Try to guess if it is a common library if the name is very specific (e.g., "Tencent-Hunyuan")
                    if (lowName.startsWith('tencent') || lowName.startsWith('microsoft') || lowName.startsWith('google')) {
                        // Heurística de busca provável ou apenas logar
                    }
                }
            }
                
                if (impliedUrls.length > 0) {
                    console.log(`[URL-SCRAPER] Heurística Profunda: Encontrou ${impliedUrls.length} potenciais repositórios a partir do texto/estruturas.`);
                    matches.push(...impliedUrls);
                }
            }
            
            // Se não encontrou links explícitos, possivelmente estão embedados ou a página só menciona os nomes.
            // Acionar o Instinto Predador (Gemini AI) para raspar profundamente o conteúdo.
            if (matches.length === 0 && process.env.GEMINI_API_KEY) {
                console.log(`[URL-SCRAPER] IA Heurística Ativada: Nenhum link óbvio detectado. Devorando texto bruto para extração de repositórios implícitos...`);
                try {
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                    // Trim text to avoid huge context window explosions, first 50k chars is enough for most articles
                    const promptText = text.substring(0, 50000); 
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: `Extract all GitHub repository urls mentioned or implied in this HTML content.
Return ONLY a valid JSON array of strings containing the FULL urls (e.g. ["https://github.com/facebook/react"]).
Do not include any markdown formatting like \`\`\`json. Return just the raw JSON array.
Content:
${promptText}`
                    });
                    
                    const aiResponse = response.text || "[]";
                    console.log(`[URL-SCRAPER] IA Heurística retornou: ${aiResponse.substring(0, 100)}...`);
                    const aiParsed = JSON.parse(aiResponse);
                    if (Array.isArray(aiParsed) && aiParsed.length > 0) {
                        matches = aiParsed;
                    }
                } catch (aiError: any) {
                    console.error(`[URL-SCRAPER] Falha na extração de IA Heurística:`, aiError.message);
                }
            }

            // Deduplica
            const uniqueRepos = [...new Set(matches.map(url => url.replace(/\.git$/, '')))];
            
            const manager = new UpdateManager();
            let addedCount = 0;
            
            for (const repoUrl of uniqueRepos) {
                // Remove trailing punctuation or whitespace grabbed by regex
                const cleanUrl = repoUrl.replace(/[\.\,\)\"\'\]]+$/, '');
                if (cleanUrl.startsWith('https://github.com/')) {
                    const add = manager.addRepository(cleanUrl);
                    if (add) addedCount++;
                }
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
