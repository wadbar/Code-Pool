// Bloco Unificado: DistributedIndex
// Finalidade: Indexação full-text e persistência de metadados em cluster local.
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IndexDocument {
    id: string;
    content: string;
    metadata: Record<string, any>;
}

export interface SearchResult {
    documentId: string;
    score: number;
}

export class DistributedIndex {
    private indexName: string;
    private indexPath: string;
    private invertedIndex: Map<string, Set<string>> = new Map();
    private documents: Map<string, IndexDocument> = new Map();

    constructor(indexName: string) {
        this.indexName = indexName;
        this.indexPath = path.join(process.cwd(), 'POOL', '.tmp', `index-${indexName}.json`);
    }

    private tokenize(text: string): string[] {
        return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    }

    /**
     * Construção de índice invertido com persistência em disco.
     */
    async buildIndex(documents: IndexDocument[]): Promise<void> {
        console.log(`[INDEX] Processando ${documents.length} documentos para '${this.indexName}'...`);
        this.invertedIndex.clear();
        this.documents.clear();

        for (const doc of documents) {
            this.documents.set(doc.id, doc);
            const tokens = this.tokenize(doc.content);
            for (const token of tokens) {
                if (!this.invertedIndex.has(token)) {
                    this.invertedIndex.set(token, new Set());
                }
                this.invertedIndex.get(token)!.add(doc.id);
            }
        }

        await this.persist();
        console.log(`[INDEX] '${this.indexName}' indexado com sucesso.`);
    }

    private async persist(): Promise<void> {
        try {
            const data = {
                documents: Array.from(this.documents.entries()),
                index: Array.from(this.invertedIndex.entries()).map(([k, v]) => [k, Array.from(v)])
            };
            await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
            await fs.writeFile(this.indexPath, JSON.stringify(data), 'utf8');
        } catch (error) {
            console.error(`[INDEX] Falha na persistência do índice ${this.indexName}:`, error);
        }
    }

    /**
     * Busca Híbrida rudimentar (TF-IDF simples baseado em tokens)
     */
    async search(query: string): Promise<SearchResult[]> {
        const tokens = this.tokenize(query);
        const scores: Map<string, number> = new Map();

        for (const token of tokens) {
            const docIds = this.invertedIndex.get(token);
            if (docIds) {
                for (const docId of docIds) {
                    scores.set(docId, (scores.get(docId) || 0) + 1);
                }
            }
        }

        const results: SearchResult[] = Array.from(scores.entries()).map(([documentId, score]) => ({
            documentId,
            score
        })).sort((a, b) => b.score - a.score);

        return results;
    }
}
