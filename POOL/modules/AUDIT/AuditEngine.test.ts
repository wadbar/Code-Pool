import { assertEnvironmentVariable, purgeSensitiveResource } from './AuditEngine';
import { jest } from '@jest/globals';

describe('AuditEngine', () => {
    describe('assertEnvironmentVariable', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        test('should return value if environment variable exists', () => {
            process.env.TEST_VAR = 'test_value';
            expect(assertEnvironmentVariable('TEST_VAR')).toBe('test_value');
        });

        test('should throw error if environment variable does not exist', () => {
            delete process.env.TEST_VAR;
            expect(() => assertEnvironmentVariable('TEST_VAR')).toThrow('[CRITICAL-INFRA] Variável obrigatória não definida: TEST_VAR');
        });
    });

    describe('purgeSensitiveResource', () => {
        test('should clear cookie if clearCookie function is available', () => {
            const clearCookie = jest.fn();
            const res = { clearCookie };
            
            purgeSensitiveResource(res, 'sensitive_cookie');
            
            expect(clearCookie).toHaveBeenCalledWith('sensitive_cookie', expect.any(Object));
        });

        test('should not throw if clearCookie function is not available', () => {
            const res = {};
            expect(() => purgeSensitiveResource(res, 'sensitive_cookie')).not.toThrow();
        });
    });
});
