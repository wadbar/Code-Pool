// Bloco Unificado: SSH-Commander
// Finalidade: Execução de comandos remotos e gerenciamento de VPS
// Status: Consolidado (Originalmente em papermu, papercreeper)

/**
 * @doc EXPLANATION OF EXTERNAL IMPORTS:
 * - `Client` (from 'ssh2'): Classe de cliente SSH estrita que abre conexões SCP/SFTP,
 *   gerencia canais SSH de fluxo duplo para executar comandos remotos síncronos/assíncronos nas VPS cadastradas.
 */
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

    async uploadFile(localPath: string, remotePath: string) {
        return new Promise<void>((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) return reject(err);
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }

    async downloadFile(remotePath: string, localPath: string) {
        return new Promise<void>((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) return reject(err);
                sftp.fastGet(remotePath, localPath, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }
}
