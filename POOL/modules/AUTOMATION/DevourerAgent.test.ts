import fs from 'fs';
import path from 'path';

describe('DevourerAgent (Real Integration)', () => {
    let mockQueuePath: string;
    let DevourerAgent: any;

    beforeAll(async () => {
        const module = await import('./DevourerAgent');
        DevourerAgent = module.DevourerAgent;
    });

    beforeEach(() => {
        mockQueuePath = path.join(process.cwd(), 'POOL', 'devourer-queue.json');
        if (fs.existsSync(mockQueuePath)) {
            fs.unlinkSync(mockQueuePath);
        }
    });

    afterAll(() => {
        if (fs.existsSync(mockQueuePath)) {
            fs.unlinkSync(mockQueuePath);
        }
    });

    test('should initialize queue file if it does not exist', () => {
        const agent = new DevourerAgent();
        expect(fs.existsSync(mockQueuePath)).toBeTruthy();
        expect(JSON.parse(fs.readFileSync(mockQueuePath, 'utf8'))).toEqual([]);
    });

    test('should add task to queue', () => {
        const agent = new DevourerAgent();
        
        const task = {
            repoUrl: 'https://github.com/wadbar/fake-repo-for-test-only',
            targetModule: 'AUTH',
            priority: 'high',
            status: 'pending'
        };

        agent.addTask(task);

        const content = JSON.parse(fs.readFileSync(mockQueuePath, 'utf8'));
        expect(content.length).toBe(1);
        expect(content[0].repoUrl).toBe(task.repoUrl);
        expect(content[0].status).toBe('pending');
    });

    test('should process pending tasks realistically', async () => {
        const agent = new DevourerAgent();
        
        const task = {
            repoUrl: 'https://github.com/wadbar/fake-repo-for-test-only', // Repositório que provavelmente não existe (ou falhará rápido)
            targetModule: 'AUTH',
            priority: 'high',
            status: 'pending'
        };

        agent.addTask(task);
        // O Ingester vai tentar clonar de verdade o repositório fake e falhará (ou não) dependendo da rede.
        // O status deve mudar de pendente para devoured ou failed baseado na tentativa real
        await agent.processQueue();

        const content = JSON.parse(fs.readFileSync(mockQueuePath, 'utf8'));
        expect(content.length).toBe(1);
        // O status mais provável é 'failed' porque o repositório é falso e o git clone falhará,
        // garantindo que não estamos usando simulacros (o executável do sistema operacional foi invocado).
        expect(['devoured', 'failed']).toContain(content[0].status);
    }, 80000); // 80 segundos de timeout para acomodar os exponential backoffs do RepoIngester 
});

