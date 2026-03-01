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
        updateCursorPosition(_x: number, _y: number) { }
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

// ─────────────────────────────────────────────────────────────
// Task 3.1.1: Cursor Broadcasting Tests
// ─────────────────────────────────────────────────────────────
describe('useSync Hook - Cursor Broadcasting (Task 3.1.1)', () => {
    it('should expose updateCursorPosition function', () => {
        const { result } = renderHook(() => useSync({ roomId: 'cursor-test' }));
        expect(typeof result.current.updateCursorPosition).toBe('function');
    });

    it('should not throw when calling updateCursorPosition', () => {
        const { result } = renderHook(() => useSync({ roomId: 'cursor-test' }));
        expect(() => {
            act(() => {
                result.current.updateCursorPosition(100, 200);
            });
        }).not.toThrow();
    });

    it('should not throw when calling updateCursorPosition with negative coordinates', () => {
        const { result } = renderHook(() => useSync({ roomId: 'cursor-test' }));
        expect(() => {
            act(() => {
                result.current.updateCursorPosition(-50, -100);
            });
        }).not.toThrow();
    });

    it('should not throw when calling updateCursorPosition with zero', () => {
        const { result } = renderHook(() => useSync({ roomId: 'cursor-test' }));
        expect(() => {
            act(() => {
                result.current.updateCursorPosition(0, 0);
            });
        }).not.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────
// Task 3.1.3: Users State with Cursor Data
// ─────────────────────────────────────────────────────────────
describe('useSync Hook - Users State with Cursor (Task 3.1.3)', () => {
    it('should initialize users as an empty array', () => {
        const { result } = renderHook(() => useSync({ roomId: 'users-test' }));
        expect(result.current.users).toEqual([]);
    });

    it('should expose users property that can hold cursor data', () => {
        const { result } = renderHook(() => useSync({ roomId: 'users-test' }));
        // The type allows cursor as optional, so the initial empty array is valid
        expect(Array.isArray(result.current.users)).toBe(true);
    });
});
