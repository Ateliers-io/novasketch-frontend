import { db } from "../db";
import type { SyncOperation } from "../db/schema";

class SyncService {
    private isSyncing = false;

    constructor() {
        this.init();
    }

    private init() {
        // Listen for online events
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('App back online. Triggering sync...');
                this.processQueue();
            });
        }
    }

    /**
     * Queue a new operation to be synced with the backend
     */
    async queueOperation(collection: string, action: SyncOperation['action'], payload: any) {
        const operation: SyncOperation = {
            collection,
            action,
            payload,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0
        };

        await db.syncQueue.add(operation);

        // If we're online, try to process immediately
        if (navigator.onLine) {
            this.processQueue();
        }
    }

    /**
     * Iterate through the queue and sync items to the backend
     */
    async processQueue() {
        if (this.isSyncing) return;
        if (!navigator.onLine) return;

        const pendingOps = await db.syncQueue
            .where('status')
            .equals('pending')
            .toArray();

        if (pendingOps.length === 0) return;

        this.isSyncing = true;
        console.log(`Processing sync queue: ${pendingOps.length} items...`);

        for (const op of pendingOps) {
            try {
                await this.syncToBackend(op);
                // On success, remove from queue
                await db.syncQueue.delete(op.id!);
            } catch (error) {
                console.error(`Failed to sync operation ${op.id}:`, error);

                // Update retry count and status
                await db.syncQueue.update(op.id!, {
                    status: 'failed',
                    retryCount: (op.retryCount || 0) + 1
                });
            }
        }

        this.isSyncing = false;

        // Check if there are still failed items to retry later
        const failedOps = await db.syncQueue.where('status').equals('failed').toArray();
        if (failedOps.length > 0 && navigator.onLine) {
            // Optional: Set a timeout to retry failed ones if we're still online
            setTimeout(() => this.retryFailed(), 5000);
        }
    }

    private async retryFailed() {
        await db.syncQueue.where('status').equals('failed').modify({ status: 'pending' });
        this.processQueue();
    }

    /**
     * Placeholder for the actual API call to your MongoDB backend
     */
    private async syncToBackend(op: SyncOperation) {
        console.log(`Syncing ${op.action} on ${op.collection} to MongoDB...`, op.payload);

        // TODO: Replace with real axios/fetch call to your API
        // const response = await fetch(`/api/${op.collection}`, {
        //   method: op.action === 'CREATE' ? 'POST' : op.action === 'UPDATE' ? 'PUT' : 'DELETE',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(op.payload)
        // });

        // if (!response.ok) throw new Error('Backend sync failed');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        return true;
    }
}

export const syncService = new SyncService();
