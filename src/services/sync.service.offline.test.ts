/**
 * Epic 7: Offline Editing & Sync — SyncService Unit Tests
 *
 * Story 7.2: Offline Editing Queue (IndexedDB persistence + local Yjs edits)
 * Story 7.3: Auto-Reconnect & Sync (pending flag cleared on reconnect)
 * Story 7.4: Server Disconnect Handling (onConnectionChange callbacks)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SyncService from './sync.service';

// Track IndexedDB constructor calls
let idbConstructorCalls: any[] = [];

vi.mock('y-indexeddb', () => {
    return {
        IndexeddbPersistence: class {
            constructor(name: string, doc: any) {
                idbConstructorCalls.push({ name, doc });
            }
            once(event: string, cb: Function) {
                if (event === 'synced') {
                    setTimeout(cb, 10);
                }
            }
            on() { }
            destroy() { }
        }
    };
});

// Track WebSocket provider instances for emit access
let lastWsProvider: any = null;

vi.mock('y-websocket', () => {
    return {
        WebsocketProvider: class {
            _listeners: Record<string, Function[]>;
            awareness: any;
            constructor(url: string, room: string, doc: any, opts: any) {
                this._listeners = {};
                this.awareness = {
                    on: vi.fn(),
                    off: vi.fn(),
                    getStates: vi.fn(() => new Map()),
                    getLocalState: vi.fn(() => ({})),
                    setLocalStateField: vi.fn(),
                };
                lastWsProvider = this;
            }
            on(event: string, cb: Function) {
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(cb);
            }
            destroy() { }
        }
    };
});

// Helper to emit events on the last created wsProvider
function emitWs(event: string, ...args: any[]) {
    if (lastWsProvider && lastWsProvider._listeners[event]) {
        lastWsProvider._listeners[event].forEach((cb: Function) => cb(...args));
    }
}

const createService = (overrides = {}) => {
    return new SyncService({
        roomId: 'test-room',
        onStateChange: vi.fn(),
        onConnectionChange: vi.fn(),
        onSyncStatusChange: vi.fn(),
        onPendingChange: vi.fn(),
        ...overrides
    });
};

describe('Epic 7: Offline Editing & Sync (SyncService)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        idbConstructorCalls = [];
        lastWsProvider = null;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('7.2 Offline Editing: Should initialize IndexedDB for offline queue persistence', async () => {
        const service = createService();
        const initPromise = service.init();

        // Fast-forward to resolve IndexedDB sync
        vi.runAllTimers();
        await initPromise;

        // Verify IndexedDB was initialized with the correct room name
        expect(idbConstructorCalls).toHaveLength(1);
        expect(idbConstructorCalls[0].name).toBe('novasketch-test-room');
    });

    it('7.2 Offline Editing: Pushes actions to local Yjs doc instead of failing when disconnected', async () => {
        const onPendingChange = vi.fn();
        const service = createService({ onPendingChange });
        const initPromise = service.init();

        vi.runAllTimers();
        await initPromise;

        // Simulate WebSocket disconnect
        emitWs('status', { status: 'disconnected' });
        expect((service as any).wsConnected).toBe(false);

        // Perform an offline edit — should NOT throw
        service.addLine({
            id: 'line1', points: [0, 0, 10, 10], color: 'black', strokeWidth: 2
        });

        // The Yjs document should have recorded the edit locally
        expect(service.getLines()).toHaveLength(1);

        // Should trigger pending changes flag (to show in UI)
        expect(onPendingChange).toHaveBeenCalledWith(true);
    });

    it('7.3 Auto-Reconnect & Sync: Clears pending flag when coming back online', async () => {
        const onPendingChange = vi.fn();
        const service = createService({ onPendingChange });
        const initPromise = service.init();

        vi.runAllTimers();
        await initPromise;

        // Start offline
        emitWs('status', { status: 'disconnected' });

        // Make offline edit
        service.addShape({
            id: 'shape1', type: 'rect',
            position: { x: 0, y: 0 },
            style: { stroke: 'red', strokeWidth: 2, fill: '', hasFill: false },
            transform: { rotation: 0, scaleX: 1, scaleY: 1 }
        });
        expect(onPendingChange).toHaveBeenCalledWith(true);

        // Timer shouldn't run while offline
        expect((service as any).pendingTimer).toBeNull();

        // Simulate coming back online
        emitWs('status', { status: 'connected' });

        // The sync service sets a 2-second timer to clear the pending flag
        expect((service as any).pendingTimer).not.toBeNull();

        vi.advanceTimersByTime(2000);

        // Flag should be cleared since it synced automatically
        expect(onPendingChange).toHaveBeenCalledWith(false);
    });

    it('7.4 Server Disconnect Handling: Fires onConnectionChange callbacks on disconnect/reconnect', async () => {
        const onConnectionChange = vi.fn();
        const service = createService({ onConnectionChange });
        const initPromise = service.init();

        vi.runAllTimers();
        await initPromise;

        // Disconnect
        emitWs('status', { status: 'disconnected' });
        expect(onConnectionChange).toHaveBeenCalledWith(false);

        // Reconnect
        emitWs('status', { status: 'connected' });
        expect(onConnectionChange).toHaveBeenCalledWith(true);
    });
});