import { GoogleGenAI } from "@google/genai";
import { POOL_SYSTEM_PROMPT } from "./SystemPrompt";

export type AIProviderName = "gemini" | "ollama" | "nvidia" | "openai" | "codex";

export interface AIResponse {
    text: string;
    model: string;
    usage?: any;
    fallback?: boolean;
}

export interface UniversalAIConfig {
    geminiKey?: string;
    openaiKey?: string;
    nvidiaKey?: string;
    ollamaHost?: string;
}

export class UniversalAIBridge {
    private config: UniversalAIConfig;

    constructor(config: UniversalAIConfig) {
        this.config = config;
    }

    /**
     * Ponto de entrada universal para geração de conteúdo.
     * Implementa lógica de fallback automático para o Gemini se as chaves estiverem ausentes.
     */
    async prompt(text: string, provider: AIProviderName, model: string, systemInstruction: string = POOL_SYSTEM_PROMPT): Promise<AIResponse> {
        console.log(`[UniversalAIBridge] Dispatching request to ${provider} (${model})...`);
        
        // Verifica se as chaves necessárias estão presentes, caso contrário, aplica fallback para Gemini
        let targetProvider = provider;
        let targetModel = model;
        let isFallback = false;

        if (provider === "openai" || provider === "codex") {
            if (!this.config.openaiKey || this.config.openaiKey === "") {
                console.warn(`[UniversalAIBridge] OPENAI_API_KEY ausente. Aplicando fallback para Gemini.`);
                targetProvider = "gemini";
                targetModel = "gemini-1.5-flash"; // Modelo padrão resiliente
                isFallback = true;
            }
        } else if (provider === "nvidia") {
            if (!this.config.nvidiaKey || this.config.nvidiaKey === "") {
                console.warn(`[UniversalAIBridge] NVIDIA_API_KEY ausente. Aplicando fallback para Gemini.`);
                targetProvider = "gemini";
                targetModel = "gemini-1.5-flash";
                isFallback = true;
            }
        }

        let response: AIResponse;
        
        switch (targetProvider) {
            case "gemini":
                response = await this.callGemini(text, targetModel, systemInstruction);
                break;
            case "ollama":
                try {
                    response = await this.callOllama(text, model, systemInstruction);
                } catch (e) {
                    console.warn(`[UniversalAIBridge] Falha ao conectar ao Ollama local. Aplicando fallback para Gemini.`);
                    response = await this.callGemini(text, "gemini-1.5-flash", systemInstruction);
                    isFallback = true;
                }
                break;
            case "openai":
            case "codex":
                response = await this.callOpenAI(text, model, systemInstruction);
                break;
            case "nvidia":
                response = await this.callNvidia(text, model, systemInstruction);
                break;
            default:
                throw new Error(`Provider ${targetProvider} não suportado.`);
        }

        if (isFallback) {
            response.fallback = true;
            response.text = `[AVISO: FALLBACK ATIVADO - PROVIDER ORIGINAL: ${provider}]\n\n${response.text}`;
        }

        return response;
    }

    private async callGemini(prompt: string, model: string, system: string): Promise<AIResponse> {
        if (!this.config.geminiKey) throw new Error("GEMINI_API_KEY não configurada.");
        const genAI = new GoogleGenAI(this.config.geminiKey);
        const aiModel = genAI.getGenerativeModel({ model, systemInstruction: system });
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        return { text: response.text(), model };
    }

    private async callOllama(prompt: string, model: string, system: string): Promise<AIResponse> {
        const host = this.config.ollamaHost || "http://localhost:11434";
        const response = await fetch(`${host}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                prompt: `${system}\n\nUSER PROMPT: ${prompt}`,
                stream: false,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama Error: ${err}`);
        }

        const data = await response.json();
        return { text: data.response, model };
    }

    private async callOpenAI(prompt: string, model: string, system: string): Promise<AIResponse> {
        if (!this.config.openaiKey) throw new Error("OPENAI_API_KEY não configurada.");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.config.openaiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt },
                ],
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI Error: ${err}`);
        }

        const data = await response.json();
        return { text: data.choices[0].message.content, model };
    }

    private async callNvidia(prompt: string, model: string, system: string): Promise<AIResponse> {
        if (!this.config.nvidiaKey) throw new Error("NVIDIA_API_KEY não configurada.");
        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.config.nvidiaKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt },
                ],
                temperature: 0.2,
                top_p: 0.7,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`NVIDIA Error: ${err}`);
        }

        const data = await response.json();
        return { text: data.choices[0].message.content, model };
    }
}
