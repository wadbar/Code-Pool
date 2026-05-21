// Bloco Unificado: GeminiBridge
// Finalidade: Orquestração de modelos Gemini para Texto, Visão e Código com suporte a streaming e tratamento robusto de erros.

import { GoogleGenAI } from "@google/genai";

export class GeminiBridge {
    private ai: GoogleGenAI;

    constructor(apiKey?: string) {
        // Fallback para a chave do ambiente se não for fornecida explicitamente
        const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
        
        if (!effectiveKey) {
            console.warn("[GeminiBridge] Nenhuma chave API detectada na inicialização. O modelo poderá falhar se não houver um ambiente pré-configurado.");
        }

        this.ai = new GoogleGenAI({
            apiKey: effectiveKey || "DUMMY_KEY", // Evita crash na lib mas permite falhar na requisição com erro real
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build',
                }
            }
        });
    }

    /**
     * Executa um prompt com tratamento robusto de erros e modelo fallback.
     */
    async prompt(text: string, modelName: string = "gemini-1.5-flash", config: any = {}): Promise<string> {
        try {
            const model = this.ai.getGenerativeModel({ model: modelName, ...config });
            const result = await model.generateContent(text);
            const response = await result.response;
            return response.text() || "";
        } catch (error: any) {
            console.error(`[GeminiBridge] Erro ao gerar conteúdo com modelo ${modelName}:`, error);
            
            if (modelName !== "gemini-1.5-flash") {
                console.warn(`[GeminiBridge] Retentando com modelo de recuperação gemini-1.5-flash...`);
                try {
                    const fallbackModel = this.ai.getGenerativeModel({ model: "gemini-1.5-flash" });
                    const result = await fallbackModel.generateContent(text);
                    const response = await result.response;
                    return response.text() || "";
                } catch (fallbackError: any) {
                    console.error(`[GeminiBridge] Modelo de recuperação também falhou:`, fallbackError);
                    throw new Error(`Falha Gemini API: ${error.message}. Fallback também falhou: ${fallbackError.message}`);
                }
            }
            throw new Error(`Falha Gemini API: ${error.message}`);
        }
    }

    /**
     * Suporta streaming assíncrono para respostas do modelo chunk por chunk.
     */
    async *promptStream(text: string, modelName: string = "gemini-1.5-flash", config: any = {}) {
        try {
            const model = this.ai.getGenerativeModel({ model: modelName, ...config });
            const result = await model.generateContentStream(text);
            for await (const chunk of result.stream) {
                yield chunk.text() || "";
            }
        } catch (error: any) {
            console.error(`[GeminiBridge] Erro no streaming com modelo ${modelName}:`, error);
            throw new Error(`Falha de streaming Gemini: ${error.message}`);
        }
    }

    /**
     * Geração simples de texto a partir de um prompt.
     */
    async generateCompletion(prompt: string, modelName: string = "gemini-1.5-flash"): Promise<string> {
        try {
            const model = this.ai.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text() || "";
        } catch (error: any) {
            console.error(`[GeminiBridge] Erro ao gerar completion com modelo ${modelName}:`, error);
            throw new Error(`Falha Gemini API na geração de completion: ${error.message}`);
        }
    }

    /**
     * Geração sofisticada de módulos TypeScript.
     */
    async generateModule(description: string) {
        const instruction = `Analise detalhadamente o seguinte pedido de recurso técnico e atue como um engenheiro principal de software.\n` +
            `Gere APENAS código TypeScript puro, modular, autossuficiente e livre de mockups ou simulacros para este recurso: ${description}.\n` +
            `Não forneça explicações em prosa antes ou depois, nem cercas de markdown do tipo \`\`\`typescript, retorne EXCLUSIVAMENTE o código-fonte executável e robusto.`;
        return this.prompt(instruction, "gemini-3.5-flash");
    }
}
