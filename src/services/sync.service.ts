/**
 * Sync Service for Whiteboard Collaboration
 * 
 * This service handles:
 * 1. Yjs document management for CRDT-based state
 * 2. WebSocket connection to sync with backend (MongoDB persistence)
 * 3. IndexedDB persistence for offline support
 * 4. Undo/Redo via Y.UndoManager
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { getShapeBoundingBox } from '../utils/boundingBox';
import { ShapeType } from '../types/shapes';
// Inline varint decoding helpers (replaces lib0/decoding import).
// lib0 is only a transitive dep of yjs and breaks production builds.
const decoding = {
    createDecoder(buf: Uint8Array) {
        return { buf, pos: 0 };
    },
    readVarUint(decoder: { buf: Uint8Array; pos: number }): number {
        let num = 0, shift = 0, byte: number;
        do {
            byte = decoder.buf[decoder.pos++];
            num |= (byte & 0x7f) << shift;
            shift += 7;
        } while (byte & 0x80);
        return num >>> 0;
    },
    readVarString(decoder: { buf: Uint8Array; pos: number }): string {
        const len = decoding.readVarUint(decoder);
        const bytes = decoder.buf.subarray(decoder.pos, decoder.pos + len);
        decoder.pos += len;
        return new TextDecoder().decode(bytes);
    },
};

// Types matching the Whiteboard component
export interface StrokeLine {
    id: string;
    points: number[];
    color: string;
    strokeWidth: number;
    brushType?: string;
    opacity?: number;
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
    tension?: number;
    dash?: number[];
    globalCompositeOperation?: string;
    shadowBlur?: number;
    shadowColor?: string;
    parentId?: string;
}

export interface Shape {
    id: string;
    type: string;
    position: { x: number; y: number };
    style: {
        stroke: string;
        strokeWidth: number;
        fill: string;
        hasFill: boolean;
    };
    transform: {
        rotation: number;
        scaleX: number;
        scaleY: number;
    };
    zIndex: number;
    // Rectangle specific
    width?: number;
    height?: number;
    cornerRadius?: number;
    // Circle specific
    radius?: number;
    // Ellipse specific
    radiusX?: number;
    radiusY?: number;
    // Hierarchical/Frame support (Epic 7.5)
    parentId?: string;
    childrenIds?: string[];
    backgroundVisible?: boolean;
    padding?: number;
    visible?: boolean;
    locked?: boolean;
    opacity?: number;
    ownerId?: string;
    assignedUserIds?: string[];
    name?: string;
}

export interface TextAnnotation {
    id: string;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
    textAlign?: 'left' | 'center' | 'right';
    rotation?: number;
    parentId?: string;
}

export interface SyncState {
    lines: StrokeLine[];
    shapes: Shape[];
    textAnnotations: TextAnnotation[];
    canvasBackgroundColor: string;
    isLocked: boolean;
}

export type SyncStateChangeHandler = (state: SyncState) => void;

export interface SyncServiceConfig {
    roomId: string;
    wsUrl?: string;
    onStateChange: SyncStateChangeHandler;
    onConnectionChange?: (connected: boolean) => void;
    onSyncStatusChange?: (synced: boolean) => void;
    // Task 1.3.3-B / 3.1.3: notifies React when collaborators or their cursor positions change
    onAwarenessUpdate?: (users: { id: string; name: string; color: string; cursor?: { x: number; y: number } }[]) => void;
    // Task 1.5.1: Notifies React for system events like session_locked
    onSystemEvent?: (event: any) => void;
    // Task 1.5 fix: Dedicated callback for lock state changes via Yjs yMeta
    onLockChange?: (locked: boolean) => void;
    // Notifies React whenever the undo/redo stack changes so buttons update
    onUndoRedoChange?: (canUndo: boolean, canRedo: boolean) => void;
    // Task 3.4.3-A: Notifies React when local edits are buffered and not yet confirmed by server
    onPendingChange?: (hasPending: boolean) => void;
}

class SyncService {
    private doc: Y.Doc;
    private wsProvider: WebsocketProvider | null = null;
    private idbPersistence: IndexeddbPersistence | null = null;
    private undoManager: Y.UndoManager | null = null;

    // Yjs shared types
    private yLines: Y.Array<StrokeLine>;
    private yShapes: Y.Array<Shape>;
    private yTexts: Y.Array<TextAnnotation>;
    private yMeta: Y.Map<any>;

    private config: SyncServiceConfig;
    private isInitialized = false;
    // Task 3.4.3-A: Track unsynced local mutations
    private wsConnected = false;
    private pendingTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(config: SyncServiceConfig) {
        this.config = config;
        this.doc = new Y.Doc();

        // Initialize shared types
        this.yLines = this.doc.getArray<StrokeLine>('lines');
        this.yShapes = this.doc.getArray<Shape>('shapes');
        this.yTexts = this.doc.getArray<TextAnnotation>('texts');
        this.yMeta = this.doc.getMap('meta');

        // Set up observers
        this.setupObservers();
    }

    private setupObservers(): void {
        const notifyChange = () => {
            this.config.onStateChange({
                lines: this.yLines.toArray(),
                shapes: this.yShapes.toArray(),
                textAnnotations: this.yTexts.toArray(),
                canvasBackgroundColor: this.yMeta.get('bgColor') || '#0B0C10',
                isLocked: this.yMeta.get('isLocked') === true,
            });
        };

        this.yLines.observe(notifyChange);
        this.yShapes.observe(notifyChange);
        this.yTexts.observe(notifyChange);

        // Observe yMeta for general changes AND dedicated lock change detection
        this.yMeta.observe((event) => {
            notifyChange();
            // Fire dedicated lock callback when isLocked key changes
            if (event.keysChanged.has('isLocked') && this.config.onLockChange) {
                this.config.onLockChange(this.yMeta.get('isLocked') === true);
            }
        });
    }

    /**
     * Initialize the sync service - call this once when component mounts
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;

        const { roomId, wsUrl = 'ws://localhost:3000' } = this.config;

        // 1. Set up IndexedDB persistence for offline support
        this.idbPersistence = new IndexeddbPersistence(`novasketch-${roomId}`, this.doc);

        // Wait for IndexedDB to sync
        await new Promise<void>((resolve) => {
            this.idbPersistence!.once('synced', () => {
                console.log('[SyncService] IndexedDB synced - offline data loaded');
                this.config.onSyncStatusChange?.(true);
                resolve();
            });
        });

        // Emit initial state from IndexedDB
        this.config.onStateChange({
            lines: this.yLines.toArray(),
            shapes: this.yShapes.toArray(),
            textAnnotations: this.yTexts.toArray(),
            canvasBackgroundColor: this.yMeta.get('bgColor') || '#0B0C10',
            isLocked: this.yMeta.get('isLocked') === true,
        });

        // 2. Set up UndoManager BEFORE WebSocket so it's ready to track local transactions
        // from the moment the first remote sync arrives and the user starts drawing.
        // Task 1.5 fix: Excludes yMeta so Lock/Unlock state and bgColor are NOT undoable.
        this.undoManager = new Y.UndoManager([this.yLines, this.yShapes, this.yTexts], {
            trackedOrigins: new Set(['local']),
        });

        // Notify React whenever the undo/redo stack changes so the buttons stay in sync.
        // This is necessary because UndoManager events fire outside React's render cycle.
        const notifyUndoRedo = () => {
            this.config.onUndoRedoChange?.(
                this.canUndo(),
                this.canRedo()
            );
        };
        this.undoManager.on('stack-item-added', notifyUndoRedo);
        this.undoManager.on('stack-item-popped', notifyUndoRedo);
        this.undoManager.on('stack-cleared', notifyUndoRedo);

        // 3. Set up WebSocket provider for real-time sync
        // disableBc: prevents cross-tab BroadcastChannel from conflicting with WS sync
        // resyncInterval: periodically re-sends SyncStep1 so late-joiners catch up reliably
        this.wsProvider = new WebsocketProvider(wsUrl, roomId, this.doc, {
            connect: true,
            disableBc: true,
            resyncInterval: 5000,
        });

        // CRITICAL FIX: Register no-op handlers for our custom message types (2-5)
        // so y-websocket doesn't misinterpret them as Auth (type 2) or
        // QueryAwareness (type 3), which causes awareness storms with 3+ users.
        const provider = this.wsProvider as any;
        provider.messageHandlers[2] = () => { }; // Ephemeral/drag — handled elsewhere
        provider.messageHandlers[3] = () => { }; // Property updates — handled elsewhere
        provider.messageHandlers[4] = () => { }; // Presence events — handled by custom WS listener
        provider.messageHandlers[5] = () => { }; // Redis cached state — handled by custom WS listener

        // Task 3.4.3-A: Track local doc mutations for pending-change detection.
        // When origin === 'local', show "Syncing..." briefly. If connected, Yjs sends
        // the data almost instantly, so we auto-clear after 1.5s. If disconnected,
        // the pending state persists until reconnection + sync.
        this.doc.on('update', (_update: Uint8Array, origin: any) => {
            if (origin === 'local') {
                this.config.onPendingChange?.(true);

                // Clear any existing timer
                if (this.pendingTimer) clearTimeout(this.pendingTimer);

                // If connected, data is sent instantly — auto-clear after short delay
                if (this.wsConnected) {
                    this.pendingTimer = setTimeout(() => {
                        this.config.onPendingChange?.(false);
                        this.pendingTimer = null;
                    }, 1500);
                }
                // If disconnected, stay pending (cleared on reconnect+sync)
            }
        });

        this.wsProvider.on('status', (event: { status: string }) => {
            const connected = event.status === 'connected';
            this.wsConnected = connected;
            console.log(`[SyncService] WebSocket ${connected ? 'connected' : 'disconnected'}`);
            this.config.onConnectionChange?.(connected);

            // Task 3.4.3-A: Going offline — cancel auto-clear timer so badge stays pending
            if (!connected && this.pendingTimer) {
                clearTimeout(this.pendingTimer);
                this.pendingTimer = null;
            }

            // Task 3.4.3-A: Reconnected — auto-clear pending after short delay
            // The sync event doesn't always re-fire on reconnect, so this is the safety net.
            if (connected) {
                if (this.pendingTimer) clearTimeout(this.pendingTimer);
                this.pendingTimer = setTimeout(() => {
                    this.config.onPendingChange?.(false);
                    this.pendingTimer = null;
                }, 2000);
            }

            // Setup listener for custom backend messages (type 4 - presence/events)
            if (connected && this.wsProvider && (this.wsProvider as any).ws) {
                const ws = (this.wsProvider as any).ws as WebSocket;
                // Avoid Duplicate Listeners (ws is created anew on reconnect)
                ws.addEventListener('message', async (messageEvent) => {
                    try {
                        const data = messageEvent.data;
                        let buffer: ArrayBuffer;
                        if (data instanceof Blob) {
                            buffer = await data.arrayBuffer();
                        } else {
                            buffer = data;
                        }

                        const decoder = decoding.createDecoder(new Uint8Array(buffer));
                        const messageType = decoding.readVarUint(decoder);
                        if (messageType === 4 && this.config.onSystemEvent) {
                            const jsonStr = decoding.readVarString(decoder);
                            this.config.onSystemEvent(JSON.parse(jsonStr));
                        }
                    } catch {
                        // ignore parsing errors for sync messages
                    }
                });
            }
        });

        // Task 1.3.3-B / Fix: Subscribe to awareness changes to track connected users.
        // Task 3.1.3: Extended to also extract cursor positions for remote cursors.
        // Deduplication by name prevents ghost duplicates when a user refreshes.
        this.wsProvider.awareness.on('change', () => {
            if (!this.config.onAwarenessUpdate) return;
            const awareness = this.wsProvider!.awareness;
            const localClientID = awareness.clientID;
            const seen = new Set<string>();
            const users: { id: string; name: string; color: string; cursor?: { x: number; y: number } }[] = [];

            awareness.getStates().forEach((state: any, clientID: number) => {
                const u = state.user;
                if (!u?.name || !u?.color) return;
                if (seen.has(u.name)) return;  // skip ghost duplicates
                seen.add(u.name);

                // Only include cursor data from OTHER users (not our own)
                const cursor = (clientID !== localClientID && state.cursor)
                    ? { x: state.cursor.x, y: state.cursor.y }
                    : undefined;

                users.push({ id: u.id, name: u.name, color: u.color, cursor });
            });

            this.config.onAwarenessUpdate(users);
        });

        this.wsProvider.on('sync', (isSynced: boolean) => {
            console.log(`[SyncService] WebSocket sync status: ${isSynced}`);
            if (isSynced) {
                // Re-emit state after server sync
                this.config.onStateChange({
                    lines: this.yLines.toArray(),
                    shapes: this.yShapes.toArray(),
                    textAnnotations: this.yTexts.toArray(),
                    canvasBackgroundColor: this.yMeta.get('bgColor') || '#0B0C10',
                    isLocked: this.yMeta.get('isLocked') === true,
                });

                // Task 3.4.3-A: Server confirmed sync — clear pending state immediately
                if (this.pendingTimer) {
                    clearTimeout(this.pendingTimer);
                    this.pendingTimer = null;
                }
                this.config.onPendingChange?.(false);
            }
        });

        this.isInitialized = true;
        console.log('[SyncService] Initialized for room:', roomId);
    }

    /**
     * Destroy the sync service - call this when component unmounts
     */
    destroy(): void {
        this.wsProvider?.disconnect();
        this.wsProvider?.destroy();
        this.idbPersistence?.destroy();
        this.doc.destroy();
        this.isInitialized = false;
        console.log('[SyncService] Destroyed');
    }

    // --- USER AWARENESS ---

    /**
     * Broadcasts the current user's metadata (name, color, id) to other clients
     * via the Yjs Awareness protocol.
     */
    updateUserMetadata(metadata: { id: string; name: string; color: string }): void {
        this.wsProvider?.awareness.setLocalStateField('user', metadata);
    }

    /**
     * Task 3.1.1: Broadcast cursor position to all collaborators
     * via the Yjs Awareness protocol. The backend already relays
     * awareness messages (server.js case 1), so no server changes needed.
     */
    updateCursorPosition(x: number, y: number): void {
        this.wsProvider?.awareness.setLocalStateField('cursor', { x, y });
    }

    // --- LINE OPERATIONS ---

    addLine(line: StrokeLine): void {
        this.doc.transact(() => {
            this.yLines.push([line]);
        }, 'local');
    }

    updateLine(id: string, updates: Partial<StrokeLine>): void {
        this.doc.transact(() => {
            const index = this.yLines.toArray().findIndex(l => l.id === id);
            if (index !== -1) {
                const existing = this.yLines.get(index);
                this.yLines.delete(index, 1);
                this.yLines.insert(index, [{ ...existing, ...updates }]);
            }
        }, 'local');
    }

    deleteLine(id: string): void {
        this.doc.transact(() => {
            const index = this.yLines.toArray().findIndex(l => l.id === id);
            if (index !== -1) {
                this.yLines.delete(index, 1);
            }
        }, 'local');
    }

    setLines(lines: StrokeLine[]): void {
        this.doc.transact(() => {
            this.yLines.delete(0, this.yLines.length);
            this.yLines.push(lines);
        }, 'local');
    }

    // --- SHAPE OPERATIONS ---

    addShape(shape: Shape): void {
        this.doc.transact(() => {
            this.yShapes.push([shape]);
        }, 'local');
    }

    updateShape(id: string, updates: Partial<Shape>): void {
        this.doc.transact(() => {
            const index = this.yShapes.toArray().findIndex(s => s.id === id);
            if (index !== -1) {
                const existing = this.yShapes.get(index);
                this.yShapes.delete(index, 1);
                this.yShapes.insert(index, [{ ...existing, ...updates }]);
            }
        }, 'local');
    }

    deleteShape(id: string): void {
        this.doc.transact(() => {
            const index = this.yShapes.toArray().findIndex(s => s.id === id);
            if (index !== -1) {
                this.yShapes.delete(index, 1);
            }
        }, 'local');
    }

    setShapes(shapes: Shape[]): void {
        this.doc.transact(() => {
            this.yShapes.delete(0, this.yShapes.length);
            this.yShapes.push(shapes);
        }, 'local');
    }

    // --- TEXT OPERATIONS ---

    addText(text: TextAnnotation): void {
        this.doc.transact(() => {
            this.yTexts.push([text]);
        }, 'local');
    }

    updateText(id: string, updates: Partial<TextAnnotation>): void {
        this.doc.transact(() => {
            const index = this.yTexts.toArray().findIndex(t => t.id === id);
            if (index !== -1) {
                const existing = this.yTexts.get(index);
                this.yTexts.delete(index, 1);
                this.yTexts.insert(index, [{ ...existing, ...updates }]);
            }
        }, 'local');
    }

    deleteText(id: string): void {
        this.doc.transact(() => {
            const index = this.yTexts.toArray().findIndex(t => t.id === id);
            if (index !== -1) {
                this.yTexts.delete(index, 1);
            }
        }, 'local');
    }

    setTexts(texts: TextAnnotation[]): void {
        this.doc.transact(() => {
            this.yTexts.delete(0, this.yTexts.length);
            this.yTexts.push(texts);
        }, 'local');
    }

    // --- META OPERATIONS ---
    setCanvasBackgroundColor(color: string): void {
        this.doc.transact(() => {
            this.yMeta.set('bgColor', color);
        }, 'local');
    }

    // --- BATCH OPERATIONS ---

    /**
     * Execute multiple operations in a single transaction.
     * essential for "atomic" undo steps (e.g. moving 5 shapes = 1 history entry, not 5).
     */
    batch(callback: () => void): void {
        this.doc.transact(callback, 'local');
    }

    // --- EPIC 7.5: FRAME/GROUP MANAGEMENT ---

    /**
     * Group a set of shape IDs into a new Frame.
     */
    groupIntoFrame(shapeIds: string[], lineIds: string[] = [], textIds: string[] = [], ownerId: string = "unknown"): void {
        console.log('[SyncService] groupIntoFrame called with IDs:', shapeIds, lineIds, textIds, 'owner:', ownerId);
        if (shapeIds.length === 0) {
            console.log('[SyncService] Group failed: No shapes provided');
            return;
        }

        this.doc.transact(() => {
            try {
                const shapes = this.yShapes.toArray();
                const lines = this.yLines.toArray();
                const texts = this.yTexts.toArray();

                const selectedShapes = shapes.filter(s => shapeIds.includes(s.id));
                const selectedLines = lines.filter(l => lineIds.includes(l.id));
                const selectedTexts = texts.filter(t => textIds.includes(t.id));

                if (selectedShapes.length === 0 && selectedLines.length === 0 && selectedTexts.length === 0) {
                    console.log('[SyncService] Group failed: No matching elements');
                    return;
                }

                // 1. Calculate bounding box
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                selectedShapes.forEach(s => {
                    const bb = getShapeBoundingBox(s as any);
                    minX = Math.min(minX, bb.minX);
                    minY = Math.min(minY, bb.minY);
                    maxX = Math.max(maxX, bb.maxX);
                    maxY = Math.max(maxY, bb.maxY);
                });
                selectedLines.forEach(l => {
                    for (let j = 0; j < l.points.length; j += 2) {
                        minX = Math.min(minX, l.points[j]);
                        minY = Math.min(minY, l.points[j + 1]);
                        maxX = Math.max(maxX, l.points[j]);
                        maxY = Math.max(maxY, l.points[j + 1]);
                    }
                });
                selectedTexts.forEach(t => {
                    const w = t.text.length * (t.fontSize * 0.6);
                    const h = t.fontSize * 1.2;
                    minX = Math.min(minX, t.x);
                    minY = Math.min(minY, t.y);
                    maxX = Math.max(maxX, t.x + w);
                    maxY = Math.max(maxY, t.y + h);
                });

                const padding = 20;
                const frameX = minX - padding;
                const frameY = minY - padding;
                const frameW = (maxX - minX) + padding * 2;
                const frameH = (maxY - minY) + padding * 2;

                // Determine if we should inherit a parentId (if all items are in the same frame)
                const allParentIds = new Set([...selectedShapes, ...selectedLines, ...selectedTexts].map(x => x.parentId));
                const commonParentId = allParentIds.size === 1 ? Array.from(allParentIds)[0] : undefined;

                // 2. Create the Frame
                const frameId = `frame-${Date.now()}`;
                const frame: Shape = {
                    id: frameId,
                    parentId: commonParentId,
                    type: ShapeType.FRAME,
                    position: { x: frameX, y: frameY },
                    width: frameW,
                    height: frameH,
                    childrenIds: shapeIds,
                    backgroundVisible: true,
                    padding: padding,
                    style: {
                        stroke: '#3B82F6',
                        strokeWidth: 1,
                        fill: 'rgba(102, 252, 241, 0.05)',
                        hasFill: true,
                    },
                    transform: { rotation: 0, scaleX: 1, scaleY: 1 },
                    zIndex: Math.max(...shapes.map(s => s.zIndex), 0) + 1,
                    visible: true,
                    locked: false,
                    opacity: 1,
                    ownerId,
                    assignedUserIds: [],
                    name: "Frame",
                };

                // 3. Update children to be relative
                selectedShapes.forEach(s => {
                    const idx = shapes.findIndex(sh => sh.id === s.id);
                    if (idx !== -1) {
                        const updatedShape: any = {
                            ...s,
                            parentId: frameId,
                            position: {
                                x: s.position.x - frameX,
                                y: s.position.y - frameY
                            }
                        };
                        if (updatedShape.startPoint) {
                            updatedShape.startPoint = { x: updatedShape.startPoint.x - frameX, y: updatedShape.startPoint.y - frameY };
                            updatedShape.endPoint = { x: updatedShape.endPoint.x - frameX, y: updatedShape.endPoint.y - frameY };
                        }
                        if (updatedShape.points) {
                            updatedShape.points = updatedShape.points.map((p: any) => ({ x: p.x - frameX, y: p.y - frameY }));
                        }

                        this.yShapes.delete(idx);
                        this.yShapes.insert(idx, [updatedShape]);
                    }
                });

                selectedLines.forEach(l => {
                    const idx = lines.findIndex(ln => ln.id === l.id);
                    if (idx !== -1) {
                        const newPoints = l.points.map((val, i) => i % 2 === 0 ? val - frameX : val - frameY);
                        const updatedLine = { ...l, parentId: frameId, points: newPoints };
                        this.yLines.delete(idx);
                        this.yLines.insert(idx, [updatedLine]);
                    }
                });

                selectedTexts.forEach(t => {
                    const idx = texts.findIndex(tx => tx.id === t.id);
                    if (idx !== -1) {
                        const updatedText = { ...t, parentId: frameId, x: t.x - frameX, y: t.y - frameY };
                        this.yTexts.delete(idx);
                        this.yTexts.insert(idx, [updatedText]);
                    }
                });

                // 4. Add the Frame to the shared collection
                this.yShapes.push([frame]);
                console.log('[SyncService] groupIntoFrame COMPLETE! Frame ID:', frameId);
            } catch (err: any) {
                console.error('[SyncService] Error during groupIntoFrame:', err);
            }
        }, 'local');
    }

    /**
     * Disband a frame and return its children to the root level.
     */
    ungroupFrame(frameId: string): void {
        this.doc.transact(() => {
            const shapesArr = this.yShapes.toArray();
            const frameIdx = shapesArr.findIndex(s => s.id === frameId);
            if (frameIdx === -1) return;

            const frame = shapesArr[frameIdx];
            if (frame.type !== 'frame') return;

            const frameX = frame.position.x;
            const frameY = frame.position.y;

            // 1. Revert shapes
            // We use a separate array of updates to avoid index shifting issues during loop
            const shapeUpdates: { index: number; shape: Shape }[] = [];
            this.yShapes.toArray().forEach((s, idx) => {
                if (s.parentId === frameId) {
                    const revertShape: any = {
                        ...s,
                        parentId: undefined,
                        position: { x: s.position.x + frameX, y: s.position.y + frameY }
                    };
                    if (revertShape.startPoint) {
                        revertShape.startPoint = { x: revertShape.startPoint.x + frameX, y: revertShape.startPoint.y + frameY };
                        revertShape.endPoint = { x: revertShape.endPoint.x + frameX, y: revertShape.endPoint.y + frameY };
                    }
                    if (revertShape.points) {
                        revertShape.points = revertShape.points.map((p: any) => ({ x: p.x + frameX, y: p.y + frameY }));
                    }
                    shapeUpdates.push({
                        index: idx,
                        shape: revertShape as Shape
                    });
                }
            });
            // Apply updates in reverse to maintain indices
            shapeUpdates.sort((a, b) => b.index - a.index).forEach(upd => {
                this.yShapes.delete(upd.index);
                this.yShapes.insert(upd.index, [upd.shape]);
            });

            // 2. Revert lines
            const lineUpdates: { index: number; line: StrokeLine }[] = [];
            this.yLines.toArray().forEach((l, idx) => {
                if (l.parentId === frameId) {
                    const newPoints = l.points.map((val, i) => i % 2 === 0 ? val + frameX : val + frameY);
                    lineUpdates.push({
                        index: idx,
                        line: { ...l, parentId: undefined, points: newPoints }
                    });
                }
            });
            lineUpdates.sort((a, b) => b.index - a.index).forEach(upd => {
                this.yLines.delete(upd.index);
                this.yLines.insert(upd.index, [upd.line]);
            });

            // 3. Revert texts
            const textUpdates: { index: number; text: TextAnnotation }[] = [];
            this.yTexts.toArray().forEach((t, idx) => {
                if (t.parentId === frameId) {
                    textUpdates.push({
                        index: idx,
                        text: {
                            ...t,
                            parentId: undefined,
                            x: t.x + frameX,
                            y: t.y + frameY
                        }
                    });
                }
            });
            textUpdates.sort((a, b) => b.index - a.index).forEach(upd => {
                this.yTexts.delete(upd.index);
                this.yTexts.insert(upd.index, [upd.text]);
            });

            // 4. Delete the frame itself
            const finalFrameIdx = this.yShapes.toArray().findIndex(s => s.id === frameId);
            if (finalFrameIdx !== -1) {
                this.yShapes.delete(finalFrameIdx);
            }
        });
    }


    // --- UNDO/REDO ---

    undo(): void {
        this.undoManager?.undo();
    }

    redo(): void {
        this.undoManager?.redo();
    }

    canUndo(): boolean {
        return (this.undoManager?.undoStack.length ?? 0) > 0;
    }

    canRedo(): boolean {
        return (this.undoManager?.redoStack.length ?? 0) > 0;
    }

    // --- CLEAR ---

    clearAll(): void {
        this.doc.transact(() => {
            this.yLines.delete(0, this.yLines.length);
            this.yShapes.delete(0, this.yShapes.length);
            this.yTexts.delete(0, this.yTexts.length);
            this.yMeta.set('bgColor', '#0B0C10');
        }, 'local');
    }

    // --- GETTERS ---

    getLines(): StrokeLine[] {
        return this.yLines.toArray();
    }

    getShapes(): Shape[] {
        return this.yShapes.toArray();
    }

    getTexts(): TextAnnotation[] {
        return this.yTexts.toArray();
    }

    getCanvasBackgroundColor(): string {
        return this.yMeta.get('bgColor') || '#0B0C10';
    }

    isConnected(): boolean {
        return this.wsProvider?.wsconnected ?? false;
    }

    // --- SESSION LOCK (via Yjs yMeta for real-time broadcast) ---

    /**
     * Write the session lock state to the Yjs shared meta map.
     * This propagates instantly to all connected clients via the existing
     * WebSocket, so guests see the lock/unlock change in real-time.
     * Uses 'local' origin so this action is undoable (owner's action).
     */
    setSessionLocked(locked: boolean): void {
        this.doc.transact(() => {
            this.yMeta.set('isLocked', locked);
        }, 'system');
    }

    getSessionLocked(): boolean {
        return this.yMeta.get('isLocked') === true;
    }
}

export default SyncService;
