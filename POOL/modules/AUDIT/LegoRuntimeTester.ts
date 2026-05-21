import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GeminiBridge } from '../AI/GeminiBridge';

export interface TestResult {
    success: boolean;
    exit_code: number;
    output: string;
    errors: string[];
    stability_rating: number; // 0-100
    refinement_needed: boolean;
}

export class LegoRuntimeTester {
    private bridge: GeminiBridge;

    constructor(apiKey: string) {
        this.bridge = new GeminiBridge(apiKey);
    }

    /**
     * Executa um teste de "Pré-Voo" (Pre-flight):
     * Verifica sintaxe e tenta compilar/executar uma instância básica do bloco.
     */
    public async runPreflight(filePath: string): Promise<TestResult> {
        const fileName = path.basename(filePath);
        const testDir = path.join(process.cwd(), 'POOL', '.tmp', 'tests');
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

        const testFilePath = path.join(testDir, `preflight_${Date.now()}_${fileName}`);
        
        // Criar um script wrapper para tentar importar e instanciar
        const wrapperCode = `
import * as Module from '${filePath.replace(/\.ts$/, '')}';
console.log('[TEST] Importação bem-sucedida de ${fileName}');
const keys = Object.keys(Module);
console.log('[TEST] Exports detectados:', keys.join(', '));
if (keys.length === 0) throw new Error('O bloco não exporta nenhuma funcionalidade.');
`;

        fs.writeFileSync(testFilePath, wrapperCode);

        try {
            const output = execSync(`npx -y tsx ${testFilePath}`, { encoding: 'utf8', timeout: 5000 });
            return {
                success: true,
                exit_code: 0,
                output,
                errors: [],
                stability_rating: 90,
                refinement_needed: false
            };
        } catch (err: any) {
            const errors = [err.message, err.stderr || ''].filter(Boolean);
            return {
                success: false,
                exit_code: err.status || 1,
                output: err.stdout || '',
                errors,
                stability_rating: 30,
                refinement_needed: true
            };
        } finally {
            if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
        }
    }

    /**
     * Teste de "Tentativa e Erro" (Trial and Error):
     * O sistema tenta usar o bloco em um cenário e, se falhar, sugere correções imediatas.
     */
    public async trialAndError(filePath: string, scenario: string): Promise<{ result: TestResult; correction?: string }> {
        const preflight = await this.runPreflight(filePath);
        if (preflight.success) return { result: preflight };

        const currentCode = fs.readFileSync(filePath, 'utf8');
        const prompt = `
O bloco Lego "${path.basename(filePath)}" falhou no teste de execução.
ERROS:
${preflight.errors.join('\n')}

CENÁRIO DE USO:
${scenario}

CÓDIGO ATUAL:
${currentCode}

Atue como um Engenheiro Senior. Explique por que falhou e forneça APENAS o código corrigido e blindado para que o teste passe.
Retorne no formato JSON:
{
  "explanation": "...",
  "corrected_code": "..."
}`;

        try {
            const aiResponse = await this.bridge.prompt(prompt, 'gemini-3.5-flash', { responseMimeType: 'application/json' });
            const data = JSON.parse(aiResponse);
            return {
                result: preflight,
                correction: data.corrected_code
            };
        } catch (e) {
            return { result: preflight };
        }
    }
}
