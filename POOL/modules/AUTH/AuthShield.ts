// Bloco Unificado: Auth-Shield
// Finalidade: Segurança, JWT, Proteção de API e Gestão de Sessão
// Ambiente Alvo: Node.js / Express 

import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// 1. Injeção Estrita na Interface nativa do Express (Elimina o uso de "any")
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number | string;
        login: string;
        avatar_url?: string;
        isGuest?: boolean;
        [key: string]: any;
      };
    }
  }
}

// Auxiliar manual para extração de Cookies de cabeçalhos brutos
export function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const parts = c.trim().split('=');
    const k = parts[0];
    if (k === name) {
      return parts.slice(1).join('='); 
    }
  }
  return null;
}

// Limitador de taxa global blindado
export const kernelRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 150, 
  // Em produção atrás de Nginx/Cloudflare, altere para true ou gerencie no app.set('trust proxy', 1)
  validate: { trustProxy: false }, 
  message: { error: 'Excesso de requisições. Conexão limitada para proteção do servidor.' }
});

export class AuthShield {
    /**
     * Valida e retorna o Secret JWT em tempo de execução.
     * Garante o padrão "Fail-Fast" caso a infraestrutura não injete a variável de ambiente.
     */
    private static getSecret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('[CRITICAL] JWT_SECRET não definido no ambiente de execução.');
        }
        return secret;
    }

    static generateToken(payload: string | object | Buffer, options: SignOptions = { expiresIn: '7d' }): string {
        return jwt.sign(payload, this.getSecret(), options);
    }

    static verifyToken(token: string): any {
        return jwt.verify(token, this.getSecret());
    }

    /**
     * Middleware não-bloqueante para validação JWT.
     * Permite fluxo contínuo como Guest se o token for ausente ou inválido.
     */
    static authenticate(req: Request, res: Response, next: NextFunction): void {
        let token = parseCookie(req.headers.cookie, 'token');
        
        // Fallback para cabeçalho Authorization Bearer
        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        // Sem token: Atribuição imediata de Guest
        if (!token) {
            req.user = AuthShield.getGuestIdentity();
            return next();
        }
        
        try {
            const decoded = AuthShield.verifyToken(token);
            req.user = decoded;
            return next();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
            console.warn(`[AuthShield] Token de sessão rejeitado/expirado (${errorMessage}). Executando purga e operando como Guest.`);
            
            // Purga real do cookie corrompido no cliente
            res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            
            req.user = AuthShield.getGuestIdentity();
            return next();
        }
    }

    // Isola o gerador de identidade Guest para manter a modularidade e evitar repetição
    private static getGuestIdentity() {
        return {
            id: 1337,
            login: 'Guest',
            avatar_url: 'https://avatars.githubusercontent.com/u/10137?v=4',
            isGuest: true
        };
    }
}
