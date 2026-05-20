import Redis from 'ioredis';

// Optional Redis client for caching and activity monitoring
export let redis: Redis | null = null;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('error', (err) => {
        console.warn('[REDIS] Connection error (falling back to memory):', err.message);
        redis = null;
    });
}

const memoryCache = new Map<string, { value: any, expiry: number }>();

export async function setCache(key: string, value: any, ttlSeconds: number = 60) {
    try {
        if (redis) {
            await redis.setex(key, ttlSeconds, JSON.stringify(value));
        } else {
            memoryCache.set(key, { value, expiry: Date.now() + (ttlSeconds * 1000) });
        }
    } catch (err) {
        console.warn(`[CACHE] Failed to set cache for ${key}`);
    }
}

export async function getCache<T>(key: string): Promise<T | null> {
    try {
        if (redis) {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } else {
            const cached = memoryCache.get(key);
            if (cached) {
                if (Date.now() < cached.expiry) {
                    return cached.value as T;
                } else {
                    memoryCache.delete(key);
                }
            }
            return null;
        }
    } catch (err) {
        console.warn(`[CACHE] Failed to get cache for ${key}`);
        return null;
    }
}

export async function invalidateCache(key: string) {
    try {
        if (redis) {
            await redis.del(key);
        } else {
            memoryCache.delete(key);
        }
    } catch(e) {}
}

export async function logUserActivity(userId: string, action: string, details: any = {}) {
    const activity = { userId, action, details, timestamp: Date.now() };
    try {
        if (redis) {
            await redis.lpush('user-activity', JSON.stringify(activity));
            await redis.ltrim('user-activity', 0, 999); // Keep last 1000
        } else {
            // Memory fallback
            let list = memoryCache.get('user-activity-logs')?.value || [];
            list.unshift(activity);
            if (list.length > 1000) list.pop();
            memoryCache.set('user-activity-logs', { value: list, expiry: Date.now() + (86400 * 7 * 1000) });
        }
        console.log(`[ACTIVITY] ${userId} - ${action}`);
    } catch (e) {}
}

export async function getActivityLogs(): Promise<any[]> {
    try {
        if (redis) {
            const logs = await redis.lrange('user-activity', 0, 99);
            return logs.map(l => JSON.parse(l));
        } else {
            const logs = memoryCache.get('user-activity-logs')?.value;
            return (logs || []).slice(0, 100);
        }
    } catch (e) {
        return [];
    }
}
