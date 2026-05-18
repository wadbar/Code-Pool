import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';
import { HungryPoolEngine } from './POOL/modules/AUTOMATION/HungryPoolEngine';

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
app.post('/api/pool/ingest', express.json(), (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) {
    return res.status(400).json({ error: 'Forneça a githubUrl' });
  }
  
  // Aqui o RepoIngester atua (simulado no log do console)
  // Além de ingerir, adicionamos automaticamente ao monitoramento
  updateManager.addRepository(githubUrl);
  
  console.log(`[TERMINAL] Comando de ingestão recebido para: ${githubUrl}`);
  res.json({ 
    status: 'Ingestion task started',
    target: githubUrl,
    message: 'O Gemini identificará os clusters lógicos e alocará na Pool. Repositório adicionado ao monitoramento cíclico.'
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
