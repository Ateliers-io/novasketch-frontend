import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSync } from './useSync';

vi.mock('./sync.service', () => ({
    default: class MockSyncService {
        config: any;
        constructor(config: any) { this.config = config; }
        async init() { return Promise.resolve(); }
        destroy() { }
        canUndo() { return false; }
        canRedo() { return false; }
    }
}));

describe('useSync Hook - Lock Feature', () => {
    it('should initialize with initialLocked state', () => {
        const { result } = renderHook(() => useSync({ roomId: 'test', initialLocked: true }));
        expect(result.current.isLocked).toBe(true);
    });

    it('should update isLocked when initialLocked prop changes', () => {
        const { result, rerender } = renderHook(
            ({ initialLocked }) => useSync({ roomId: 'test', initialLocked }),
            { initialProps: { initialLocked: false } }
        );
        expect(result.current.isLocked).toBe(false);

        rerender({ initialLocked: true });
        expect(result.current.isLocked).toBe(true);
    });

    it('should allow setIsLocked to manually toggle lock', () => {
        const { result } = renderHook(() => useSync({ roomId: 'test', initialLocked: false }));

        act(() => {
            result.current.setIsLocked(true);
        });

        expect(result.current.isLocked).toBe(true);
    });
});
