// Bloco Unificado: GeminiBridge
// Finalidade: Orquestração de modelos Gemini para Texto, Visão e Código com suporte a streaming e tratamento robusto de erros.

import { GoogleGenAI } from "@google/genai";

export class GeminiBridge {
    private ai: GoogleGenAI;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Gemini API key is required to initialize GeminiBridge.");
        }
        this.ai = new GoogleGenAI({
            apiKey,
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
    async prompt(text: string, modelName: string = "gemini-3.5-flash", config: any = {}): Promise<string> {
        try {
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: text,
                config,
            });
            return response.text || "";
        } catch (error: any) {
            console.error(`[GeminiBridge] Erro ao gerar conteúdo com modelo ${modelName}:`, error);
            
            // Recuperação graciosa: tenta segunda vez com modelo fallback mais geral se for de outra classe
            if (modelName !== "gemini-3.5-flash") {
                console.warn(`[GeminiBridge] Retentando com modelo de recuperação gemini-3.5-flash...`);
                try {
                    const fallbackResponse = await this.ai.models.generateContent({
                        model: "gemini-3.5-flash",
                        contents: text,
                        config,
                    });
                    return fallbackResponse.text || "";
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
    async *promptStream(text: string, modelName: string = "gemini-3.5-flash", config: any = {}) {
        try {
            const responseStream = await this.ai.models.generateContentStream({
                model: modelName,
                contents: text,
                config,
            });
            for await (const chunk of responseStream) {
                yield chunk.text || "";
            }
        } catch (error: any) {
            console.error(`[GeminiBridge] Erro no streaming com modelo ${modelName}:`, error);
            throw new Error(`Falha de streaming Gemini: ${error.message}`);
        }
    }

    /**
     * Geração simples de texto a partir de um prompt.
     */
    async generateCompletion(prompt: string, modelName: string = "gemini-3.5-flash"): Promise<string> {
        try {
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: prompt,
            });
            return response.text || "";
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
