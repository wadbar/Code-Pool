import { spawn } from 'child_process';
import fs from 'fs';

const logFile = fs.openSync('blueprints.log', 'a');
const errFile = fs.openSync('blueprints.err', 'a');

const child = spawn('npx', ['tsx', 'worker_blueprints.ts'], {
    detached: true,
    stdio: ['ignore', logFile, errFile]
});

child.unref();

console.log(`[DAEMON] Background retro-blueprint worker started with PID ${child.pid}.`);
console.log(`[DAEMON] This process will scan the pool registry and generate blueprints for repos that lack them.`);
console.log(`[DAEMON] You can check logs using: cat blueprints.log`);
