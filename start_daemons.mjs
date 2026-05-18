import { spawn } from 'child_process';
import fs from 'fs';

const logFile = fs.openSync('ingest.log', 'a');
const errFile = fs.openSync('ingest.err', 'a');

const p1 = spawn('npx', ['tsx', 'worker_ingest.ts'], {
    detached: true,
    stdio: ['ignore', logFile, errFile]
});
p1.unref();
console.log(`[DAEMON] Ingestion worker started PID: ${p1.pid}`);

const logFile2 = fs.openSync('blueprints.log', 'a');
const errFile2 = fs.openSync('blueprints.err', 'a');

const p2 = spawn('npx', ['tsx', 'worker_blueprints.ts'], {
    detached: true,
    stdio: ['ignore', logFile2, errFile2]
});
p2.unref();

console.log(`[DAEMON] Blueprints worker started PID: ${p2.pid}`);
