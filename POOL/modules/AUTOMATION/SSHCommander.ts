// Bloco Unificado: SSH-Commander
// Finalidade: Execução de comandos remotos e gerenciamento de VPS
// Status: Consolidado (Originalmente em papermu, papercreeper)

import { Client } from 'ssh2';

export class SSHCommander {
    private conn = new Client();

    async connect(config: any) {
        return new Promise<void>((resolve, reject) => {
            this.conn.on('ready', () => resolve()).on('error', reject).connect(config);
        });
    }

    async exec(cmd: string) {
        return new Promise((resolve, reject) => {
            this.conn.exec(cmd, (err, stream) => {
                if (err) return reject(err);
                let output = '';
                stream.on('data', (d: any) => output += d);
                stream.on('close', () => resolve(output));
            });
        });
    }
}
