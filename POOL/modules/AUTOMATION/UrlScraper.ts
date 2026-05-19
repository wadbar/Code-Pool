import { UpdateManager } from './UpdateManager';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class UrlScraper {
    /**
     * Scrapes a given URL or raw content for GitHub repository links 
     * and adds them to the ingestion pool.
     */
    static async scrapeAndQueueRepos(sourceUrl?: string, rawContent?: string, depth = 0) {
        if (!sourceUrl && !rawContent) {
            return { status: "error", message: "Nenhuma URL ou conteúdo fornecido." };
        }

        // Evitar recursão infinita (Máximo 2 níveis: Lista -> Perfis -> Repos)
        if (depth > 2) return { status: "success", found: 0, added: 0 };

        console.log(`[URL-SCRAPER] [Depth:${depth}] Buscando links de repositórios em: ${sourceUrl || 'Conteúdo manual'}`);
        
        try {
            let text = rawContent || '';
            
            if (sourceUrl && !rawContent) {
                // Otimizador de URL GitHub: troca blob por raw para facilitar parse (menos HTML, mais markdown/texto)
                if (sourceUrl.includes('github.com/') && (sourceUrl.includes('/blob/') || sourceUrl.includes('/tree/'))) {
                    sourceUrl = sourceUrl.replace('/blob/', '/raw/').replace('/tree/', '/raw/');
                    console.log(`[URL-SCRAPER] Otimizando link GitHub -> Raw: ${sourceUrl}`);
                }

                // Se for um link de github direto
                if (sourceUrl.includes('github.com')) {
                    const cleanUrl = sourceUrl.split('?')[0].replace(/\/$/, '');
                    const pathParts = cleanUrl.split('github.com/')[1]?.split('/');
                    
                    if (pathParts) {
                        // Caso 1: Repositório Direto (User/Repo)
                        if (pathParts.length >= 2) {
                            const user = pathParts[0];
                            const repo = pathParts[1];
                            const skip = ['explore', 'trending', 'marketplace', 'features', 'topics', 'collections', 'events', 'settings', 'notifications', 'orgs', 'site', 'contact', 'about', 'security', 'pricing', 'blog', 'search'];
                            
                            // Se for um link de repo real (não uma página institucional)
                            if (!skip.includes(user.toLowerCase())) {
                                const repoUrl = `https://github.com/${user}/${repo}`;
                                const manager = new UpdateManager();
                                if (manager.addRepository(repoUrl)) {
                                    console.log(`[URL-SCRAPER] Repositório único adicionado via URL: ${repoUrl}`);
                                    return { status: "success", found: 1, added: 1, url: repoUrl };
                                }
                                return { status: "success", found: 1, added: 0, message: "Já estava na piscina." };
                            }
                        }
                        
                        // Caso 2: Perfil de Usuário/Org (apenas /user)
                        if (pathParts.length === 1) {
                            const user = pathParts[0];
                            const skip = ['explore', 'trending', 'marketplace', 'features', 'topics', 'collections', 'events', 'settings', 'notifications', 'orgs', 'site', 'contact', 'about', 'security', 'pricing', 'blog', 'search', 'pulls', 'issues'];
                            if (!skip.includes(user.toLowerCase())) {
                                console.log(`[URL-SCRAPER] Perfil GitHub detectado: ${user}. Tentando buscar via API oficial do GitHub...`);
                                try {
                                    const apiResponse = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=updated`, {
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                            'Accept': 'application/vnd.github.v3+json'
                                        }
                                    });
                                    if (apiResponse.ok) {
                                        const repos = await apiResponse.json();
                                        if (Array.isArray(repos)) {
                                            const manager = new UpdateManager();
                                            let addedCount = 0;
                                            for (const r of repos) {
                                                if (r.html_url) {
                                                    if (manager.addRepository(r.html_url)) {
                                                        addedCount++;
                                                    }
                                                }
                                            }
                                            console.log(`[URL-SCRAPER] API oficial retornou ${repos.length} repositórios para ${user}. Adicionados: ${addedCount}`);
                                            return {
                                                status: "success",
                                                found: repos.length,
                                                added: addedCount,
                                                message: `User API: Encontrados ${repos.length} repositórios de ${user}, adicionados ${addedCount} novos.`
                                            };
                                        }
                                    } else {
                                        console.log(`[URL-SCRAPER] API retornou status ${apiResponse.status}, caindo de volta para o scraping HTML...`);
                                    }
                                } catch (apiErr: any) {
                                    console.log(`[URL-SCRAPER] Erro ao chamar API do GitHub: ${apiErr.message}. Caindo de volta para o scraping HTML...`);
                                }
                                // Redirecionamos para a aba de repositórios para o scraper buscar tudo
                                sourceUrl = `https://github.com/${user}?tab=repositories&sort=updated`;
                                console.log(`[URL-SCRAPER] Perfil GitHub detectado: ${user}. Redirecionando para aba de repositórios...`);
                            }
                        }
                    }
                }

                let finalUrl = sourceUrl;
                // Reddit Adapter: Reddit blocks most simple HTML fetches, but allows .json with much more data
                if (sourceUrl.includes('reddit.com/r/') && !sourceUrl.includes('.json')) {
                    finalUrl = sourceUrl.split('?')[0].replace(/\/$/, '') + '.json';
                    console.log(`[URL-SCRAPER] Reddit detectado. Redirecionando para endpoint JSON: ${finalUrl}`);
                }

                const response = await fetch(finalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en-US,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Referer': 'https://www.google.com/'
                    }
                });

                if (!response.ok) {
                    console.error(`[URL-SCRAPER] HTTP Error ${response.status} fetching ${finalUrl}`);
                    if (finalUrl !== sourceUrl) {
                        return this.scrapeAndQueueRepos(sourceUrl, undefined, depth); 
                    }
                    throw new Error(`O servidor retornou erro ${response.status}. Sites como Reddit/Twitter/Github monitoram acessos automatizados. Se o erro persistir, tente usar a Ingestão Manual com o código-fonte da página.`);
                }

                const contentType = response.headers.get('content-type') || '';
                
                if (contentType.includes('application/json') || finalUrl.endsWith('.json')) {
                    try {
                        const jsonData = await response.json();
                        text = JSON.stringify(jsonData);
                        if (Array.isArray(jsonData)) {
                            jsonData.forEach(item => {
                                if (item.data && item.data.children) {
                                    item.data.children.forEach((child: any) => {
                                        if (child.data) {
                                            text += ' ' + (child.data.selftext || '') + ' ' + (child.data.body || '') + ' ' + (child.data.title || '');
                                        }
                                    });
                                }
                                if (item.data && item.data.selftext) text += ' ' + item.data.selftext;
                            });
                        }
                    } catch (e) {
                        text = await response.text();
                    }
                } else {
                    text = await response.text();
                }
            }
            
            // 1. Regex de Atributos
            const attributeRegex = /(?:href|src|data-[a-z0-9\-]+|value|content|action|title|url|original-url)=["']([^"']*(?:github\.com|git\.io|gist\.github\.com|githubusercontent\.com)[^"']*)["']/gi;
            let attributeMatches: string[] = [];
            let attrMatch;
            while ((attrMatch = attributeRegex.exec(text)) !== null) {
                let rawUrl = attrMatch[1].trim();
                if (rawUrl.includes('%3A%2F%2F')) {
                    try {
                        const decoded = decodeURIComponent(rawUrl);
                        const githubPart = decoded.match(/https?:\/\/github\.com\/[a-zA-Z0-9_\-\.\/]+/gi);
                        if (githubPart) rawUrl = githubPart[0];
                    } catch(e) {}
                }
                let url = rawUrl;
                if (url.startsWith('//')) url = 'https:' + url;
                if (!url.startsWith('http') && !url.includes('://')) url = 'https://' + url.replace(/^\//, '');
                url = url.split('?')[0].split('#')[0].replace(/[\.\,\)\"\'\]\s]+$/, '');
                if (url.includes('github.com/') || url.includes('git.io/')) {
                    attributeMatches.push(url);
                }
            }

            // 2. Regex de Texto Puro e Perfis
            const profileRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)(?:\/)?(?:\s|$|"|'|>|\)|\])/gi;
            const repoRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)(?:\/[a-zA-Z0-9_\-\.]+)?/gi;
            
            let foundProfiles: string[] = [];
            let textMatches: string[] = [];
            
            let rMatch;
            while ((rMatch = repoRegex.exec(text)) !== null) {
                const url = `https://github.com/${rMatch[1]}/${rMatch[2]}`;
                textMatches.push(url);
            }

            let pMatch;
            while ((pMatch = profileRegex.exec(text)) !== null) {
                const user = pMatch[1];
                const skip = ['explore', 'trending', 'marketplace', 'features', 'topics', 'collections', 'events', 'settings', 'notifications', 'orgs', 'site', 'contact', 'about', 'security', 'pricing', 'blog', 'search', 'pulls', 'issues', 'privacy', 'terms'];
                if (!skip.includes(user.toLowerCase())) {
                    foundProfiles.push(user);
                }
            }
            
            let matches = [...new Set([...attributeMatches, ...textMatches])];
            foundProfiles = [...new Set(foundProfiles)];

            let recursiveFound = 0;
            let recursiveAdded = 0;

            // Se for Depth 0 (primeiro scrape) e encontrar perfis de usuários, iterar sobre eles
            if (depth === 0 && foundProfiles.length > 0) {
                console.log(`[URL-SCRAPER] Lista de usuários detectada (${foundProfiles.length}). Scraping iterativo iniciado...`);
                // Limite de 30 usuários iniciais para não estourar rate limit da API do GitHub
                const targetUsers = foundProfiles.slice(0, 30);
                for (const user of targetUsers) {
                    try {
                        const recResult = await this.scrapeAndQueueRepos(`https://github.com/${user}`, undefined, depth + 1);
                        if (recResult.status === "success") {
                            recursiveFound += (recResult.found || 0);
                            recursiveAdded += (recResult.added || 0);
                        }
                        // Pequeno delay para evitar 429
                        await new Promise(r => setTimeout(r, 100));
                    } catch (e) {}
                }
            }

            // 3. Sensor de Contexto (Pares usuario/repo soltos)
            const pairMatches = text.match(/(?:>|"|'|\s|^)([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.\/]{3,50})(?:<|"|'|\s|$)/gi) || [];
            const impliedUrls: string[] = [];
            for (const m of pairMatches) {
                const clean = m.replace(/[><"'\s\n]/g, '').replace(/\/$/, '');
                const parts = clean.split('/');
                if (parts.length < 2) continue;
                const user = parts[0];
                const repo = parts[1].split(/[#\?]/)[0].split('.')[0]; 
                const noise = ['explore', 'trending', 'marketplace', 'features', 'topics', 'collections', 'events', 'settings', 'notifications', 'orgs', 'site', 'contact', 'about', 'security', 'pricing', 'blog', 'search', 'r', 'u'];
                if (noise.includes(user.toLowerCase())) continue;
                if (clean.length < 4) continue;
                impliedUrls.push(`https://github.com/${user}/${repo}`);
            }
            matches.push(...impliedUrls);
            
            const uniqueRepos = [...new Set(matches.map(url => {
                let clean = url.replace(/\.git$/, '').replace(/\/$/, '').replace(/[\.\,\)\"\'\]]+$/, '');
                const parts = clean.split('github.com/')[1]?.split('/');
                if (parts && parts.length >= 2) return `https://github.com/${parts[0]}/${parts[1]}`;
                return '';
            }).filter(u => u !== ''))];
            
            const manager = new UpdateManager();
            let addedCount = 0;
            for (const repoUrl of uniqueRepos) {
                if (repoUrl.includes('/')) {
                    if (manager.addRepository(repoUrl)) addedCount++;
                }
            }
            
            return { 
                status: "success", 
                found: uniqueRepos.length + recursiveFound, 
                added: addedCount + recursiveAdded 
            };
        } catch (err: any) {
             console.error(`[URL-SCRAPER] Erro no scrape:`, err.message);
             return { status: "error", message: err.message };
        }
    }
}

