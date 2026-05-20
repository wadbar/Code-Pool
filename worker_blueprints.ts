import fs from 'fs';
import path from 'path';
import { RepoIngester } from './POOL/modules/AUTOMATION/RepoIngester';
import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';

process.on('uncaughtException', (err: Error) => {
    console.error(`[CRITICAL] Uncaught Exception in worker_blueprints: ${err.message}`);
});

process.on('unhandledRejection', (reason: any) => {
    console.error(`[CRITICAL] Unhandled Rejection in worker_blueprints: ${reason}`);
});

let isRunning = true;

const gracefulShutdown = () => {
    console.log(`[SYS] Signal received (SIGINT/SIGTERM) mapped in worker_blueprints. Commencing Graceful Shutdown...`);
    isRunning = false;
    setTimeout(() => {
        console.error(`[CRITICAL] Forcing shutdown over timeout in worker_blueprints.`);
        process.exit(1);
    }, 5000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

(async () => {
    console.log("[WORKER-BLUEPRINT] Booting background retroactive blueprint generator...");
    
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const BASE_BACKOFF_MS = 120000;
    const MAX_BACKOFF_MS = 600000;
    let currentBackoff = BASE_BACKOFF_MS;

    while (isRunning) {
        try {
            await UpdateManager.waitIfPaused();
            const control = UpdateManager.getControlStatus();
            if (control.status === 'stop_after_current') {
                console.log("[WORKER-BLUEPRINT] Stop triggered.");
                await sleep(10000);
                continue;
            }
            
            await RepoIngester.generateMissingBlueprints();
            
            currentBackoff = BASE_BACKOFF_MS; // reset on success
            await sleep(currentBackoff);
        } catch (err: any) {
            console.error(`[WORKER-BLUEPRINT] Error during generation: ${err.message}`);
            await sleep(currentBackoff);
            currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
        }
    }
    
    console.log("[WORKER-BLUEPRINT] Background blueprint generator gracefully terminated.");
    process.exit(0);
})();
