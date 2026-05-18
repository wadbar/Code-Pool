import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';
import fs from 'fs';
import path from 'path';

(async () => {
    console.log("[WORKER] Booting background ingestion for all repositories...");
    
    // Remove clearing of lastSync to allow resuming in sequence
    // Use force = false so it continues where it left off
    const registryPath = path.join(process.cwd(), 'POOL', 'pool-registry.json');
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    console.log(`[WORKER] Resuming processing of ${data.repositories.length} repos. Skipping already processed.`);
    
    const manager = new UpdateManager();
    try {
        await manager.syncAll(false);
        console.log("[WORKER] Complete.");
    } catch (err) {
        console.error("[WORKER] Error during global ingestion cycle:", err);
    }
})();
