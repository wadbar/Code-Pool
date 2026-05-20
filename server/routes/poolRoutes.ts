import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { logSystem } from '../utils/logger';
import { getCache, setCache, logUserActivity, getActivityLogs, invalidateCache } from '../utils/redisCache';

export function createPoolRouter(
    updateManager: any, 
    hungryPool: any, 
    urlScraper: any, 
    scannerAgent: any
): Router {
  const router = express.Router();

  // Helper auth check for activity
  const getUserId = (req: any) => req.headers['x-user-id'] || 'anonymous';

  // Endpoint de Inventario de Blocos Extrapolados
  router.get('/inventory', async (req, res) => {
    const cached = await getCache('pool:inventory');
    if (cached) return res.json(cached);

    const poolPath = path.join(process.cwd(), 'POOL', 'modules');
    if (!fs.existsSync(poolPath)) return res.json({ inventory: [] });

    const categories = fs.readdirSync(poolPath).filter(f => fs.statSync(path.join(poolPath, f)).isDirectory());
    const inventory = categories.map(cat => {
      const catPath = path.join(poolPath, cat);
      const files = fs.readdirSync(catPath).filter(f => f.endsWith('.ts') && f !== 'index.ts');
      return { category: cat, blocks: files };
    });
    
    const result = { inventory };
    await setCache('pool:inventory', result, 15);
    res.json(result);
  });

  // Code Pool Auditor API
  router.get('/check-gemini', (req, res) => res.json({ hasKey: !!process.env.GEMINI_API_KEY, len: (process.env.GEMINI_API_KEY || '').length }));

  // Função helper para varredura recursiva de diretórios no Linux
  const scanDirectoryRecursive = (dir: string): { files: number, sizeKB: number } => {
    let results = { files: 0, sizeKB: 0 };
    if (!fs.existsSync(dir)) return results;
    
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          const subInfo = scanDirectoryRecursive(fullPath);
          results.files += subInfo.files;
          results.sizeKB += subInfo.sizeKB;
        } else {
          results.files += 1;
          results.sizeKB += stat.size / 1024;
        }
      }
    } catch (e) {
      // Ignora arquivos/pastas sem permissão (graceful scan)
    }
    return results;
  };

  // Endpoint de Scanner de Sistema: lê árvore e estatísticas em disco
  router.get('/real-scan-data', async (req, res) => {
    try {
      const rootPool = path.join(process.cwd(), 'POOL');
      const modulesDir = path.join(rootPool, 'modules');
      const blueprintsDir = path.join(rootPool, 'blueprints');
      
      let totalBlocks = 0;
      let totalBlueprints = 0;
      let diskSizeKB = 0;
      const categoriesCount: Record<string, number> = {};

      // 1. Scanner de Módulos (Blocos Lego)
      if (fs.existsSync(modulesDir)) {
          const categories = fs.readdirSync(modulesDir);
          for (const category of categories) {
              const catPath = path.join(modulesDir, category);
              const catStat = fs.statSync(catPath);
              if (catStat.isDirectory()) {
                  const scanResults = scanDirectoryRecursive(catPath);
                  categoriesCount[category] = scanResults.files;
                  totalBlocks += scanResults.files;
                  diskSizeKB += scanResults.sizeKB;
              }
          }
      }

      // 2. Scanner de Blueprints
      if (fs.existsSync(blueprintsDir)) {
          const scanResults = scanDirectoryRecursive(blueprintsDir);
          totalBlueprints = scanResults.files;
          diskSizeKB += scanResults.sizeKB;
      }

      // 3. Fallback Registry (apenas para metadados leves se existir)
      let totalRepos = 0;
      let events: string[] = [];
      const cachePath = path.join(rootPool, 'system-scan-cache.json');
      if (fs.existsSync(cachePath)) {
        try {
            const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            totalRepos = cacheData.totalRepos || 0;
            events = cacheData.events || [];
            if (cacheData.diskSizeKB && cacheData.diskSizeKB > diskSizeKB) {
                diskSizeKB = cacheData.diskSizeKB; // Merge metadata if larger
            }
        } catch (e) {
           // Ignora JSON corrompido
        }
      }

      // Arredonda disk size
      diskSizeKB = Math.round(diskSizeKB * 100) / 100;

      return res.json({
        lastScanTime: new Date().toISOString(),
        totalRepos,
        totalBlocks,
        totalBlueprints,
        totalDigestedFiles: totalBlocks, // Equivale aos blocos processados
        diskSizeKB,
        categoriesCount,
        events
      });
    } catch (e: any) {
      logSystem(`[CRITICAL] Erro no endpoint /real-scan-data: ${e.message}`);
      res.status(500).json({ error: 'Falha fatal ao ler dados do scanner de sistema.' });
    }
  });

  // Endpoint contagem e listagem física de blueprints
  router.get('/blueprints', (req, res) => {
    try {
      const bpsPath = path.join(process.cwd(), 'POOL', 'blueprints');
      let blueprintsList: any[] = [];
      let count = 0;
      if (fs.existsSync(bpsPath)) {
        const files = fs.readdirSync(bpsPath).filter(f => f.endsWith('.md'));
        count = files.length;
        blueprintsList = files.map(f => ({
          filename: f,
          size: fs.statSync(path.join(bpsPath, f)).size
        }));
      }
      res.json({ count, blueprints: blueprintsList });
    } catch (e: any) {
      logSystem(`Erro no /blueprints: ${e.message}`);
      res.status(500).json({ error: 'Erro ao listar blueprints.' });
    }
  });

  router.get('/activity', async (req, res) => {
    const logs = await getActivityLogs();
    res.json({ logs });
  });

  // Endpoint de Ingestão Automatizada
  router.post('/ingest', async (req, res) => {
    const { githubUrl, userId } = req.body;
    if (!githubUrl) {
      return res.status(400).json({ error: 'Forneça a githubUrl' });
    }
    
    updateManager.addRepository(githubUrl);
    console.log(`[INGEST] Adicionando repositório à fila: ${githubUrl}`);
    await logUserActivity(getUserId(req), 'ingest_repository', { githubUrl });
    await invalidateCache('pool:registry');
    
    res.json({ 
      status: 'Ingestion Queued',
      target: githubUrl,
      message: 'Repositório enfileirado para processamento em background.'
    });
  });

  // Endpoint autônomo para ingerir repositórios
  router.post('/ingest-all', async (req, res) => {
    console.log(`[INGEST] Comando de ingestão global recebido.`);
    await logUserActivity(getUserId(req), 'global_ingest_started');
    
    updateManager.syncAll(true).then(() => {
       console.log(`[INGEST] Ingestão global background finalizada.`);
    }).catch((err: any) => {
       console.error(`[INGEST] Erro na ingestão global:`, err);
    });

    res.json({ 
      status: 'Global Ingestion task started',
      message: 'Ciclo de processamento global iniciado. Acompanhe os logs via endpoint de log.'
    });
  });

  // Endpoint de Registro de Repositório Watchlist
  router.get('/registry', async (req, res) => {
    const cached = await getCache('pool:registry');
    if (cached) return res.json(cached);

    const watched = updateManager.listWatched();
    const result = {
        watched: watched,
        total: watched.length
    };
    await setCache('pool:registry', result, 10);
    res.json(result);
  });

  router.post('/registry/remove', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    const removed = updateManager.removeRepository(url);
    if (removed) {
      scannerAgent.addEvent('WATCHLIST', `URL removida: ${url}`);
      scannerAgent.executeScan();
      await logUserActivity(getUserId(req), 'remove_repository', { url });
      await invalidateCache('pool:registry');
      res.json({ status: 'Removed', url });
    } else {
      res.status(404).json({ error: 'Repository not found in registry' });
    }
  });

  router.post('/registry/add', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    const added = updateManager.addRepository(url);
    if (added) {
      scannerAgent.addEvent('WATCHLIST', `Nova URL adicionada à Watchlist: ${url}`);
      await logUserActivity(getUserId(req), 'add_repository', { url });
    } else {
      scannerAgent.addEvent('WATCHLIST', `Tentativa de registrar URL duplicada/inválida: ${url}`);
    }
    scannerAgent.executeScan();
    await invalidateCache('pool:registry');
    res.json({ status: 'success', message: 'Repositório enfileirado para digestão.' });
  });

  let isSyncing = false;

  // Endpoint para Sync Manual da Pool
  router.post('/sync', async (req, res) => {
    if (isSyncing) {
        return res.status(200).json({ status: 'already_syncing', message: 'Uma sincronização já está em andamento.' });
    }
    
    isSyncing = true;
    logSystem("Iniciando sincronização (sync) manual de todos os repositórios em background...");
    
    updateManager.syncAll().then(result => {
        isSyncing = false;
        logSystem(`Sincronização manual concluída! ${result.updated} repositórios atualizados.`);
    }).catch((err: any) => {
        isSyncing = false;
        logSystem(`Falha na sincronização manual: ${err.message}`);
    });

    res.status(202).json({ status: 'sync_started', message: 'Sincronização iniciada em background.' });
  });

  router.get('/sync/status', (req, res) => {
    res.json({ isSyncing });
  });

  // Endpoint para Caçada Autônoma (Hungry Pool)
  router.post('/hunt', async (req, res) => {
    try {
        const { topics } = req.body;
        let result;
        if (topics && Array.isArray(topics)) {
            logSystem(`Iniciando busca automática por tópicos: ${topics.join(', ')}...`);
            result = await hungryPool.searchForTopics(topics);
        } else {
            logSystem("Iniciando busca automática de repositórios (GitHub)...");
            result = await hungryPool.huntForCode();
        }
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
  router.post('/scrape-url', async (req, res) => {
    const { sourceUrl, rawContent } = req.body;
    if (!sourceUrl && !rawContent) return res.status(400).json({ error: 'Forneça a sourceUrl ou rawContent para raspar.' });

    const result = await urlScraper.scrapeAndQueueRepos(sourceUrl, rawContent);
    if (result.status === "error") {
        return res.status(500).json(result);
    }
    return res.json(result);
  });

  // Endpoint para limpar arquivos de log
  router.post('/logs/clear', (req, res) => {
      const logFiles = ['ingest.log', 'ingest.err', 'blueprints.log', 'blueprints.err', 'system.log'];
      const deleted: string[] = [];
      const errors: string[] = [];

      for (const file of logFiles) {
          const filePath = path.join(process.cwd(), file);
          if (fs.existsSync(filePath)) {
              try {
                  fs.unlinkSync(filePath);
                  deleted.push(file);
              } catch (err: any) {
                  errors.push(`${file}: ${err.message}`);
              }
          }
      }
      logSystem(`Logs clear requested. Deleted: ${deleted.join(', ')}. Errors: ${errors.join(', ')}`);
      res.json({ status: 'success', deleted, errors });
  });

  // Endpoint de Status dos Daemons de Background (Ingestao e Blueprints)
  router.get('/daemons/status', (req, res) => {
    try {
      const controlPath = path.join(process.cwd(), 'POOL', 'worker-status.json');
      let controlStatus = 'running';
      if (fs.existsSync(controlPath)) {
        try {
          controlStatus = JSON.parse(fs.readFileSync(controlPath, 'utf8')).status || 'running';
        } catch (e) {}
      }

      let ingestActive = false;
      let blueprintsActive = false;

      // Executa ps aux para checar se estão rodando de fato (somente sob Linux no contêiner)
      try {
        ingestActive = execSync("ps aux | grep 'worker_ingest' | grep -v grep || true").toString().trim().length > 0;
      } catch (e) {}
      try {
        blueprintsActive = execSync("ps aux | grep 'worker_blueprints' | grep -v grep || true").toString().trim().length > 0;
      } catch (e) {}

      // Checa se há arquivos .err gravados com erro recente
      let ingestError = "";
      let blueprintsError = "";
      
      const ingestErrPath = path.join(process.cwd(), 'ingest.err');
      if (fs.existsSync(ingestErrPath)) {
        const stats = fs.statSync(ingestErrPath);
        if (stats.size > 0) {
          const content = fs.readFileSync(ingestErrPath, 'utf8').trim();
          if (content.length > 0) {
            ingestError = content.split('\n').slice(-3).join('\n');
          }
        }
      }

      const blueprintsErrPath = path.join(process.cwd(), 'blueprints.err');
      if (fs.existsSync(blueprintsErrPath)) {
        const stats = fs.statSync(blueprintsErrPath);
        if (stats.size > 0) {
          const content = fs.readFileSync(blueprintsErrPath, 'utf8').trim();
          if (content.length > 0) {
            blueprintsError = content.split('\n').slice(-3).join('\n');
          }
        }
      }

      // Conclui o status final com base nas leituras obtidas
      const ingestStatus = controlStatus === 'paused' ? 'paused' : (ingestActive ? 'running' : 'error');
      const blueprintsStatus = controlStatus === 'paused' ? 'paused' : (blueprintsActive ? 'running' : 'error');

      res.json({
        controlStatus,
        ingest: {
          status: ingestStatus,
          active: ingestActive,
          error: ingestError || null
        },
        blueprints: {
          status: blueprintsStatus,
          active: blueprintsActive,
          error: blueprintsError || null
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao monitorar status dos daemons: ' + err.message });
    }
  });

  // Endpoint para disparar auditoria de integridade sob demanda (ScannerAgent)
  router.post('/scanner/scan', async (req, res) => {
    try {
      logSystem(`[Scanner Trigger] Varredura de integridade sob demanda iniciada pelo usuário.`);
      scannerAgent.addEvent('SERVER', `Auditoria de integridade e estatísticas disparada sob demanda.`);
      await scannerAgent.executeScan();
      
      const rootPool = path.join(process.cwd(), 'POOL');
      const cachePath = path.join(rootPool, 'system-scan-cache.json');
      let updatedData = {};
      if (fs.existsSync(cachePath)) {
        try {
          updatedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        } catch (e) {}
      }
      
      res.json({
        status: 'success',
        message: 'Auditoria de integridade do disco concluída com sucesso.',
        data: updatedData
      });
    } catch (err: any) {
      logSystem(`[Scanner Trigger Error] Erro ao executar varredura de integridade: ${err.message}`);
      res.status(500).json({ error: 'Falha ao processar scanner de sistema: ' + err.message });
    }
  });

  return router;
}
