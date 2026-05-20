import 'dotenv/config';
import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';
import fs from 'fs';
import path from 'path';

process.on('uncaughtException', (err: Error) => {
    console.error(`[CRITICAL] Uncaught Exception in worker_ingest: ${err.message}`);
});

process.on('unhandledRejection', (reason: any) => {
    console.error(`[CRITICAL] Unhandled Rejection in worker_ingest: ${reason}`);
});

let isRunning = true;

const gracefulShutdown = () => {
    console.log(`[SYS] Signal received (SIGINT/SIGTERM) mapped in worker_ingest. Commencing Graceful Shutdown...`);
    isRunning = false;
    setTimeout(() => {
        console.error(`[CRITICAL] Forcing shutdown over timeout in worker_ingest.`);
        process.exit(1);
    }, 5000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

(async () => {
    console.log("[WORKER] Booting background ingestion for all repositories...");
    
    const registryPath = path.join(process.cwd(), 'POOL', 'pool-registry.json');
    try {
        if (fs.existsSync(registryPath)) {
            const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
            console.log(`[WORKER] Resuming processing of ${data.repositories.length} repos. Skipping already processed.`);
        }
    } catch (e: any) {
        console.warn(`[WORKER] Could not parse registry early read: ${e.message}`);
    }
    
    const manager = new UpdateManager();
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const BASE_BACKOFF_MS = 15000;
    const MAX_BACKOFF_MS = 300000;
    let currentBackoff = BASE_BACKOFF_MS;
    
    while (isRunning) {
        try {
            await manager.syncAll(false);
            currentBackoff = BASE_BACKOFF_MS; // reset on success
            await sleep(currentBackoff);
        } catch (err: any) {
            console.error(`[WORKER] Error during global ingestion cycle: ${err.message}`);
            await sleep(currentBackoff);
            currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
        }
    }
    console.log("[WORKER] Background ingestion gracefully terminated.");
    process.exit(0);
})();
