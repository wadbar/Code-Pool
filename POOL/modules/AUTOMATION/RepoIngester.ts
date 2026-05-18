// Bloco Unificado: RepoIngester
// Finalidade: Monitorar e fazer a ingestão automatizada de novos repositórios do GitHub.
// Ele clona o código em memória, manda pro GeminiBridge decompor e salva no Pool.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';

export class RepoIngester {
    /**
     * Ingestão autônoma de um repositório
     * Realiza clone físico, varredura estática de diretórios, 
     * acionamento do LLM para classificação e divisão em blocos (Lego),
     * e os destila (salva) nos módulos do sistema linux.
     */
    static async ingestFromGitHub(repoUrl: string, timeout: number = 45000) {
        console.log(`[INGESTER] Iniciando ciclo reverso autônomo. Destilar: ${repoUrl} (Timeout: ${timeout}ms)`);
        
        // 0. Carregar progresso anterior
        const progressPath = path.join(process.cwd(), 'POOL', 'ingestion-progress.json');
        let progress: Record<string, string[]> = {};
        if (fs.existsSync(progressPath)) {
            try { progress = JSON.parse(fs.readFileSync(progressPath, 'utf8')); } catch (e) {}
        }
        const digestedFiles = progress[repoUrl] || [];

        // 1. Setup workspace isolado de ambiente linux
        const safeName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
        const tmpPath = path.join(process.cwd(), 'POOL', '.tmp', safeName);
        
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
            const sliceSize = isMonsterPass ? 50 : allFiles.length;
            const filesToProcess = remainingFiles.slice(0, sliceSize);
            
            if (filesToProcess.length === 0) {
                 return { status: "success", reason: "all_files_processed" };
            }

            console.log(`[INGESTER] Digerindo fatia de ${filesToProcess.length} arquivos...`);

            for (let i = 0; i < filesToProcess.length; i++) {
                const filePath = filesToProcess[i];
                const relativePath = filePath.replace(tmpPath, '');
                
                const code = fs.readFileSync(filePath, 'utf-8');
                if (code.trim().length === 0 || code.length > 25000) {
                    digestedFiles.push(relativePath); // Marcar como "feito" (pulado)
                    continue; 
                }

                console.log(`[INGESTER] [${i + 1}/${filesToProcess.length}] Decompondo: ${path.basename(filePath)}`);
                
                // --- PAUSE CHECK (MODULO AUTONOMO) ---
                const { UpdateManager } = await import('./UpdateManager');
                await UpdateManager.waitIfPaused();
                const control = UpdateManager.getControlStatus();
                if (control.status === 'stop_after_current') {
                    console.warn(`[INGESTER] Abortando processamento de arquivos por comando de STOP.`);
                    return { status: "partial", reason: "aborted_by_stop", filesProcessed: i };
                }
                // ------------------------------------

                const aiResult = await this.decomposeWithAI(code, path.basename(filePath));
                
                if (aiResult && aiResult.category && aiResult.block_id) {
                    const isNewWinner = await this.evaluateAndDeduplicate(aiResult.category, aiResult.block_id, aiResult.code, repoUrl, filePath);
                    if (isNewWinner) extractedModules.push({ category: aiResult.category, name: aiResult.block_id });
                }
                
                digestedFiles.push(relativePath);
                
                // Salvar progresso incremental a cada 10 arquivos (segurança)
                if (i % 10 === 0) {
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
            console.error(`[INGESTER] Falha na ingestão: ${error.message}`);
            return { status: "failed", error: error.message };
        } finally {
            if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
        }
    }

    static async generateMissingBlueprints() {
        const registryPath = path.join(process.cwd(), 'POOL', 'pool-registry.json');
        if (!fs.existsSync(registryPath)) return;
        const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

        for (const repo of data.repositories) {
            const safeName = repo.url.replace(/[^a-zA-Z0-9]/g, '_');
            const bpsPath = path.join(process.cwd(), 'POOL', 'blueprints', `${safeName}.md`);
            if (fs.existsSync(bpsPath)) continue;

            console.log(`[INGESTER] Gerando Blueprint retroativo para: ${repo.url}`);
            const tmpPath = path.join(process.cwd(), 'POOL', '.tmp', safeName);
            
            try {
                if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
                fs.mkdirSync(tmpPath, { recursive: true });

                try {
                    execSync(`git clone --depth 1 --single-branch ${repo.url} ${tmpPath}`, { 
                        stdio: 'ignore',
                        timeout: 45000,
                        killSignal: 'SIGKILL'
                    });
                } catch (e: any) {
                    console.warn(`[INGESTER] Falha/Timeout no clone retroativo para ${repo.url}`);
                    continue; // Pula este e vai pro proximo no loop do try/finally
                }
                const files = this.scanDirForSourceCode(tmpPath);
                const appBlueprint = await this.generateRepoBlueprint(repo.url, files, tmpPath);
                this.saveBlueprint(repo.url, appBlueprint);
                console.log(`[INGESTER] Blueprint retroativo gerado.`);
            } catch (error: any) {
                console.error(`[INGESTER] Erro ao gerar blueprint retroativo para ${repo.url}:`, error.message);
            } finally {
                if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true, force: true });
            }
        }
        console.log(`[INGESTER] Finalizada varredura de blueprints retroativos.`);
    }

    private static scanDirForSourceCode(dir: string, fileList: string[] = []): string[] {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file === '.git' || file === 'node_modules' || file === 'dist' || file === 'build') continue;
            
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                this.scanDirForSourceCode(filePath, fileList);
            } else {
                if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.py')) {
                    fileList.push(filePath);
                }
            }
        }
        return fileList;
    }

    private static async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static async generateRepoBlueprint(repoUrl: string, files: string[], tmpPath: string): Promise<string> {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'fake-key-for-proxy' });
            // Construir mini arvore de arquivos
            const tree = files.map(f => f.replace(tmpPath, '')).slice(0, 150).join('\n'); // limite prudente
            
            const prompt = `Analise a estrutura de diretórios deste repositório e crie um MAPA DA ARQUITETURA (Blueprint).
Isso será usado para remontar os blocos modulares no futuro. Explique o padrão arquitetural, como as coisas se conectam e a stack.
URL: ${repoUrl}
Arquivos:
${tree}

Responda SOMENTE o documento em formato Markdown (Blueprint/Manual).`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            await this.sleep(4000);
            return response.text || "Blueprint falhou.";
        } catch (err) {
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
            // Inicializa SDK com chave dummy; a proxy da plataforma intercepta e injeta a chave autêntica
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'fake-key-for-proxy' });
            
            // Decisão Inteligente de Acoplamento (Filtro Lego) - Strict JSON Instruction
            const prompt = `Atue como um arquiteto modular sênior.
Analise o código-fonte fornecido do arquivo ${filename}. 
Sua tarefa é extrair a principal lógica, componente, função ou classe e devolvê-la adaptada para um escopo independente e modular em TypeScript.
A categoria deve ser estritamente UMA DESTAS (ou crie uma concisa se não se encaixar): [AUTH, DB, GEOMETRY, MEDIA, NETWORKING, SECURITY, AUTOMATION, UI, UTILS, ALGORITHM].
IMPORTANTE: Crie um "block_id" universal. Exemplo: se for um conector mongodb, block_id = "mongodb_connector". Se for auth JWT, block_id = "jwt_auth_service".
Responda APENAS com um objeto JSON válido contendo:
- "category": "nome_da_categoria"
- "block_id": "identificador_universal_do_bloco (snake_case exclusivo para o recurso)"
- "code": "o código typescript modular izado, pronto para compilar"

Código Fonte original:
\`\`\`
${source}
\`\`\`
`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                   responseMimeType: 'application/json',
                }
            });
            
            // Respeito ao Rate Limit proativamente
            await this.sleep(4000); 

            if (response.text) {
                const parsed = JSON.parse(response.text);
                return parsed;
            }
            return null;
        } catch (err: any) {
             const errMsg = err.message || '';
             if ((errMsg.includes('API key not valid') || errMsg.includes('401') || errMsg.includes('403')) && !errMsg.includes('fake-key')) {
                 console.error(`[INGESTER] CRITICAL AUTH FAILURE: Aborting ingestion. Check your GEMINI_API_KEY.`);
                 process.env.INGEST_FATAL_ERROR = "AUTH_FAILURE";
                 throw new Error("AUTH_FAILURE");
             }
             
             if (errMsg.includes('429') && attempt <= 3) {
                 console.warn(`[INGESTER] Rate Limit atingido (429). Aguardando 15s para retry (tentativa ${attempt}/3)...`);
                 await this.sleep(15000);
                 return this.decomposeWithAI(source, filename, attempt + 1);
             }
             console.error(`[INGESTER] Falha na decomposição IA (Alucinação ou recusa):`, errMsg);
             return null;
        }
    }

    private static async evaluateAndDeduplicate(category: string, blockId: string, newCode: string, repoUrl: string, filePath: string): Promise<boolean> {
        const catPath = path.join(process.cwd(), 'POOL', 'modules', category);
        if (!fs.existsSync(catPath)) fs.mkdirSync(catPath, { recursive: true });
        
        const destPath = path.join(catPath, `${blockId}.ts`);
        const finalCode = `// [BLOCOS UNIFICADOS - RECURSO: ${blockId}]\n// Última Contribuição: ${repoUrl} (${path.basename(filePath)})\n\n${newCode}`;

        if (!fs.existsSync(destPath)) {
            // Novo recurso na piscina, arquiva direto
            fs.writeFileSync(destPath, finalCode);
            console.log(`[INGESTER] NOVO BLOCO (Lego) Isolado: /modules/${category}/${blockId}.ts`);
            return true;
        } else {
            // Recurso redudante. Disputa pelo "Melhor Código".
            console.log(`[INGESTER] BLOCO REDUNDANTE IDENTIFICADO (${blockId}). Acionando IA para julgar e unificar o melhor código.`);
            const existingCode = fs.readFileSync(destPath, 'utf8');
            
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'fake-key-for-proxy' });
                const prompt = `Atue como Auditor Sênior de Software.
Temos dois blocos de código (Lego) rotulados sob o mesmo nome "${blockId}".
Exigência 1: Se eles fizerem a exata mesma coisa, decida qual bloco é mais otimizado, mais atualizado e sem erros. O melhor código vence. Se possível e fizer sentido, mescle as qualidades.
Exigência 2 [REGRA DE OURO]: Se as duas funcionalidades forem essencialmente DISTINTAS, incompatíveis e servem a propósitos difentes (ex: ambos se chamam "parser" mas um faz CSV e outro YAML), NÃO DESCARTAR NENHUM. Preserve os dois combinando-os no mesmo arquivo, exportando como classes/funções separadas (ex: CSVParser e YAMLParser).
Retorne SOMENTE O CÓDIGO FINAL em TypeScript pronto para produção, sem markdown \`\`\`ts e sem justificativas.

BLOCO ATUAL DA PISCINA:
${existingCode.substring(0, 5000)}

NOVO BLOCO PROPOSTO (${repoUrl}):
${newCode.substring(0, 5000)}`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });
                await this.sleep(4000); // Rate Limit

                let winnerCode = response.text || '';
                // Limpeza basica de markdown se vier vazado
                winnerCode = winnerCode.replace(/```typescript/g, '').replace(/```ts/g, '').replace(/```/g, '');

                const finalWinnerCode = `// [BLOCOS UNIFICADOS - RECURSO: ${blockId} - JULGADO E OTIMIZADO]\n// Última Avaliação/Merge: ${repoUrl}\n\n${winnerCode.trim()}`;
                fs.writeFileSync(destPath, finalWinnerCode);
                console.log(`[INGESTER] BATALHA CONCLUÍDA: O código para ${blockId} foi evoluído na POOL.`);
                return true;
            } catch (err: any) {
                console.error(`[INGESTER] Falha na disputa de duelo de código para ${blockId}, mantendo pool inalterada.`, err.message);
                return false;
            }
        }
    }
}

