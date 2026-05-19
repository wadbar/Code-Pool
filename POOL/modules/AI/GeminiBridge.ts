// Bloco Unificado: GeminiBridge
// Finalidade: Orquestração de modelos Gemini para Texto, Visão e Código
// Status: Consolidado (Originalmente em 9 repositórios @wadbar)

/**
 * @doc EXPLANATION OF EXTERNAL IMPORTS:
 * - `GoogleGenerativeAI` (@google/generative-ai): Biblioteca original de conexão da API do Google,
 *   encapsulada na classe GeminiBridge como interface de geração simplificada de texto, código e análises arquiteturais.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiBridge {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async prompt(text: string, modelName: string = "gemini-1.5-pro") {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(text);
        return result.response.text();
    }

    // Método especializado para geração de código modular
    async generateModule(description: string) {
        const instruction = `Gere apenas código TypeScript puro para o seguinte recurso: ${description}. Não inclua explicações ou markdown.`;
        return this.prompt(instruction);
    }
}
