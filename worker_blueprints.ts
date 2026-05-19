import fs from 'fs';
import path from 'path';
import { RepoIngester } from './POOL/modules/AUTOMATION/RepoIngester';
import { UpdateManager } from './POOL/modules/AUTOMATION/UpdateManager';

(async () => {
    console.log("[WORKER-BLUEPRINT] Booting background retroactive blueprint generator...");
    
    while (true) {
        try {
            await UpdateManager.waitIfPaused();
            const control = UpdateManager.getControlStatus();
            if (control.status === 'stop_after_current') {
                console.log("[WORKER-BLUEPRINT] Stop triggered.");
                await new Promise(r => setTimeout(r, 10000));
                continue;
            }
            
            await RepoIngester.generateMissingBlueprints();
            // Wait 120 seconds before checking again for missing blueprints
            await new Promise(r => setTimeout(r, 120000));
        } catch (err) {
            console.error("[WORKER-BLUEPRINT] Error during generation:", err);
            await new Promise(r => setTimeout(r, 120000));
        }
    }
})();
