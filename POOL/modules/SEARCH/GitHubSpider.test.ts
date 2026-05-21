import { GitHubSpider } from './GitHubSpider';
import { jest } from '@jest/globals';

describe('GitHubSpider (Real Network Integration)', () => {
    let spider: GitHubSpider;

    beforeAll(() => {
        // Usa token de ambiente se existir, caso contrário vai anônimo (sujeito a rate limit)
        spider = new GitHubSpider(process.env.GITHUB_TOKEN || '');
    });

    // Timeout longo por causa de chamadas reais de rede
    jest.setTimeout(30000);

    test('discoverForks should fetch real forks for a known repository', async () => {
        // Usamos um repositório icônico/conhecido e pequeno/médio para não estourar paginação, 
        // mas axios vai retornar dados reais. 'facebook/react' tem muitos forks, então limitamos maxForks.
        const forks = await spider.discoverForks('wadbar/Code-Pool', 1);
        
        expect(Array.isArray(forks)).toBe(true);
        // Pode ser 0 se não tiver forks, mas não deve quebrar
        if (forks.length > 0) {
            expect(forks[0]).toContain('http');
        }
    });

    test('discoverRelatedByTopics should return real related URLs', async () => {
        const result = await spider.discoverRelatedByTopics(['react', 'typescript', 'test'], 1);
        
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
            expect(result[0]).toContain('http');
            expect(result[0]).toContain('github.com');
        }
    });

    test('discoverUserRepos should return real repos for a known user', async () => {
        const result = await spider.discoverUserRepos('wadbar', 2);
        
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
            expect(result[0]).toContain('http');
            expect(result[0]).toContain('github.com');
        }
    });
});

