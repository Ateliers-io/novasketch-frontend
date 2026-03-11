import { useEffect, useRef } from 'react';
import { Shape, ToolType, generateShapeId, getCurrentTimestamp } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { TextAnnotation, Action } from '../types';
import type { ActiveTool } from '../../Toolbar/Toolbar';

// Internal clipboard — lives in memory so it works across re-renders.
// Using a module-level ref avoids stale closures.
interface ClipboardPayload {
    shapes: Shape[];
    lines: StrokeLine[];
    texts: TextAnnotation[];
}

let _clipboard: ClipboardPayload | null = null;

// offsetCounter ensures repeated Ctrl+V pastes stack neatly
let _pasteCount = 0;

interface UseKeyboardShortcutsOptions {
    shapes: Shape[];
    lines: StrokeLine[];
    textAnnotations: TextAnnotation[];
    selectedShapeIds: Set<string>;
    selectedLineIds: Set<string>;
    selectedTextIds: Set<string>;
    activeTextInput: { x: number; y: number } | null;
    activeTool: ActiveTool;
    isLocked: boolean;

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

// Deep-clone and reassign a new ID to each copied shape
function cloneShape(shape: Shape, dx: number, dy: number): Shape {
    const now = getCurrentTimestamp();
    const newId = generateShapeId();
    const clone: any = {
        ...shape,
        id: newId,
        createdAt: now,
        updatedAt: now,
        // Offset position so the paste doesn't land on top of original
        position: { x: shape.position.x + dx, y: shape.position.y + dy },
    };
    // Offset geometry for lines/arrows
    if (clone.startPoint) {
        clone.startPoint = { x: clone.startPoint.x + dx, y: clone.startPoint.y + dy };
        clone.endPoint = { x: clone.endPoint.x + dx, y: clone.endPoint.y + dy };
        if (clone.controlPoint) {
            clone.controlPoint = { x: clone.controlPoint.x + dx, y: clone.controlPoint.y + dy };
        }
        // Sever smart connector bindings so the paste stands alone
        delete clone.startConnection;
        delete clone.endConnection;
    }
    // Offset triangle points
    if (clone.points && Array.isArray(clone.points) && clone.type === 'triangle') {
        clone.points = clone.points.map((p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy }));
    }
    // Frame children will be re-mapped separately; clear for safety
    if (clone.childrenIds) clone.childrenIds = [];
    // Strip parentId — paste creates top-level elements
    delete clone.parentId;
    return clone as Shape;
}

function cloneLine(line: StrokeLine, dx: number, dy: number): StrokeLine {
    const offsets: number[] = [];
    for (let i = 0; i < line.points.length; i += 2) {
        offsets.push(line.points[i] + dx);
        offsets.push(line.points[i + 1] + dy);
    }
    return {
        ...line,
        id: `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        points: offsets,
    };
}

function cloneText(text: TextAnnotation, dx: number, dy: number): TextAnnotation {
    return {
        ...text,
        id: `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        x: text.x + dx,
        y: text.y + dy,
    };
}

/**
 * Extracts keyboard shortcut handling from the Whiteboard component.
 * Handles: Ctrl+A (select all), Escape (deselect), Delete/Backspace,
 * Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo), tool shortcuts,
 * AND Ctrl+C (copy), Ctrl+X (cut), Ctrl+V (paste).
 */
export function useKeyboardShortcuts({
    shapes,
    lines,
    textAnnotations,
    selectedShapeIds,
    selectedLineIds,
    selectedTextIds,
    activeTextInput,
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
    isLocked,
}: UseKeyboardShortcutsOptions) {
    // Keep stable refs for values that change often so the event listener
    // can always read the latest without being re-registered constantly.
    const shapesRef = useRef(shapes);
    const linesRef = useRef(lines);
    const textsRef = useRef(textAnnotations);
    const selectedShapeIdsRef = useRef(selectedShapeIds);
    const selectedLineIdsRef = useRef(selectedLineIds);
    const selectedTextIdsRef = useRef(selectedTextIds);
    const activeTextInputRef = useRef(activeTextInput);
    const isLockedRef = useRef(isLocked);

    shapesRef.current = shapes;
    linesRef.current = lines;
    textsRef.current = textAnnotations;
    selectedShapeIdsRef.current = selectedShapeIds;
    selectedLineIdsRef.current = selectedLineIds;
    selectedTextIdsRef.current = selectedTextIds;
    activeTextInputRef.current = activeTextInput;
    isLockedRef.current = isLocked;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeInput = activeTextInputRef.current;
            const locked = isLockedRef.current;

            // Task 1.5.3: Panning shortcut is allowed even when locked.
            if (!activeInput && !e.ctrlKey && !e.metaKey && e.key === 'h') {
                setActiveTool(ToolType.HAND);
            }

            // Task 1.5.3: Escape is allowed to clear selection
            if (e.key === 'Escape') {
                setSelectedShapeIds(new Set());
                setSelectedLineIds(new Set());
                setSelectedTextIds(new Set());
                setActiveTextInput(null);
            }

            // ── Copy (Ctrl/Cmd+C) ──────────────────────────────────────
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !activeInput) {
                const selShapes = selectedShapeIdsRef.current;
                const selLines = selectedLineIdsRef.current;
                const selTexts = selectedTextIdsRef.current;

                const hasSelection = selShapes.size > 0 || selLines.size > 0 || selTexts.size > 0;
                if (hasSelection) {
                    e.preventDefault();
                    _clipboard = {
                        shapes: shapesRef.current.filter(s => selShapes.has(s.id)),
                        lines: linesRef.current.filter(l => selLines.has(l.id)),
                        texts: textsRef.current.filter(t => selTexts.has(t.id)),
                    };
                    _pasteCount = 0; // reset stacking offset when new copy is made
                }
                return;
            }

            // ── Cut (Ctrl/Cmd+X) ───────────────────────────────────────
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && !activeInput && !locked) {
                const selShapes = selectedShapeIdsRef.current;
                const selLines = selectedLineIdsRef.current;
                const selTexts = selectedTextIdsRef.current;

                const hasSelection = selShapes.size > 0 || selLines.size > 0 || selTexts.size > 0;
                if (hasSelection) {
                    e.preventDefault();
                    _clipboard = {
                        shapes: shapesRef.current.filter(s => selShapes.has(s.id)),
                        lines: linesRef.current.filter(l => selLines.has(l.id)),
                        texts: textsRef.current.filter(t => selTexts.has(t.id)),
                    };
                    _pasteCount = 0;
                    // Remove originals
                    setShapes(prev => prev.filter(s => !selShapes.has(s.id)));
                    setLines(prev => prev.filter(l => !selLines.has(l.id)));
                    setTextAnnotations(prev => prev.filter(t => !selTexts.has(t.id)));
                    setSelectedShapeIds(new Set());
                    setSelectedLineIds(new Set());
                    setSelectedTextIds(new Set());
                }
                return;
            }

            // ── Paste (Ctrl/Cmd+V) ─────────────────────────────────────
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !activeInput && !locked) {
                if (!_clipboard) return;
                e.preventDefault();

                _pasteCount += 1;
                const STEP = 20;
                const dx = STEP * _pasteCount;
                const dy = STEP * _pasteCount;

                const newShapes = _clipboard.shapes.map(s => cloneShape(s, dx, dy));
                const newLines = _clipboard.lines.map(l => cloneLine(l, dx, dy));
                const newTexts = _clipboard.texts.map(t => cloneText(t, dx, dy));

                setShapes(prev => [...prev, ...newShapes]);
                setLines(prev => [...prev, ...newLines]);
                setTextAnnotations(prev => [...prev, ...newTexts]);

                // Select the newly pasted items
                setSelectedShapeIds(new Set(newShapes.map(s => s.id)));
                setSelectedLineIds(new Set(newLines.map(l => l.id)));
                setSelectedTextIds(new Set(newTexts.map(t => t.id)));
                setActiveTool('select');
                return;
            }

            // Task 1.5.3: If session is locked, block ALL shortcuts including undo/redo.
            if (locked) return;

            // Undo (Ctrl+Z / Cmd+Z) — only in unlocked sessions
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                performUndo();
                return;
            }

            // Redo (Ctrl+Y / Cmd+Y) OR (Ctrl+Shift+Z / Cmd+Shift+Z)
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                performRedo();
                return;
            }

            // Ctrl+A: Select All Items
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const hasItems = shapesRef.current.length > 0 || linesRef.current.length > 0 || textsRef.current.length > 0;
                if (hasItems) {
                    setSelectedShapeIds(new Set(shapesRef.current.map(s => s.id)));
                    setSelectedLineIds(new Set(linesRef.current.map(l => l.id)));
                    setSelectedTextIds(new Set(textsRef.current.map(t => t.id)));
                    setActiveTool('select');
                }
                return;
            }

            // Delete/Backspace: Delete All Selected Items
            const selShapes = selectedShapeIdsRef.current;
            const selLines = selectedLineIdsRef.current;
            const selTexts = selectedTextIdsRef.current;
            const hasSelection = selShapes.size > 0 || selLines.size > 0 || selTexts.size > 0;

            if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
                if (activeInput) return;

                const affectedShapes = shapesRef.current.filter(s => selShapes.has(s.id));
                const affectedLines = linesRef.current.filter(l => selLines.has(l.id));
                const affectedTexts = textsRef.current.filter(t => selTexts.has(t.id));

                affectedShapes.forEach(s => addToHistory({ type: 'DELETE', objectType: 'shape', id: s.id, previousState: s, newState: null, userId: 'local' }));
                affectedLines.forEach(l => addToHistory({ type: 'DELETE', objectType: 'line', id: l.id, previousState: l, newState: null, userId: 'local', index: linesRef.current.findIndex(line => line.id === l.id) }));
                affectedTexts.forEach(t => addToHistory({ type: 'DELETE', objectType: 'text', id: t.id, previousState: t, newState: null, userId: 'local' }));

                setShapes(prev => prev.filter(s => !selShapes.has(s.id)));
                setLines(prev => prev.filter(l => !selLines.has(l.id)));
                setTextAnnotations(prev => prev.filter(t => !selTexts.has(t.id)));
                setSelectedShapeIds(new Set());
                setSelectedLineIds(new Set());
                setSelectedTextIds(new Set());
            }

            // Tool shortcuts (only when not typing)
            if (!activeInput && !e.ctrlKey && !e.metaKey) {
                if (e.key === 'g') setActiveTool(ToolType.FILL_BUCKET);
                if (e.key === 'v') setActiveTool('select');
                if (e.key === 'p') setActiveTool(ToolType.PEN);
                if (e.key === 'e') setActiveTool('eraser');
                if (e.key === 't') setActiveTool('text');
                if (e.key === 'r') setActiveTool(ToolType.RECTANGLE);
                if (e.key === 'c') setActiveTool(ToolType.CIRCLE);
                if (e.key === 'l') setActiveTool(ToolType.LINE);
                if (e.key === 'f') setActiveTool(ToolType.FRAME);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [performUndo, performRedo, setActiveTool, setSelectedShapeIds, setSelectedLineIds, setSelectedTextIds, setActiveTextInput, setShapes, setLines, setTextAnnotations, addToHistory]);
}
