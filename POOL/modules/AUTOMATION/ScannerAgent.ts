import fs from 'fs';
import path from 'path';

export interface ScanEvent {
    timestamp: string;
    type: 'DISC' | 'LEGO' | 'BLUEPRINT' | 'WATCHLIST' | 'SERVER';
    message: string;
}

export interface ScanCache {
    lastScanTime: string;
    totalRepos: number;
    totalBlocks: number;
    totalBlueprints: number;
    totalDigestedFiles: number;
    diskSizeKB: number;
    categoriesCount: Record<string, number>;
    events: ScanEvent[];
}

export class ScannerAgent {
    private cachePath: string;
    private registryPath: string;
    private modulesPath: string;
    private blueprintsPath: string;
    private knownBlocks: Set<string>;
    private knownBlueprints: Set<string>;
    private isScanning: boolean;

    constructor() {
        this.cachePath = path.join(process.cwd(), 'POOL', 'system-scan-cache.json');
        this.registryPath = path.join(process.cwd(), 'POOL', 'pool-registry.json');
        this.modulesPath = path.join(process.cwd(), 'POOL', 'modules');
        this.blueprintsPath = path.join(process.cwd(), 'POOL', 'blueprints');
        this.knownBlocks = new Set<string>();
        this.knownBlueprints = new Set<string>();
        this.isScanning = false;
        
        this.initCache();
    }

    private initCache() {
        if (!fs.existsSync(path.join(process.cwd(), 'POOL'))) {
            fs.mkdirSync(path.join(process.cwd(), 'POOL'), { recursive: true });
        }
        if (!fs.existsSync(this.cachePath)) {
            const initialCache: ScanCache = {
                lastScanTime: new Date().toISOString(),
                totalRepos: 0,
                totalBlocks: 0,
                totalBlueprints: 0,
                totalDigestedFiles: 0,
                diskSizeKB: 0,
                categoriesCount: {},
                events: [
                    {
                        timestamp: new Date().toISOString(),
                        type: 'SERVER',
                        message: 'Agente Varredor inicializado. Monitorando ciclo de arquivos de forma assíncrona.'
                    }
                ]
            };
            fs.writeFileSync(this.cachePath, JSON.stringify(initialCache, null, 2));
        }
    }

    private getCache(): ScanCache {
        try {
            if (fs.existsSync(this.cachePath)) {
                return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
            }
        } catch (e) {
            console.error('[SCANNER-AGENT] Erro ao carregar cache do varredor:', e);
        }
        return {
            lastScanTime: new Date().toISOString(),
            totalRepos: 0,
            totalBlocks: 0,
            totalBlueprints: 0,
            totalDigestedFiles: 0,
            diskSizeKB: 0,
            categoriesCount: {},
            events: []
        };
    }

    private saveCache(cache: ScanCache) {
        try {
            fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2));
        } catch (e) {
            console.error('[SCANNER-AGENT] Erro ao salvar cache:', e);
        }
    }

    public addEvent(type: ScanEvent['type'], message: string) {
        const cache = this.getCache();
        const timestamp = new Date().toISOString();
        cache.events.unshift({ timestamp, type, message });
        
        // Limita a 100 eventos relevantes recentes para não estourar tamanho do cache
        if (cache.events.length > 100) {
            cache.events = cache.events.slice(0, 100);
        }
        this.saveCache(cache);
    }

    /**
     * Varredura Recursiva Assíncrona Inteligente (Mapeia arquivos sem bloquear Event Loop)
     */
    private async scanDirAsync(dir: string, fileExtension?: string): Promise<{ path: string, size: number }[]> {
        if (!fs.existsSync(dir)) return [];
        try {
            const list = await fs.promises.readdir(dir);
            const results = await Promise.all(list.map(async (item) => {
                const fullPath = path.join(dir, item);
                try {
                    const stat = await fs.promises.stat(fullPath);
                    if (stat.isDirectory()) {
                        return this.scanDirAsync(fullPath, fileExtension);
                    } else {
                        if (fileExtension && !item.endsWith(fileExtension)) {
                            return [];
                        }
                        return [{ path: fullPath, size: stat.size }];
                    }
                } catch (err) {
                    return [];
                }
            }));
            return results.reduce((acc, current) => acc.concat(current), []);
        } catch (e) {
            return [];
        }
    }

    /**
     * Executa a varredura completa do ambiente
     */
    public async executeScan() {
        if (this.isScanning) return;
        this.isScanning = true;

        const startTime = Date.now();
        // console.log('[SCANNER-AGENT] Iniciando varredura completa do sistema de arquivos...');

        try {
            // 1. Carrega dados de repositórios do pool-registry.json
            let totalRepos = 0;
            let totalDigestedFiles = 0;
            if (fs.existsSync(this.registryPath)) {
                try {
                    const regData = JSON.parse(await fs.promises.readFile(this.registryPath, 'utf8'));
                    if (regData && Array.isArray(regData.repositories)) {
                        totalRepos = regData.repositories.length;
                        totalDigestedFiles = regData.repositories.reduce((acc: number, r: any) => acc + (r.digestedCount || 0), 0);
                    }
                } catch (e) {
                    console.error('[SCANNER-AGENT] Erro ao ler pool-registry.json de forma assíncrona:', e);
                }
            }

            // 2. Varredura física das peças Lego (arquivos .ts em POOL/modules)
            const modulesResult = await this.scanDirAsync(this.modulesPath, '.ts');
            // Remove arquivos de índice e resolve arquivos relativos
            const blocks = modulesResult.filter(r => !r.path.endsWith('index.ts'));
            const totalBlocks = blocks.length;

            // 3. Varredura física dos blueprints (arquivos .md em POOL/blueprints)
            const blueprintsResult = await this.scanDirAsync(this.blueprintsPath, '.md');
            const totalBlueprints = blueprintsResult.length;

            // 4. Calcular o tamanho das categorias físicas reais
            const categoriesCount: Record<string, number> = {};
            if (fs.existsSync(this.modulesPath)) {
                try {
                    const dirs = await fs.promises.readdir(this.modulesPath);
                    for (const d of dirs) {
                        const dPath = path.join(this.modulesPath, d);
                        const dStat = await fs.promises.stat(dPath);
                        if (dStat.isDirectory()) {
                            const subFiles = await fs.promises.readdir(dPath);
                            const count = subFiles.filter(f => f.endsWith('.ts') && f !== 'index.ts').length;
                            if (count > 0) {
                                categoriesCount[d.toUpperCase()] = count;
                            }
                        }
                    }
                } catch (e) {}
            }

            // 5. Cálculo volumétrico de bytes no disco
            const totalBytes = blocks.reduce((acc, r) => acc + r.size, 0) + blueprintsResult.reduce((acc, r) => acc + r.size, 0);
            const diskSizeKB = Math.round(totalBytes / 1024);

            // 6. Detecção de Alterações reais (Diferencial para disparar eventos nativos)
            const currentBlocksSet = new Set(blocks.map(b => path.basename(b.path)));
            const currentBlueprintsSet = new Set(blueprintsResult.map(bp => path.basename(bp.path)));

            // Se for a primeira varredura da sessão, apenas inicializa conjuntos conhecidos
            if (this.knownBlocks.size > 0) {
                // Novos blocos criados
                for (const b of currentBlocksSet) {
                    if (!this.knownBlocks.has(b)) {
                        this.addEvent('LEGO', `Novo bloco Lego detectado no disco: ${b}`);
                    }
                }
                // Blocos deletados
                for (const b of this.knownBlocks) {
                    if (!currentBlocksSet.has(b)) {
                        this.addEvent('LEGO', `Bloco Lego removido do disco físico: ${b}`);
                    }
                }
            }

            if (this.knownBlueprints.size > 0) {
                // Novos blueprints criados
                for (const bp of currentBlueprintsSet) {
                    if (!this.knownBlueprints.has(bp)) {
                        const rawTitle = bp.replace('.md', '').replaceAll('___', '://').replaceAll('_', '/');
                        this.addEvent('BLUEPRINT', `Novo blueprint arquitetural compilado: ${rawTitle}`);
                    }
                }
                // Blueprints deletados
                for (const bp of this.knownBlueprints) {
                    if (!currentBlueprintsSet.has(bp)) {
                        this.addEvent('BLUEPRINT', `Blueprint descartado do disco: ${bp}`);
                    }
                }
            }

            // Atualiza conjuntos em memória para a próxima iteração
            this.knownBlocks = currentBlocksSet;
            this.knownBlueprints = currentBlueprintsSet;

            // 7. Salva estatísticas consolidadas no cache
            const cache = this.getCache();
            cache.lastScanTime = new Date().toISOString();
            cache.totalRepos = totalRepos;
            cache.totalBlocks = totalBlocks;
            cache.totalBlueprints = totalBlueprints;
            cache.totalDigestedFiles = totalDigestedFiles;
            cache.diskSizeKB = diskSizeKB;
            cache.categoriesCount = categoriesCount;

            this.saveCache(cache);

            // const elapsed = Date.now() - startTime;
            // console.log(`[SCANNER-AGENT] Varredura física completa em ${elapsed}ms. Dados cacheados com sucesso.`);

        } catch (error: any) {
            console.error('[SCANNER-AGENT] Falha na varredura física do disco:', error);
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Loop autônomo periódico que impede qualquer travamento do servidor
     */
    public startDaemon(intervalMs: number = 5000) {
        // Primeira varredura assíncrona imediata
        setImmediate(() => this.executeScan());
        
        setInterval(() => {
            this.executeScan().catch(err => {
                console.error('[SCANNER-AGENT] Daemon de varredura crashou:', err);
            });
        }, intervalMs);
    }
}
