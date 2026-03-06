/**
 * Offline Detection & Sync — Unit Tests
 *
 * This file contains tests for the useSync hook's offline behavior.
 * Following industry practices, we test the hook logic in isolation.
 *
 * Story 7.1: Offline Detection
 *   - Tests that the useSync hook exposes `isConnected` which toggles
 *     when the WebSocket provider fires status events.
 *
 * Story 7.2-7.4: Integration logic is tested in sync.service.offline.test.ts
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock SyncService before importing useSync
const mockDestroy = vi.fn();
const mockUpdateCursorPosition = vi.fn();
const mockUpdateUserMetadata = vi.fn();
const mockAddLine = vi.fn();
const mockCanUndo = vi.fn(() => false);
const mockCanRedo = vi.fn(() => false);
const mockClearAll = vi.fn();
const mockSetSessionLocked = vi.fn();

let capturedCallbacks: any = {};

vi.mock('./sync.service', () => {
    return {
        default: class MockSyncService {
            config: any;
            constructor(config: any) {
                this.config = config;
                capturedCallbacks = config;
            }
            async init() {
                // Simulate the callbacks SyncService would fire
                this.config.onSyncStatusChange?.(true);
                this.config.onConnectionChange?.(true);
                return Promise.resolve();
            }
            destroy = mockDestroy;
            addLine = mockAddLine;
            updateLine = vi.fn();
            deleteLine = vi.fn();
            setLines = vi.fn();
            addShape = vi.fn();
            updateShape = vi.fn();
            deleteShape = vi.fn();
            setShapes = vi.fn();
            addText = vi.fn();
            updateText = vi.fn();
            deleteText = vi.fn();
            setTexts = vi.fn();
            setCanvasBackgroundColor = vi.fn();
            batch = vi.fn((cb: Function) => cb());
            undo = vi.fn();
            redo = vi.fn();
            canUndo = mockCanUndo;
            canRedo = mockCanRedo;
            clearAll = mockClearAll;
            getLines = vi.fn(() => []);
            getShapes = vi.fn(() => []);
            updateCursorPosition = mockUpdateCursorPosition;
            updateUserMetadata = mockUpdateUserMetadata;
            setSessionLocked = mockSetSessionLocked;
        }
    };
});

import { useSync } from './useSync';

describe('useSync Hook - Offline Detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedCallbacks = {};
    });

    it('should report isConnected=true when WebSocket is connected', async () => {
        const { result } = renderHook(() => useSync({ roomId: 'offline-test' }));

        // After init, the mock fires onConnectionChange(true)
        await act(async () => {
            // Wait for init promise
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.isConnected).toBe(true);
    });

    it('should report isConnected=false when WebSocket disconnects', async () => {
        const { result } = renderHook(() => useSync({ roomId: 'offline-test' }));

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Initially connected
        expect(result.current.isConnected).toBe(true);

        // Simulate disconnect via the captured callback
        act(() => {
            capturedCallbacks.onConnectionChange?.(false);
        });

        expect(result.current.isConnected).toBe(false);
    });

    it('should report isConnected=true again after reconnection', async () => {
        const { result } = renderHook(() => useSync({ roomId: 'offline-test' }));

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Disconnect
        act(() => {
            capturedCallbacks.onConnectionChange?.(false);
        });
        expect(result.current.isConnected).toBe(false);

        // Reconnect
        act(() => {
            capturedCallbacks.onConnectionChange?.(true);
        });
        expect(result.current.isConnected).toBe(true);
    });

    it('should track hasPendingChanges when offline edits are made', async () => {
        const { result } = renderHook(() => useSync({ roomId: 'offline-test' }));

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Initially no pending changes
        expect(result.current.hasPendingChanges).toBe(false);

        // Simulate pending change (offline edit)
        act(() => {
            capturedCallbacks.onPendingChange?.(true);
        });
        expect(result.current.hasPendingChanges).toBe(true);

        // Simulate sync complete (back online)
        act(() => {
            capturedCallbacks.onPendingChange?.(false);
        });
        expect(result.current.hasPendingChanges).toBe(false);
    });

    it('should report isSynced after initial IndexedDB sync', async () => {
        const { result } = renderHook(() => useSync({ roomId: 'offline-test' }));

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // The mock fires onSyncStatusChange(true) during init
        expect(result.current.isSynced).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });
});