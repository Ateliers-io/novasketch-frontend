import { describe, it, expect, beforeEach } from 'vitest';
import * as whiteboardService from './whiteboard.service';
import { db } from '../db';

describe('WhiteboardService', () => {
    const boardId = 'test-board';

    beforeEach(async () => {
        await db.whiteboard.clear();
        await db.syncQueue.clear();
    });

    it('should save a whiteboard element and queue it for sync', async () => {
        const element = {
            type: 'shape' as const,
            data: {
                id: 'shape-1',
                type: 'rectangle' as any,
                position: { x: 10, y: 10 },
                width: 100,
                height: 100,
                style: { stroke: '#000', strokeWidth: 2, fill: '#fff', hasFill: true },
                transform: { rotation: 0, scaleX: 1, scaleY: 1 },
                zIndex: 1,
                opacity: 1,
                visible: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };

        await whiteboardService.saveWhiteboardElement(boardId, element);

        // Check local DB
        const localItem = await db.whiteboard.get('shape-1');
        expect(localItem).toBeDefined();
        expect(localItem?.boardId).toBe(boardId);

        // Check Sync Queue
        const syncOps = await db.syncQueue.toArray();
        expect(syncOps.length).toBe(1);
        expect(syncOps[0].collection).toBe('whiteboard');
        expect(syncOps[0].action).toBe('UPDATE');
    });

    it('should delete a whiteboard element and queue for sync', async () => {
        // Prime the DB
        await db.whiteboard.add({
            id: 'shape-2',
            boardId,
            element: { type: 'shape', data: { id: 'shape-2' } } as any,
            updatedAt: Date.now()
        });

        await whiteboardService.deleteWhiteboardElement(boardId, 'shape-2');

        // Check local DB
        const localItem = await db.whiteboard.get('shape-2');
        expect(localItem).toBeUndefined();

        // Check Sync Queue
        const syncOps = await db.syncQueue.where('action').equals('DELETE').toArray();
        expect(syncOps.length).toBe(1);
        expect(syncOps[0].payload.elementId).toBe('shape-2');
    });
});
