import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from './api';
import {
    createSession,
    getUserSessions,
    deleteSession
} from './session.service';

vi.mock('./api');

/**
 * Integration Test for Session Service
 * 
 * This test suite validates the expected behavior when interacting with raw browser APIs
 * (like localStorage). The backend API is mocked to always fail to trigger offline fallbacks.
 */
describe('Session Service - Offline Integration', () => {
    beforeEach(() => {
        // Clear actual jsdom localStorage
        localStorage.clear();
        vi.clearAllMocks();

        // Mock API failure so we immediately hit offline modes without waiting for 5s timeout
        vi.mocked(api.post).mockRejectedValue(new Error('Network offline'));
        vi.mocked(api.get).mockRejectedValue(new Error('Network offline'));
        vi.mocked(api.delete).mockRejectedValue(new Error('Network offline'));
        vi.mocked(api.patch).mockRejectedValue(new Error('Network offline'));
    });
    it('should fallback to client UUID and real localStorage when API is down', async () => {
        // Attempt to create a session. Since the backend is likely down or returns an error,
        // it should hit the catch block and use the client UUID / local storage fallback.
        const result = await createSession('Integration Test Board', true);

        expect(result).toBeDefined();
        expect(result.sessionId).toBeDefined();
        // Since it's a UUID, verify it looks like a valid string
        expect(typeof result.sessionId).toBe('string');
        expect(result.sessionId.length).toBeGreaterThan(10);

        // Verify the board was actually saved to jsdom's real localStorage
        const rawBoards = localStorage.getItem('novasketch_boards');
        expect(rawBoards).not.toBeNull();

        const boards = JSON.parse(rawBoards!);
        expect(boards.length).toBe(1);
        expect(boards[0].sessionId).toBe(result.sessionId);
        expect(boards[0].name).toBe('Integration Test Board');
        expect(boards[0].isCollab).toBe(true);
    });

    it('should fetch merged sessions from local storage when API fails', async () => {
        // Seed the real local storage
        const mockBoard = {
            sessionId: 'local-integration-123',
            name: 'Local Seed Board',
            createdBy: 'You',
            createdAt: new Date().toISOString(),
            url: `/board/local-integration-123`
        };
        localStorage.setItem('novasketch_boards', JSON.stringify([mockBoard]));

        // Fetch sessions. Without a backend, this should return the seed.
        const sessions = await getUserSessions();

        expect(sessions.length).toBeGreaterThanOrEqual(1);
        const found = sessions.find(s => s.sessionId === 'local-integration-123');
        expect(found).toBeDefined();
        expect(found?.name).toBe('Local Seed Board');
    });

    it('should delete from local storage when backend is unreachable', async () => {
        // Seed local storage with a board
        const mockBoard = {
            sessionId: 'delete-me-123',
            name: 'To Be Deleted',
            createdBy: 'You',
            createdAt: new Date().toISOString(),
            url: `/board/delete-me-123`
        };
        localStorage.setItem('novasketch_boards', JSON.stringify([mockBoard]));
        localStorage.setItem('novasketch_owned_boards', JSON.stringify(['delete-me-123']));

        // Attempt delete
        await deleteSession('delete-me-123');

        // Verify it was wiped from actual localStorage
        const rawBoards = localStorage.getItem('novasketch_boards');
        const boards = JSON.parse(rawBoards || '[]');
        expect(boards.find((b: any) => b.sessionId === 'delete-me-123')).toBeUndefined();

        const rawOwned = localStorage.getItem('novasketch_owned_boards');
        const owned = JSON.parse(rawOwned || '[]');
        expect(owned.includes('delete-me-123')).toBe(false);
    });
});
