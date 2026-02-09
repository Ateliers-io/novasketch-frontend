/**
 * React hook for using the SyncService in components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import SyncService, { SyncState, StrokeLine, TextAnnotation } from './sync.service';
import type { Shape } from '../types/shapes';

interface UseSyncOptions {
    roomId: string;
    wsUrl?: string;
}

interface UseSyncResult {
    // State
    lines: StrokeLine[];
    shapes: Shape[];
    textAnnotations: TextAnnotation[];

    // Connection status
    isConnected: boolean;
    isSynced: boolean;
    isLoading: boolean;

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

    // Batch operations
    batch: (callback: () => void) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Clear
    clearAll: () => void;
}

export function useSync({ roomId, wsUrl }: UseSyncOptions): UseSyncResult {
    const [lines, setLinesState] = useState<StrokeLine[]>([]);
    const [shapes, setShapesState] = useState<Shape[]>([]);
    const [textAnnotations, setTextAnnotationsState] = useState<TextAnnotation[]>([]);

    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

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
                if (synced) {
                    setIsLoading(false);
                }
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

    return {
        lines,
        shapes,
        textAnnotations,
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
        batch,
        undo,
        redo,
        canUndo,
        canRedo,
        clearAll,
    };
}
