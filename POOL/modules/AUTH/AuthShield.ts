// Bloco Unificado: Auth-Shield
// Finalidade: Segurança, JWT e Proteção de API
// Status: Consolidado (Originalmente em Fliper, papervideo)

import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

export const kernelRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

export class AuthShield {
    static generateToken(payload: any, secret: string) {
        return jwt.sign(payload, secret, { expiresIn: '24h' });
    }

    static verifyToken(token: string, secret: string) {
        return jwt.verify(token, secret);
    }
}
