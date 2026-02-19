import { useEffect } from 'react';
import { Shape, Position, ToolType } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { TextAnnotation, Action } from '../types';
import type { ActiveTool } from '../../Toolbar/Toolbar';

interface UseKeyboardShortcutsOptions {
    shapes: Shape[];
    lines: StrokeLine[];
    textAnnotations: TextAnnotation[];
    selectedShapeIds: Set<string>;
    selectedLineIds: Set<string>;
    selectedTextIds: Set<string>;
    activeTextInput: { x: number; y: number } | null;
    activeTool: ActiveTool;

    setSelectedShapeIds: (ids: Set<string>) => void;
    setSelectedLineIds: (ids: Set<string>) => void;
    setSelectedTextIds: (ids: Set<string>) => void;
    setActiveTextInput: (input: { x: number; y: number } | null) => void;
    setActiveTool: (tool: ActiveTool) => void;
    setShapes: (updater: Shape[] | ((prev: Shape[]) => Shape[])) => void;
    setLines: (updater: StrokeLine[] | ((prev: StrokeLine[]) => StrokeLine[])) => void;
    setTextAnnotations: (updater: TextAnnotation[] | ((prev: TextAnnotation[]) => TextAnnotation[])) => void;
    addToHistory: (action: Action) => void;

    performUndo: () => void;
    performRedo: () => void;
}

/**
 * Extracts keyboard shortcut handling from the Whiteboard component.
 * Handles: Ctrl+A (select all), Escape (deselect), Delete/Backspace,
 * Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo), and tool shortcuts.
 */
export function useKeyboardShortcuts({
    shapes,
    lines,
    textAnnotations,
    selectedShapeIds,
    selectedLineIds,
    selectedTextIds,
    activeTextInput,
    activeTool,
    setSelectedShapeIds,
    setSelectedLineIds,
    setSelectedTextIds,
    setActiveTextInput,
    setActiveTool,
    setShapes,
    setLines,
    setTextAnnotations,
    addToHistory,
    performUndo,
    performRedo,
}: UseKeyboardShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+A: Select All Items (shapes, lines, text)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault(); // Prevent browser's "Select All" text behavior
                const hasItems = shapes.length > 0 || lines.length > 0 || textAnnotations.length > 0;
                if (hasItems) {
                    setSelectedShapeIds(new Set(shapes.map(s => s.id)));
                    setSelectedLineIds(new Set(lines.map(l => l.id)));
                    setSelectedTextIds(new Set(textAnnotations.map(t => t.id)));
                    // Switch to selection tool automatically
                    setActiveTool('select');
                }
            }

            // Escape: Deselect All
            if (e.key === 'Escape') {
                setSelectedShapeIds(new Set());
                setSelectedLineIds(new Set());
                setSelectedTextIds(new Set());
                setActiveTextInput(null);
            }

            // Delete/Backspace: Delete All Selected Items
            const hasSelection = selectedShapeIds.size > 0 || selectedLineIds.size > 0 || selectedTextIds.size > 0;
            if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
                if (activeTextInput) return;

                // Capture state for undo
                const affectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
                const affectedLines = lines.filter(l => selectedLineIds.has(l.id));
                const affectedTexts = textAnnotations.filter(t => selectedTextIds.has(t.id));

                affectedShapes.forEach(s => addToHistory({ type: 'DELETE', objectType: 'shape', id: s.id, previousState: s, newState: null, userId: 'local' }));
                affectedLines.forEach(l => addToHistory({ type: 'DELETE', objectType: 'line', id: l.id, previousState: l, newState: null, userId: 'local', index: lines.findIndex(line => line.id === l.id) }));
                affectedTexts.forEach(t => addToHistory({ type: 'DELETE', objectType: 'text', id: t.id, previousState: t, newState: null, userId: 'local' }));

                setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)));
                setLines(prev => prev.filter(l => !selectedLineIds.has(l.id)));
                setTextAnnotations(prev => prev.filter(t => !selectedTextIds.has(t.id)));
                setSelectedShapeIds(new Set());
                setSelectedLineIds(new Set());
                setSelectedTextIds(new Set());
            }

            // Undo (Ctrl+Z / Cmd+Z)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                performUndo();
            }

            // Redo (Ctrl+Y / Cmd+Y) OR (Ctrl+Shift+Z / Cmd+Shift+Z)
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                performRedo();
            }

            // Tool shortcuts (only when not typing)
            if (!activeTextInput && !e.ctrlKey && !e.metaKey) {
                if (e.key === 'g') setActiveTool(ToolType.FILL_BUCKET);
                if (e.key === 'h') setActiveTool(ToolType.HAND);
                if (e.key === 'v') setActiveTool('select');
                if (e.key === 'p') setActiveTool(ToolType.PEN);
                if (e.key === 'e') setActiveTool('eraser');
                if (e.key === 't') setActiveTool('text');
                if (e.key === 'r') setActiveTool(ToolType.RECTANGLE);
                if (e.key === 'c') setActiveTool(ToolType.CIRCLE);
                if (e.key === 'l') setActiveTool(ToolType.LINE);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shapes, lines, textAnnotations, selectedShapeIds, selectedLineIds, selectedTextIds, activeTextInput, performUndo, performRedo]);
}
