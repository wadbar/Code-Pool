import fs from 'fs';
import path from 'path';

export function logSystem(msg: string) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  try {
    fs.appendFileSync(path.join(process.cwd(), 'system.log'), `[${timestamp}] ${msg}\n`);
  } catch (err) {
    console.error('Failed to write to system.log', err);
  }
}
