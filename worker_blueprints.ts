import { RepoIngester } from './POOL/modules/AUTOMATION/RepoIngester';

(async () => {
    console.log("[WORKER] Booting background retrograde blueprint generation...");
    try {
        await RepoIngester.generateMissingBlueprints();
        console.log("[WORKER] Retroactive blueprint retrofitting complete.");
    } catch (err) {
        console.error("[WORKER] Error during blueprint generation:", err);
    }
})();
