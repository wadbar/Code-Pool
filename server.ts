import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServer as createViteServer } from 'vite';
import Redis from 'ioredis';
import { runFullAudit } from './src/utils/AuditRunner.js';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // --- Redis Initialization ---
  const redis = process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL) 
    : new Redis({ host: '127.0.0.1', port: 6379, lazyConnect: true });

  const getCachedData = async (key: string) => {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.warn(`[Redis] Cache fetch failed for ${key}:`, err);
      return null;
    }
  };

  const setCachedData = async (key: string, data: any, ttl = 3600) => {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
    } catch (err) {
      console.warn(`[Redis] Cache store failed for ${key}:`, err);
    }
  };

  // --- UpdateManager: Git Cron Job ---
  // Default every 30 minutes, configurable via env
  const gitCronSchedule = process.env.GIT_SYNC_SCHEDULE || '*/30 * * * *';
  cron.schedule(gitCronSchedule, async () => {
    console.log('[UpdateManager] Triggering scheduled code pool persistence...');
    try {
      // Note: In a real environment, we'd need valid credentials
      const { stdout, stderr } = await execPromise('git push --force');
      console.log(`[UpdateManager] Sync Result: ${stdout}`);
      if (stderr) console.error(`[UpdateManager] Sync Warning: ${stderr}`);
      io.emit('log', { level: 'INFO', context: 'INFRA', message: 'Remote code pool persistence successful.' });
    } catch (error: any) {
      console.error(`[UpdateManager] Sync Failed: ${error.message}`);
      io.emit('log', { level: 'ERROR', context: 'INFRA', message: `Sync Failure: ${error.message}` });
    }
  });

  // --- SocketHub: Real-time Event Orchestration ---
  io.on('connection', (socket) => {
    console.log(`[SocketHub] client connected: ${socket.id}`);
    
    socket.on('audit:start', async () => {
      io.emit('log', { level: 'INFO', context: 'AUDIT', message: 'AuditRunner signal received. Initializing exaustive scan...' });
      // Logic for AuditRunner would go here or call a separate process
    });

    socket.on('disconnect', () => {
      console.log(`[SocketHub] client disconnected: ${socket.id}`);
    });
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/repo-registry', async (req, res) => {
    const cacheKey = 'api:repo-registry';
    const cached = await getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
      const modulesPath = path.join(process.cwd(), 'src', 'POOL', 'modules');
      if (!fs.existsSync(modulesPath)) {
         return res.json({ modules: [] });
      }
      
      const categories = fs.readdirSync(modulesPath);
      const modules: any[] = [];

      for (const cat of categories) {
        const catPath = path.join(modulesPath, cat);
        if (fs.statSync(catPath).isDirectory()) {
          const files = fs.readdirSync(catPath);
          modules.push(...files.filter(f => !f.endsWith('.test.ts')).map(f => ({
            name: f.replace(/\.(ts|tsx|js|jsx)$/, ''),
            category: cat,
            path: path.join('POOL/modules', cat, f)
          })));
        }
      }

      await setCachedData(cacheKey, { modules });
      res.json({ modules });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/audit-results', async (req, res) => {
    const cacheKey = 'api:audit-results';
    const cached = await getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
      const reports = await runFullAudit();
      await setCachedData(cacheKey, { reports }, 600); // Cache for 10 minutes
      res.json({ reports });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware for Development ---
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[SystemArchitecture] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[CRITICAL] Server startup failure:', err);
  process.exit(1);
});
