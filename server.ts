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

const app = express();
const PORT = 3000;
const updateManager = new UpdateManager();
const hungryPool = new HungryPoolEngine(updateManager);

export function logSystem(msg: string) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  try {
    fs.appendFileSync(path.join(process.cwd(), 'system.log'), `[${timestamp}] ${msg}\n`);
  } catch (err) {
    console.error('Failed to write to system.log', err);
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
  console.log(`[TERMINAL] Alvo adicionado à fila de digestão: ${githubUrl}`);
  
  res.json({ 
    status: 'Ingestion Queued',
    target: githubUrl,
    message: 'Repositório adicionado à esteira de processamento. O Devourer o processará em background.'
  });
});

// Endpoint autônomo e definitivo para ingerir CADA UM dos repositórios
app.post('/api/pool/ingest-all', async (req, res) => {
  console.log(`[TERMINAL] Comando MASTER de ingestão real recebido para TODOS os repositórios restantes.`);
  
  // Real Ingestion in background internally
  updateManager.syncAll(true).then(() => {
     console.log(`[TERMINAL] Finalizada ingestão background global.`);
  }).catch(err => {
     console.error(`[TERMINAL] Erro na ingestão background global:`, err);
  });

  res.json({ 
    status: 'Global Ingestion task started',
    message: 'O ciclo reverso autônomo e definitivo foi ativado no servidor. Acompanhe os logs via terminal/server-side.'
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
    res.json({ status: 'Removed', url });
  } else {
    res.status(404).json({ error: 'Repository not found in registry' });
  }
});

app.post('/api/pool/registry/add', express.json(), (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  updateManager.addRepository(url);
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
      logSystem("Iniciando caçada autônoma por repositórios do GitHub (Hungry Pool)...");
      const result = await hungryPool.huntForCode();
      logSystem(`Caçada concluída! Total de novos repositórios encontrados: ${result.hunted || 0}`);
      res.json({
          status: 'Hunting completed',
          ...result,
          message: 'A Piscina Faminta encontrou novos repositórios e os adicionou ao fluxo de digestão (ingestão).'
      });
  } catch (err: any) {
      logSystem(`Erro durante a caçada: ${err.message}`);
      res.status(500).json({ error: 'A caçada falhou.', details: err.message });
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
                logSystem("[Git Setup] Removendo repositório Git existente para reiniciar limpo...");
                fs.rmSync(gitDir, { recursive: true, force: true });
            }
            logSystem("[Git Setup] Inicializando repositório Git local limpo...");
            execSync('git init', { cwd: rootPath });
            execSync('git config user.name "Lego Pool Bot"', { cwd: rootPath });
            execSync('git config user.email "bot@lego-pool.local"', { cwd: rootPath });
            logSystem("[Git Setup] Repositório Git configurado com sucesso.");
        } catch (initErr: any) {
            logSystem(`[Git Setup Error] Falha fatal ao configurar o Git: ${initErr.message}`);
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
            } finally {
                commitProgress.active = false;
            }
        });

    } catch (err: any) {
        logSystem(`[Git Commit Engine Error] Falha de pré-voo: ${err.message}`);
        res.status(500).json({ error: 'Erro de Commit: ' + err.message, details: err.message });
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
