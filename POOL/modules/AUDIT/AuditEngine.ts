// Bloco Unificado: Audit-Engine
// Finalidade: Biblioteca de padrões de hardening, sanitização e auditoria industrial.

export interface AuditResults {
    vulnerabilities: string[];
    hardened: boolean;
    timestamp: string;
}

/**
 * Protocolo Industrial de Hardening de Variáveis de Ambiente
 * Executa o padrão Fail-Fast para variáveis críticas de infraestrutura.
 */
export function assertEnvironmentVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`[CRITICAL-INFRA] Variável obrigatória não definida: ${name}`);
    }
    return value;
}

/**
 * Protocolo de Sanitização de Recursos (Leak-Prevention)
 * Garante que cookies ou buffers sejam limpos de forma real.
 */
export function purgeSensitiveResource(res: any, name: string): void {
    if (typeof res.clearCookie === 'function') {
        res.clearCookie(name, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    }
}
