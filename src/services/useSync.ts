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

    // Session 
    isLocked: boolean;
    setIsLocked: (locked: boolean) => void;

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

    // Awareness / presence
    users: { name: string; color: string }[];
    updateUserMetadata: (metadata: { name: string; color: string }) => void;
}

export function useSync({ roomId, wsUrl, initialLocked = false }: UseSyncOptions): UseSyncResult {
    const [lines, setLinesState] = useState<StrokeLine[]>([]);
    const [shapes, setShapesState] = useState<Shape[]>([]);
    const [textAnnotations, setTextAnnotationsState] = useState<TextAnnotation[]>([]);
    const [canvasBackgroundColor, setCanvasBackgroundColorState] = useState('#0B0C10');

    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Task 1.5.1: Listen to session locked state
    const [isLocked, setIsLocked] = useState(initialLocked);

    // If the prop changes from a parent fetch, update local state
    useEffect(() => {
        setIsLocked(initialLocked);
    }, [initialLocked]);

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Task 1.3.3-B: Live list of connected collaborators
    const [users, setUsers] = useState<{ name: string; color: string }[]>([]);

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
            // Task 1.3.3-B: update React state whenever awareness changes
            onAwarenessUpdate: (updatedUsers) => {
                setUsers(updatedUsers);
            },
            onSystemEvent: (event) => {
                if (event.event === 'session_locked') {
                    console.log('[useSync] Server declared session locked!');
                    setIsLocked(true);
                    // You could also emit a toast here. I will just rely on the UI updating.
                }
            }
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

    // Task 1.3.3-B: Broadcast user identity via Yjs awareness
    const updateUserMetadata = useCallback((metadata: { name: string; color: string }) => {
        serviceRef.current?.updateUserMetadata(metadata);
    }, []);

    return {
        lines,
        shapes,
        textAnnotations,
        canvasBackgroundColor,
        isConnected,
        isSynced,
        isLoading,
        addLine,
        updateLine,
        deleteLine,
        setLines,
        addShape,
        updateShape,
        deleteShape,
        setShapes,
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
        isLocked,
        setIsLocked,
    };
}
