import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './api';
import {
    createSession,
    getSession,
    toggleSessionLock,
    upsertLocalBoard,
    touchLocalBoard,
    updateSessionName,
    getUserSessions,
    joinSession,
    deleteSession
} from './session.service';

vi.mock('./api');

describe('Session Service', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        mockStorage = {};

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => mockStorage[key] || null);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
            mockStorage[key] = value.toString();
        });

        // Mock Math.random for deterministic UUID generation in fallback
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Local Board Registry', () => {
        it('should upsert a local board', () => {
            const board = { sessionId: 'board1', name: 'Test', createdBy: 'me', createdAt: 'now', url: '/b1' };
            upsertLocalBoard(board);

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards).toHaveLength(1);
            expect(boards[0]).toEqual(board);

            // Upsert existing
            board.name = 'Updated';
            upsertLocalBoard(board);
            const boards2 = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards2).toHaveLength(1);
            expect(boards2[0].name).toBe('Updated');
        });

        it('should touch a local board', () => {
            const board = { sessionId: 'board1', name: 'Test', createdBy: 'me', createdAt: 'now', url: '/b1' };
            upsertLocalBoard(board);

            touchLocalBoard('board1');
            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards[0].lastEditedAt).toBeDefined();
            expect(boards[0].lastAccessedAt).toBeDefined();
        });
    });

    describe('createSession', () => {
        it('should create session via API and save locally', async () => {
            vi.mocked(api.post).mockResolvedValue({ data: { canvasId: 'api-123', url: '/b/api-123' } });

            const result = await createSession('My Board', true);
            expect(api.post).toHaveBeenCalledWith('/canvas', { name: 'My Board' });
            expect(result.sessionId).toBe('api-123');

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards).toHaveLength(1);
            expect(boards[0].sessionId).toBe('api-123');
            expect(boards[0].isCollab).toBe(true);
        });

        it('should fallback to client UUID if API fails', async () => {
            vi.mocked(api.post).mockRejectedValue(new Error('Network Error'));

            const result = await createSession();
            expect(result.sessionId).toBeDefined();
            // It should generate a UUID
            expect(typeof result.sessionId).toBe('string');
            expect(result.sessionId.length).toBeGreaterThan(10);

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards).toHaveLength(1);
            expect(boards[0].sessionId).toBe(result.sessionId);
        });
    });

    describe('getSession', () => {
        it('should fetch session from API', async () => {
            vi.mocked(api.get).mockResolvedValue({
                data: { canvasId: '123', name: 'Board 123', is_locked: true }
            });

            const result = await getSession('123');
            expect(api.get).toHaveBeenCalledWith('/canvas/123');
            expect(result).toMatchObject({
                sessionId: '123',
                name: 'Board 123',
                is_locked: true,
            });
        });

        it('should return null on API error', async () => {
            vi.mocked(api.get).mockRejectedValue(new Error('error'));
            const result = await getSession('999');
            expect(result).toBeNull();
        });
    });

    describe('Lock Feature', () => {
        it('should successfully toggle session lock state', async () => {
            const mockResponse = { data: { is_locked: true } };
            vi.mocked(api.patch).mockResolvedValue(mockResponse);

            const result = await toggleSessionLock('test-room', true);

            expect(api.patch).toHaveBeenCalledWith('/canvas/test-room/lock', { is_locked: true });
            expect(result).toBe(true);
        });

        it('should handle errors when toggling session lock state', async () => {
            const mockError = new Error('Network Error');
            vi.mocked(api.patch).mockRejectedValue(mockError);

            await expect(toggleSessionLock('test-room', true)).rejects.toThrow('Network Error');
        });
    });

    describe('updateSessionName', () => {
        it('should update name via API and locally', async () => {
            vi.mocked(api.patch).mockResolvedValue({});
            upsertLocalBoard({ sessionId: 'board1', name: 'Old', createdBy: '', createdAt: '', url: '' });

            await updateSessionName('board1', 'New Note');
            expect(api.patch).toHaveBeenCalledWith('/canvas/board1/name', { name: 'New Note' });

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards[0].name).toBe('New Note');
        });

        it('should update name locally even if API fails', async () => {
            vi.mocked(api.patch).mockRejectedValue(new Error('offline'));
            upsertLocalBoard({ sessionId: 'b1', name: 'Old', createdBy: '', createdAt: '', url: '' });

            await updateSessionName('b1', 'Fallback Note');

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards[0].name).toBe('Fallback Note');
        });
    });

    describe('getUserSessions', () => {
        it('should fetch from API and merge with local', async () => {
            upsertLocalBoard({ sessionId: 'local1', name: 'Local Only', createdBy: 'me', createdAt: 'now', url: '/b/local1' });

            vi.mocked(api.get).mockResolvedValue({
                data: {
                    canvases: [
                        { canvasId: 'api1', name: 'API Board' },
                        { canvasId: 'local1', name: 'Local Merged Server' } // Should overwrite local
                    ]
                }
            });

            const results = await getUserSessions();
            expect(results).toHaveLength(2);
            expect(results.find(r => r.sessionId === 'api1')).toBeDefined();
            expect(results.find(r => r.sessionId === 'local1')?.name).toBe('Local Merged Server');
        });

        it('should return local boards if API fails', async () => {
            upsertLocalBoard({ sessionId: 'local2', name: 'Local 2', createdBy: 'me', createdAt: 'now', url: '/b/local2' });
            vi.mocked(api.get).mockRejectedValue(new Error('offline'));

            const results = await getUserSessions();
            expect(results).toHaveLength(1);
            expect(results[0].sessionId).toBe('local2');
        });
    });

    describe('joinSession', () => {
        it('should post to join endpoint', async () => {
            vi.mocked(api.post).mockResolvedValue({});
            await joinSession('test-room');
            expect(api.post).toHaveBeenCalledWith('/canvas/test-room/join');
        });
    });

    describe('deleteSession', () => {
        it('should delete from backend and local storage', async () => {
            vi.mocked(api.delete).mockResolvedValue({});
            upsertLocalBoard({ sessionId: 'b1', name: 'Local', createdBy: '', createdAt: '', url: '' });
            mockStorage['novasketch_owned_boards'] = JSON.stringify(['b1']);

            await deleteSession('b1');
            expect(api.delete).toHaveBeenCalledWith('/api/canvas/b1');

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards).toHaveLength(0);

            const owned = JSON.parse(mockStorage['novasketch_owned_boards']);
            expect(owned).toHaveLength(0);
        });

        it('should delete locally even if backend fails', async () => {
            vi.mocked(api.delete).mockRejectedValue(new Error('offline'));
            upsertLocalBoard({ sessionId: 'b2', name: 'Local', createdBy: '', createdAt: '', url: '' });

            await deleteSession('b2');

            const boards = JSON.parse(mockStorage['novasketch_boards']);
            expect(boards).toHaveLength(0);
        });
    });
});
