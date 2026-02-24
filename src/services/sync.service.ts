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
    // Rectangle specific
    width?: number;
    height?: number;
    cornerRadius?: number;
    // Circle specific
    radius?: number;
    // Ellipse specific
    radiusX?: number;
    radiusY?: number;
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
}

export interface SyncState {
    lines: StrokeLine[];
    shapes: Shape[];
    textAnnotations: TextAnnotation[];
    canvasBackgroundColor: string;
}

export type SyncStateChangeHandler = (state: SyncState) => void;

export interface SyncServiceConfig {
    roomId: string;
    wsUrl?: string;
    onStateChange: SyncStateChangeHandler;
    onConnectionChange?: (connected: boolean) => void;
    onSyncStatusChange?: (synced: boolean) => void;
    onAwarenessUpdate?: (users: any[]) => void;
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
            });
        };

        this.yLines.observe(notifyChange);
        this.yShapes.observe(notifyChange);
        this.yTexts.observe(notifyChange);
        this.yMeta.observe(notifyChange);
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
        });

        // 2. Set up WebSocket provider for real-time sync
        this.wsProvider = new WebsocketProvider(wsUrl, roomId, this.doc, {
            connect: true,
        });

        // Task 1.3.3: Listen to awareness updates to track connected users
        this.wsProvider.awareness.on('change', () => {
            const states = Array.from(this.wsProvider!.awareness.getStates().values());
            const users = states.map(state => state.user).filter(Boolean);
            this.config.onAwarenessUpdate?.(users);
        });

        this.wsProvider.on('status', (event: { status: string }) => {
            const connected = event.status === 'connected';
            console.log(`[SyncService] WebSocket ${connected ? 'connected' : 'disconnected'}`);
            this.config.onConnectionChange?.(connected);
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
                });
            }
        });

        // 3. Set up UndoManager for undo/redo
        // Utilizing Yjs built-in history management to handle CRDT conflicts automatically.
        // trackedOrigins: 'local' ensures I only undo MY actions, not my teammate's.
        this.undoManager = new Y.UndoManager([this.yLines, this.yShapes, this.yTexts, this.yMeta], {
            trackedOrigins: new Set(['local']),
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

    // --- USER AWARENESS OPERATIONS ---
    updateUserMetadata(metadata: { name: string; color: string }): void {
        this.wsProvider?.awareness.setLocalStateField('user', metadata);
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
}

export default SyncService;
