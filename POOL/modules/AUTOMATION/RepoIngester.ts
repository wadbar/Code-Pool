// Bloco Unificado: RepoIngester
// Finalidade: Monitorar e fazer a ingestão automatizada de novos repositórios do GitHub.
// Ele clona o código em memória, manda pro GeminiBridge decompor e salva no Pool.

/**
 * @doc EXPLANATION OF EXTERNAL IMPORTS:
 * - `fs` (Node.js file system): Usado para leitura/escrita síncrona/assíncrona de arquivos de código e controle de progresso.
 * - `path` (Node.js path): Utilitário para resolver diretórios e construir caminhos seguros de arquivos multi-plataforma.
 * - `os` (Node.js os): Usado para acessar diretórios temporários padronizados do sistema operacional (os.tmpdir()).
 * - `crypto` (Node.js crypto): Usado para gerar hashes de conteúdo de arquivos de modo a otimizar o cache de requisições de IA.
 * - `execSync` (child_process): Execução de subprocessos sincronizados no sistema operacional, especializado em clonar repositórios do Git.
 * - `GoogleGenerativeAI` (@google/generative-ai): Biblioteca oficial de integração do modelo Gemini do Google para análise e classificação inteligente de código.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class RepoIngester {
    /**
     * Utilitário de Cache Persistente para respostas da IA (salvo em /POOL/ai-cache.json)
     */
    private static getCache(key: string): any {
        const cachePath = path.join(process.cwd(), 'POOL', 'ai-cache.json');
        if (!fs.existsSync(cachePath)) return null;
        try {
            const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            return cache[key] || null;
        } catch (e) {
            return null;
        }
    }

    private static setCache(key: string, value: any): void {
        const cachePath = path.join(process.cwd(), 'POOL', 'ai-cache.json');
        let cache: Record<string, any> = {};
        if (fs.existsSync(cachePath)) {
            try {
                cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            } catch (e) {}
        }
        cache[key] = value;
        try {
            fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        } catch (e) {}
    }

    /**
     * Encontra e lê o arquivo README do repositório clonado se ele existir.
     */
    private static findREADME(tmpPath: string): string | null {
        try {
            if (!fs.existsSync(tmpPath)) return null;
            const filenames = fs.readdirSync(tmpPath);
            const readmeFile = filenames.find(name => name.toLowerCase().startsWith('readme.'));
            if (readmeFile) {
                return fs.readFileSync(path.join(tmpPath, readmeFile), 'utf8');
            }
        } catch (e) {
            console.warn(`[INGESTER] Erro ao ler README em ${tmpPath}:`, e);
        }
        return null;
    }

    /**
     * Executa git clone com retentativa robusta sob falhas de rede ou timeout.
     */
    private static async cloneWithRetry(repoUrl: string, destPath: string, timeout: number, retries = 3): Promise<void> {
        let lastError: any = null;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`[INGESTER] Tentativa de Clone ${attempt}/${retries} para ${repoUrl}...`);
                const activeTimeout = Math.floor(timeout * (attempt === 1 ? 1 : attempt === 2 ? 1.5 : 2));
                
                // Strategy variation: use full clone on last attempt
                const isFinalAttempt = attempt === retries;
                const cloneCmd = isFinalAttempt ? `git clone ${repoUrl} ${destPath}` : `git clone --depth 1 --single-branch ${repoUrl} ${destPath}`;
                
                execSync(cloneCmd, {
                    stdio: 'pipe',
                    timeout: activeTimeout,
                    killSignal: 'SIGKILL'
                });
                console.log(`[INGESTER] Clone concluído com sucesso na tentativa ${attempt}!`);
                return;
            } catch (err: any) {
                lastError = err;
                const stderr = err.stderr?.toString() || '';
                console.warn(`[INGESTER] Falha no Clone (tentativa ${attempt}/${retries}): ${err.message}. Stderr: ${stderr}`);
                if (attempt < retries) {
                    const waitTime = 3000 * attempt;
                    console.log(`[INGESTER] Aguardando ${waitTime}ms antes de retentar...`);
                    await this.sleep(waitTime);
                }
            }
        }
        throw lastError;
    }
    /**
     * Ingestão autônoma de um repositório
     */
    static async ingestFromGitHub(repoUrl: string, timeout: number = 45000) {
        try {
            console.log(`[INGESTER] Iniciando ciclo reverso autônomo. Destilar: ${repoUrl} (Timeout: ${timeout}ms)`);
            
            // 0. Carregar progresso anterior
            const progressPath = path.join(process.cwd(), 'POOL', 'ingestion-progress.json');
            let progress: Record<string, string[]> = {};
            if (fs.existsSync(progressPath)) {
                try { progress = JSON.parse(fs.readFileSync(progressPath, 'utf8')); } catch (e) {}
            }
            const digestedFiles = progress[repoUrl] || [];

            // 1. Setup workspace isolado DENTRO da raiz do projeto (Escritível e seguro)
            const safeName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
            const tmpBase = path.join(process.cwd(), 'POOL', '.tmp');
            if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
            
            const tmpPath = path.join(tmpBase, safeName);
            
            if (fs.existsSync(tmpPath)) {
                fs.rmSync(tmpPath, { recursive: true, force: true });
            }
            fs.mkdirSync(tmpPath, { recursive: true });

            const extractedModules: any[] = [];
            try {
                // 2. Clone real no SO com retentativas e tratamento robusto
                try {
                    await this.cloneWithRetry(repoUrl, tmpPath, timeout);
                } catch (cloneErr: any) {
                    const stderr = cloneErr.stderr?.toString() || '';
                    console.error(`[INGESTER] Erro definitivo no git clone para ${repoUrl}: ${cloneErr.message}. Stderr: ${stderr}`);
                    
                    if (cloneErr.code === 'ETIMEDOUT' || cloneErr.signal === 'SIGKILL' || stderr.toLowerCase().includes('timeout')) {
                        return { status: "monster", reason: "clone_timeout" };
                    }
                    return { status: "failed", error: `Clone failed after retries: ${stderr.substring(0, 200)}` };
                }

                // 3. Varredura e Filtro de Progresso (The Elite Scout)
                let allFiles = this.scanDirForSourceCode(tmpPath);
                
                console.log(`[INGESTER] Analisando a presa... ${allFiles.length} arquivos brutos detectados.`);
                
                // --- ELITE HEURISTIC FILTERING (Golden Standard) ---
                let goldenFiles = allFiles.filter(f => {
                    const relative = f.replace(tmpPath, '').toLowerCase();
                    const fileName = path.basename(f).toLowerCase();
                    
                    // Rigorous exclusionary rules to drop junk but keep the golden blocks
                    if (relative.includes('/.git/') || relative.includes('/node_modules/')) return false;
                    if (relative.includes('.test.') || relative.includes('.spec.')) return false;
                    if (relative.includes('/__mocks__/') || relative.includes('/__tests__/')) return false;
                    if (relative.includes('/fixtures/') || relative.includes('/stories/')) return false;
                    if (relative.includes('/docs/') || relative.includes('/assets/')) return false;
                    if (fileName.endsWith('.d.ts')) return false; 
                    if (fileName === 'setupTests' || fileName === 'reportWebVitals') return false;
                    
                    const size = fs.statSync(f).size;
                    // Ignore empty or extremely tiny files (unlikely to be complex lego pieces)
                    if (size < 100) return false;
                    // Ignore gigantic files (likely generated bundles or massive JSON dumps)
                    if (size > 150000) return false; 

                    return true;
                });
                
                // Prioritization: TypeScript/React components are often highest value for UI Lego
                goldenFiles = goldenFiles.sort((a, b) => {
                    const extA = path.extname(a);
                    const extB = path.extname(b);
                    const priority = { '.tsx': 1, '.ts': 2, '.jsx': 3, '.js': 4, '.py': 5 };
                    const pA = (priority as any)[extA] || 99;
                    const pB = (priority as any)[extB] || 99;
                    return pA - pB || fs.statSync(b).size - fs.statSync(a).size;
                });

                // Filtrar o que já foi digerido
                const remainingFiles = goldenFiles.filter(f => !digestedFiles.includes(f.replace(tmpPath, '')));
                
                console.log(`[INGESTER] Padrões Ouro identificados: ${goldenFiles.length} arquivos relevantes. ${remainingFiles.length} aguardando extração.`);

                // 4. Gerar Blueprint apenas se for a primeira vez
                const safeRepoName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
                const blueprintExists = fs.existsSync(path.join(process.cwd(), 'POOL', 'blueprints', `${safeRepoName}.md`));
                if (!blueprintExists) {
                    console.log(`[INGESTER] Gerando Blueprint Global...`);
                    const appBlueprint = await this.generateRepoBlueprint(repoUrl, allFiles, tmpPath);
                    this.saveBlueprint(repoUrl, appBlueprint);
                }

                // 5. Fatiamento Dinâmico (The Great Devourer)
                const totalRelevant = goldenFiles.length;
                const isHuge = totalRelevant > 600; // Apenas 600+ arquivos é "Huge"
                const sliceSize = isHuge ? 40 : 80; // Slices maiores para repos normais
                const filesToProcess = remainingFiles.slice(0, sliceSize);
                
                if (filesToProcess.length === 0) {
                     return { status: "success", reason: "all_files_processed" };
                }

                console.log(`[INGESTER] Digerindo fatia de ${filesToProcess.length} arquivos...`);

                for (let i = 0; i < filesToProcess.length; i++) {
                    const filePath = filesToProcess[i];
                    const relativePath = filePath.replace(tmpPath, '');
                    
                    try {
                        const code = fs.readFileSync(filePath, 'utf-8');
                        if (code.trim().length === 0 || code.length > 30000) {
                            digestedFiles.push(relativePath); 
                            continue; 
                        }

                        console.log(`[INGESTER] [${i + 1}/${filesToProcess.length}] Decompondo: ${path.basename(filePath)}`);
                        
                        // --- PAUSE CHECK ---
                        const { UpdateManager } = await import('./UpdateManager');
                        await UpdateManager.waitIfPaused();
                        const control = UpdateManager.getControlStatus();
                        if (control.status === 'stop_after_current') {
                            console.warn(`[INGESTER] Abortando processamento de arquivos por comando de STOP.`);
                            return { status: "partial", reason: "aborted_by_stop", filesProcessed: i };
                        }
                        // ------------------------------------

                        const aiResult = await this.decomposeWithAI(code, path.basename(filePath));
                        
                        if (aiResult && aiResult.category && aiResult.block_id && aiResult.code) {
                            const isNewWinner = await this.evaluateAndDeduplicate(aiResult.category, aiResult.block_id, aiResult.code, repoUrl, filePath);
                            if (isNewWinner) extractedModules.push({ category: aiResult.category, name: aiResult.block_id });
                        } else {
                            console.warn(`[INGESTER] Falha na extração de ${path.basename(filePath)}: AI retornou nulo ou incompleto.`);
                        }
                    } catch (fileErr: any) {
                        console.error(`[INGESTER] Erro ao processar arquivo individual ${filePath}: ${fileErr.message}`);
                    }
                    
                    digestedFiles.push(relativePath);
                    
                    // Salvar progresso incremental a cada 5 arquivos
                    if (i % 5 === 0) {
                        progress[repoUrl] = digestedFiles;
                        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
                    }
                }

                // Salvar estado final do ciclo
                progress[repoUrl] = digestedFiles;
                fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));

                const hasMore = remainingFiles.length > sliceSize;
                return {
                    status: hasMore ? "partial" : "success",
                    filesProcessed: filesToProcess.length,
                    totalPending: remainingFiles.length - filesToProcess.length,
                    totalFiles: allFiles.length,
                    modulesExtracted: extractedModules
                };

            } catch (error: any) {
                console.error(`[INGESTER] Falha na ingestão do repositório ${repoUrl}: ${error.message}`);
                return { status: "failed", error: error.message };
            } finally {
                try {
                    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
                } catch (rmErr) {}
            }
        } catch (fatalErr: any) {
            console.error(`[INGESTER] FATAL ERROR na ingestão: ${fatalErr.message}`);
            return { status: "failed", error: fatalErr.message };
        }
    }

    static async generateMissingBlueprints() {
        const registryPath = path.join(process.cwd(), 'POOL', 'pool-registry.json');
        if (!fs.existsSync(registryPath)) return;
        
        let data;
        try {
            data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        } catch (e) {
            console.error("[INGESTER] Registry JSON malformado.");
            return;
        }

        const missingBlueprints = data.repositories.filter((repo: any) => {
            const safeName = repo.url.replace(/[^a-zA-Z0-9]/g, '_');
            const bpsPath = path.join(process.cwd(), 'POOL', 'blueprints', `${safeName}.md`);
            return !fs.existsSync(bpsPath);
        });

        if (missingBlueprints.length === 0) return;

        console.log(`[INGESTER] Encontrados ${missingBlueprints.length} repositórios sem blueprint. Iniciando geração paralela...`);

        // Process in small batches to avoid hitting API limits
        const batchSize = 3;
        for (let i = 0; i < missingBlueprints.length; i += batchSize) {
            const batch = missingBlueprints.slice(i, i + batchSize);
            await Promise.allSettled(batch.map((repo: any) => this.generateAndSaveBlueprint(repo.url)));
        }

        console.log(`[INGESTER] Finalizada varredura de blueprints retroativos.`);
    }

    private static async generateAndSaveBlueprint(repoUrl: string) {
        const safeName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
        console.log(`[INGESTER] Gerando Blueprint para: ${repoUrl}`);
        const tmpBase = path.join(process.cwd(), 'POOL', '.tmp');
        const tmpPath = path.join(tmpBase, safeName);
        
        try {
            if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
            if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
            fs.mkdirSync(tmpPath, { recursive: true });

            try {
                await this.cloneWithRetry(repoUrl, tmpPath, 60000);
            } catch (e: any) {
                console.warn(`[INGESTER] Falha/Timeout no clone para ${repoUrl}.`);
                return;
            }
            const files = this.scanDirForSourceCode(tmpPath);
            if (files.length > 0) {
                const appBlueprint = await this.generateRepoBlueprint(repoUrl, files, tmpPath);
                this.saveBlueprint(repoUrl, appBlueprint);
                console.log(`[INGESTER] Blueprint gerado.`);
            }
        } catch (error: any) {
            console.error(`[INGESTER] Erro ao gerar blueprint para ${repoUrl}:`, error.message);
        } finally {
            try {
                if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
            } catch (rmErr) {}
        }
    }

    private static scanDirForSourceCode(dir: string, fileList: string[] = []): string[] {
        if (!fs.existsSync(dir)) return fileList;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file === '.git' || file === 'node_modules' || file === 'dist' || file === 'build' || file === '__pycache__') continue;
            
            const filePath = path.join(dir, file);
            if (!fs.existsSync(filePath)) continue;
            
            if (fs.statSync(filePath).isDirectory()) {
                this.scanDirForSourceCode(filePath, fileList);
            } else {
                const ext = path.extname(file).toLowerCase();
                if (['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.cpp', '.h'].includes(ext)) {
                    fileList.push(filePath);
                }
            }
        }
        return fileList;
    }

    private static async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static getAI() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("[INGESTER] GEMINI_API_KEY não encontrada no ambiente. Isso pode causar falhas 400.");
        }
        return new GoogleGenerativeAI(apiKey || 'fake-key');
    }

    private static async generateRepoBlueprint(repoUrl: string, files: string[], tmpPath: string): Promise<string> {
        const cacheKey = `blueprint:${repoUrl}`;
        const cached = this.getCache(cacheKey);
        if (cached) {
            console.log(`[INGESTER] Usando Blueprint em cache para: ${repoUrl}`);
            return cached;
        }

        try {
            const genAI = this.getAI();
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const tree = files.map(f => f.slice(tmpPath.length)).slice(0, 200).join('\n');
            const readmeContent = this.findREADME(tmpPath) || "Nenhum README encontrado.";
            const trimmedReadme = readmeContent.slice(0, 8000); // Protect context limits
            
            const prompt = `Analise a estrutura de diretórios deste repositório e o seu README.md e crie um MAPA DA ARQUITETURA (Blueprint).
No início (topo) do documento Markdown, inclua uma seção formatada de metadados estruturados:

# METADADOS
- **Main Programming Language**: [Linguagem principal detectada ou informada]
- **License Type**: [Tipo de Licença, ex: MIT, Apache, GNU ou Indefinida]
- **Project Purpose Summary**: [Resumo conciso de 2-3 frases do propósito do projeto]

Em seguida, explique o padrão arquitetural, como as coisas se conectam e a stack tecnológica no corpo do Blueprint. Isso será usado para remontar os blocos modulares no futuro.

URL do Repositório: ${repoUrl}
README (parcial):
${trimmedReadme}

Arquivos:
${tree}

Responda SOMENTE o documento em formato Markdown sem blocos de código extras.`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            await this.sleep(3000);
            const text = response.text() || "Blueprint falhou.";
            
            if (text && text !== "Blueprint falhou.") {
                this.setCache(cacheKey, text);
            }
            return text;
        } catch (err: any) {
            console.error(`[INGESTER] Falha no Blueprint:`, err.message);
            return "Erro ao extrair Blueprint.";
        }
    }

    private static saveBlueprint(repoUrl: string, content: string) {
        const bpsPath = path.join(process.cwd(), 'POOL', 'blueprints');
        if (!fs.existsSync(bpsPath)) fs.mkdirSync(bpsPath, { recursive: true });
        
        const safeName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
        fs.writeFileSync(path.join(bpsPath, `${safeName}.md`), `# Blueprint Repositório: ${repoUrl}\n\n${content}`);
    }

    private static async decomposeWithAI(source: string, filename: string, attempt = 1): Promise<{category: string, block_id: string, code: string} | null> {
        // Criar chave de cache única baseada no hash do código do arquivo
        const contentHash = crypto.createHash('sha256').update(source).digest('hex');
        const cacheKey = `decompose:${contentHash}`;
        const cached = this.getCache(cacheKey);
        if (cached) {
            console.log(`[INGESTER] Usando resultado Decompose em cache para: ${filename}`);
            return cached;
        }

        try {
            const genAI = this.getAI();
            const model = genAI.getGenerativeModel({ 
                model: 'gemini-1.5-flash',
                generationConfig: {
                    responseMimeType: 'application/json',
                }
            });
            
            const prompt = `Atue como um arquiteto modular sênior. Analise o arquivo ${filename}. 
Extraia a principal lógica (componente, função ou classe) e adapte-a para ser independente e modular em TypeScript.
A categoria deve ser estritamente uma destas baseadas nos módulos existentes e recomendados: [AUTH, DB, GEOMETRY, MEDIA, NETWORKING, SECURITY, AUTOMATION, UI, UTILS, ALGORITHM, AI, ML, AUDITOR, DATA, PROCEDURAL, SEARCH, VISION, VALIDATION].
IMPORTANTE: block_id deve ser snake_case descrevendo a funcionalidade.
Responda APENAS JSON:
{
  "category": "string",
  "block_id": "string",
  "code": "string (typescript code)"
}

Source:
${source}
`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            await this.sleep(3000); 

            if (text) {
                let cleanText = text.trim();
                // Strip markdown markers if present
                cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
                
                try {
                    const parsed = JSON.parse(cleanText);
                    if (parsed && parsed.category && parsed.block_id && parsed.code) {
                        this.setCache(cacheKey, parsed);
                    }
                    return parsed;
                } catch (jsonErr) {
                    console.error(`[INGESTER] Erro JSON:`, cleanText.substring(0, 50));
                    return null;
                }
            }
            return null;
        } catch (err: any) {
             const msg = err.message || '';
             console.error(`[INGESTER] Decompose Error (${filename}):`, msg);

             if (msg.includes('429') && attempt <= 2) {
                 await this.sleep(10000);
                 return this.decomposeWithAI(source, filename, attempt + 1);
             }
             return null;
        }
    }

    private static async evaluateAndDeduplicate(category: string, blockId: string, newCode: string, repoUrl: string, filePath: string): Promise<boolean> {
        const catPath = path.join(process.cwd(), 'POOL', 'modules', category);
        if (!fs.existsSync(catPath)) fs.mkdirSync(catPath, { recursive: true });
        
        const destPath = path.join(catPath, `${blockId}.ts`);
        const finalCode = `// [BLOCOS UNIFICADOS - RECURSO: ${blockId}]\n// Última Contribuição: ${repoUrl} (${path.basename(filePath)})\n\n${newCode}`;

        if (!fs.existsSync(destPath)) {
            fs.writeFileSync(destPath, finalCode);
            console.log(`[INGESTER] NOVO BLOCO: /modules/${category}/${blockId}.ts`);
            return true;
        } else {
            const existingCode = fs.readFileSync(destPath, 'utf8');
            if (existingCode.length > 10000 || newCode.length > 10000) return false; // Too big to merge with LLM simply

            try {
                const genAI = this.getAI();
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                
                const prompt = `Mescle ou decida qual o melhor código TypeScript para o recurso "${blockId}". 
Mantenha exports claros. Retorne apenas o código TS puro.

EXISTING:
${existingCode.substring(0, 4000)}

NEW:
${newCode.substring(0, 4000)}`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                await this.sleep(3000);

                let merged = response.text() || '';
                merged = merged.replace(/^```typescript/, '').replace(/^```ts/, '').replace(/```$/, '').trim();

                const header = `// [BLOCOS UNIFICADOS - RECURSO: ${blockId} - MERGED]\n// Audit: ${repoUrl}\n\n`;
                fs.writeFileSync(destPath, header + merged);
                console.log(`[INGESTER] MERGE CONCLUÍDO: ${blockId}`);
                return true;
            } catch (err: any) {
                console.error(`[INGESTER] Merge failed for ${blockId}:`, err.message);
                return false;
            }
        }
    }
}
