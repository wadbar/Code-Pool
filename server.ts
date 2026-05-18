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

// Set up periodic automatic hunt triggering (every 1 hour for demo purposes)
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
        
        res.json({
            ingestion: ingestLogs,
            blueprints: blueprintLogs,
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
    const tmpPath = path.join(process.cwd(), 'POOL', '.tmp');
    try {
        if (fs.existsSync(tmpPath)) {
            fs.rmSync(tmpPath, { recursive: true, force: true });
            fs.mkdirSync(tmpPath, { recursive: true });
        }
        res.json({ status: 'Purged' });
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
        res.json({ status: 'Logs purged' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/pool/worker/commit', async (req, res) => {
    const { execSync } = require('child_process');
    const poolPath = path.join(process.cwd(), 'POOL');
    try {
        // Ensure we are not committing the .tmp directory
        const gitignorePath = path.join(poolPath, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            fs.writeFileSync(gitignorePath, '.tmp/\n*.log\n*.err\n');
        }

        if (!fs.existsSync(path.join(poolPath, '.git'))) {
            execSync('git init', { cwd: poolPath });
            execSync('git config user.email "pool@wadbar.ai"', { cwd: poolPath });
            execSync('git config user.name "Lego Pool Bot"', { cwd: poolPath });
        }
        
        execSync('git add .', { cwd: poolPath });
        // Check if there are changes to commit
        const status = execSync('git status --porcelain', { cwd: poolPath }).toString();
        if (status.trim().length === 0) {
            return res.json({ status: 'No changes', message: 'Nothing to commit.' });
        }

        execSync('git commit -m "Consolidation requested from Dashboard"', { cwd: poolPath });
        res.json({ status: 'Committed' });
    } catch (err: any) {
        console.error("[SYS] Commit failed:", err.message);
        res.status(500).json({ error: 'Commit failed', details: err.message });
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
