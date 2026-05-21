import fs from 'fs';
import path from 'path';
import { UniversalAIBridge } from '../AI';
import { POOL_SYSTEM_PROMPT } from '../AI/SystemPrompt';
import { BlockHealth } from './QualityAuditor';

export interface InteropMatrix {
    source_block: string;
    target_block: string;
    affinity: number; // 0-100 (how well they fit together)
    correlation: 'High' | 'Medium' | 'Low' | 'None';
    interdependence: 'Critical' | 'Optional' | 'Standalone';
    proximity: number; // semantic distance
    similarity: number; // algorithmic/logic similarity
    origin_compatibility: boolean; // if they share architectural heritage
    synergy_potential: number; // 0-100 potential for complex orchestration
    fit_result: string; // descriptive outcome of the combo
    stability_score: number; // probability of the combo working without errors
    suggested_implementation: string; // how to glue them
}

export interface LegoCompositionReport {
    timestamp: string;
    blocks_analyzed: string[];
    matrix: InteropMatrix[];
    top_synergies: string[];
}

export class LegoInteroperability {
    private bridge: UniversalAIBridge;

    constructor(config: any = {}) {
        this.bridge = new UniversalAIBridge({
            geminiKey: config.geminiKey || process.env.GEMINI_API_KEY,
            openaiKey: config.openaiKey || process.env.OPENAI_API_KEY,
            nvidiaKey: config.nvidiaKey || process.env.NVIDIA_API_KEY,
            ollamaHost: config.ollamaHost || process.env.OLLAMA_HOST
        });
    }

    /**
     * Analisa o "encaixe" de dois blocos Lego.
     * Determina se eles são compatíveis, se um depende do outro e qual a afinidade funcional.
     */
    public async analyzeFit(sourcePath: string, targetPath: string): Promise<InteropMatrix> {
        const sourceCode = fs.readFileSync(sourcePath, 'utf8');
        const targetCode = fs.readFileSync(targetPath, 'utf8');
        const sourceName = path.basename(sourcePath).replace(/\.[jt]s$/, '');
        const targetName = path.basename(targetPath).replace(/\.[jt]s$/, '');

        const prompt = `${POOL_SYSTEM_PROMPT}
Atue como um Arquiteto de Sistemas Ultra-Modular.
Sua missão é realizar um teste de "ENCAIXE LEGO" entre dois blocos de código.

BLOCO A: ${sourceName}
BLOCO B: ${targetName}

Analise os exports, imports, tipos de dados e lógica funcional de ambos para determinar a INTEROPERABILIDADE.

Responda APENAS um objeto JSON válido:
{
  "affinity": number (0-100),
  "correlation": "High" | "Medium" | "Low" | "None",
  "interdependence": "Critical" | "Optional" | "Standalone",
  "proximity": number (0-100),
  "similarity": number (0-100),
  "origin_compatibility": boolean,
  "synergy_potential": number (0-100),
  "fit_result": "Descrição curta do resultado da combinação",
  "stability_score": number (0-100),
  "suggested_implementation": "Código de exemplo ou instrução de como conectar os dois"
}`;

        try {
            const combinedContent = `CODE A (${sourceName}):\n${sourceCode}\n\nCODE B (${targetName}):\n${targetCode}`;
            const result = await this.bridge.prompt(`${prompt}\n\n${combinedContent}`, 'gemini', 'gemini-3.5-flash');

            const interop = JSON.parse(result.text.replace(/^```json/, '').replace(/```$/, '').trim());
            
            return {
                source_block: sourceName,
                target_block: targetName,
                ...interop
            };
        } catch (err: any) {
            console.error(`[INTEROP] Erro ao analisar encaixe entre ${sourceName} e ${targetName}:`, err.message);
            throw err;
        }
    }

    /**
     * Sugere as melhores combinações para um bloco específico dentro da Pool.
     */
    /**
     * Sugere as melhores combinações para um bloco específico dentro da Pool.
     */
    public async suggestSynergies(blockPath: string, poolBlocks: string[]): Promise<InteropMatrix[]> {
        const blockName = path.basename(blockPath).replace(/\.[jt]s$/, '');
        console.log(`[INTEROP] Procurando sinergias para o bloco: ${blockName}...`);
        
        const matrices: InteropMatrix[] = [];
        
        // Seleciona uma amostra se a pool for muito grande para evitar custos/tempo excessivos
        const candidates = poolBlocks.filter(b => b !== blockPath).slice(0, 5); 

        for (const candidate of candidates) {
            try {
                const matrix = await this.analyzeFit(blockPath, candidate);
                if (matrix.affinity > 50) {
                    matrices.push(matrix);
                }
            } catch (e) {}
        }

        return matrices.sort((a, b) => b.affinity - a.affinity);
    }

    /**
     * Analisa uma "Orquestração" ou "Conjunto" de múltiplos blocos funcionando juntos.
     */
    public async analyzeComposition(blockPaths: string[]): Promise<{
        synergy_score: number;
        cohesion: number;
        complexity: number;
        orchestration_plan: string;
        potential_issues: string[];
    }> {
        if (blockPaths.length < 2) throw new Error("Mínimo de 2 blocos para análise de composição.");
        
        const codes = blockPaths.map(p => ({
            name: path.basename(p),
            content: fs.readFileSync(p, 'utf8')
        }));

        const prompt = `${POOL_SYSTEM_PROMPT}
Atue como um Arquiteto de Sistemas Master.
Analise este CONJUNTO de blocos Lego que serão usados em COOPERAÇÃO.

COMPONENTES:
${codes.map(c => `- ${c.name}`).join('\n')}

Responda um JSON com:
{
  "synergy_score": number (0-100),
  "cohesion": number (0-100),
  "complexity": number (0-100),
  "orchestration_plan": "Como orquestrar esses blocos para uma aplicação real",
  "potential_issues": ["lista de conflitos de dependência ou lógica"]
}`;

        try {
            const combinedContent = codes.map(c => `// FILE: ${c.name}\n${c.content}`).join('\n\n');
            const result = await this.bridge.prompt(`${prompt}\n\n${combinedContent}`, 'gemini', 'gemini-3.5-flash');

            return JSON.parse(result.text.replace(/^```json/, '').replace(/```$/, '').trim());
        } catch (err: any) {
            console.error(`[INTEROP] Erro na análise de composição:`, err.message);
            throw err;
        }
    }
}
