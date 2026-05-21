import fs from 'fs';
import path from 'path';
import { GeminiBridge } from '../AI/GeminiBridge';
import { POOL_SYSTEM_PROMPT } from '../AI/SystemPrompt';
import { BlockHealth } from './QualityAuditor';

export interface InteropMatrix {
    source_block: string;
    target_block: string;
    affinity: number; // 0-100 (how well they fit together)
    correlation: 'High' | 'Medium' | 'Low' | 'None';
    interdependence: 'Critical' | 'Optional' | 'Standalone';
    proximity: number; // semantic distance
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
    private bridge: GeminiBridge;

    constructor(apiKey: string) {
        this.bridge = new GeminiBridge(apiKey);
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
  "fit_result": "Descrição curta do resultado da combinação",
  "stability_score": number (0-100),
  "suggested_implementation": "Código de exemplo ou instrução de como conectar os dois"
}`;

        try {
            const combinedContent = `CODE A (${sourceName}):\n${sourceCode}\n\nCODE B (${targetName}):\n${targetCode}`;
            const result = await this.bridge.prompt(`${prompt}\n\n${combinedContent}`, 'gemini-3.5-flash', {
                responseMimeType: 'application/json'
            });

            const interop = JSON.parse(result.replace(/^```json/, '').replace(/```$/, '').trim());
            
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
    public async suggestSynergies(blockPath: string, poolBlocks: string[]): Promise<InteropMatrix[]> {
        const blockName = path.basename(blockPath).replace(/\.[jt]s$/, '');
        console.log(`[INTEROP] Procurando sinergias para o bloco: ${blockName}...`);
        
        const matrices: InteropMatrix[] = [];
        
        // Seleciona uma amostra se a pool for muito grande para evitar custos/tempo excessivos
        // Em um sistema real, poderíamos usar vetores de embedding para pré-selecionar candidatos
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
}
