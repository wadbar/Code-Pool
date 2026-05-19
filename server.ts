import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';

import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';
import { RepoIngester } from './POOL/modules/AUTOMATION/RepoIngester';
import { HungryPoolEngine } from './POOL/modules/AUTOMATION/HungryPoolEngine';
import { UrlScraper } from './POOL/modules/AUTOMATION/UrlScraper';
import { ScannerAgent } from './POOL/modules/AUTOMATION/ScannerAgent';

const app = express();
const PORT = 3000;
const updateManager = new UpdateManager();
const hungryPool = new HungryPoolEngine(updateManager);

const scannerAgent = new ScannerAgent();
scannerAgent.startDaemon(5000); // Executa varreduras assíncronas do disco físico a cada 5 segundos

export function logSystem(msg: string) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  try {
    fs.appendFileSync(path.join(process.cwd(), 'system.log'), `[${timestamp}] ${msg}\n`);
  } catch (err) {
    console.error('Failed to write to system.log', err);
  }
}

let lastDaemonCheckTime = 0;

export function checkAndResurrectDaemons(force = false) {
  const now = Date.now();
  if (!force && (now - lastDaemonCheckTime < 10000)) return;
  lastDaemonCheckTime = now;

  const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
  let currentStatus = 'running';
  if (fs.existsSync(controlPath)) {
    try {
      currentStatus = JSON.parse(fs.readFileSync(controlPath, 'utf8')).status || 'running';
    } catch (e) {}
  }

  if (currentStatus === 'paused') {
    return;
  }

  try {
    const ingestRunning = execSync("ps aux | grep 'worker_ingest' | grep -v grep || true").toString().trim().length > 0;
    const blueprintsRunning = execSync("ps aux | grep 'worker_blueprints' | grep -v grep || true").toString().trim().length > 0;

    if (!ingestRunning || !blueprintsRunning) {
      console.log(`[SYS-AUTO-HEAL] Daemons missing (Ingest: ${ingestRunning}, Blueprints: ${blueprintsRunning}). Resurrecting silently...`);
      logSystem(`[AUTO-HEAL] Daemons de background detectados inativos pela infraestrutura serverless. Ressuscitando de forma automatizada e transparente...`);
      execSync('npx -y tsx start_daemons.mjs');
    }
  } catch (err: any) {
    console.error(`[SYS-AUTO-HEAL] Failed to verify or resurrect daemons:`, err.message);
  }
}

app.use(express.json());

// Block access to .tmp from frontend and prevent Vite from trying to transform missing assets
app.use('/POOL/.tmp', (req, res, next) => {
  const fullPath = path.join(process.cwd(), 'POOL', '.tmp', req.path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found in temporary storage' });
  }
  // If it exists, block it anyway to be safe and prevent Vite from processing it
  res.status(403).json({ error: 'Access to temporary files is restricted' });
});

// Set up periodic automatic hunt triggering
setInterval(async () => {
  console.log(`[SYS] Triggering automatic hunt...`);
  try {
    await hungryPool.huntForCode();
  } catch (err) {
    console.error(`[SYS] Automatic hunt failed:`, err);
  }
}, 60 * 60 * 1000);

// Endpoint de Inventario de Blocos Extrapolados
app.get('/api/pool/inventory', (req, res) => {
  const poolPath = path.join(process.cwd(), 'POOL', 'modules');
  if (!fs.existsSync(poolPath)) return res.json({ inventory: [] });

  const categories = fs.readdirSync(poolPath).filter(f => fs.statSync(path.join(poolPath, f)).isDirectory());
  const inventory = categories.map(cat => {
    const catPath = path.join(poolPath, cat);
    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.ts') && f !== 'index.ts');
    return { category: cat, blocks: files };
  });
  
  res.json({ inventory });
});

// Code Pool Auditor API
app.get('/api/check-gemini', (req, res) => res.json({ hasKey: !!process.env.GEMINI_API_KEY, len: (process.env.GEMINI_API_KEY || '').length }));

// Novo endpoint do Agente de Varredura de Eventos em Tempo Real do Disco e Logs (Wadbar Direct Scan)
app.get('/api/pool/real-scan-data', (req, res) => {
  checkAndResurrectDaemons();

  const cachePath = path.join(process.cwd(), 'POOL', 'system-scan-cache.json');
  if (!fs.existsSync(cachePath)) {
    return res.json({ 
      lastScanTime: new Date().toISOString(),
      totalRepos: updateManager.listWatched().length,
      totalBlocks: 0,
      totalBlueprints: 0,
      totalDigestedFiles: 0,
      diskSizeKB: 0,
      categoriesCount: {},
      events: [{ timestamp: new Date().toISOString(), type: 'SERVER', message: 'Mecanismo de auditoria em carregamento inicial...' }]
    });
  }
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: 'Falha ao ler cache do scanner', details: e.message });
  }
});

app.get('/api/pool/status', (req, res) => {
  const poolPath = path.join(process.cwd(), 'POOL', 'modules');
  if (fs.existsSync(poolPath)) {
    const modules = fs.readdirSync(poolPath).filter(f => fs.statSync(path.join(poolPath, f)).isDirectory());
    res.json({
      status: 'Ready',
      architectural_modules: modules,
      message: 'Terminal de Auditoria Wadbar (Lego Pool) Ativo.'
    });
  } else {
    res.status(404).json({ error: 'Pool modules directory not found' });
  }
});

// List files within a specific capability module
app.get('/api/pool/modules/:category', (req, res) => {
  const { category } = req.params;
  const catPath = path.join(process.cwd(), 'POOL', 'modules', category);
  
  if (fs.existsSync(catPath)) {
    const files = fs.readdirSync(catPath)
      .filter(f => f.endsWith('.ts'))
      .map(f => `/POOL/modules/${category}/${f}`);
    res.json({ category, available_blocks: files });
  } else {
    res.status(404).json({ error: 'Category not found' });
  }
});

// Endpoint de Ingestão Automatizada
app.post('/api/pool/ingest', express.json(), async (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) {
    return res.status(400).json({ error: 'Forneça a githubUrl' });
  }
  
  updateManager.addRepository(githubUrl);
  console.log(`[INGEST] Adicionando repositório à fila: ${githubUrl}`);
  
  res.json({ 
    status: 'Ingestion Queued',
    target: githubUrl,
    message: 'Repositório enfileirado para processamento em background.'
  });
});

// Endpoint autônomo para ingerir repositórios
app.post('/api/pool/ingest-all', async (req, res) => {
  console.log(`[INGEST] Comando de ingestão global recebido.`);
  
  updateManager.syncAll(true).then(() => {
     console.log(`[INGEST] Ingestão global background finalizada.`);
  }).catch(err => {
     console.error(`[INGEST] Erro na ingestão global:`, err);
  });

  res.json({ 
    status: 'Global Ingestion task started',
    message: 'Ciclo de processamento global iniciado. Acompanhe os logs via endpoint de log.'
  });
});

// Endpoint de Registro de Repositório Watchlist
app.get('/api/pool/registry', (req, res) => {
  res.json({
      watched: updateManager.listWatched(),
      total: updateManager.listWatched().length
  });
});

// Endpoint para contar blueprints reais na pasta POOL/blueprints
app.get('/api/pool/blueprints', (req, res) => {
  const blueprintsPath = path.join(process.cwd(), 'POOL', 'blueprints');
  if (!fs.existsSync(blueprintsPath)) {
    return res.json({ count: 0, blueprints: [] });
  }
  try {
    const files = fs.readdirSync(blueprintsPath).filter(f => f.endsWith('.md'));
    res.json({
      count: files.length,
      blueprints: files.map(f => ({
        name: f.replace('.md', '').replaceAll('___', '://').replaceAll('_', '/'),
        filename: f
      }))
    });
  } catch (err: any) {
    res.json({ count: 0, blueprints: [] });
  }
});

app.post('/api/pool/registry/remove', express.json(), (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  const removed = updateManager.removeRepository(url);
  if (removed) {
    scannerAgent.addEvent('WATCHLIST', `URL removida: ${url}`);
    scannerAgent.executeScan();
    res.json({ status: 'Removed', url });
  } else {
    res.status(404).json({ error: 'Repository not found in registry' });
  }
});

app.post('/api/pool/registry/add', express.json(), (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  const added = updateManager.addRepository(url);
  if (added) {
    scannerAgent.addEvent('WATCHLIST', `Nova URL adicionada à Watchlist: ${url}`);
  } else {
    scannerAgent.addEvent('WATCHLIST', `Tentativa de registrar URL duplicada/inválida: ${url}`);
  }
  scannerAgent.executeScan();
  res.json({ status: 'success', message: 'Repositório enfileirado para digestão.' });
});

// Endpoint para Sync Manual da Pool
app.post('/api/pool/sync', async (req, res) => {
  try {
      logSystem("Iniciando sincronização (sync) manual de todos os repositórios...");
      const result = await updateManager.syncAll();
      logSystem(`Sincronização manual concluída! Repositórios novos adicionados e processamento enfileirado.`);
      res.json(result);
  } catch (err: any) {
      logSystem(`Falha na sincronização manual: ${err.message}`);
      res.status(500).json({ error: 'Falha na sincronização global', details: err.message });
  }
});

// Endpoint para Caçada Autônoma (Hungry Pool)
app.post('/api/pool/hunt', async (req, res) => {
  try {
      logSystem("Iniciando busca automática de repositórios (GitHub)...");
      const result = await hungryPool.huntForCode();
      logSystem(`Busca concluída. Total de novos repositórios encontrados: ${result.hunted || 0}`);
      res.json({
          status: 'Hunting completed',
          ...result,
          message: 'Novos repositórios encontrados e enfileirados para processamento.'
      });
  } catch (err: any) {
      logSystem(`Erro durante a busca: ${err.message}`);
      res.status(500).json({ error: 'Falha durante a busca.', details: err.message });
  }
});

// Endpoint para extrair links de github de uma URL ou lista de artigos/documentos e encher a esteira (fila de digestão)
app.post('/api/pool/scrape-url', express.json(), async (req, res) => {
  const { sourceUrl, rawContent } = req.body;
  if (!sourceUrl && !rawContent) return res.status(400).json({ error: 'Forneça a sourceUrl ou rawContent para raspar.' });

  const result = await UrlScraper.scrapeAndQueueRepos(sourceUrl, rawContent);
  if (result.status === "error") {
      return res.status(500).json(result);
  }
  return res.json(result);
});

// Endpoint para visualizar os logs de ingestão em "tempo real" (últimas linhas)
app.get('/api/pool/logs', (req, res) => {
    checkAndResurrectDaemons();
    try {
        const ingestLogs = fs.existsSync('ingest.log') ? fs.readFileSync('ingest.log', 'utf8').split('\n').slice(-50).join('\n') : "Aguardando worker de ingestão...";
        const blueprintLogs = fs.existsSync('blueprints.log') ? fs.readFileSync('blueprints.log', 'utf8').split('\n').slice(-30).join('\n') : "Aguardando worker de blueprints...";
        const systemLogs = fs.existsSync('system.log') ? fs.readFileSync('system.log', 'utf8').split('\n').slice(-50).join('\n') : "";
        
        res.json({
            ingestion: ingestLogs,
            blueprints: blueprintLogs,
            system: systemLogs,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: "Falha ao ler logs." });
    }
});

// Ingestion Control Endpoints
app.get('/api/pool/worker/status', (req, res) => {
    const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
    if (!fs.existsSync(controlPath)) return res.json({ status: 'running' });
    try {
        const data = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
        res.json(data);
    } catch (e) {
        res.json({ status: 'running' });
    }
});

app.post('/api/pool/worker/control', (req, res) => {
    const { status } = req.body;
    if (!['running', 'paused', 'stop_after_current'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
    if (!fs.existsSync(path.join(process.cwd(), 'POOL'))) {
        fs.mkdirSync(path.join(process.cwd(), 'POOL'), { recursive: true });
    }
    fs.writeFileSync(controlPath, JSON.stringify({ status }));
    console.log(`[SYS] Control status updated to: ${status}`);
    logSystem(`Status do Worker alterado para: ${status.toUpperCase()}`);
    res.json({ status });
});

app.post('/api/pool/worker/purge-tmp', (req, res) => {
    const tmpPathOld = path.join(process.cwd(), 'POOL', '.tmp');
    const tmpPathNew = path.join(os.tmpdir(), 'lego-pool-tmp');
    try {
        if (fs.existsSync(tmpPathOld)) {
            fs.rmSync(tmpPathOld, { recursive: true, force: true });
            fs.mkdirSync(tmpPathOld, { recursive: true });
        }
        if (fs.existsSync(tmpPathNew)) {
            fs.rmSync(tmpPathNew, { recursive: true, force: true });
            fs.mkdirSync(tmpPathNew, { recursive: true });
        }
        logSystem("Limpeza de arquivos temporários (.tmp e lego-pool-tmp) concluída.");
        res.json({ status: 'Purged all temp locations' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/pool/worker/purge-logs', (req, res) => {
    try {
        if (fs.existsSync('ingest.log')) fs.writeFileSync('ingest.log', '');
        if (fs.existsSync('ingest.err')) fs.writeFileSync('ingest.err', '');
        if (fs.existsSync('blueprints.log')) fs.writeFileSync('blueprints.log', '');
        if (fs.existsSync('blueprints.err')) fs.writeFileSync('blueprints.err', '');
        if (fs.existsSync('system.log')) fs.writeFileSync('system.log', '');
        logSystem("Todos os arquivos de log (ingestão, blueprints e sistema) foram limpos pelo usuário.");
        res.json({ status: 'Logs purged' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

let commitProgress = { total: 0, done: 0, active: false };

app.get('/api/pool/worker/commit-status', (req, res) => {
    res.json(commitProgress);
});

app.post('/api/pool/worker/commit', async (req, res) => {
    const rootPath = process.cwd();
    
    if (commitProgress.active) {
        return res.status(400).json({ status: 'Processing', message: 'Já existe uma auditoria de commit em andamento.' });
    }

    try {
        const gitDir = path.join(rootPath, '.git');
    const initGitRepo = () => {
        try {
            if (fs.existsSync(gitDir)) {
                logSystem("[Git Setup] Repositório Git já existe. Verificando integridade...");
                // Don't rm -rf. Try to repair if needed by just running git init again (safe on existing)
            }
            logSystem("[Git Setup] Inicializando/Verificando repositório Git local...");
            execSync('git init', { cwd: rootPath });
            execSync('git config user.name "Lego Pool Bot"', { cwd: rootPath });
            execSync('git config user.email "bot@lego-pool.local"', { cwd: rootPath });
            logSystem("[Git Setup] Repositório Git pronto.");
        } catch (initErr: any) {
            logSystem(`[Git Setup Error] Falha ao configurar o Git: ${initErr.message}`);
        }
    };

    if (!fs.existsSync(gitDir)) {
        initGitRepo();
    }

    let statusOutput = "";
    try {
        statusOutput = execSync('git status --porcelain=v1 .', { 
            cwd: rootPath,
            maxBuffer: 20 * 1024 * 1024 
        }).toString();
    } catch (statusErr: any) {
        logSystem(`[Git Setup] git status falhou (possível index/HEAD corrompido): ${statusErr.message}. Forçando auto-cura...`);
        initGitRepo();
        try {
            statusOutput = execSync('git status --porcelain=v1 .', { 
                cwd: rootPath,
                maxBuffer: 20 * 1024 * 1024 
            }).toString();
        } catch (retryErr: any) {
            logSystem(`[Git Setup Error] Falha persistiva após auto-cura do Git: ${retryErr.message}`);
            return res.status(500).json({ error: 'Erro de Commit: ' + retryErr.message, details: retryErr.message });
        }
    }
        
        const files = statusOutput.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                let filePath = line.substring(3).trim();
                if (filePath.startsWith('"') && filePath.endsWith('"')) {
                    filePath = filePath.substring(1, filePath.length - 1);
                }
                return filePath;
            });
            
        if (files.length === 0) {
            return res.json({ status: 'No changes', message: 'Nenhuma nova peça Lego.' });
        }

        commitProgress = { total: files.length, done: 0, active: true };
        logSystem(`Iniciando Auditoria de Commit Git para ${files.length} arquivos alterados.`);

        res.json({ 
            status: 'Committed', 
            filesChanged: files.length, 
            message: `Auditoria delegada: ${files.length} blocos serão processados em background.`
        });

        setImmediate(async () => {
            try {
                for (let i = 0; i < files.length; i++) {
                    const filePath = files[i];
                    
                    if (
                        filePath.includes('.tmp/') || 
                        filePath.includes('node_modules/') ||
                        filePath.includes('dist/') ||
                        filePath.endsWith('.log') || 
                        filePath.endsWith('.err') ||
                        filePath.endsWith('worker-status.json') ||
                        filePath.includes('ingestion-progress.json')
                    ) {
                        commitProgress.done++;
                        continue;
                    }
                    
                    const escapedFile = `"${filePath.replace(/"/g, '\\"')}"`;
                    const fileName = filePath.split('/').pop() || 'bloco';
                    
                    let commitMsg = filePath.startsWith('POOL/modules/') || filePath.startsWith('POOL/blueprints/') 
                        ? `📦 [Lego] ${fileName}`
                        : `🛠️ [Infra] ${fileName}`;
                    
                    try {
                        execSync(`git add ${escapedFile}`, { cwd: rootPath });
                        execSync(`git commit -m "${commitMsg}"`, { cwd: rootPath });
                        logSystem(`[Git Commit] Código salvo com sucesso: ${filePath}`);
                        commitProgress.done++;
                        await new Promise(r => setTimeout(r, 20));
                    } catch (e: any) {
                        logSystem(`[Git Commit Sync Error] Falha ao commitar ${filePath}: ${e.message}`);
                        commitProgress.done++;
                    }
                }
                logSystem(`Status: Ciclo de Auditoria de commits concluído com sucesso.`);
                
                // Auto-push to remote backup if configured
                try {
                    const gitConfigPath = path.join(rootPath, "POOL", "git-config.json");
                    if (fs.existsSync(gitConfigPath)) {
                        const config = JSON.parse(fs.readFileSync(gitConfigPath, "utf8"));
                        if (config.remoteUrl && config.autoPush) {
                            logSystem("[Git Backup] Auto-push ativo. Persistindo alterações na piscina remota...");
                            await executeGitPushInternal();
                        }
                    }
                } catch (pushErr: any) {
                    logSystem(`[Git Backup Run Error] Auto-push falhou: ${pushErr.message}`);
                }
            } finally {
                commitProgress.active = false;
            }
        });

    } catch (err: any) {
        logSystem(`[Git Commit Engine Error] Falha de pré-voo: ${err.message}`);
        res.status(500).json({ error: 'Erro de Commit: ' + err.message, details: err.message });
    }
});

export function executeGitPushInternal(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const rootPath = process.cwd();
            const gitConfigPath = path.join(rootPath, 'POOL', 'git-config.json');
            if (!fs.existsSync(gitConfigPath)) {
                throw new Error('Configuração de Git remoto não localizada.');
            }
            
            const config = JSON.parse(fs.readFileSync(gitConfigPath, 'utf8'));
            const remoteUrl = config.remoteUrl || '';
            const token = config.token || '';
            const branch = config.branch || 'main';
            
            if (!remoteUrl) {
                throw new Error('A URL do repositório remoto não foi configurada.');
            }
            
            // Normalize and inject token into URL if provided
            let targetUrl = remoteUrl;
            if (token && remoteUrl.includes('github.com')) {
                // Remove existing user info inside URL if any
                const cleanUrl = remoteUrl.replace(/https?:\/\/([^@]+)@/, 'https://');
                targetUrl = cleanUrl.replace('https://', `https://${token}@`);
            }
            
            logSystem(`[Git Backup] Configurando remote origin para link persistente...`);
            
            try {
                execSync('git remote remove origin', { cwd: rootPath, stdio: 'ignore' });
            } catch (e) {}
            
            execSync(`git remote add origin "${targetUrl.replace(/"/g, '\\"')}"`, { cwd: rootPath });
            
            logSystem(`[Git Backup] Iniciando push forçado (force push) na branch ${branch}...`);
            
            try {
                execSync(`git branch -M ${branch}`, { cwd: rootPath });
            } catch (e) {}
            
            execSync(`git push -f origin ${branch}`, { 
                cwd: rootPath,
                timeout: 90000 
            });
            
            logSystem(`[Git Backup Success] Sincronização de peças concluída com total fidelidade na piscina remota.`);
            resolve();
        } catch (err: any) {
            console.error(`[Git Push Error] Fail:`, err.message);
            logSystem(`[Git Push Error] Falha crítica de persistência remota: ${err.message}`);
            reject(err);
        }
    });
}

// Endpoints de Configuração de Git Remoto (Salvaguarda Real / Backup)
app.get('/api/pool/git/config', (req, res) => {
    const gitConfigPath = path.join(process.cwd(), 'POOL', 'git-config.json');
    if (!fs.existsSync(gitConfigPath)) {
        return res.json({ remoteUrl: '', branch: 'main', autoPush: true, hasToken: false });
    }
    try {
        const config = JSON.parse(fs.readFileSync(gitConfigPath, 'utf8'));
        res.json({
            remoteUrl: config.remoteUrl || '',
            branch: config.branch || 'main',
            autoPush: config.autoPush !== undefined ? !!config.autoPush : true,
            hasToken: !!config.token
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Falha ao carregar configuração.' });
    }
});

app.post('/api/pool/git/config', express.json(), (req, res) => {
    const { remoteUrl, token, branch, autoPush } = req.body;
    const gitConfigPath = path.join(process.cwd(), 'POOL', 'git-config.json');
    if (!fs.existsSync(path.join(process.cwd(), 'POOL'))) {
        fs.mkdirSync(path.join(process.cwd(), 'POOL'), { recursive: true });
    }
    
    try {
        let existingConfig: any = {};
        if (fs.existsSync(gitConfigPath)) {
            try {
                existingConfig = JSON.parse(fs.readFileSync(gitConfigPath, 'utf8'));
            } catch (e) {}
        }
        
        const newConfig = {
            remoteUrl: remoteUrl !== undefined ? remoteUrl : existingConfig.remoteUrl || '',
            token: token !== undefined ? token : existingConfig.token || '',
            branch: branch || existingConfig.branch || 'main',
            autoPush: autoPush !== undefined ? !!autoPush : existingConfig.autoPush !== undefined ? existingConfig.autoPush : true
        };
        
        fs.writeFileSync(gitConfigPath, JSON.stringify(newConfig, null, 2));
        logSystem(`[Git Backup] Configurações de backup atualizadas: URL=${newConfig.remoteUrl}, Branch=${newConfig.branch}, AutoPush=${newConfig.autoPush}`);
        res.json({ status: 'success', message: 'Salvaguarda de Git configurada com sucesso.' });
    } catch (err: any) {
        res.status(500).json({ error: 'Falha ao salvar configuração.' });
    }
});

// Endpoint para acionar o Push Remoto manual
app.post('/api/pool/git/push', async (req, res) => {
    try {
        logSystem(`[Git Backup] Sincronização remota acionada manualmente...`);
        await executeGitPushInternal();
        res.json({ status: 'success', message: 'Módulos persistidos com sucesso na piscina remota (GitHub)!' });
    } catch (err: any) {
        res.status(500).json({ error: 'Erro ao sincronizar com GitHub remoto', details: err.message });
    }
});

app.post('/api/pool/worker/restart', async (req, res) => {
    try {
        console.log(`[SYS] Force restarting workers...`);
        logSystem("Solicitado reinício forçado dos Workers (Ingestion & Blueprints). Matando processos órfãos...");
        execSync('npx -y tsx kill_stuck.js');
        logSystem("Inicializando novos processos de Daemons...");
        execSync('npx -y tsx start_daemons.mjs');
        // Reset control to running on restart
        const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
        fs.writeFileSync(controlPath, JSON.stringify({ status: 'running' }));
        logSystem("Workers reiniciados com sucesso. Status redefinido para 'RUNNING'.");
        res.json({ status: 'Restarted' });
    } catch (err: any) {
        logSystem(`Erro na reinicialização de workers: ${err.message}`);
        res.status(500).json({ error: 'Falha ao reiniciar workers', details: err.message });
    }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TERMINAL] Code Pool Environment running on http://localhost:${PORT}`);
    console.log(`[AUDIT] Consolidated resources ready for extraction.`);
    
    logSystem("========================================= DEPLOYMENT INIT =========================================");
    logSystem(`Servidor Code Pool ativo na porta ${PORT}. Pronto para receber repositórios.`);
    
    // Auto-start daemons
    try {
        console.log(`[SYS] Booting default daemons...`);
        logSystem("Inicializando Daemons secundários automáticos (worker_ingest e worker_blueprints)...");
        execSync('npx -y tsx start_daemons.mjs');
        logSystem("Daemons iniciados com sucesso.");
    } catch (e: any) {
        console.error('Failed to auto-start daemons', e);
        logSystem(`Falha ao iniciar Daemons automaticamente: ${e.message}`);
    }
  });
}

startServer();
