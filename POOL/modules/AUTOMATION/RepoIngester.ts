// Bloco Unificado: RepoIngester
// Finalidade: Monitorar e fazer a ingestão automatizada de novos repositórios do GitHub.
// Ele clona o código em memória, manda pro GeminiBridge decompor e salva no Pool.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class RepoIngester {
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

            // 1. Setup workspace isolado EXTERNO à raiz do projeto (Evita conflitos com o Vite)
            const safeName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
            const tmpBase = path.join(os.tmpdir(), 'lego-pool-tmp');
            if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
            
            const tmpPath = path.join(tmpBase, safeName);
            
            if (fs.existsSync(tmpPath)) {
                fs.rmSync(tmpPath, { recursive: true, force: true });
            }
            fs.mkdirSync(tmpPath, { recursive: true });

            const extractedModules: any[] = [];
            try {
                // 2. Clone real no SO
                console.log(`[INGESTER] (Exec) git clone no rep: ${repoUrl}`);
                try {
                    execSync(`git clone --depth 1 --single-branch ${repoUrl} ${tmpPath}`, {
                        stdio: 'ignore', 
                        timeout: timeout,
                        killSignal: 'SIGKILL'
                    });
                } catch (cloneErr: any) {
                    console.warn(`[INGESTER] Repo muito grande ou timeout (Monster) detectado para ${repoUrl}. Reenviando para o final da fila.`);
                    return { status: "monster", reason: "clone_timeout" };
                }

                // 3. Varredura e Filtro de Progresso
                let allFiles = this.scanDirForSourceCode(tmpPath);
                
                // Priorização: Arquivos menores e tipos TS/JS primeiro
                allFiles = allFiles.sort((a, b) => {
                    const extA = path.extname(a);
                    const extB = path.extname(b);
                    const priority = { '.ts': 1, '.tsx': 1, '.js': 2, '.jsx': 2, '.py': 3 };
                    const pA = (priority as any)[extA] || 99;
                    const pB = (priority as any)[extB] || 99;
                    return pA - pB || fs.statSync(a).size - fs.statSync(b).size;
                });

                // Filtrar o que já foi digerido (compara pelo caminho relativo dentro do repo)
                const remainingFiles = allFiles.filter(f => !digestedFiles.includes(f.replace(tmpPath, '')));
                
                console.log(`[INGESTER] Telemetria: ${allFiles.length} totais. ${remainingFiles.length} pendentes.`);

                // 4. Gerar Blueprint apenas se for a primeira vez
                const safeRepoName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
                const blueprintExists = fs.existsSync(path.join(process.cwd(), 'POOL', 'blueprints', `${safeRepoName}.md`));
                if (!blueprintExists) {
                    console.log(`[INGESTER] Gerando Blueprint Global...`);
                    const appBlueprint = await this.generateRepoBlueprint(repoUrl, allFiles, tmpPath);
                    this.saveBlueprint(repoUrl, appBlueprint);
                }

                // 5. Fatiamento: Se for monstro ou muito grande, processamos 50 por vez
                const isMonsterPass = timeout > 45000 || allFiles.length > 300;
                const sliceSize = isMonsterPass ? 50 : 25; // Smaller slices for stability
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

        for (const repo of data.repositories) {
            const safeName = repo.url.replace(/[^a-zA-Z0-9]/g, '_');
            const bpsPath = path.join(process.cwd(), 'POOL', 'blueprints', `${safeName}.md`);
            if (fs.existsSync(bpsPath)) continue;

            console.log(`[INGESTER] Gerando Blueprint retroativo para: ${repo.url}`);
            const tmpPath = path.join(os.tmpdir(), 'lego-pool-tmp', safeName);
            
            try {
                if (!fs.existsSync(path.dirname(tmpPath))) fs.mkdirSync(path.dirname(tmpPath), { recursive: true });

                try {
                    execSync(`git clone --depth 1 --single-branch ${repo.url} ${tmpPath}`, { 
                        stdio: 'ignore',
                        timeout: 60000,
                        killSignal: 'SIGKILL'
                    });
                } catch (e: any) {
                    console.warn(`[INGESTER] Falha/Timeout no clone retroativo para ${repo.url}`);
                    continue;
                }
                const files = this.scanDirForSourceCode(tmpPath);
                if (files.length > 0) {
                    const appBlueprint = await this.generateRepoBlueprint(repo.url, files, tmpPath);
                    this.saveBlueprint(repo.url, appBlueprint);
                    console.log(`[INGESTER] Blueprint retroativo gerado.`);
                }
            } catch (error: any) {
                console.error(`[INGESTER] Erro ao gerar blueprint retroativo para ${repo.url}:`, error.message);
            } finally {
                try {
                    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
                } catch (rmErr) {}
            }
        }
        console.log(`[INGESTER] Finalizada varredura de blueprints retroativos.`);
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
        try {
            const genAI = this.getAI();
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const tree = files.map(f => f.slice(tmpPath.length)).slice(0, 200).join('\n');
            
            const prompt = `Analise a estrutura de diretórios deste repositório e crie um MAPA DA ARQUITETURA (Blueprint).
Isso será usado para remontar os blocos modulares no futuro. Explique o padrão arquitetural, como as coisas se conectam e a stack.
URL: ${repoUrl}
Arquivos:
${tree}

Responda SOMENTE o documento em formato Markdown (Blueprint/Manual) sem blocos de código extras.`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            await this.sleep(3000);
            return response.text() || "Blueprint falhou.";
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
A categoria deve ser uma destas: [AUTH, DB, GEOMETRY, MEDIA, NETWORKING, SECURITY, AUTOMATION, UI, UTILS, ALGORITHM, ML].
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
                    return JSON.parse(cleanText);
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
