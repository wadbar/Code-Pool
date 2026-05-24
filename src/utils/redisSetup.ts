import Redis from 'ioredis';

/**
 * RedisSetup - Industrial Cache Orchestrator
 * Implements a circuit-breaker pattern with automatic Memory Fallback.
 */

class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private isConnected = false;
  private memoryCache = new Map<string, { data: any, expires: number }>();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private initialize() {
    const url = process.env.REDIS_URL;
    
    // Industrial Guard: Do not attempt connection if URL is missing in dev
    if (!url) {
      console.info('[Supreme-Cache] REDIS_URL not detected. Initializing Memory Cache Engine.');
      return;
    }

    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Supreme-Cache] Redis Threshold reached. Disabling remote cache.');
          return null; 
        }
        return Math.min(times * 1000, 3000);
      }
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[Supreme-Cache] Redis connectivity established.');
    });

    this.client.on('error', (err: any) => {
      this.isConnected = false;
      // Suppress ECONNREFUSED noise in dev logs unless it's a critical remote failure
      if (err.code !== 'ECONNREFUSED') {
        console.error('[Supreme-Cache] Redis error:', err.message);
      }
    });

    this.client.connect().catch(() => {
      this.isConnected = false;
    });
  }

  public getHealthStatus() {
    return {
      connected: this.isConnected,
      engine: this.isConnected ? 'REDIS' : 'LOCAL_MEMORY',
      latency: this.isConnected ? 'LOW' : 'ZERO'
    };
  }

  public async get(key: string): Promise<any> {
    if (this.isConnected && this.client) {
      try {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } catch {
        this.isConnected = false;
      }
    }

    const entry = this.memoryCache.get(key);
    if (entry && entry.expires > Date.now()) return entry.data;
    if (entry) this.memoryCache.delete(key);
    return null;
  }

  public async set(key: string, data: any, ttl = 3600): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, JSON.stringify(data), 'EX', ttl);
      } catch {
        this.isConnected = false;
      }
    }
    this.memoryCache.set(key, { data, expires: Date.now() + (ttl * 1000) });
  }

  public async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch {
        this.isConnected = false;
      }
    }
    this.memoryCache.delete(key);
  }
}

export const cacheEngine = RedisClient.getInstance();
