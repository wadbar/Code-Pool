import { GoogleGenAI } from "@google/genai";
import { POOL_SYSTEM_PROMPT } from "./SystemPrompt";

export type AIProviderName = "gemini" | "ollama" | "nvidia" | "openai" | "codex";

export interface AIResponse {
    text: string;
    model: string;
    usage?: any;
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
     */
    async prompt(text: string, provider: AIProviderName, model: string, systemInstruction: string = POOL_SYSTEM_PROMPT): Promise<AIResponse> {
        console.log(`[UniversalAIBridge] Dispatching request to ${provider} (${model})...`);
        
        switch (provider) {
            case "gemini":
                return this.callGemini(text, model, systemInstruction);
            case "ollama":
                return this.callOllama(text, model, systemInstruction);
            case "openai":
            case "codex":
                return this.callOpenAI(text, model, systemInstruction);
            case "nvidia":
                return this.callNvidia(text, model, systemInstruction);
            default:
                throw new Error(`Provider ${provider} não suportado.`);
        }
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
