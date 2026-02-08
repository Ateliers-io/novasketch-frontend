import { db } from "../db";
import type { CacheEntry } from "../db/schema";

export async function setCache(key: string, value: unknown) {
    const entry: CacheEntry = {
        key,
        value,
        updatedAt: Date.now(),
    };
    return db.cache.put(entry);
}

export async function getCache<T>(key: string): Promise<T | null> {
    const entry = await db.cache.get(key);
    if (!entry) return null;
    return entry.value as T;
}

export async function removeCache(key: string) {
    return db.cache.delete(key);
}

export async function clearCache() {
    return db.cache.clear();
}
