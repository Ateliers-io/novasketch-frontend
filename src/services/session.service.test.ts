import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { createSession, getSession, toggleSessionLock } from './session.service';

vi.mock('./api');

describe('Session Service - Lock Feature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully toggle session lock state', async () => {
        const mockResponse = { data: { is_locked: true } };
        vi.mocked(api.patch).mockResolvedValue(mockResponse);

        const result = await toggleSessionLock('test-room', true);

        expect(api.patch).toHaveBeenCalledWith('/session/test-room/lock', { is_locked: true });
        expect(result).toBe(true);
    });

    it('should handle errors when toggling session lock state', async () => {
        const mockError = new Error('Network Error');
        vi.mocked(api.patch).mockRejectedValue(mockError);

        await expect(toggleSessionLock('test-room', true)).rejects.toThrow('Network Error');
    });
});
