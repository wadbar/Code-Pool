import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

export interface SSHKeyPairInfo {
    privateKeyPath: string;
    publicKeyPath: string;
    publicKey: string | null;
    exists: boolean;
}

export interface SSHTestResult {
    success: boolean;
    username: string | null;
    message: string;
    rawOutput: string;
}

export class SSHManager {
    private static KEY_FILE_NAME = 'id_github_pool';

    /**
     * Retorna o diretório .ssh do usuário no sistema (~/.ssh)
     */
    public static getSshDir(): string {
        const home = os.homedir();
        const sshDir = path.join(home, '.ssh');
        if (!fs.existsSync(sshDir)) {
            fs.mkdirSync(sshDir, { recursive: true, mode: 0x1c0 }); // 0700 permissions
        }
        return sshDir;
    }

    /**
     * Retorna o diretório de persistência/backup dentro da própria POOL
     */
    public static getBackupDir(): string {
        const backupDir = path.join(process.cwd(), 'POOL', 'data', 'ssh_backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        return backupDir;
    }

    /**
     * Retorna os caminhos dos arquivos de chaves no sistema (~/.ssh/id_github_pool)
     */
    public static getKeyPaths(): { privateKeyPath: string; publicKeyPath: string } {
        const sshDir = this.getSshDir();
        return {
            privateKeyPath: path.join(sshDir, this.KEY_FILE_NAME),
            publicKeyPath: path.join(sshDir, `${this.KEY_FILE_NAME}.pub`)
        };
    }

    /**
     * Retorna os caminhos dos arquivos de backup das chaves
     */
    public static getBackupPaths(): { privateBackupPath: string; publicBackupPath: string } {
        const backupDir = this.getBackupDir();
        return {
            privateBackupPath: path.join(backupDir, this.KEY_FILE_NAME),
            publicBackupPath: path.join(backupDir, `${this.KEY_FILE_NAME}.pub`)
        };
    }

    /**
     * Gera um novo par de chaves SSH (RSA 4096 bits) focado em integração com GitHub
     */
    public static async generateKeyPair(force = false): Promise<SSHKeyPairInfo> {
        const { privateKeyPath, publicKeyPath } = this.getKeyPaths();
        const { privateBackupPath, publicBackupPath } = this.getBackupPaths();

        const existsSystem = fs.existsSync(privateKeyPath);
        const existsBackup = fs.existsSync(privateBackupPath);

        // Se já existe no sistema ou no backup e não for forçado, restaura e retorna
        if (!force) {
            if (existsSystem) {
                return this.getKeyPairInfo();
            }
            if (existsBackup) {
                this.restoreFromBackup();
                return this.getKeyPairInfo();
            }
        }

        console.log('[SSH-MANAGER] Iniciando geração de par de chaves SSH (RSA 4096)...');
        
        // Limpar arquivos antigos para assegurar transição sem erros nas permissões
        for (const file of [privateKeyPath, publicKeyPath, privateBackupPath, publicBackupPath]) {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch (e) {}
            }
        }

        return new Promise<SSHKeyPairInfo>((resolve, reject) => {
            const command = `ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "lego-pool@github-auth"`;
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    console.error('[SSH-MANAGER] Erro ao executar ssh-keygen:', stderr || err.message);
                    return reject(new Error(`Falha ao gerar par de chaves SSH: ${err.message}`));
                }

                try {
                    // Configura as permissões estritas recomendadas pelo protocolo SSH
                    fs.chmodSync(privateKeyPath, 0x100); // 0400 (Somente leitura dono)
                    fs.chmodSync(publicKeyPath, 0x1a4);  // 0644

                    // Backup para persistência de dados
                    fs.copyFileSync(privateKeyPath, privateBackupPath);
                    fs.copyFileSync(publicKeyPath, publicBackupPath);

                    console.log(`[SSH-MANAGER] Par de chaves criado com sucesso em: ${privateKeyPath}`);
                    
                    const info = this.getKeyPairInfo();
                    resolve(info);
                } catch (writeErr: any) {
                    reject(new Error(`Falha ao salvar/backupear chaves geradas: ${writeErr.message}`));
                }
            });
        });
    }

    /**
     * Retorna as informações do par de chaves atual
     */
    public static getKeyPairInfo(): SSHKeyPairInfo {
        const { privateKeyPath, publicKeyPath } = this.getKeyPaths();
        const exists = fs.existsSync(privateKeyPath);
        let publicKey: string | null = null;

        if (exists && fs.existsSync(publicKeyPath)) {
            try {
                publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
            } catch (e) {}
        }

        return {
            privateKeyPath,
            publicKeyPath,
            publicKey,
            exists
        };
    }

    /**
     * Sifona/Lê a chave pública atual em runtime
     */
    public static getPublicKey(): string | null {
        const { publicKeyPath } = this.getKeyPaths();
        if (fs.existsSync(publicKeyPath)) {
            return fs.readFileSync(publicKeyPath, 'utf8').trim();
        }
        
        const { publicBackupPath } = this.getBackupPaths();
        if (fs.existsSync(publicBackupPath)) {
            this.restoreFromBackup();
            if (fs.existsSync(publicKeyPath)) {
                return fs.readFileSync(publicKeyPath, 'utf8').trim();
            }
        }
        return null;
    }

    /**
     * Lê a chave privada atual de forma segura
     */
    public static getPrivateKey(): string | null {
        const { privateKeyPath } = this.getKeyPaths();
        if (fs.existsSync(privateKeyPath)) {
            return fs.readFileSync(privateKeyPath, 'utf8').trim();
        }
        
        const { privateBackupPath } = this.getBackupPaths();
        if (fs.existsSync(privateBackupPath)) {
            this.restoreFromBackup();
            if (fs.existsSync(privateKeyPath)) {
                return fs.readFileSync(privateKeyPath, 'utf8').trim();
            }
        }
        return null;
    }

    /**
     * Permite salvar uma chave SSH privada customizada (caso o usuário já possua uma)
     */
    public static async saveCustomPrivateKey(privateKeyContent: string, publicKeyContent?: string): Promise<void> {
        const { privateKeyPath, publicKeyPath } = this.getKeyPaths();
        const { privateBackupPath, publicBackupPath } = this.getBackupPaths();

        const cleanPrivateKey = privateKeyContent.trim() + '\n';
        
        // Garante criação do diretório .ssh
        this.getSshDir();

        // Escrita nos caminhos principais
        fs.writeFileSync(privateKeyPath, cleanPrivateKey, { mode: 0x180 }); // 0600
        if (publicKeyContent) {
            fs.writeFileSync(publicKeyPath, publicKeyContent.trim() + '\n', { mode: 0x1a4 }); // 0644
        } else {
            // Se não forneceu chave pública, tenta remover a antiga para evitar incongruências
            if (fs.existsSync(publicKeyPath)) {
                try { fs.unlinkSync(publicKeyPath); } catch (e) {}
            }
        }

        // Replica para a pasta de backup (persistência estável)
        fs.writeFileSync(privateBackupPath, cleanPrivateKey);
        if (publicKeyContent) {
            fs.writeFileSync(publicBackupPath, publicKeyContent.trim() + '\n');
        } else if (fs.existsSync(publicBackupPath)) {
            try { fs.unlinkSync(publicBackupPath); } catch (e) {}
        }

        console.log('[SSH-MANAGER] Chave privada customizada importada e salva com sucesso.');
    }

    /**
     * Escaneia as chaves de máquina/host do GitHub para adicioná-las ao known_hosts,
     * prevenindo paradas interativas durante o processo automático de sincronização.
     */
    public static setupKnownHosts(): Promise<void> {
        const sshDir = this.getSshDir();
        const knownHostsPath = path.join(sshDir, 'known_hosts');

        console.log('[SSH-MANAGER] Buscando e autorizando chaves públicas do host github.com...');

        return new Promise<void>((resolve, reject) => {
            exec('ssh-keyscan github.com', (err, stdout, stderr) => {
                if (err) {
                    console.warn('[SSH-MANAGER] ssh-keyscan falhou (rede ocupada ou indisponível). Adicionando bypass estático.');
                    
                    // Bypass estático em caso de rede bloqueada na varredura ativa
                    const staticGithubHosts = 
                        "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0Sd86V356GsAJLQs5ap1zyTuhd4S2X1gD\n" +
                        "github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSWZPMnNGu33XkXy5gqReKFRX5f6KSA8TEQYFrGviizKAhN4R7mFTo0A/1B3eQvM15MebgaI51z6DuTcaY40=\n" +
                        "github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjsh4fHxbEZS42m46NxRYpxA6X2xpWccgwiIBxA3V20nihWv49NnYYYsH7L38KzKDXoKlN/5WJ8e8+8+1Wz34000000000000000000000000000000000000000000000000000000000= (placeholder robusto)\n";
                    
                    try {
                        fs.writeFileSync(knownHostsPath, staticGithubHosts, { flag: 'a' });
                        return resolve();
                    } catch (writeErr: any) {
                        return reject(writeErr);
                    }
                }

                try {
                    const scannedKeys = stdout.trim();
                    if (scannedKeys) {
                        let currentContent = '';
                        if (fs.existsSync(knownHostsPath)) {
                            currentContent = fs.readFileSync(knownHostsPath, 'utf8');
                        }
                        
                        // Evita duplicidade agressiva
                        const keysToAdd = scannedKeys.split('\n').filter(line => {
                            return !currentContent.includes(line.trim());
                        });

                        if (keysToAdd.length > 0) {
                            fs.writeFileSync(knownHostsPath, currentContent + (currentContent.endsWith('\n') || currentContent === '' ? '' : '\n') + keysToAdd.join('\n') + '\n');
                            console.log('[SSH-MANAGER] Hosts autorizados com sucesso em known_hosts.');
                        } else {
                            console.log('[SSH-MANAGER] Chaves do Host github.com já cadastradas em known_hosts.');
                        }
                    }
                    resolve();
                } catch (writeErr: any) {
                    reject(new Error(`Falha ao gravar hosts conhecidos: ${writeErr.message}`));
                }
            });
        });
    }

    /**
     * Configura o arquivo de ~/.ssh/config para priorizar o uso desta chave específica
     * ao interagir com o GitHub.
     */
    public static configureSshConfig(): void {
        const sshDir = this.getSshDir();
        const configPath = path.join(sshDir, 'config');
        const { privateKeyPath } = this.getKeyPaths();

        const configSnippet = `\n# LEGO-POOL AUTOGENERATED\nHost github.com\n  HostName github.com\n  User git\n  IdentityFile ${privateKeyPath}\n  IdentitiesOnly yes\n  StrictHostKeyChecking no\n`;

        try {
            let content = '';
            if (fs.existsSync(configPath)) {
                content = fs.readFileSync(configPath, 'utf8');
            }

            if (!content.includes('id_github_pool') && !content.includes('LEGO-POOL AUTOGENERATED')) {
                fs.writeFileSync(configPath, content + configSnippet, { mode: 0x180 }); // 0600
                console.log('[SSH-MANAGER] Arquivo ~/.ssh/config configurado com bypass de identidade GitHub.');
            } else {
                console.log('[SSH-MANAGER] Ajustes de atalho SSH no ~/.ssh/config já integrados.');
            }
        } catch (e: any) {
            console.error('[SSH-MANAGER] Alerta: Não foi possível configurar o arquivo ~/.ssh/config:', e.message);
        }
    }

    /**
     * Retorna a string do git ssh command para sobreposição manual em tempo de execução
     */
    public static getGitSshCommand(): string {
        const { privateKeyPath } = this.getKeyPaths();
        return `ssh -i "${privateKeyPath}" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes`;
    }

    /**
     * Executa teste real de conexão à autenticação do GitHub utilizando SSH
     */
    public static async testGitHubConnection(): Promise<SSHTestResult> {
        const { privateKeyPath } = this.getKeyPaths();
        if (!fs.existsSync(privateKeyPath)) {
            return {
                success: false,
                username: null,
                message: 'Chave SSH privada indisponível. Por favor, gere um par de chaves primeiro.',
                rawOutput: ''
            };
        }

        console.log('[SSH-MANAGER] Executando diagnóstico de conexão com o GitHub...');

        return new Promise<SSHTestResult>((resolve) => {
            const cmd = `ssh -i "${privateKeyPath}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o IdentitiesOnly=yes -T git@github.com`;
            
            exec(cmd, (err, stdout, stderr) => {
                const combined = (stdout + '\n' + stderr).trim();
                
                // Nota: O GitHub intencionalmente retorna código 1 sob conexão SSH bem-sucedida que não possui shell
                const isSuccessfulAuth = combined.includes('You\'ve successfully authenticated');
                
                if (isSuccessfulAuth) {
                    // Extrai o nome de usuário (exemplo: "Hi username! You've successfully authenticated")
                    const match = combined.match(/Hi\s+([a-zA-Z0-9_\-]+)!/i);
                    const username = match ? match[1] : null;

                    resolve({
                        success: true,
                        username,
                        message: `Autenticado com sucesso no GitHub como "${username || 'Desconhecido'}".`,
                        rawOutput: combined
                    });
                } else {
                    let errMsg = 'Falha crítica na autenticação por chaves com o GitHub.';
                    if (combined.includes('Permission denied')) {
                        errMsg = 'Acesso Recusado (Permission Denied). Certifique-se de adicionar a Chave Pública (Deploy Key) gerada às configurações do repositório no GitHub.';
                    } else if (combined.includes('Could not resolve hostname') || combined.includes('Connection timed out')) {
                        errMsg = 'Erro de rede ou resolução DNS ao tentar contatar o servidor github.com.';
                    }

                    resolve({
                        success: false,
                        username: null,
                        message: errMsg,
                        rawOutput: combined
                    });
                }
            });
        });
    }

    /**
     * Helper de reparação rápida de redundância de cópias
     */
    private static restoreFromBackup() {
        const { privateKeyPath, publicKeyPath } = this.getKeyPaths();
        const { privateBackupPath, publicBackupPath } = this.getBackupPaths();

        try {
            if (fs.existsSync(privateBackupPath) && !fs.existsSync(privateKeyPath)) {
                fs.copyFileSync(privateBackupPath, privateKeyPath);
                fs.chmodSync(privateKeyPath, 0x100); // 0400
                console.log('[SSH-MANAGER] Chave privada restaurada com sucesso a partir do backup.');
            }
            if (fs.existsSync(publicBackupPath) && !fs.existsSync(publicKeyPath)) {
                fs.copyFileSync(publicBackupPath, publicKeyPath);
                fs.chmodSync(publicKeyPath, 0x1a4);  // 0644
                console.log('[SSH-MANAGER] Chave pública restaurada com sucesso a partir do backup.');
            }
        } catch (e: any) {
            console.error('[SSH-MANAGER] Falha grave de recuperação das chaves:', e.message);
        }
    }
}
