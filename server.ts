import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';
import { RepoIngester } from './POOL/modules/AUTOMATION/RepoIngester';
import { HungryPoolEngine } from './POOL/modules/AUTOMATION/HungryPoolEngine';
import { UrlScraper } from './POOL/modules/AUTOMATION/UrlScraper';

const app = express();
const PORT = 3000;
const updateManager = new UpdateManager();
const hungryPool = new HungryPoolEngine(updateManager);

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
  console.log(`[TERMINAL] Comando de ingestão real recebido para: ${githubUrl}`);
  
  // Real Ingestion in background
  RepoIngester.ingestFromGitHub(githubUrl).then(() => {
     console.log(`[TERMINAL] Finalizada ingestão background de: ${githubUrl}`);
  }).catch(err => {
     console.error(`[TERMINAL] Erro na ingestão background de ${githubUrl}:`, err);
  });

  res.json({ 
    status: 'Ingestion task started',
    target: githubUrl,
    message: 'Processamento autônomo acionado. Os blocos modulares começarão a ser depositados na POOL.'
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

// Endpoint para Sync Manual da Pool
app.post('/api/pool/sync', async (req, res) => {
  try {
      const result = await updateManager.syncAll();
      res.json(result);
  } catch (err: any) {
      res.status(500).json({ error: 'Falha na sincronização global', details: err.message });
  }
});

// Endpoint para Caçada Autônoma (Hungry Pool)
app.post('/api/pool/hunt', async (req, res) => {
  try {
      const result = await hungryPool.huntForCode();
      res.json({
          status: 'Hunting completed',
          ...result,
          message: 'A Piscina Faminta encontrou novos repositórios e os adicionou ao fluxo de digestão (ingestão).'
      });
  } catch (err: any) {
      res.status(500).json({ error: 'A caçada falhou.', details: err.message });
  }
});

// Endpoint para extrair links de github de uma URL ou lista de artigos/documentos e encher a esteira (fila de digestão)
app.post('/api/pool/scrape-url', express.json(), async (req, res) => {
  const { sourceUrl } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'Forneça a sourceUrl para raspar.' });

  const result = await UrlScraper.scrapeAndQueueRepos(sourceUrl);
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
    res.json({ status });
});

app.post('/api/pool/worker/purge-tmp', (req, res) => {
    const tmpPathOld = path.join(process.cwd(), 'POOL', '.tmp');
    const tmpPathNew = path.join(require('os').tmpdir(), 'lego-pool-tmp');
    try {
        if (fs.existsSync(tmpPathOld)) {
            fs.rmSync(tmpPathOld, { recursive: true, force: true });
            fs.mkdirSync(tmpPathOld, { recursive: true });
        }
        if (fs.existsSync(tmpPathNew)) {
            fs.rmSync(tmpPathNew, { recursive: true, force: true });
            fs.mkdirSync(tmpPathNew, { recursive: true });
        }
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
        res.json({ status: 'Logs purged' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/pool/worker/commit', async (req, res) => {
    const { execSync } = require('child_process');
    const rootPath = process.cwd();
    const poolPath = path.join(rootPath, 'POOL');
    
    try {
        // Ensure pool directory exists
        if (!fs.existsSync(poolPath)) {
            fs.mkdirSync(poolPath, { recursive: true });
        }

        // Ensure git identity is set for the root repo to prevent commit failures
        try {
            execSync('git config user.email', { cwd: rootPath, stdio: 'pipe' });
        } catch (e) {
            console.log("[SYS] Configurando identidade Git base...");
            execSync('git config user.email "pool@wadbar.ai"', { cwd: rootPath });
            execSync('git config user.name "Lego Pool Bot"', { cwd: rootPath });
        }

        // Clean up any rogue nested .git directory in POOL that would break root sync
        const nestedGitPath = path.join(poolPath, '.git');
        if (fs.existsSync(nestedGitPath)) {
            fs.rmSync(nestedGitPath, { recursive: true, force: true });
            console.log("[SYS] Removed rogue nested .git directory inside POOL.");
        }

        // Use --porcelain=v1 to get a clean status of the POOL directory relative to root
        // The output paths will be relative to rootPath
        const statusOutput = execSync('git status --porcelain=v1 POOL/', { 
            cwd: rootPath,
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large repos
        }).toString();
        
        // Parse status output
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
            return res.json({ status: 'No changes', message: 'Nenhuma nova peça Lego encontrada para commit.' });
        }

        console.log(`[SYS] Iniciando commit cirúrgico peça por peça para ${files.length} blocos...`);

        let commitsDone = 0;
        
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            
            // Ignora arquivos temporários se por acaso vazarem pro git
            if (filePath.includes('.tmp/') || filePath.endsWith('.log') || filePath.endsWith('.err')) {
                continue;
            }
            
            const escapedFile = `"${filePath.replace(/"/g, '\\"')}"`;
            
            // Extrai só o nome final do arquivo pra mensagem ficar bonita
            const fileName = filePath.split('/').pop() || 'bloco_desconhecido';
            
            try {
                // Adiciona e comita cada peça cirurgicamente
                execSync(`git add ${escapedFile}`, { cwd: rootPath });
                
                // Mensagem especial formatada
                const commitMsg = `📦 [Lego Pool] Reforço Arquitetural: ${fileName}`;
                execSync(`git commit -m "${commitMsg}"`, { cwd: rootPath });
                
                commitsDone++;
                const logMsg = `[SYS] Commit isolado realizado: ${commitMsg}`;
                console.log(logMsg);
                fs.appendFileSync(path.join(rootPath, 'system.log'), `[${new Date().toISOString()}] ${logMsg}\n`);
            } catch (err: any) {
                const errMsg = `[SYS] Falha ao isolar bloco ${filePath}: ${err.message}`;
                console.error(errMsg);
                fs.appendFileSync(path.join(rootPath, 'system.log'), `[${new Date().toISOString()}] ERROR: ${errMsg}\n`);
            }
        }

        res.json({ 
            status: 'Committed', 
            filesChanged: files.length, 
            commitsCount: commitsDone,
            message: `Auditoria concluída: ${commitsDone} peças Lego individualmente blindadas e enviadas para o histórico.`
        });
    } catch (err: any) {
        console.error("[SYS] Falha crítica de sincronização:", err.message);
        res.status(500).json({ 
            error: 'Falha sincronização cirúrgica', 
            details: err.message
        });
    }
});

app.post('/api/pool/worker/restart', async (req, res) => {
    const { execSync } = require('child_process');
    try {
        console.log(`[SYS] Force restarting workers...`);
        execSync('npx -y tsx kill_stuck.js');
        execSync('npx -y tsx start_daemons.mjs');
        // Reset control to running on restart
        const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
        fs.writeFileSync(controlPath, JSON.stringify({ status: 'running' }));
        res.json({ status: 'Restarted' });
    } catch (err: any) {
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
  });
}

startServer();
