import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from './sync.service';
import { db } from '../db';

describe('SyncService', () => {
    let syncService: SyncService;

    beforeEach(async () => {
        await db.syncQueue.clear();
        // Reset navigator.onLine to true for each test
        (navigator as any).onLine = true;
        syncService = new SyncService();
    });

    it('should queue an operation and try to process it if online', async () => {
        const processSpy = vi.spyOn(syncService, 'processQueue');

        await syncService.queueOperation('users', 'CREATE', { id: '1', name: 'Test' });

        const count = await db.syncQueue.count();
        expect(count).toBe(1);
        expect(processSpy).toHaveBeenCalled();
    });

    it('should stay in queue if offline', async () => {
        (navigator as any).onLine = false;
        const processSpy = vi.spyOn(syncService, 'processQueue');

        await syncService.queueOperation('users', 'CREATE', { id: '2', name: 'Offline' });

        const count = await db.syncQueue.count();
        expect(count).toBe(1);

        const ops = await db.syncQueue.toArray();
        expect(ops[0].status).toBe('pending');
    });

    it('should delete from queue on successful sync', async () => {
        // Mock successful sync by accessing private method via prototype for the test
        const syncSpy = vi.spyOn(SyncService.prototype as any, 'syncToBackend').mockResolvedValue(true);

        await syncService.queueOperation('users', 'CREATE', { id: '3', name: 'Success' });

        // Explicitly await processing
        await syncService.processQueue();

        const count = await db.syncQueue.count();
        expect(count).toBe(0);
        expect(syncSpy).toHaveBeenCalled();
    });
});
