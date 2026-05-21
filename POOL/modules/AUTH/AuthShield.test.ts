import { AuthShield } from './AuthShield';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

describe('AuthShield', () => {
    const originalEnv = process.env;
    const testSecret = 'test-secret-123';

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.JWT_SECRET = testSecret;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('generateToken should create a valid token', () => {
        const payload = { username: 'testuser' };
        const token = AuthShield.generateToken(payload);
        
        expect(token).toBeDefined();
        const decoded = jwt.verify(token, testSecret) as any;
        expect(decoded.username).toBe('testuser');
    });

    test('verifyToken should verify a valid token', () => {
        const payload = { userId: 123 };
        const token = jwt.sign(payload, testSecret);
        
        const verified = AuthShield.verifyToken(token);
        expect(verified.userId).toBe(123);
    });

    test('authenticate should set guest identity if no token provided', () => {
        const req = { headers: {} } as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        AuthShield.authenticate(req, res, next);

        expect(req.user?.isGuest).toBe(true);
        expect(req.user?.login).toBe('Guest');
        expect(next).toHaveBeenCalled();
    });

    test('authenticate should set user identity if valid token provided in Bearer', () => {
        const payload = { id: 1, login: 'realuser' };
        const token = AuthShield.generateToken(payload);
        
        const req = { 
            headers: { authorization: `Bearer ${token}` } 
        } as unknown as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        AuthShield.authenticate(req, res, next);

        expect(req.user?.id).toBe(1);
        expect(req.user?.login).toBe('realuser');
        expect(req.user?.isGuest).toBeUndefined();
        expect(next).toHaveBeenCalled();
    });

    test('authenticate should clear cookie and set guest identity if token invalid', () => {
        const req = { headers: { cookie: 'token=invalid-token' } } as unknown as Request;
        const res = { clearCookie: jest.fn() } as unknown as Response;
        const next = jest.fn() as NextFunction;

        AuthShield.authenticate(req, res, next);

        expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
        expect(req.user?.isGuest).toBe(true);
        expect(next).toHaveBeenCalled();
    });
});
