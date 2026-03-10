/**
 * React hook for using the SyncService in components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import SyncService, { SyncState, StrokeLine, TextAnnotation } from './sync.service';
import type { Shape } from '../types/shapes';

interface UseSyncOptions {
    roomId: string;
    wsUrl?: string;
    initialLocked?: boolean;
}

interface UseSyncResult {
    // State
    lines: StrokeLine[];
    shapes: Shape[];
    textAnnotations: TextAnnotation[];
    canvasBackgroundColor: string;

    // Connection status
    isConnected: boolean;
    isSynced: boolean;
    isLoading: boolean;
    // True when local edits haven't been confirmed by the server yet
    hasPendingChanges: boolean;

    // Session 
    isLocked: boolean;
    setIsLocked: (locked: boolean) => void;
    setSessionLocked: (locked: boolean) => void;
    boardName: string;
    setBoardName: (name: string) => void;

    // Line operations
    addLine: (line: StrokeLine) => void;
    updateLine: (id: string, updates: Partial<StrokeLine>) => void;
    deleteLine: (id: string) => void;
    setLines: (lines: StrokeLine[]) => void;

    // Shape operations  
    addShape: (shape: Shape) => void;
    updateShape: (id: string, updates: Partial<Shape>) => void;
    deleteShape: (id: string) => void;
    setShapes: (shapes: Shape[]) => void;
    groupIntoFrame: (shapeIds: string[], lineIds?: string[], textIds?: string[], ownerId?: string) => void;
    ungroupFrame: (frameId: string) => void;

    // Text operations
    addText: (text: TextAnnotation) => void;
    updateText: (id: string, updates: Partial<TextAnnotation>) => void;
    deleteText: (id: string) => void;
    setTexts: (texts: TextAnnotation[]) => void;

    // Meta operations
    setCanvasBackgroundColor: (color: string) => void;

    // Batch operations
    batch: (callback: () => void) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Clear
    clearAll: () => void;

    // Awareness / presence (includes cursor position for remote users)
    users: { id: string; name: string; color: string; cursor?: { x: number; y: number } }[];
    updateUserMetadata: (metadata: { id: string; name: string; color: string }) => void;

    // Live cursor broadcasting
    updateCursorPosition: (x: number, y: number) => void;
}

export function useSync({ roomId, wsUrl, initialLocked = false }: UseSyncOptions): UseSyncResult {
    const [lines, setLinesState] = useState<StrokeLine[]>([]);
    const [shapes, setShapesState] = useState<Shape[]>([]);
    const [textAnnotations, setTextAnnotationsState] = useState<TextAnnotation[]>([]);
    const [canvasBackgroundColor, setCanvasBackgroundColorState] = useState('#0B0C10');

    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Listen to session locked state
    const [isLocked, setIsLocked] = useState(initialLocked);

    // Board name synced via Yjs yMeta
    const [boardName, setBoardNameState] = useState('');

    // If the prop changes from a parent fetch, update local state
    useEffect(() => {
        setIsLocked(initialLocked);
    }, [initialLocked]);

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Live list of connected collaborators (with cursor positions)
    const [users, setUsers] = useState<{ id: string; name: string; color: string; cursor?: { x: number; y: number } }[]>([]);

    // Track whether local edits are buffered and unconfirmed
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    const serviceRef = useRef<SyncService | null>(null);

    // Initialize service
    useEffect(() => {
        const service = new SyncService({
            roomId,
            wsUrl,
            onStateChange: (state: SyncState) => {
                setLinesState(state.lines);
                setShapesState(state.shapes as Shape[]);
                setTextAnnotationsState(state.textAnnotations);
                setCanvasBackgroundColorState(state.canvasBackgroundColor);

                // Update undo/redo state
                if (serviceRef.current) {
                    setCanUndo(serviceRef.current.canUndo());
                    setCanRedo(serviceRef.current.canRedo());
                }
            },
            onConnectionChange: (connected) => {
                setIsConnected(connected);
            },
            onSyncStatusChange: (synced) => {
                setIsSynced(synced);
                if (synced) setIsLoading(false);
            },
            // Update React state whenever awareness changes
            onAwarenessUpdate: (updatedUsers) => {
                setUsers(updatedUsers);
            },
            onSystemEvent: (event) => {
                if (event.event === 'session_locked') {
                    console.log('[useSync] Server declared session locked!');
                    setIsLocked(true);
                }
            },
            // Real-time lock sync via Yjs yMeta map
            onLockChange: (locked) => {
                console.log(`[useSync] Lock state changed via Yjs: ${locked}`);
                setIsLocked(locked);
            },
            // Real-time board name sync via Yjs yMeta
            onBoardNameChange: (name) => {
                setBoardNameState(name);
            },
            // Direct callback from UndoManager stack events to update React state, so
            // the undo/redo buttons accurate for ALL users including guests.
            onUndoRedoChange: (canUndoVal, canRedoVal) => {
                setCanUndo(canUndoVal);
                setCanRedo(canRedoVal);
            },
            // Track pending local changes for visual indicator
            onPendingChange: (hasPending) => {
                setHasPendingChanges(hasPending);
            },
        });

        serviceRef.current = service;

        service.init().catch((err) => {
            console.error('[useSync] Failed to initialize:', err);
            setIsLoading(false);
        });

        return () => {
            service.destroy();
            serviceRef.current = null;
        };
    }, [roomId, wsUrl]);

    // Update undo/redo state after operations
    // forced re-render hook because Yjs events happen outside React's lifecycle.
    // without this, buttons stay disabled until the next unrelated state change.
    const updateUndoRedoState = useCallback(() => {
        if (serviceRef.current) {
            setCanUndo(serviceRef.current.canUndo());
            setCanRedo(serviceRef.current.canRedo());
        }
    }, []);

    // Line operations
    const addLine = useCallback((line: StrokeLine) => {
        serviceRef.current?.addLine(line);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const updateLine = useCallback((id: string, updates: Partial<StrokeLine>) => {
        serviceRef.current?.updateLine(id, updates);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const deleteLine = useCallback((id: string) => {
        serviceRef.current?.deleteLine(id);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const setLines = useCallback((newLines: StrokeLine[]) => {
        serviceRef.current?.setLines(newLines);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Shape operations
    const addShape = useCallback((shape: Shape) => {
        serviceRef.current?.addShape(shape as any);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
        serviceRef.current?.updateShape(id, updates as any);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const deleteShape = useCallback((id: string) => {
        serviceRef.current?.deleteShape(id);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const setShapes = useCallback((newShapes: Shape[]) => {
        serviceRef.current?.setShapes(newShapes as any);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const groupIntoFrame = useCallback((shapeIds: string[], lineIds: string[] = [], textIds: string[] = [], ownerId: string = "unknown") => {
        serviceRef.current?.groupIntoFrame(shapeIds, lineIds, textIds, ownerId);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const ungroupFrame = useCallback((frameId: string) => {
        serviceRef.current?.ungroupFrame(frameId);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Text operations
    const addText = useCallback((text: TextAnnotation) => {
        serviceRef.current?.addText(text);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const updateText = useCallback((id: string, updates: Partial<TextAnnotation>) => {
        serviceRef.current?.updateText(id, updates);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const deleteText = useCallback((id: string) => {
        serviceRef.current?.deleteText(id);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const setTexts = useCallback((newTexts: TextAnnotation[]) => {
        serviceRef.current?.setTexts(newTexts);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Meta operations
    const setCanvasBackgroundColor = useCallback((color: string) => {
        serviceRef.current?.setCanvasBackgroundColor(color);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Batch operations
    const batch = useCallback((callback: () => void) => {
        serviceRef.current?.batch(callback);
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Undo/Redo
    const undo = useCallback(() => {
        serviceRef.current?.undo();
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    const redo = useCallback(() => {
        serviceRef.current?.redo();
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Clear all
    const clearAll = useCallback(() => {
        serviceRef.current?.clearAll();
        updateUndoRedoState();
    }, [updateUndoRedoState]);

    // Broadcast user identity via Yjs awareness
    const updateUserMetadata = useCallback((metadata: { id: string; name: string; color: string }) => {
        serviceRef.current?.updateUserMetadata(metadata);
    }, []);

    // Broadcast cursor position to all collaborators
    const updateCursorPosition = useCallback((x: number, y: number) => {
        serviceRef.current?.updateCursorPosition(x, y);
    }, []);

    // Write lock state to Yjs yMeta for real-time broadcast
    const setSessionLocked = useCallback((locked: boolean) => {
        serviceRef.current?.setSessionLocked(locked);
    }, []);

    const setBoardName = useCallback((name: string) => {
        serviceRef.current?.setBoardName(name);
    }, []);

    return {
        lines,
        shapes,
        textAnnotations,
        canvasBackgroundColor,
        isConnected,
        isSynced,
        isLoading,
        hasPendingChanges,
        addLine,
        updateLine,
        deleteLine,
        setLines,
        addShape,
        updateShape,
        deleteShape,
        setShapes,
        groupIntoFrame,
        ungroupFrame,
        addText,
        updateText,
        deleteText,
        setTexts,
        setCanvasBackgroundColor,
        batch,
        undo,
        redo,
        canUndo,
        canRedo,
        clearAll,
        users,
        updateUserMetadata,
        updateCursorPosition,
        isLocked,
        setIsLocked,
        setSessionLocked,
        boardName,
        setBoardName,
    };
}
