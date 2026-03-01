import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Task 3.1 Tests: Sync Service — Cursor Broadcasting & Awareness Extraction
 *
 * Uses lightweight mocking to test cursor functionality without relying on
 * actual Yjs/WebSocket internals.
 */

// Create shared mock instances so we can inspect calls
const mockSetLocalStateField = vi.fn();
const mockAwarenessOn = vi.fn();
const mockAwarenessGetStates = vi.fn(() => new Map());

const mockAwareness = {
    clientID: 1,
    setLocalStateField: mockSetLocalStateField,
    getStates: mockAwarenessGetStates,
    on: mockAwarenessOn,
};

vi.mock('yjs', () => {
    const makeArray = () => ({
        observe: vi.fn(),
        toArray: vi.fn(() => []),
        push: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        length: 0,
    });
    const makeMap = () => ({
        observe: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
    });
    return {
        Doc: class MockDoc {
            getArray = vi.fn(() => makeArray());
            getMap = vi.fn(() => makeMap());
            transact = vi.fn((fn: Function) => fn());
            destroy = vi.fn();
        },
        UndoManager: class MockUndoManager {
            on = vi.fn();
            undo = vi.fn();
            redo = vi.fn();
            canUndo = () => false;
            canRedo = () => false;
            destroy = vi.fn();
        },
    };
});

vi.mock('y-websocket', () => ({
    WebsocketProvider: class MockProvider {
        awareness = mockAwareness;
        on = vi.fn();
        disconnect = vi.fn();
        destroy = vi.fn();
    },
}));

vi.mock('y-indexeddb', () => ({
    IndexeddbPersistence: class MockIDB {
        once = vi.fn((_: string, cb: Function) => cb());
        destroy = vi.fn();
    },
}));

import SyncService from './sync.service';

beforeEach(() => {
    vi.clearAllMocks();
    mockAwarenessGetStates.mockReturnValue(new Map());
});

// ─────────────────────────────────────────────────────────────
// Task 3.1.1: updateCursorPosition
// ─────────────────────────────────────────────────────────────
describe('SyncService — Cursor Broadcasting (Task 3.1.1)', () => {
    it('should have the updateCursorPosition method', () => {
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
        });
        expect(typeof service.updateCursorPosition).toBe('function');
    });

    it('should not throw when called before init (no wsProvider)', () => {
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
        });
        expect(() => service.updateCursorPosition(50, 50)).not.toThrow();
    });

    it('should call awareness.setLocalStateField("cursor", {x, y}) after init', async () => {
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
        });
        await service.init();

        service.updateCursorPosition(100, 200);

        expect(mockSetLocalStateField).toHaveBeenCalledWith('cursor', { x: 100, y: 200 });
    });

    it('should send different coordinates on successive calls', async () => {
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
        });
        await service.init();

        service.updateCursorPosition(10, 20);
        service.updateCursorPosition(30, 40);
        service.updateCursorPosition(50, 60);

        const cursorCalls = mockSetLocalStateField.mock.calls.filter(
            (c: any[]) => c[0] === 'cursor'
        );
        expect(cursorCalls).toEqual([
            ['cursor', { x: 10, y: 20 }],
            ['cursor', { x: 30, y: 40 }],
            ['cursor', { x: 50, y: 60 }],
        ]);
    });

    it('should handle zero coordinates', async () => {
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
        });
        await service.init();

        service.updateCursorPosition(0, 0);

        expect(mockSetLocalStateField).toHaveBeenCalledWith('cursor', { x: 0, y: 0 });
    });

    it('should handle negative coordinates (panned canvas)', async () => {
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
        });
        await service.init();

        service.updateCursorPosition(-150, -300);

        expect(mockSetLocalStateField).toHaveBeenCalledWith('cursor', { x: -150, y: -300 });
    });
});

// ─────────────────────────────────────────────────────────────
// Task 3.1.3: Awareness cursor extraction
// ─────────────────────────────────────────────────────────────
describe('SyncService — Awareness Cursor Extraction (Task 3.1.3)', () => {
    it('should include cursor data for remote users in onAwarenessUpdate', async () => {
        const onAwarenessUpdate = vi.fn();
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
            onAwarenessUpdate,
        });
        await service.init();

        // Find the awareness 'change' handler
        const changeCall = mockAwarenessOn.mock.calls.find((c: any[]) => c[0] === 'change');
        expect(changeCall).toBeDefined();
        const changeHandler = changeCall![1];

        // Simulate state: local user (clientID=1) + remote user (clientID=2)
        const states = new Map<number, any>();
        states.set(1, { user: { name: 'Me', color: '#3B82F6' }, cursor: { x: 10, y: 10 } });
        states.set(2, { user: { name: 'Remote', color: '#EC4899' }, cursor: { x: 200, y: 300 } });
        mockAwarenessGetStates.mockReturnValue(states);

        changeHandler();

        const users = onAwarenessUpdate.mock.calls[onAwarenessUpdate.mock.calls.length - 1][0];

        // Local user (clientID=1) should NOT have cursor
        const me = users.find((u: any) => u.name === 'Me');
        expect(me).toBeDefined();
        expect(me.cursor).toBeUndefined();

        // Remote user (clientID=2) should have cursor
        const remote = users.find((u: any) => u.name === 'Remote');
        expect(remote).toBeDefined();
        expect(remote.cursor).toEqual({ x: 200, y: 300 });
    });

    it('should omit cursor for users without cursor in awareness state', async () => {
        const onAwarenessUpdate = vi.fn();
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
            onAwarenessUpdate,
        });
        await service.init();

        const changeCall = mockAwarenessOn.mock.calls.find((c: any[]) => c[0] === 'change');
        const changeHandler = changeCall![1];

        const states = new Map<number, any>();
        states.set(5, { user: { name: 'NoCursor', color: '#10B981' } }); // no cursor field
        mockAwarenessGetStates.mockReturnValue(states);

        changeHandler();

        const users = onAwarenessUpdate.mock.calls[onAwarenessUpdate.mock.calls.length - 1][0];
        const user = users.find((u: any) => u.name === 'NoCursor');
        expect(user).toBeDefined();
        expect(user.cursor).toBeUndefined();
    });

    it('should deduplicate users by name (ghost prevention)', async () => {
        const onAwarenessUpdate = vi.fn();
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
            onAwarenessUpdate,
        });
        await service.init();

        const changeCall = mockAwarenessOn.mock.calls.find((c: any[]) => c[0] === 'change');
        const changeHandler = changeCall![1];

        // Same name, two entries (ghost from tab refresh)
        const states = new Map<number, any>();
        states.set(10, { user: { name: 'Karthik', color: '#3B82F6' }, cursor: { x: 10, y: 10 } });
        states.set(11, { user: { name: 'Karthik', color: '#3B82F6' }, cursor: { x: 20, y: 20 } });
        mockAwarenessGetStates.mockReturnValue(states);

        changeHandler();

        const users = onAwarenessUpdate.mock.calls[onAwarenessUpdate.mock.calls.length - 1][0];
        const matches = users.filter((u: any) => u.name === 'Karthik');
        expect(matches.length).toBe(1);
    });

    it('should skip users without name or color', async () => {
        const onAwarenessUpdate = vi.fn();
        const service = new SyncService({
            roomId: 'test',
            onStateChange: vi.fn(),
            onAwarenessUpdate,
        });
        await service.init();

        const changeCall = mockAwarenessOn.mock.calls.find((c: any[]) => c[0] === 'change');
        const changeHandler = changeCall![1];

        const states = new Map<number, any>();
        states.set(3, { user: { name: '', color: '#FFF' } }); // empty name
        states.set(4, { user: { name: 'Valid', color: '#EF4444' }, cursor: { x: 1, y: 1 } });
        states.set(5, {}); // no user at all
        mockAwarenessGetStates.mockReturnValue(states);

        changeHandler();

        const users = onAwarenessUpdate.mock.calls[onAwarenessUpdate.mock.calls.length - 1][0];
        expect(users.length).toBe(1);
        expect(users[0].name).toBe('Valid');
    });
});
