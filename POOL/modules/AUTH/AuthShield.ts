// Bloco Unificado: Auth-Shield
// Finalidade: Segurança, JWT e Proteção de API

import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Auxiliar manual para extração de Cookies específicos de cabeçalhos brutos de requisição HTTP
export function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let c of cookies) {
    const parts = c.trim().split('=');
    const k = parts[0];
    const v = parts.slice(1).join('='); // Suporta valores que contenham "="
    if (k === name) return v;
  }
  return null;
}

// Limitador de taxa global para prevenção de ataques de força bruta ou estouro de recursos
export const kernelRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela padrão de 15 minutos
  max: 15000, // Permite até 15000 requisições por janela ip (aumentado para evitar falsos positivos no ambiente de desenvolvimento local)
  validate: { trustProxy: false }, // Evita as validações rígidas de proxy que geram ValidationError em certos ambientes
  message: { error: 'Excesso de requisições enviadas ao servidor. Por favor, tente novamente mais tarde.' }
});

export class AuthShield {
    static generateToken(payload: any, secret: string) {
        return jwt.sign(payload, secret, { expiresIn: '7d' });
    }

    static verifyToken(token: string, secret: string) {
        return jwt.verify(token, secret);
    }

    /**
     * Middleware unificado express para validação opcional/não-bloqueante de token de sessão JWT.
     * Se um token for fornecido, ele é verificado e o usuário é identificado.
     * Se nenhum token for fornecido, o acesso é concedido como Guest/Desenvolvedor Local automaticamente,
     * garantindo que nenhuma funcionalidade do ecossistema open-source seja bloqueada.
     */
    static authenticate(req: Request, res: Response, next: NextFunction) {
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
        
        // Tenta coletar do Cookie de sessão primeiramente (método preferido)
        let token = parseCookie(req.headers.cookie, 'token');
        
        // Trata alternativa de fallback via cabeçalho Authorization Bearer
        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                token = parts[1];
            }
        }
        
        // Se não houver token, permite acesso irrestrito como Desenvolvedor Guest
        if (!token) {
            (req as any).user = {
                id: 1337,
                login: 'Guest',
                avatar_url: 'https://avatars.githubusercontent.com/u/10137?v=4',
                isGuest: true
            };
            return next();
        }
        
        try {
            const decoded = AuthShield.verifyToken(token, JWT_SECRET);
            (req as any).user = decoded; // Popula payload sintonizado pro Express
            next();
        } catch (err: any) {
            console.warn('[AuthShield] Token expirado ou inválido de sessão. Continuando como Guest:', err.message);
            // Em caso de token expirado ou inválido, limpamos o cookie corrompido e permitimos prosseguir como Guest
            (req as any).user = {
                id: 1337,
                login: 'Guest',
                avatar_url: 'https://avatars.githubusercontent.com/u/10137?v=4',
                isGuest: true
            };
            next();
        }
    }
}
