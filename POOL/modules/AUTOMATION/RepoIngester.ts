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
 * - `GeminiBridge` (../AI/GeminiBridge): Motor unificado para classificação sofisticada e robusta de código e modelagem de prompts de IA.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { GeminiBridge } from '../AI/GeminiBridge';
import { UniversalAIBridge } from '../AI/UniversalAIBridge';
import { POOL_SYSTEM_PROMPT } from '../AI/SystemPrompt';

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
     * Otimizado para repositórios grandes focando em clones shallow.
     */
    private static async cloneWithRetry(repoUrl: string, destPath: string, timeout: number, retries = 3): Promise<void> {
        let lastError: any = null;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                if (fs.existsSync(destPath)) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                }
                
                console.log(`[INGESTER] Tentativa de Clone ${attempt}/${retries} para ${repoUrl}...`);
                
                // Timeout mais agressivo para repositórios grandes
                const activeTimeout = Math.floor(timeout * (attempt + 1));
                
                // Robust git configuration for large and slow network transfers
                const gitConfig = '-c http.postBuffer=1073741824 -c http.lowSpeedLimit=1 -c http.lowSpeedTime=120 -c core.compression=0';
                
                const customEnv = { ...process.env };
                try {
                    const { SSHManager } = await import('../AUTH/SSHManager');
                    if (SSHManager.getKeyPairInfo().exists) {
                        customEnv.GIT_SSH_COMMAND = SSHManager.getGitSshCommand();
                    }
                } catch (sshErr: any) {
                    console.warn('[INGESTER] SSHManager não pôde ser carregado para clonagem:', sshErr.message);
                }

                // Smart Shallow Clone mechanism
                let targetDepth = 1;
                try {
                    const lsRemoteOut = execSync(`git ls-remote ${repoUrl}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000, env: customEnv });
                    const refsCount = lsRemoteOut.toString().split('\n').filter(line => line.trim().length > 0).length;
                    console.log(`[INGESTER] Smart Shallow Clone: Detectadas ${refsCount} referências remotas.`);
                    
                    if (refsCount < 50) {
                        targetDepth = 10;
                    } else if (refsCount < 500) {
                        targetDepth = 3;
                    } else {
                        targetDepth = 1;
                    }
                    console.log(`[INGESTER] Ajustando dinamicamente --depth para ${targetDepth} para otimização de tráfego de rede.`);
                } catch (e: any) {
                    console.warn(`[INGESTER] Smart Shallow Clone falhou ao ler refs remotas. Fallback para depth 1.`);
                }
                
                const cloneCmd = `git ${gitConfig} clone --depth ${targetDepth} --single-branch --no-tags ${repoUrl} ${destPath}`;
                
                execSync(cloneCmd, {
                    stdio: 'pipe',
                    timeout: activeTimeout,
                    killSignal: 'SIGKILL',
                    env: customEnv
                });
                
                console.log(`[INGESTER] Clone concluído com sucesso na tentativa ${attempt}!`);
                return;
            } catch (err: any) {
                lastError = err;
                const stderr = err.stderr?.toString() || '';
                console.warn(`[INGESTER] Falha no Clone (tentativa ${attempt}/${retries}): ${err.message}. Stderr: ${stderr}`);
                
                // Limpeza garantida caso o clone tenha criado diretórios parciais
                if (fs.existsSync(destPath)) {
                    try {
                        fs.rmSync(destPath, { recursive: true, force: true });
                    } catch (cleanupErr) {
                        console.error(`[INGESTER] Erro ao limpar diretório parcial: ${cleanupErr}`);
                    }
                }
                
                if (attempt < retries) {
                    const waitTime = 10000 * Math.pow(2, attempt - 1); // Exponential backoff: 10s, 20s, 40s...
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
                // 2. Clone do repositório no sistema operacional com retentativas e tratamento robusto
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
                    const appBlueprint = await this.generateRepoBlueprint(repoUrl, goldenFiles, tmpPath);
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

                console.log(`[INGESTER] Digerindo fatia de ${filesToProcess.length} arquivos com tolerância e retentativas...`);

                const ingestedHashesPath = path.join(process.cwd(), 'POOL', 'ingested-hashes.json');
                let ingestedHashes = new Set<string>();
                if (fs.existsSync(ingestedHashesPath)) {
                    try { ingestedHashes = new Set(JSON.parse(fs.readFileSync(ingestedHashesPath, 'utf8'))); } catch (e) {}
                }

                for (let i = 0; i < filesToProcess.length; i++) {
                    const filePath = filesToProcess[i];
                    const relativePath = filePath.replace(tmpPath, '');
                    
                    let fileSuccess = false;
                    const fileRetries = 3;
                    let lastFileError = "";

                    for (let attempt = 1; attempt <= fileRetries; attempt++) {
                        try {
                            const code = fs.readFileSync(filePath, 'utf-8');
                            if (code.trim().length === 0 || code.length > 30000) {
                                fileSuccess = true;
                                break; 
                            }

                            // --- DEDUPLICAÇÃO INTELIGENTE POR HASH (Early Return) ---
                            const fileHash = crypto.createHash('sha256').update(code).digest('hex');
                            if (ingestedHashes.has(fileHash)) {
                                console.log(`[INGESTER] [${i + 1}/${filesToProcess.length}] Ignorando duplicata exata (Hash Match): ${path.basename(filePath)}`);
                                fileSuccess = true;
                                break;
                            }

                            console.log(`[INGESTER] [${i + 1}/${filesToProcess.length}] [Tentativa ${attempt}/${fileRetries}] Decompondo: ${path.basename(filePath)}`);
                            
                            // --- CONTEXT INJECTION: Buscar arquivos relacionados na mesma pasta para dar contexto à IA ---
                            const folder = path.dirname(filePath);
                            const siblingFiles = fs.readdirSync(folder).filter(f => {
                                const ext = path.extname(f).toLowerCase();
                                return f !== path.basename(filePath) && ['.ts', '.js', '.tsx', '.jsx'].includes(ext) && fs.statSync(path.join(folder, f)).size < 15000;
                            }).slice(0, 3); // Pegar até 3 irmãos para não estourar contexto

                            const contextData = siblingFiles.map(f => ({
                                name: f,
                                code: fs.readFileSync(path.join(folder, f), 'utf-8').slice(0, 5000)
                            }));

                            // --- PAUSE CHECK ---
                            const { UpdateManager } = await import('./UpdateManager');
                            await UpdateManager.waitIfPaused();
                            const control = UpdateManager.getControlStatus();
                            if (control.status === 'stop_after_current') {
                                console.warn(`[INGESTER] Abortando processamento de arquivos por comando de STOP.`);
                                return { status: "partial", reason: "aborted_by_stop", filesProcessed: i };
                            }
                            // ------------------------------------

                            const aiResult = await this.decomposeWithAI(code, path.basename(filePath), contextData);
                            if (aiResult && aiResult.category && aiResult.block_id && aiResult.code) {
                                const isNewWinner = await this.evaluateAndDeduplicate(aiResult.category, aiResult.block_id, aiResult.code, repoUrl, filePath);
                                if (isNewWinner) {
                                    extractedModules.push({ category: aiResult.category, name: aiResult.block_id });
                                }
                                
                                // Salvar hash do arquivo original após sucesso da ingestão
                                ingestedHashes.add(fileHash);
                                fs.writeFileSync(ingestedHashesPath, JSON.stringify(Array.from(ingestedHashes), null, 2));
                                
                                fileSuccess = true;
                                break; // Sucesso para o arquivo corrente!
                            } else {
                                throw new Error("A IA retornou um formato de decomposição nulo ou inválido.");
                            }
                        } catch (fileErr: any) {
                            lastFileError = fileErr.message || "Erro desconhecido";
                            console.warn(`[INGESTER] Falha ao processar arquivo ${path.basename(filePath)} (Tentativa ${attempt}/${fileRetries}): ${lastFileError}`);
                            if (attempt < fileRetries) {
                                await this.sleep(2000 * attempt); // Delay incremental (backoff)
                            }
                        }
                    }

                    if (!fileSuccess) {
                        console.error(`[INGESTER] ERRO DEFINITIVO no processamento do arquivo ${relativePath} após ${fileRetries} tentativas: ${lastFileError}`);
                        
                        // Registra o erro de processamento individual em um log de auditoria ao invés de derrubar o pipeline
                        const errsLogPath = path.join(process.cwd(), 'POOL', 'ingestion-errors.json');
                        let errsLog: Record<string, string[]> = {};
                        if (fs.existsSync(errsLogPath)) {
                            try { errsLog = JSON.parse(fs.readFileSync(errsLogPath, 'utf8')); } catch (e) {}
                        }
                        if (!errsLog[repoUrl]) errsLog[repoUrl] = [];
                        errsLog[repoUrl].push(`${relativePath}: ${lastFileError}`);
                        try {
                            fs.writeFileSync(errsLogPath, JSON.stringify(errsLog, null, 2));
                        } catch (e) {}
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

        // Processa em lote pequeno para gerenciar limites de API
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

    private static async getBridge() {
        return new UniversalAIBridge({
            geminiKey: process.env.GEMINI_API_KEY
        });
    }

    private static async generateRepoBlueprint(repoUrl: string, files: string[], tmpPath: string): Promise<string> {
        const cacheKey = `blueprint:${repoUrl}`;
        const errorCacheKey = `blueprint:error:${repoUrl}`;
        const cached = this.getCache(cacheKey);
        if (cached) {
            console.log(`[INGESTER] Usando Blueprint em cache para: ${repoUrl}`);
            return cached;
        }

        const cachedError = this.getCache(errorCacheKey);
        if (cachedError) {
             console.log(`[INGESTER] Retornando Blueprint em cache com erro para: ${repoUrl}`);
             return cachedError;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        // Se estivermos em ambiente sem chave e não for AI Studio (fallback manual)
        const isFallback = !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '';

        try {
            const bridge = await this.getBridge();
            
            const tree = files.map(f => f.slice(tmpPath.length)).slice(0, 200).join('\n');
            const readmeContent = this.findREADME(tmpPath) || "Nenhum README encontrado.";
            const trimmedReadme = readmeContent.slice(0, 8000); // Protect context limits
            
            const prompt = `${POOL_SYSTEM_PROMPT}\n\nAnalise a estrutura de diretórios deste repositório e o seu README.md e crie um MAPA DA ARQUITETURA (Blueprint).
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
            
            const response = await bridge.prompt(prompt, 'gemini', 'gemini-1.5-flash');
            const text = response.text;
            await this.sleep(2000);
            
            if (text && text !== "Blueprint falhou.") {
                this.setCache(cacheKey, text);
            }
            return text;
        } catch (err: any) {
            console.error(`[INGESTER] Falha no Blueprint de ${repoUrl}:`, err.message);
            
            // Se falhou mesmo com fallback interno do UniversalAIBridge, gera um blueprint determinístico simples
            const tree = files.map(f => f.slice(tmpPath.length)).slice(0, 50).join('\n');
            const markdown = `# METADADOS (GERADO OFFLINE)\n- **Repo**: ${repoUrl}\n- **Aviso**: Blueprint gerado offline por falha na IA.\n\n## Arquivos Principais:\n\`\`\`text\n${tree}\n\`\`\``;
            return markdown;
        }
    }

    private static saveBlueprint(repoUrl: string, content: string) {
        const bpsPath = path.join(process.cwd(), 'POOL', 'blueprints');
        if (!fs.existsSync(bpsPath)) fs.mkdirSync(bpsPath, { recursive: true });
        
        const safeName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
        fs.writeFileSync(path.join(bpsPath, `${safeName}.md`), `# Blueprint Repositório: ${repoUrl}\n\n${content}`);
    }

    private static async decomposeWithAI(source: string, filename: string, context: {name: string, code: string}[] = [], attempt = 1): Promise<{category: string, block_id: string, code: string} | null> {
        // Criar chave de cache única baseada no hash do código do arquivo
        const contentHash = crypto.createHash('sha256').update(source).digest('hex');
        const cacheKey = `decompose:${contentHash}`;
        const cached = this.getCache(cacheKey);
        if (cached) {
            console.log(`[INGESTER] Usando resultado Decompose em cache para: ${filename}`);
            return cached;
        }

        try {
            const bridge = await this.getBridge();
            
            const prompt = `${POOL_SYSTEM_PROMPT}\n\nAtue como um arquiteto modular sênior de sistemas de alto desempenho. 
Analise detalhadamente o arquivo ${filename} para classificação sofisticada de código e extração de blocos lógicos autônomos. 
Como parte da análise rigorosa:
1. Examine a finalidade do código, imports, dependências e padrões estáticos de programação.
2. Extraia a lógica modular REAL (função, componente React ou classe TypeScript). É TERMINANTEMENTE PROIBIDO criar esqueletos vazios, funções de mentira ou simulacros (mocks). O código DEVE ser 100% completo, blindado com a lógica bruta e funcional.
3. Se o código depender de tipos ou utilitários presentes nos ARQUIVOS DE CONTEXTO fornecidos abaixo, INTEGRE ou SINTETIZE essa lógica para dentro do código final. O objetivo é que o Bloco Lego seja AUTOSSUFICIENTE e possa ser executado de forma independente.
4. Classifique o recurso especificamente em uma das seguintes categorias canônicas baseadas nos módulos existentes do ecossistema: [AUTH, DB, GEOMETRY, MEDIA, NETWORKING, SECURITY, AUTOMATION, UI, UTILS, ALGORITHM, AI, ML, AUDITOR, DATA, PROCEDURAL, SEARCH, VISION, VALIDATION].
5. IMPORTANTE: Defina o "block_id" de forma determinística utilizando snake_case extremamente descritiva da funcionalidade analisada.
6. REGRA DE OURO (ANTI-SIMULACRO): Você ESTÁ PROIBIDO de usar marcadores de omissão como "// ... resto do código aqui". Você DEVE retornar a implementação COMPLETA, PROFUNDA e VERDADEIRA encontrada no repositório.

Responda APENAS um objeto JSON estruturado contendo a classificação sofisticada:
{
  "category": "string",
  "block_id": "string",
  "code": "string (código typescript COMPLETO, PODEROSO E ROBUSTO, zero placeholders, 100% implementado e pronto para produção, incluindo dependências locais sintetizadas)"
}

CONTEXTO ADICIONAL (Arquivos relacionados na mesma pasta):
${context.map(c => `// FILE: ${c.name}\n${c.code}`).join('\n\n')}

SOURCE CODE PRINCIPAL (${filename}):
${source}
`;
            const response = await bridge.prompt(prompt, 'gemini', 'gemini-1.5-flash');
            const text = response.text;
            
            await this.sleep(2000); 

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
                    console.error(`[INGESTER] Erro ao parsear JSON sofisticado da IA:`, cleanText.substring(0, 100));
                    return null;
                }
            }
            return null;
        } catch (err: any) {
             const msg = err.message || '';
             console.error(`[INGESTER] Erro no Decompose de ${filename} (Tentativa ${attempt}):`, msg);

             if ((msg.includes('429') || msg.includes('rate limit')) && attempt <= 3) {
                 const waitTime = attempt * 12000;
                 console.warn(`[INGESTER] Rate limit atingido. Aguardando ${waitTime}ms para retentativa...`);
                 await this.sleep(waitTime);
                 return this.decomposeWithAI(source, filename, context, attempt + 1);
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
            if (existingCode.length > 60000 || newCode.length > 60000) return false; 

            try {
                const bridge = await this.getBridge();
                
                const prompt = `${POOL_SYSTEM_PROMPT}\n\nMescle inteligentemente ou decida qual o melhor código TypeScript profundo e real para o recurso de alta performance "${blockId}". 
Mantenha exports claros, tipos consistentes e trate erros adequadamente. 
É TERMINANTEMENTE PROIBIDO resumir o código, usar marcações de "// ... (código existente)" ou gerar esqueletos vazios. A implementação final deve ser COMPLETA, PODEROSA e PRONTA PARA PRODUÇÃO.
Retorne apenas o código TS puro sem explicações ou delimitadores.

EXISTING:
${existingCode}

NEW:
${newCode}`;

                const response = await bridge.prompt(prompt, 'gemini', 'gemini-1.5-flash');
                let merged = response.text;
                await this.sleep(2000);

                merged = merged.replace(/^```typescript/, '').replace(/^```ts/, '').replace(/```$/, '').trim();

                const header = `// [BLOCOS UNIFICADOS - RECURSO: ${blockId} - MERGED]\n// Audit: ${repoUrl}\n\n`;
                fs.writeFileSync(destPath, header + merged);
                console.log(`[INGESTER] MERGE CONCLUÍDO COM SUCESSO: ${blockId}`);
                return true;
            } catch (err: any) {
                console.error(`[INGESTER] Falha no Merge de ${blockId}:`, err.message);
                
                // Fallback de merge simples se a IA falhar
                if (newCode.length > existingCode.length) {
                    fs.writeFileSync(destPath, finalCode);
                }
                return true;
            }
        }
    }
}
