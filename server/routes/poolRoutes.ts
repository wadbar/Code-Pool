import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logSystem } from '../utils/logger';

export function createPoolRouter(
    updateManager: any, 
    hungryPool: any, 
    urlScraper: any, 
    scannerAgent: any
): Router {
  const router = express.Router();

  // Endpoint de Inventario de Blocos Extrapolados
  router.get('/inventory', (req, res) => {
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
  router.get('/check-gemini', (req, res) => res.json({ hasKey: !!process.env.GEMINI_API_KEY, len: (process.env.GEMINI_API_KEY || '').length }));

  // Endpoint de Ingestão Automatizada
  router.post('/ingest', express.json(), async (req, res) => {
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
  router.post('/ingest-all', async (req, res) => {
    console.log(`[INGEST] Comando de ingestão global recebido.`);
    
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
  router.get('/registry', (req, res) => {
    res.json({
        watched: updateManager.listWatched(),
        total: updateManager.listWatched().length
    });
  });

  router.post('/registry/remove', express.json(), (req, res) => {
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

  router.post('/registry/add', express.json(), (req, res) => {
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
  router.post('/sync', async (req, res) => {
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
  router.post('/scrape-url', express.json(), async (req, res) => {
    const { sourceUrl, rawContent } = req.body;
    if (!sourceUrl && !rawContent) return res.status(400).json({ error: 'Forneça a sourceUrl ou rawContent para raspar.' });

    const result = await urlScraper.scrapeAndQueueRepos(sourceUrl, rawContent);
    if (result.status === "error") {
        return res.status(500).json(result);
    }
    return res.json(result);
  });

  return router;
}
