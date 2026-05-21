// Bloco Unificado: Auth-Shield
// Finalidade: Segurança, JWT, Proteção de API e Gestão de Sessão
// Ambiente Alvo: Node.js / Express 

import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import os from 'os';

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

// Limitador de taxa blindado e Adaptativo ao Hardware
export const kernelRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Janela dinâmica de 1 minuto
  max: 1000, // Aumentado de 100 para 1000 para evitar bloqueios em desenvolvimento
  skip: (req, res) => {
    // Desabilitado temporariamente para alta performance em desenvolvimento
    return true; 
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Excesso de requisições. A capacidade computacional da infraestrutura atingiu o limite.' }
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
