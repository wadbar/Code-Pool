import fs from 'fs';
import path from 'path';
import { UniversalAIBridge, type AIProviderName } from '../AI';
import { POOL_SYSTEM_PROMPT } from '../AI/SystemPrompt';

export type MaturityLevel = 'Skeleton' | 'Partial' | 'Functional' | 'Robust' | 'Optimized';

export interface BlockHealth {
    block_id: string;
    path: string;
    score: number; // 0-100
    maturity: MaturityLevel;
    coverage: number; // estimated logic completion
    last_audit: string;
    findings: string[];
    suggestions: string[];
}

export interface PoolAuditReport {
    timestamp: string;
    total_blocks: number;
    average_score: number;
    health_by_maturity: Record<MaturityLevel, number>;
    blocks: BlockHealth[];
}

export class QualityAuditor {
    private bridge: UniversalAIBridge;
    private static REGISTRY_PATH = path.join(process.cwd(), 'POOL', 'data', 'health-registry.json');

    constructor(config: any = {}) {
        this.bridge = new UniversalAIBridge({
            geminiKey: config.geminiKey || process.env.GEMINI_API_KEY,
            openaiKey: config.openaiKey || process.env.OPENAI_API_KEY,
            nvidiaKey: config.nvidiaKey || process.env.NVIDIA_API_KEY,
            ollamaHost: config.ollamaHost || process.env.OLLAMA_HOST
        });
        this.ensureDataDir();
    }

    private ensureDataDir() {
        const dataDir = path.join(process.cwd(), 'POOL', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * Analisa profundamente o código de um bloco e retorna um score de saúde.
     */
    public async analyzeBlock(filePath: string): Promise<BlockHealth> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Arquivo não encontrado para auditoria: ${filePath}`);
        }

        const code = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const blockId = fileName.replace(/\.[jt]sx?$/, '');

        const prompt = `${POOL_SYSTEM_PROMPT}
Atue como um Auditor Sênior de Código e Engenheiro de Software de Elite.
Analise o seguinte código do bloco "${blockId}" e forneça um relatório técnico de SAÚDE E QUALIDADE.

CRITÉRIOS DE AVALIAÇÃO:
1. COMPLETUDO: O código implementa toda a lógica prometida ou é apenas um esqueleto/mock?
2. ROBUSTEZ: Existe tratamento de erros granular, validação de entrada e tipos consistentes?
3. MODULARIDADE: O código é autossuficiente e bem estruturado?
4. DOCUMENTAÇÃO: Possui metadados claros e comentários úteis?

Responda APENAS um objeto JSON formatado:
{
  "score": number (0-100),
  "maturity": "Skeleton" | "Partial" | "Functional" | "Robust" | "Optimized",
  "coverage": number (0-100, nível de lógica real vs placeholders/omissões),
  "findings": ["lista de problemas encontrados"],
  "suggestions": ["lista de melhorias para tornar o bloco poderoso"]
}`;

        try {
            const result = await this.bridge.prompt(`${prompt}\n\nCONTENT:\n${code}`, 'gemini', 'gemini-3.5-flash');
            
            const auditData = JSON.parse(result.text.replace(/^```json/, '').replace(/```$/, '').trim());
            
            const health: BlockHealth = {
                block_id: blockId,
                path: filePath.replace(process.cwd(), ''),
                score: auditData.score,
                maturity: auditData.maturity,
                coverage: auditData.coverage,
                last_audit: new Date().toISOString(),
                findings: auditData.findings,
                suggestions: auditData.suggestions
            };

            this.updateRegistry(health);
            return health;
        } catch (err: any) {
            console.error(`[AUDITOR] Erro ao analisar bloco ${blockId}:`, err.message);
            throw err;
        }
    }

    /**
     * Tenta "Poderizar" um bloco: Implementa o que está faltando ou complementa a lógica.
     */
    public async powerizeBlock(filePath: string): Promise<{ success: boolean; code?: string; message: string }> {
        const health = await this.analyzeBlock(filePath);
        if (health.score >= 90 && health.maturity === 'Optimized') {
            return { success: true, message: "Bloco já se encontra em estado de alta performance e otimizado." };
        }

        const currentCode = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);

        const prompt = `${POOL_SYSTEM_PROMPT}
Atue como um Engenheiro Principal de Software (Staff Engineer).
Sua missão é REFINAR, COMPLEMENTAR e PODERIZAR o código abaixo.
O usuário relatou que muitos blocos são apenas "esqueletos" ou "sombras".
VOCÊ DEVE:
1. Eliminar todos os simulacros, mocks, e comentários de omissão ("// ... rest of code").
2. Implementar a lógica BRUTA, REAL e FUNCIONAL de forma completa.
3. Adicionar validações robustas, tratamento de exceções e melhorar a performance.
4. Manter a API (assinaturas de funções/classes) original, mas torná-la poderosa.

Retorne APENAS o código TypeScript puro e completo. Sem explicações. Sem delimitadores Markdown.

CÓDIGO ATUAL (${fileName}):
${currentCode}`;

        try {
            console.log(`[AUDITOR] Iniciando 'Poderização' do bloco ${fileName}...`);
            const aiResponse = await this.bridge.prompt(prompt, 'gemini', 'gemini-2.0-flash-exp'); 
            
            // Cleanup just in case
            let enhancedCode = aiResponse.text.replace(/^```typescript/, '').replace(/^```ts/, '').replace(/```$/, '').trim();

            if (enhancedCode && enhancedCode.length > 100) {
                fs.writeFileSync(filePath, enhancedCode);
                console.log(`[AUDITOR] Bloco ${fileName} foi refinado e salvo com sucesso.`);
                
                // Re-auditar para atualizar status
                await this.analyzeBlock(filePath);
                
                return { success: true, message: `Bloco ${fileName} foi transformado em uma implementação robusta.`, code: enhancedCode };
            }
            return { success: false, message: "Falha ao gerar código refinado consistente." };
        } catch (err: any) {
            console.error(`[AUDITOR] Erro ao poderizar bloco:`, err.message);
            return { success: false, message: `Erro no processo de refinamento: ${err.message}` };
        }
    }

    /**
     * Varre toda a POOL e gera um relatório geral de saúde.
     */
    public async auditFullPool(): Promise<PoolAuditReport> {
        const modulesPath = path.join(process.cwd(), 'POOL', 'modules');
        const files = this.walkDir(modulesPath).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('index.ts'));
        
        console.log(`[AUDITOR] Iniciando Auditoria Geral da Pool (${files.length} blocos)...`);
        
        const reports: BlockHealth[] = [];
        for (const file of files) {
            try {
                const report = await this.analyzeBlock(file);
                reports.push(report);
                // Sleep to avoid rate limits
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.warn(`[AUDITOR] Pulando bloco ${file} devido a erro.`);
            }
        }

        const totalScore = reports.reduce((acc, r) => acc + r.score, 0);
        const avgScore = reports.length > 0 ? Math.round(totalScore / reports.length) : 0;
        
        const maturityCount: Record<MaturityLevel, number> = {
            'Skeleton': 0, 'Partial': 0, 'Functional': 0, 'Robust': 0, 'Optimized': 0
        };
        reports.forEach(r => maturityCount[r.maturity]++);

        const finalReport: PoolAuditReport = {
            timestamp: new Date().toISOString(),
            total_blocks: reports.length,
            average_score: avgScore,
            health_by_maturity: maturityCount,
            blocks: reports
        };

        fs.writeFileSync(path.join(process.cwd(), 'POOL', 'data', 'full_audit_report.json'), JSON.stringify(finalReport, null, 2));
        return finalReport;
    }

    private walkDir(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.walkDir(file));
            } else {
                results.push(file);
            }
        });
        return results;
    }

    private updateRegistry(health: BlockHealth) {
        let registry: Record<string, BlockHealth> = {};
        if (fs.existsSync(QualityAuditor.REGISTRY_PATH)) {
            try {
                registry = JSON.parse(fs.readFileSync(QualityAuditor.REGISTRY_PATH, 'utf8'));
            } catch (e) {}
        }
        registry[health.block_id] = health;
        fs.writeFileSync(QualityAuditor.REGISTRY_PATH, JSON.stringify(registry, null, 2));
    }

    public static getStoredHealth(blockId: string): BlockHealth | null {
        if (fs.existsSync(this.REGISTRY_PATH)) {
            try {
                const registry = JSON.parse(fs.readFileSync(this.REGISTRY_PATH, 'utf8'));
                return registry[blockId] || null;
            } catch (e) {}
        }
        return null;
    }
}
