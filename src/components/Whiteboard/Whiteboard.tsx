import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import DOMPurify from 'dompurify';
import Toolbar, { ActiveTool, EraserMode } from '../Toolbar/Toolbar';
import {
  ToolType,
  Shape,
  ShapeType,
  createRectangle,
  createCircle,
  isRectangle,
  isCircle,
  RectangleShape,
  CircleShape,
  Position,
} from '../../types/shapes';
import SVGShapeRenderer from './SVGShapeRenderer';
import {
  getShapeBoundingBox,
  getCombinedBoundingBox,
  isPointInBoundingBox,
  BoundingBox,
} from '../../utils/boundingBox';
import ExportTools from '../ExportTools/ExportTools';
import Konva from 'konva';
import { useSync } from '../../services/useSync';

// WebSocket URL for sync
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const ROOM_ID = 'default-room'; // TODO: Make dynamic based on route/user

// --- CONFIGURATION ---
const GRID_DOT_COLOR = '#45A29E';
const DEFAULT_STROKE_COLOR = '#66FCF1';

// --- TYPES ---
interface StrokeLine {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface TextAnnotation {
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
  rotation?: number; // Added rotation property
}

// --- UNDO/REDO TYPES ---
interface Action {
  type: 'ADD' | 'UPDATE' | 'DELETE' | 'LAYER_CHANGE' | 'BATCH';
  objectType?: 'shape' | 'line' | 'text';
  id?: string;
  previousState?: any;
  newState?: any;
  userId: string;
  actions?: Action[]; // For BATCH type
  index?: number; // Order preservation
}

// --- MATH HELPERS (CRITICAL FOR ERASER) ---
function distSq(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function getSegmentCircleIntersections(p1: Position, p2: Position, c: Position, r: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - c.x;
  const fy = p1.y - c.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  let discriminant = b * b - 4 * a * C;
  const intersections: Position[] = [];

  if (discriminant >= 0 && a !== 0) {
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    if (t1 >= 0 && t1 <= 1) intersections.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
    if (t2 >= 0 && t2 <= 1) intersections.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
  }
  return intersections;
}

function eraseAtPosition(x: number, y: number, strokes: StrokeLine[], eraserRadius: number): StrokeLine[] {
  const result: StrokeLine[] = [];
  for (const stroke of strokes) {
    const points = stroke.points;
    let currentLinePoints: number[] = [];
    let segmentCount = 0;

    const finishLine = () => {
      if (currentLinePoints.length >= 4) {
        // Use a more unique ID for new segments to prevent key collisions and tracking issues
        result.push({ ...stroke, id: `${stroke.id}-${Math.floor(Math.random() * 1000000)}`, points: [...currentLinePoints] });
      }
      currentLinePoints = [];
    };

    if (points.length < 4) { result.push(stroke); continue; }

    let px = points[0];
    let py = points[1];

    if (distSq({ x: px, y: py }, { x, y }) >= eraserRadius ** 2) {
      currentLinePoints.push(px, py);
    }

    for (let i = 2; i < points.length; i += 2) {
      const cx = points[i];
      const cy = points[i + 1];
      const p1 = { x: px, y: py };
      const p2 = { x: cx, y: cy };

      const intersections = getSegmentCircleIntersections(p1, p2, { x, y }, eraserRadius);

      if (intersections.length > 0) {
        intersections.sort((a, b) => distSq(p1, a) - distSq(p1, b));
        if (distSq(p1, { x, y }) >= eraserRadius ** 2) {
          currentLinePoints.push(intersections[0].x, intersections[0].y);
          finishLine();
        }
        if (intersections.length === 2) {
          currentLinePoints.push(intersections[1].x, intersections[1].y);
        }
      }

      if (distSq(p2, { x, y }) >= eraserRadius ** 2) {
        currentLinePoints.push(cx, cy);
      } else {
        if (currentLinePoints.length > 0) {
          finishLine();
        }
      }

      px = cx;
      py = cy;
    }
    finishLine();
  }
  return result;
}

function removeStrokesAt(x: number, y: number, strokes: StrokeLine[], radius: number): StrokeLine[] {
  return strokes.filter(line => {
    for (let i = 0; i < line.points.length; i += 2) {
      if (distSq({ x: line.points[i], y: line.points[i + 1] }, { x, y }) < radius ** 2) {
        return false;
      }
    }
    return true;
  });
}

// Helper for Task 2: Reorder Object Array (Bring Forward)
function moveForward<T extends { id: string }>(items: T[], selectedIds: Set<string>): T[] {
  const newItems = [...items];
  for (let i = newItems.length - 2; i >= 0; i--) {
    if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i + 1].id)) {
      [newItems[i], newItems[i + 1]] = [newItems[i + 1], newItems[i]];
    }
  }
  return newItems;
}

// Helper for Task 2: Reorder Object Array (Send Backward)
function moveBackward<T extends { id: string }>(items: T[], selectedIds: Set<string>): T[] {
  const newItems = [...items];
  for (let i = 1; i < newItems.length; i++) {
    if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i - 1].id)) {
      [newItems[i], newItems[i - 1]] = [newItems[i - 1], newItems[i]];
    }
  }
  return newItems;
}

// --- HELPER COMPONENTS ---
const FloatingInput = ({ x, y, style, value, onChange, onSubmit }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus on mount
    const timer = setTimeout(() => {
      ref.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      onChange(''); // Clear text
      onSubmit();   // Close
    }
  };

  return (
    <div
      className="fixed z-[99999]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(10px, 10px)'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white p-1 rounded shadow-xl border-2 border-blue-500">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type text..."
          className="block w-full h-full bg-transparent text-black outline-none resize-none overflow-hidden min-w-[200px] min-h-[50px]"
          style={{
            fontSize: `${style.size || 16}px`,
            fontFamily: style.family || 'Inter',
            fontWeight: style.bold ? 'bold' : 'normal',
            fontStyle: style.italic ? 'italic' : 'normal',
            textDecoration: style.underline ? 'underline' : 'none',
            color: style.color,
          }}
        />
        <div className="text-[10px] text-gray-400 text-right px-1">Press Enter to save</div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // -- 1. SYNC STATE (Yjs + WebSocket + IndexedDB) --
  const {
    lines,
    shapes,
    textAnnotations,
    isConnected,
    isLoading: isLoadingCanvas,
    addLine,
    updateLine: syncUpdateLine,
    deleteLine: syncDeleteLine,
    setLines: syncSetLines,
    addShape,
    updateShape: syncUpdateShape,
    deleteShape: syncDeleteShape,
    setShapes: syncSetShapes,
    addText,
    updateText: syncUpdateText,
    deleteText: syncDeleteText,
    setTexts: syncSetTexts,
    undo: performUndo,
    redo: performRedo,
    canUndo,
    canRedo,
    clearAll,
  } = useSync({ roomId: ROOM_ID, wsUrl: WS_URL });

  // Keep a ref to lines for event handlers that need current state
  const linesRef = useRef(lines);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  // Snapshot for Eraser Diffing
  const [initialEraserLines, setInitialEraserLines] = useState<StrokeLine[] | null>(null);

  // State setter wrappers that use the sync service
  // These provide compatibility with existing event handlers while routing through Yjs
  const setLines = useCallback((updater: StrokeLine[] | ((prev: StrokeLine[]) => StrokeLine[])) => {
    if (typeof updater === 'function') {
      const newLines = updater(lines);
      syncSetLines(newLines);
    } else {
      syncSetLines(updater);
    }
  }, [lines, syncSetLines]);

  const setShapes = useCallback((updater: Shape[] | ((prev: Shape[]) => Shape[])) => {
    if (typeof updater === 'function') {
      const newShapes = updater(shapes);
      syncSetShapes(newShapes);
    } else {
      syncSetShapes(updater);
    }
  }, [shapes, syncSetShapes]);

  const setTextAnnotations = useCallback((updater: TextAnnotation[] | ((prev: TextAnnotation[]) => TextAnnotation[])) => {
    if (typeof updater === 'function') {
      const newTexts = updater(textAnnotations);
      syncSetTexts(newTexts);
    } else {
      syncSetTexts(updater);
    }
  }, [textAnnotations, syncSetTexts]);

  // No-op function for addToHistory (Yjs handles history automatically)
  const addToHistory = useCallback((_action: Action) => {
    // Yjs UndoManager handles history automatically via transactions
    // This is kept as a no-op for compatibility with existing code
  }, []);

  // -- 2. INTERACTION STATE --
  const [activeTool, setActiveTool] = useState<ActiveTool>('select'); // Default to select
  const [isDrawing, setIsDrawing] = useState(false);
  const [isToolLocked, setIsToolLocked] = useState(false); // Lock tool for multiple drawings
  // Task 4.2.1: State for calculating drag delta
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [lastPointerPos, setLastPointerPos] = useState<Position | null>(null);
  const [isHoveringSelection, setIsHoveringSelection] = useState(false); // Task 4.2.4: Track hover for cursor

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialResizeState, setInitialResizeState] = useState<{
    box: BoundingBox;
    shapes: Map<string, Shape>;
    lines: Map<string, StrokeLine>;
    texts: Map<string, TextAnnotation>;
  } | null>(null);

  // Rotation State
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState<number>(0);
  const [initialShapeRotations, setInitialShapeRotations] = useState<Map<string, number>>(new Map());

  // Shape Creation
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [previewShape, setPreviewShape] = useState<Shape | null>(null);

  // Dragging State Snapshot (for History)
  const [initialDragState, setInitialDragState] = useState<{
    shapes: Map<string, Shape>;
    lines: Map<string, StrokeLine>;
    texts: Map<string, TextAnnotation>;
  } | null>(null);

  // Selection State (Task 4.1) - Track all selected items
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
  const [selectionBoundingBox, setSelectionBoundingBox] = useState<BoundingBox | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // UI State
  const [activeTextInput, setActiveTextInput] = useState<{ x: number, y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState(''); // Hoisted state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // -- 3. STYLE STATE --
  const [brushSize, setBrushSize] = useState(3);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState('#45A29E');
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');

  const [fontStyles, setFontStyles] = useState({
    family: 'Inter',
    size: 16,
    bold: false,
    italic: false,
    underline: false
  });




  // Handle Window Resize
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // NOTE: Canvas loading and saving is now handled automatically by the SyncService
  // via Yjs + WebSocket (for MongoDB persistence) and IndexedDB (for offline support)


  // Keyboard Shortcuts (Ctrl+A, Escape, Delete)
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shapes, lines, textAnnotations, selectedShapeIds, selectedLineIds, selectedTextIds, activeTextInput, performUndo, performRedo]);

  // -- 4. HELPERS --
  const getPointerPos = (e: any) => {
    const stage = e.target?.getStage?.();
    if (stage) {
      return stage.getPointerPosition() || { x: 0, y: 0 };
    }

    // Fix for UI Eraser Cursor Jump: Use global client coordinates relative to container
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();

      // Get client coordinates from various event types (React Synthetic, Native, or Konva wrapped)
      const nativeEvent = e.nativeEvent || e;
      const clientX = e.clientX ?? nativeEvent.clientX ?? e.evt?.clientX;
      const clientY = e.clientY ?? nativeEvent.clientY ?? e.evt?.clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Temporary Debug Log
        // console.log('[Pointer]', { client: { x: clientX, y: clientY }, canvas: { x, y } });

        return { x, y };
      }
    }

    // Fallback (Risk of 0,0 jump if target is child)
    return { x: e.nativeEvent?.offsetX || 0, y: e.nativeEvent?.offsetY || 0 };
  };

  // Helper to check if eraser hits a shape
  function isPointInShape(shape: Shape, x: number, y: number, radius: number): boolean {
    if (isRectangle(shape)) {
      const s = shape as RectangleShape;
      // Check bounds with radius buffer
      return x >= s.position.x - radius &&
        x <= s.position.x + s.width + radius &&
        y >= s.position.y - radius &&
        y <= s.position.y + s.height + radius;
    }
    if (isCircle(shape)) {
      const s = shape as CircleShape;
      const dist = Math.sqrt((s.position.x - x) ** 2 + (s.position.y - y) ** 2);
      return dist <= s.radius + radius;
    }
    return false;
  }

  // Hit test for selection: find item (text, line, shape) at clicked point
  function findElementAtPoint(x: number, y: number): { id: string; type: 'shape' | 'line' | 'text' } | null {
    // 1. Text (Top Layer)
    for (let i = textAnnotations.length - 1; i >= 0; i--) {
      const t = textAnnotations[i];
      const w = t.text.length * (t.fontSize * 0.6); // Approximate width
      const h = t.fontSize * 1.2;
      if (x >= t.x && x <= t.x + w && y >= t.y && y <= t.y + h) {
        return { id: t.id, type: 'text' };
      }
    }

    // 2. Lines (Middle Layer)
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      // Bounding box check with buffer
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let j = 0; j < l.points.length; j += 2) {
        minX = Math.min(minX, l.points[j]);
        minY = Math.min(minY, l.points[j + 1]);
        maxX = Math.max(maxX, l.points[j]);
        maxY = Math.max(maxY, l.points[j + 1]);
      }
      const buf = (l.strokeWidth || 5) / 2 + 5;
      if (x >= minX - buf && x <= maxX + buf && y >= minY - buf && y <= maxY + buf) {
        return { id: l.id, type: 'line' };
      }
    }

    // 3. Shapes (Bottom Layer)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (isPointInBoundingBox({ x, y }, getShapeBoundingBox(s), 5)) {
        return { id: s.id, type: 'shape' };
      }
    }
    return null;
  }

  // Update bounding box when selection changes (includes shapes, lines, text)
  useEffect(() => {
    const hasSelection = selectedShapeIds.size > 0 || selectedLineIds.size > 0 || selectedTextIds.size > 0;

    if (!hasSelection) {
      setSelectionBoundingBox(null);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Include shapes
    const selectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
    selectedShapes.forEach(shape => {
      const bbox = getShapeBoundingBox(shape);
      minX = Math.min(minX, bbox.minX);
      minY = Math.min(minY, bbox.minY);
      maxX = Math.max(maxX, bbox.maxX);
      maxY = Math.max(maxY, bbox.maxY);
    });

    // Include lines
    const selectedLines = lines.filter(l => selectedLineIds.has(l.id));
    selectedLines.forEach(line => {
      for (let i = 0; i < line.points.length; i += 2) {
        minX = Math.min(minX, line.points[i]);
        minY = Math.min(minY, line.points[i + 1]);
        maxX = Math.max(maxX, line.points[i]);
        maxY = Math.max(maxY, line.points[i + 1]);
      }
    });

    // Include text
    const selectedTexts = textAnnotations.filter(t => selectedTextIds.has(t.id));
    selectedTexts.forEach(text => {
      const textWidth = text.text.length * (text.fontSize * 0.6);
      const textHeight = text.fontSize * 1.2;
      minX = Math.min(minX, text.x);
      minY = Math.min(minY, text.y);
      maxX = Math.max(maxX, text.x + textWidth);
      maxY = Math.max(maxY, text.y + textHeight);
    });

    if (minX !== Infinity) {
      setSelectionBoundingBox({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        minX,
        minY,
        maxX,
        maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      });
    }
  }, [selectedShapeIds, selectedLineIds, selectedTextIds, shapes, lines, textAnnotations]);



  const performErase = (x: number, y: number) => {
    // 1. Lines
    if (eraserMode === 'stroke') {
      const currentLines = linesRef.current;
      // Find lines that would be removed
      const linesHit = currentLines.filter(l => {
        for (let i = 0; i < l.points.length; i += 2) {
          if (distSq({ x: l.points[i], y: l.points[i + 1] }, { x, y }) < eraserSize ** 2) {
            return true;
          }
        }
        return false;
      });

      if (linesHit.length > 0) {
        // Record History
        linesHit.forEach(l => {
          const index = currentLines.findIndex(cl => cl.id === l.id);
          console.log('[Eraser] Deleting Line:', l.id, 'Index:', index);
          addToHistory({
            type: 'DELETE',
            objectType: 'line',
            id: l.id,
            previousState: l,
            newState: null,
            userId: 'local',
            index
          });
        });

        // Update State
        const newLines = currentLines.filter(l => !linesHit.some(hit => hit.id === l.id));
        setLines(newLines);
        // Sync ref immediately to ensure PointerUp sees latest state for partial logic usage elsewhere (consistency)
        linesRef.current = newLines;
      }
    } else {
      // Partial Eraser
      // Calculate new lines using current Ref to ensure we build on latest known state
      // (This avoids functional update delay causing history mismatch)
      const newLines = eraseAtPosition(x, y, linesRef.current, eraserSize);
      setLines(newLines);
      linesRef.current = newLines; // SYNC REF for proper history capture in PointerUp
    }

    // 2. Shapes
    const shapesHit = shapes.filter(s => isPointInShape(s, x, y, eraserSize));
    if (shapesHit.length > 0) {
      shapesHit.forEach(s => {
        console.log('[Eraser] Deleting Shape:', s.id);
        addToHistory({
          type: 'DELETE',
          objectType: 'shape',
          id: s.id,
          previousState: s,
          newState: null,
          userId: 'local'
        });
      });
      setShapes(prev => prev.filter(s => !shapesHit.some(hit => hit.id === s.id)));
    }

    // 3. Text
    const textsHit = textAnnotations.filter(t => {
      // Approximate text hit (top-left anchor)
      const dx = t.x - x;
      const dy = t.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= eraserSize + 20; // 20px buffer for text body (INVERSE logic from original filter)
    });

    if (textsHit.length > 0) {
      textsHit.forEach(t => {
        console.log('[Eraser] Deleting Text:', t.id);
        addToHistory({
          type: 'DELETE',
          objectType: 'text',
          id: t.id,
          previousState: t,
          newState: null,
          userId: 'local'
        });
      });
      setTextAnnotations(prev => prev.filter(t => !textsHit.some(hit => hit.id === t.id)));
    }
  };




  // -- Task 4.4: Layer Management --
  // -- Task 4.4: Layer Management --
  const handleBringForward = () => {
    let newShapes = shapes;
    let newLines = lines;
    let newTexts = textAnnotations;

    if (selectedShapeIds.size > 0) newShapes = moveForward(shapes, selectedShapeIds);
    if (selectedLineIds.size > 0) newLines = moveForward(lines, selectedLineIds);
    if (selectedTextIds.size > 0) newTexts = moveForward(textAnnotations, selectedTextIds);

    if (newShapes !== shapes) setShapes(newShapes);
    if (newLines !== lines) setLines(newLines);
    if (newTexts !== textAnnotations) setTextAnnotations(newTexts);

    // Task 3: Collaboration Broadcast
    if (newShapes !== shapes || newLines !== lines || newTexts !== textAnnotations) {
      console.log('[Broadcast] Layer Reorder:', {
        type: 'LAYER_REORDER',
        shapeOrder: newShapes.map(s => s.id),
        lineOrder: newLines.map(l => l.id),
        textOrder: newTexts.map(t => t.id)
      });
      // socket.emit('layer-update', { ... });
    }
  };

  const handleSendBackward = () => {
    let newShapes = shapes;
    let newLines = lines;
    let newTexts = textAnnotations;

    if (selectedShapeIds.size > 0) newShapes = moveBackward(shapes, selectedShapeIds);
    if (selectedLineIds.size > 0) newLines = moveBackward(lines, selectedLineIds);
    if (selectedTextIds.size > 0) newTexts = moveBackward(textAnnotations, selectedTextIds);

    if (newShapes !== shapes) setShapes(newShapes);
    if (newLines !== lines) setLines(newLines);
    if (newTexts !== textAnnotations) setTextAnnotations(newTexts);

    // Task 3: Collaboration Broadcast
    if (newShapes !== shapes || newLines !== lines || newTexts !== textAnnotations) {
      console.log('[Broadcast] Layer Reorder:', {
        type: 'LAYER_REORDER',
        shapeOrder: newShapes.map(s => s.id),
        lineOrder: newLines.map(l => l.id),
        textOrder: newTexts.map(t => t.id)
      });
      // socket.emit('layer-update', { ... });
    }
  };

  // -- 5. ACTION HANDLERS --

  const commitText = () => {
    if (activeTextInput && textInputValue.trim()) {
      const newTextId = `text-${Date.now()}`;
      const newText = {
        id: newTextId,
        x: activeTextInput.x,
        y: activeTextInput.y,
        text: textInputValue,
        color: strokeColor,
        fontSize: fontStyles.size,
        fontFamily: fontStyles.family,
        fontWeight: fontStyles.bold ? 'bold' : 'normal',
        fontStyle: fontStyles.italic ? 'italic' : 'normal',
        textDecoration: fontStyles.underline ? 'underline' : 'none',
        rotation: 0 // Initialize rotation
      };
      setTextAnnotations(prev => [...prev, newText]);
      addToHistory({
        type: 'ADD',
        objectType: 'text',
        id: newTextId,
        previousState: null,
        newState: newText,
        userId: 'local'
      });

      // Auto-switch to selection and select the new text (unless locked)
      if (!isToolLocked) {
        setActiveTool('select');
        setSelectedTextIds(new Set([newTextId]));
      }
    }
    setActiveTextInput(null);
    setTextInputValue('');
  };

  const handlePointerDown = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    // Check if clicking on UI (Toolbar)
    if ((e.target as HTMLElement).closest?.('[data-component="toolbar"]')) {
      if (activeTextInput) commitText();
      return;
    }

    // Check if clicking resize handles
    const nativeTarget = ('nativeEvent' in e ? e.nativeEvent.target : e.target) as Element;
    const resizeHandleEl = nativeTarget.closest?.('[data-resize-handle]');
    const rotationHandleEl = nativeTarget.closest?.('[data-rotation-handle]');

    // Get pointer position for handle interactions
    const { x, y } = getPointerPos(e);

    // Task 4.3: Check if clicking rotation handle
    if (activeTool === 'select' && rotationHandleEl && selectionBoundingBox) {
      if ('stopPropagation' in e) e.stopPropagation();
      setIsRotating(true);

      // Use robust coordinates relative to container
      let mouseX = x;
      let mouseY = y;
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = (e as any).clientX !== undefined ? (e as any).clientX : (e as any).evt?.clientX;
        const clientY = (e as any).clientY !== undefined ? (e as any).clientY : (e as any).evt?.clientY;
        if (clientX !== undefined && clientY !== undefined) {
          mouseX = clientX - rect.left;
          mouseY = clientY - rect.top;
        }
      }

      // Calculate initial angle from center of selection to mouse position
      const centerX = selectionBoundingBox.centerX;
      const centerY = selectionBoundingBox.centerY;
      const startAngle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
      setRotationStartAngle(startAngle);

      // Store initial rotations of all selected shapes
      const initialRotations = new Map<string, number>();
      shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
        initialRotations.set(s.id, s.transform.rotation);
      });
      // Store initial rotations of all selected text
      textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
        initialRotations.set(t.id, t.rotation || 0);
      });
      setInitialShapeRotations(initialRotations);
      return;
    }

    if (activeTool === 'select' && resizeHandleEl && selectionBoundingBox) {
      if ('stopPropagation' in e) e.stopPropagation();
      const handleId = resizeHandleEl.getAttribute('data-resize-handle');
      if (handleId) {
        setIsResizing(true);
        setResizeHandle(handleId);
        setInitialResizeState({
          box: { ...selectionBoundingBox },
          shapes: new Map(shapes.filter(s => selectedShapeIds.has(s.id)).map(s => [s.id, s])),
          lines: new Map(lines.filter(l => selectedLineIds.has(l.id)).map(l => [l.id, l])),
          texts: new Map(textAnnotations.filter(t => selectedTextIds.has(t.id)).map(t => [t.id, t]))
        });
        return;
      }
    }

    // If text input is open, commit it first (unless we are clicking ON the input, which is handled by stopPropagation)
    if (activeTextInput) {
      commitText();
      // Don't return, allow specific tool actions (like starting a new text elsewhere)
    }

    // A. SELECTION TOOL
    if (activeTool === 'select') {
      // Task 4.2.1: Drag Logic - Check bounding box first
      // If we have a selection and click inside its bounding box, start dragging
      if (selectionBoundingBox && isPointInBoundingBox({ x, y }, selectionBoundingBox)) {
        setIsDraggingSelection(true);
        setLastPointerPos({ x, y });
        // Snapshot for Undo
        setInitialDragState({
          shapes: new Map(shapes.filter(s => selectedShapeIds.has(s.id)).map(s => [s.id, s])),
          lines: new Map(lines.filter(l => selectedLineIds.has(l.id)).map(l => [l.id, l])),
          texts: new Map(textAnnotations.filter(t => selectedTextIds.has(t.id)).map(t => [t.id, t]))
        });
        return;
      }

      const clickedItem = findElementAtPoint(x, y);
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      const isShiftClick = nativeEvent?.shiftKey || false;

      if (clickedItem) {
        if (isShiftClick) {
          // Multi-select: toggle selection
          if (clickedItem.type === 'shape') {
            setSelectedShapeIds(prev => {
              const next = new Set(prev);
              if (next.has(clickedItem.id)) next.delete(clickedItem.id); else next.add(clickedItem.id);
              return next;
            });
          } else if (clickedItem.type === 'line') {
            setSelectedLineIds(prev => {
              const next = new Set(prev);
              if (next.has(clickedItem.id)) next.delete(clickedItem.id); else next.add(clickedItem.id);
              return next;
            });
          } else if (clickedItem.type === 'text') {
            setSelectedTextIds(prev => {
              const next = new Set(prev);
              if (next.has(clickedItem.id)) next.delete(clickedItem.id); else next.add(clickedItem.id);
              return next;
            });
          }
        } else {
          // Single select: replace selection (clear others)
          setSelectedShapeIds(clickedItem.type === 'shape' ? new Set([clickedItem.id]) : new Set());
          setSelectedLineIds(clickedItem.type === 'line' ? new Set([clickedItem.id]) : new Set());
          setSelectedTextIds(clickedItem.type === 'text' ? new Set([clickedItem.id]) : new Set());
        }
      } else {
        // Clicked on empty space: start marquee selection
        setSelectedShapeIds(new Set());
        setSelectedLineIds(new Set());
        setSelectedTextIds(new Set());
        setDragStart({ x, y });
        setMarqueeRect({ x, y, width: 0, height: 0 });
        setIsDrawing(true);
      }
      return;
    }

    // ... (Rest of tools)
    // B. TEXT TOOL
    if (activeTool === 'text') {
      // Start new text input
      setActiveTextInput({ x, y });
      setTextInputValue('');
      return;
    }

    // C. ERASER TOOL
    if (activeTool === 'eraser') {
      // DEBUG: Log coordinates to verify fix
      const native = (e as any).nativeEvent || (e as any).evt;
      console.log('[Eraser Down] Raw:', { x: native.clientX, y: native.clientY }, 'Canvas:', { x, y });

      // Snapshot lines for diffing later
      setInitialEraserLines(lines);
      performErase(x, y);
      setIsDrawing(true);
      return;
    }

    // C. DRAWING/SHAPE TOOLS
    setIsDrawing(true);
    setDragStart({ x, y });

    if (activeTool === ToolType.PEN) {
      setLines([...lines, {
        id: `stroke-${Date.now()}`,
        points: [x, y],
        color: strokeColor,
        strokeWidth: brushSize
      }]);
    } else if (activeTool === ToolType.RECTANGLE) {
      setPreviewShape(createRectangle(x, y, 0, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true } }));
    } else if (activeTool === ToolType.CIRCLE) {
      setPreviewShape(createCircle(x, y, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true } }));
    }
  };

  // Calculate Sub-Lines
  // This logic is complex. 'eraseAtPosition' splits lines.
  // Instead of recalculating here, we should rely on the state update inside 'performErase'.
  // But 'performErase' can call 'setLines'.
  // We need to capture the pointer move events.
  // Simpler: Just rely on 'eraseAtPosition' inside 'performErase' to update state, 
  // and PointerUp to diff.
  const handlePointerMove = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    const { x, y } = getPointerPos(e);
    setCursorPos({ x, y });

    // Task 4.2.4: Hover detection
    if (activeTool === 'select' && !isDraggingSelection && !isDrawing) {
      let hovering = false;
      if (selectionBoundingBox && isPointInBoundingBox({ x, y }, selectionBoundingBox)) {
        hovering = true;
      }
      setIsHoveringSelection(hovering);
    } else if (activeTool !== 'select') {
      setIsHoveringSelection(false);
    }

    // Task 4.3: Handle Rotation Logic
    if (isRotating && selectionBoundingBox && initialShapeRotations.size > 0) {
      const centerX = selectionBoundingBox.centerX;
      const centerY = selectionBoundingBox.centerY;

      // Use robust coordinates relative to container
      let mouseX = x;
      let mouseY = y;
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = (e as any).clientX !== undefined ? (e as any).clientX : (e as any).evt?.clientX;
        const clientY = (e as any).clientY !== undefined ? (e as any).clientY : (e as any).evt?.clientY;
        if (clientX !== undefined && clientY !== undefined) {
          mouseX = clientX - rect.left;
          mouseY = clientY - rect.top;
        }
      }

      // Calculate current angle from center to mouse
      const currentAngle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
      let deltaAngle = currentAngle - rotationStartAngle;

      // Shift key: Snap to 15-degree increments
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      if (nativeEvent?.shiftKey) {
        deltaAngle = Math.round(deltaAngle / 15) * 15;
      }

      // Update all selected shapes
      setShapes(prev => prev.map(s => {
        if (selectedShapeIds.has(s.id)) {
          const initialRotation = initialShapeRotations.get(s.id) || 0;
          return {
            ...s,
            transform: {
              ...s.transform,
              rotation: initialRotation + deltaAngle
            }
          };
        }
        return s;
      }));

      // Update all selected text
      setTextAnnotations(prev => prev.map(t => {
        if (selectedTextIds.has(t.id)) {
          const initialRotation = initialShapeRotations.get(t.id) || 0;
          return {
            ...t,
            rotation: initialRotation + deltaAngle
          };
        }
        return t;
      }));
      return;
    }

    if (isDrawing && activeTool === 'eraser') {
      performErase(x, y);
      return;
    }




    // Task 2: Handle Resizing Logic
    if (isResizing && initialResizeState && resizeHandle) {
      const { box } = initialResizeState;
      let newX = box.x;
      let newY = box.y;
      let newWidth = box.width;
      let newHeight = box.height;

      // Calculate new bounds based on handle
      // Standard delta from initial pointer usually better, but here we can compute from current mouse to initial bounds edges
      // Current Mouse: {x, y}

      // Determine new edges
      // Note: This simple logic assumes no rotation on the box itself (AABB)

      if (resizeHandle.includes('e')) newWidth = Math.max(10, x - box.x);
      if (resizeHandle.includes('w')) {
        const right = box.x + box.width;
        newWidth = Math.max(10, right - x);
        newX = right - newWidth;
      }
      if (resizeHandle.includes('s')) newHeight = Math.max(10, y - box.y);
      if (resizeHandle.includes('n')) {
        const bottom = box.y + box.height;
        newHeight = Math.max(10, bottom - y);
        newY = bottom - newHeight;
      }

      // Aspect Ratio Lock (Shift)
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      if (nativeEvent?.shiftKey && ['nw', 'ne', 'se', 'sw'].includes(resizeHandle)) {
        const ratio = box.width / box.height;
        // We need to decide which dimension to prioritize or pick the larger change
        // Simple approach: width dictates height (common) or take max projected dimension

        if (resizeHandle === 'se' || resizeHandle === 'nw') {
          // For SE/NW, standard ratio logic
          // Determine dominant axis usually, or just use width
          const projectedHeight = newWidth / ratio;
          if (newHeight < projectedHeight) {
            // Mouse is "above/left" of diagonal
            newHeight = projectedHeight;
            if (resizeHandle === 'nw') newY = (box.y + box.height) - newHeight;
          } else {
            newWidth = newHeight * ratio;
            if (resizeHandle === 'nw') newX = (box.x + box.width) - newWidth;
          }
        } else {
          // NE / SW - Inverted ratio logic visually but math is same for dimensions
          const projectedHeight = newWidth / ratio;
          // The "sign" of updates matters for position, but we already calculated newX/newY and W/H.
          // Let's refine based on W/H again.

          // If we just strictly constrain w/h:
          newHeight = newWidth / ratio;

          // Adjust position if needed (growing upwards/leftwards)
          if (resizeHandle.includes('n')) {
            newY = (box.y + box.height) - newHeight;
          }
          if (resizeHandle.includes('w')) {
            // We set newX based on Width, but here we adjusted Height based on Width.
            // Wait, if we adjusted Height, we must check if that's valid user intent.
            // Usually we take the larger of (dx, dy).
          }
        }
      }

      // Scale Factors
      const scaleX = newWidth / box.width;
      const scaleY = newHeight / box.height;

      // A. Update Shapes
      if (initialResizeState.shapes.size > 0) {
        setShapes(prev => prev.map(s => {
          const initS = initialResizeState.shapes.get(s.id);
          if (initS) {
            // Calculate relative position
            const relX = initS.position.x - box.x;
            const relY = initS.position.y - box.y;

            // New pos
            const finalX = newX + relX * scaleX;
            const finalY = newY + relY * scaleY;

            if (isRectangle(initS)) {
              return { ...s, position: { x: finalX, y: finalY }, width: (initS as RectangleShape).width * scaleX, height: (initS as RectangleShape).height * scaleY };
            } else if (isCircle(initS)) {
              // Circles usually maintain aspect ratio or become ellipses. 
              // Novasketch `CircleShape` only has `radius`. It stays a circle.
              // So we must choose one scale or average.
              // Use average of scales or max? Max ensures it doesn't shrink weirdly.
              // Or use scaleX if shift held? 
              // Let's use geometric mean or max. Max is safer for visibility.
              const scale = Math.max(scaleX, scaleY);
              return { ...s, position: { x: finalX, y: finalY }, radius: (initS as CircleShape).radius * scale };
            }
            return { ...s, position: { x: finalX, y: finalY } };
          }
          return s;
        }));
      }

      // B. Update Lines
      if (initialResizeState.lines.size > 0) {
        setLines(prev => prev.map(l => {
          const initL = initialResizeState.lines.get(l.id);
          if (initL) {
            const newPoints = [];
            for (let i = 0; i < initL.points.length; i += 2) {
              const px = initL.points[i];
              const py = initL.points[i + 1];
              const nx = newX + (px - box.x) * scaleX;
              const ny = newY + (py - box.y) * scaleY;
              newPoints.push(nx, ny);
            }
            return { ...l, points: newPoints };
          }
          return l;
        }));
      }

      // C. Update Text
      if (initialResizeState.texts.size > 0) {
        setTextAnnotations(prev => prev.map(t => {
          const initT = initialResizeState.texts.get(t.id);
          if (initT) {
            const nx = newX + (initT.x - box.x) * scaleX;
            const ny = newY + (initT.y - box.y) * scaleY;
            const nFontSize = initT.fontSize * scaleY; // Use Y scale for font size typically
            return { ...t, x: nx, y: ny, fontSize: nFontSize };
          }
          return t;
        }));
      }
      return;
    }

    // Task 4.2.1: Calculate Delta during drag
    if (isDraggingSelection && lastPointerPos) {
      const dx = x - lastPointerPos.x;
      const dy = y - lastPointerPos.y;

      // Task 4.2.2: Update object coordinates locally in real-time

      // 1. Move Shapes
      if (selectedShapeIds.size > 0) {
        setShapes(prev => prev.map(s => {
          if (selectedShapeIds.has(s.id)) {
            return {
              ...s,
              position: { x: s.position.x + dx, y: s.position.y + dy }
            };
          }
          return s;
        }));
      }

      // 2. Move Lines (all points must shift)
      if (selectedLineIds.size > 0) {
        setLines(prev => prev.map(l => {
          if (selectedLineIds.has(l.id)) {
            const newPoints = l.points.map((val, i) => {
              // Even indices are X, odd are Y
              return i % 2 === 0 ? val + dx : val + dy;
            });
            return { ...l, points: newPoints };
          }
          return l;
        }));
      }

      // 3. Move Text
      if (selectedTextIds.size > 0) {
        setTextAnnotations(prev => prev.map(t => {
          if (selectedTextIds.has(t.id)) {
            return { ...t, x: t.x + dx, y: t.y + dy };
          }
          return t;
        }));
      }

      setLastPointerPos({ x, y });
      return;
    }

    if (!isDrawing) return;

    // A. MARQUEE SELECTION
    if (activeTool === 'select' && dragStart && marqueeRect) {
      const newX = Math.min(dragStart.x, x);
      const newY = Math.min(dragStart.y, y);
      const newWidth = Math.abs(x - dragStart.x);
      const newHeight = Math.abs(y - dragStart.y);
      setMarqueeRect({ x: newX, y: newY, width: newWidth, height: newHeight });
      return;
    }

    // B. ERASING
    if (activeTool === 'eraser') {
      performErase(x, y);
      return;
    }

    // B. DRAWING PEN
    if (activeTool === ToolType.PEN) {
      setLines(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        const newPoints = last.points.concat([x, y]);
        return [...prev.slice(0, -1), { ...last, points: newPoints }];
      });
    }
    // C. RESIZING PREVIEW SHAPE
    else if (dragStart && previewShape) {
      const width = x - dragStart.x;
      const height = y - dragStart.y;
      if (activeTool === ToolType.RECTANGLE) {
        setPreviewShape({
          ...previewShape,
          position: { x: width < 0 ? x : dragStart.x, y: height < 0 ? y : dragStart.y },
          width: Math.abs(width),
          height: Math.abs(height)
        } as RectangleShape);
      } else if (activeTool === ToolType.CIRCLE) {
        const radius = Math.sqrt(width ** 2 + height ** 2);
        setPreviewShape({ ...previewShape, radius } as CircleShape);
      }
    }
  };

  const handlePointerUp = () => {
    // 1. History & Logic for Eraser (MUST BE BEFORE EARLY RETURNS)
    // Task 4.5.3 Partial Eraser Logic: Detect Changes
    if (activeTool === 'eraser' && initialEraserLines) {
      const deletedLines = initialEraserLines.filter(initL => !linesRef.current.some(currL => currL.id === initL.id));
      const addedLines = linesRef.current.filter(currL => !initialEraserLines.some(initL => initL.id === currL.id));

      const actions: Action[] = [];

      // Detect Splits (Update) vs Full Deletion
      deletedLines.forEach(deletedL => {
        // Find fragments derived from this line
        // Fragments will have IDs like `originalId-randomNum`
        // We match by checking if fragment ID starts with original ID + '-'
        const fragments = addedLines.filter(addedL => addedL.id.startsWith(deletedL.id + '-'));

        if (fragments.length > 0) {
          // This is a partial erase (Split) -> UPDATE
          console.log('[Eraser] Partial Erase (Update Path):', deletedL.id, '->', fragments.length, 'fragments');
          actions.push({
            type: 'UPDATE',
            objectType: 'line',
            id: deletedL.id,
            previousState: deletedL,
            newState: fragments,
            userId: 'local'
          });
          // Mark fragments as handled so we don't treat them as separate ADDs (though logic below for Added Lines relies on `addedLines` array)
          // But we don't process addedLines separately if we map them here.
          // Wait, we need to ensure we don't double-count them.
        } else {
          // Full Deletion -> DELETE
          const index = initialEraserLines?.findIndex(l => l.id === deletedL.id);
          console.log('[Eraser] Full Deletion:', deletedL.id, 'Index:', index);
          actions.push({
            type: 'DELETE',
            objectType: 'line',
            id: deletedL.id,
            previousState: deletedL,
            newState: null,
            userId: 'local',
            index: index !== -1 ? index : undefined
          });
        }
      });

      // NOTE: Any addedLines that are NOT fragments of deleted lines?
      // In eraser tool, user only erases. So added lines MUST be fragments.
      // So we don't need to process `addedLines` separately if we assume all added lines are fragments of suppressed lines.

      if (actions.length > 0) {
        console.log('[Eraser] Batch Action Count:', actions.length);
        addToHistory({ type: 'BATCH', userId: 'local', actions: actions });
      }
      setInitialEraserLines(null);
    }

    // Task 3.1: Handle Rotation End
    if (isRotating) {
      const affectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
      if (affectedShapes.length > 0) {
        console.log('[Broadcast] Rotation Update:', {
          type: 'rotate',
          shapes: affectedShapes.map(s => ({
            id: s.id,
            rotation: s.transform.rotation
          }))
        });
        // History for Rotation
        affectedShapes.forEach(s => {
          const initRotation = initialShapeRotations.get(s.id);
          if (initRotation !== undefined && initRotation !== s.transform.rotation) {
            const prevState = { ...s, transform: { ...s.transform, rotation: initRotation } };
            addToHistory({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prevState, newState: s, userId: 'local' });
          }
        });
      }
      setIsRotating(false);
      setRotationStartAngle(0);
      setInitialShapeRotations(new Map());
      return;
    }

    // Task 3: Broadcast properties (resize or drag)
    if (isResizing || isDraggingSelection) {
      // History for Resize
      if (isResizing && initialResizeState) {
        shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
          const prev = initialResizeState.shapes.get(s.id);
          if (prev) addToHistory({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prev, newState: s, userId: 'local' });
        });
        lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
          const prev = initialResizeState.lines.get(l.id);
          if (prev) addToHistory({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: prev, newState: l, userId: 'local' });
        });
        textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
          const prev = initialResizeState.texts.get(t.id);
          if (prev) addToHistory({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: prev, newState: t, userId: 'local' });
        });
      }

      // History for Drag
      if (isDraggingSelection && initialDragState) {
        shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
          const prev = initialDragState.shapes.get(s.id);
          // Only add if changed
          if (prev && (prev.position.x !== s.position.x || prev.position.y !== s.position.y)) {
            addToHistory({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prev, newState: s, userId: 'local' });
          }
        });
        lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
          const prev = initialDragState.lines.get(l.id);
          if (prev) addToHistory({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: prev, newState: l, userId: 'local' });
        });
        textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
          const prev = initialDragState.texts.get(t.id);
          if (prev && (prev.x !== t.x || prev.y !== t.y)) {
            addToHistory({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: prev, newState: t, userId: 'local' });
          }
        });
      }

      // Logic to prepare data for broadcast
      const affectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
      const affectedLines = lines.filter(l => selectedLineIds.has(l.id));
      const affectedText = textAnnotations.filter(t => selectedTextIds.has(t.id));

      if (affectedShapes.length > 0 || affectedLines.length > 0 || affectedText.length > 0) {
        console.log('[Broadcast] Object Update:', {
          type: isResizing ? 'resize' : 'move',
          shapes: affectedShapes.map(s => ({
            id: s.id,
            position: s.position,
            // rotation: s.rotation, // Re-add when rotation is implemented
            ...(isRectangle(s) ? { width: (s as RectangleShape).width, height: (s as RectangleShape).height } : {}),
            ...(isCircle(s) ? { radius: (s as CircleShape).radius } : {})
          })),
          lines: affectedLines.map(l => ({ id: l.id, points: l.points })),
          texts: affectedText.map(t => ({ id: t.id, position: { x: t.x, y: t.y }, fontSize: t.fontSize }))
        });
        // In a real app: socket.emit('update-objects', { ... });
      }

      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        setInitialResizeState(null);
      }
      if (isDraggingSelection) {
        setIsDraggingSelection(false);
        setLastPointerPos(null);
        setInitialDragState(null);
      }
      return;
    }

    // Auto-switch to selection after erasing (unless locked)
    if (activeTool === 'eraser' && isDrawing && !isToolLocked) {
      setIsDrawing(false);
      setActiveTool('select');
      return; // THIS WAS PREVIOUSLY CAUSING THE BUG
    }

    setIsDrawing(false);

    // Handle marquee selection completion -- MOVED UP
    if (activeTool === 'select' && marqueeRect) {
      // Find all items that intersect with the marquee
      const selectedShapeIdsNew = new Set<string>();
      const selectedLineIdsNew = new Set<string>();
      const selectedTextIdsNew = new Set<string>();

      const marqueeBox = {
        minX: marqueeRect.x,
        minY: marqueeRect.y,
        maxX: marqueeRect.x + marqueeRect.width,
        maxY: marqueeRect.y + marqueeRect.height,
      };

      // Check shapes
      shapes.forEach(shape => {
        const shapeBbox = getShapeBoundingBox(shape);
        const intersects = !(
          shapeBbox.maxX < marqueeBox.minX ||
          shapeBbox.minX > marqueeBox.maxX ||
          shapeBbox.maxY < marqueeBox.minY ||
          shapeBbox.minY > marqueeBox.maxY
        );
        if (intersects) {
          selectedShapeIdsNew.add(shape.id);
        }
      });

      // Check lines (use bounding box of all points)
      lines.forEach(line => {
        if (line.points.length < 2) return;
        let lineMinX = Infinity, lineMinY = Infinity, lineMaxX = -Infinity, lineMaxY = -Infinity;
        for (let i = 0; i < line.points.length; i += 2) {
          const px = line.points[i];
          const py = line.points[i + 1];
          lineMinX = Math.min(lineMinX, px);
          lineMinY = Math.min(lineMinY, py);
          lineMaxX = Math.max(lineMaxX, px);
          lineMaxY = Math.max(lineMaxY, py);
        }
        const intersects = !(
          lineMaxX < marqueeBox.minX ||
          lineMinX > marqueeBox.maxX ||
          lineMaxY < marqueeBox.minY ||
          lineMinY > marqueeBox.maxY
        );
        if (intersects) {
          selectedLineIdsNew.add(line.id);
        }
      });

      // Check text
      textAnnotations.forEach(text => {
        const textWidth = text.text.length * (text.fontSize * 0.6);
        const textHeight = text.fontSize * 1.2;
        const intersects = !(
          text.x + textWidth < marqueeBox.minX ||
          text.x > marqueeBox.maxX ||
          text.y + textHeight < marqueeBox.minY ||
          text.y > marqueeBox.maxY
        );
        if (intersects) {
          selectedTextIdsNew.add(text.id);
        }
      });

      setSelectedShapeIds(selectedShapeIdsNew);
      setSelectedLineIds(selectedLineIdsNew);
      setSelectedTextIds(selectedTextIdsNew);
      setMarqueeRect(null);
      setDragStart(null);
      setIsDrawing(false);
      return;
    }

    // Handle Shape Creation
    if (previewShape) {
      const isRect = isRectangle(previewShape) && (previewShape as RectangleShape).width > 5;
      const isCirc = isCircle(previewShape) && (previewShape as CircleShape).radius > 5;

      if (isRect || isCirc) {
        const newShape = previewShape;
        setShapes(prev => [...prev, newShape]); // Use functional update
        addToHistory({ type: 'ADD', objectType: 'shape', id: newShape.id, previousState: null, newState: newShape, userId: 'local' });

        // Auto-switch to selection tool after drawing (unless locked)
        if (!isToolLocked) {
          setActiveTool('select');
          setSelectedShapeIds(new Set([newShape.id]));
        } else {
          // If locked, we need to reset for next shape? actually dragStart handles it.
        }
      }
      setPreviewShape(null);
    }

    // Handle Pen Stroke
    // Use REF for lines to get latest state in closure
    if (activeTool === ToolType.PEN && linesRef.current.length > 0) {
      // Only add history if we actually drew something new (length changed or new id)
      // Since this runs ONCE per mouse up, we take the last line of the array
      const lastLine = linesRef.current[linesRef.current.length - 1];
      addToHistory({ type: 'ADD', objectType: 'line', id: lastLine.id, previousState: null, newState: lastLine, userId: 'local' });
    }

    setDragStart(null);
  };



  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen overflow-hidden bg-[#0B0C10] select-none ${isDraggingSelection || (activeTool === 'select' && isHoveringSelection)
        ? 'cursor-move'
        : activeTool === 'select'
          ? 'cursor-default'
          : 'cursor-crosshair'
        }`}
      onMouseMove={handlePointerMove}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onMouseLeave={() => setCursorPos(null)}
    >
      {/* Loading Overlay */}
      {isLoadingCanvas && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-[#0B0C10] text-[#66FCF1]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#1F2833] border-t-[#66FCF1] rounded-full animate-spin"></div>
            <p className="font-medium animate-pulse">Loading your masterpiece...</p>
          </div>
        </div>
      )}

      {/* LAYER 1: BACKGROUND */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(${GRID_DOT_COLOR} 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        isToolLocked={isToolLocked}
        onToolLockChange={setIsToolLocked}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        fontFamily={fontStyles.family}
        onFontFamilyChange={(f) => setFontStyles(p => ({ ...p, family: f }))}
        fontSize={fontStyles.size}
        onFontSizeChange={(s) => setFontStyles(p => ({ ...p, size: s }))}
        isBold={fontStyles.bold}
        onBoldChange={(b) => setFontStyles(p => ({ ...p, bold: b }))}
        isItalic={fontStyles.italic}
        onItalicChange={(i) => setFontStyles(p => ({ ...p, italic: i }))}
        isUnderline={fontStyles.underline}
        onUnderlineChange={(u) => setFontStyles(p => ({ ...p, underline: u }))}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}

        hasSelection={selectedShapeIds.size > 0 || selectedLineIds.size > 0 || selectedTextIds.size > 0}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}

        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={performUndo}
        onRedo={performRedo}
      />

      {/* Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-50 pointer-events-none">
        <div className={`bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium transition-opacity duration-300 flex items-center gap-2 ${isConnected ? 'opacity-100' : 'opacity-100'}`}>
          {isLoadingCanvas ? (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span>Loading...</span>
            </>
          ) : isConnected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span>Connected</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span>Offline (syncing later)</span>
            </>
          )}
        </div>
      </div>

      {/* LAYER 2: SVG SHAPES */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <SVGShapeRenderer
          shapes={previewShape ? [...shapes, previewShape] : shapes}
          width={dimensions.width}
          height={dimensions.height}
        />
      </div>

      {/* LAYER 2.3: MARQUEE SELECTION RECTANGLE */}
      {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
        <svg
          className="absolute inset-0 z-12 pointer-events-none"
          width={dimensions.width}
          height={dimensions.height}
        >
          <defs>
            <pattern id="marquee-pattern" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
            </pattern>
          </defs>
          {/* Marquee fill */}
          <rect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
            fill="#2dd4bf"
            fillOpacity={0.08}
          />
          {/* Marquee border */}
          <rect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
            fill="none"
            stroke="#2dd4bf"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        </svg>
      )}

      {/* LAYER 2.5: SELECTION BOUNDING BOX */}
      {selectionBoundingBox && activeTool === 'select' && (
        <svg
          className="absolute inset-0 z-15"
          width={dimensions.width}
          height={dimensions.height}
          style={{ pointerEvents: 'none' }}
        >
          <g transform={(selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0)
            ? `rotate(${shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.transform.rotation || 0}, ${selectionBoundingBox.centerX}, ${selectionBoundingBox.centerY})`
            : (selectedTextIds.size === 1 && selectedShapeIds.size === 0 && selectedLineIds.size === 0)
              ? `rotate(${textAnnotations.find(t => t.id === Array.from(selectedTextIds)[0])?.rotation || 0}, ${selectionBoundingBox.centerX}, ${selectionBoundingBox.centerY})`
              : undefined}>
            {/* SVG Definitions for filters */}
            <defs>
              {/* Drop shadow for handles */}
              <filter id="handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
              </filter>
              {/* Glow effect for bounding box */}
              <filter id="selection-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Main bounding box with glow */}
            <rect
              x={selectionBoundingBox.minX - 4}
              y={selectionBoundingBox.minY - 4}
              width={selectionBoundingBox.width + 8}
              height={selectionBoundingBox.height + 8}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={1.5}
              strokeDasharray="6,4"
              rx={2}
              filter="url(#selection-glow)"
              opacity={0.8}
            />

            {/* Corner handles with shadows and cursor hints */}
            {[
              { x: selectionBoundingBox.minX, y: selectionBoundingBox.minY, cursor: 'nwse-resize', id: 'nw' }, // Top-left
              { x: selectionBoundingBox.maxX, y: selectionBoundingBox.minY, cursor: 'nesw-resize', id: 'ne' }, // Top-right
              { x: selectionBoundingBox.maxX, y: selectionBoundingBox.maxY, cursor: 'nwse-resize', id: 'se' }, // Bottom-right
              { x: selectionBoundingBox.minX, y: selectionBoundingBox.maxY, cursor: 'nesw-resize', id: 'sw' }, // Bottom-left
            ].map((corner, i) => (
              <g key={`corner-${i}`} data-resize-handle={corner.id} style={{ pointerEvents: 'auto', cursor: corner.cursor }}>
                {/* Larger invisible hit area */}
                <rect
                  x={corner.x - 8}
                  y={corner.y - 8}
                  width={16}
                  height={16}
                  fill="transparent"
                />
                {/* Visible handle */}
                <rect
                  x={corner.x - 5}
                  y={corner.y - 5}
                  width={10}
                  height={10}
                  fill="#0f1419"
                  stroke="#2dd4bf"
                  strokeWidth={1.5}
                  rx={2}
                  filter="url(#handle-shadow)"
                />
                {/* Inner dot */}
                <circle
                  cx={corner.x}
                  cy={corner.y}
                  r={2}
                  fill="#2dd4bf"
                />
              </g>
            ))}

            {/* Midpoint handles with shadows */}
            {[
              { x: selectionBoundingBox.centerX, y: selectionBoundingBox.minY, cursor: 'ns-resize', id: 'n' }, // Top-center
              { x: selectionBoundingBox.maxX, y: selectionBoundingBox.centerY, cursor: 'ew-resize', id: 'e' }, // Right-center
              { x: selectionBoundingBox.centerX, y: selectionBoundingBox.maxY, cursor: 'ns-resize', id: 's' }, // Bottom-center
              { x: selectionBoundingBox.minX, y: selectionBoundingBox.centerY, cursor: 'ew-resize', id: 'w' }, // Left-center
            ].map((mid, i) => (
              <g key={`mid-${i}`} data-resize-handle={mid.id} style={{ pointerEvents: 'auto', cursor: mid.cursor }}>
                {/* Larger invisible hit area */}
                <rect
                  x={mid.x - 8}
                  y={mid.y - 8}
                  width={16}
                  height={16}
                  fill="transparent"
                />
                {/* Visible handle */}
                <rect
                  x={mid.x - 5}
                  y={mid.y - 5}
                  width={10}
                  height={10}
                  fill="#0f1419"
                  stroke="#2dd4bf"
                  strokeWidth={1.5}
                  rx={2}
                  filter="url(#handle-shadow)"
                />
              </g>
            ))}

            {/* Task 4.3: Rotation Handle */}
            {selectedTextIds.size === 0 && selectedLineIds.size === 0 && (
              <g data-rotation-handle="true" style={{ pointerEvents: 'auto', cursor: 'grab' }}>
                {/* Stalk line connecting to selection box */}
                <line
                  x1={selectionBoundingBox.centerX}
                  y1={selectionBoundingBox.minY - 4}
                  x2={selectionBoundingBox.centerX}
                  y2={selectionBoundingBox.minY - 28}
                  stroke="#2dd4bf"
                  strokeWidth={1.5}
                  strokeDasharray="3,2"
                />
                {/* Rotation handle circle */}
                <circle
                  cx={selectionBoundingBox.centerX}
                  cy={selectionBoundingBox.minY - 32}
                  r={10}
                  fill="#0f1419"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  filter="url(#handle-shadow)"
                />
                {/* Rotation icon (curved arrow) */}
                <path
                  d={`M ${selectionBoundingBox.centerX - 4} ${selectionBoundingBox.minY - 35}
                     a 4 4 0 1 1 8 0`}
                  stroke="#2dd4bf"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={`M ${selectionBoundingBox.centerX + 4} ${selectionBoundingBox.minY - 35}
                     l 2 -2 l 0 4 z`}
                  fill="#2dd4bf"
                />
              </g>
            )}


          </g>
        </svg>
      )}

      {/* LAYER 3: KONVA (Drawings) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ pointerEvents: 'none' }}
        >
          <Layer>
            {lines.map((line) => (
              <Line
                key={line.id}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* LAYER 4: TEXT */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {textAnnotations.map((t) => (
          <div
            key={t.id}
            style={{
              position: 'absolute',
              left: t.x,
              top: t.y,
              color: t.color,
              fontSize: t.fontSize,
              fontFamily: t.fontFamily,
              fontWeight: t.fontWeight,
              fontStyle: t.fontStyle,
              textDecoration: t.textDecoration,
              transform: `rotate(${t.rotation || 0}deg)`,
              transformOrigin: 'top left', // Or handle properly with offset
            }}
            className="whitespace-pre p-1 select-none origin-top-left"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* LAYER 5: UI OVERLAYS */}
      {activeTextInput && (
        <FloatingInput
          x={activeTextInput.x}
          y={activeTextInput.y}
          value={textInputValue}
          onChange={setTextInputValue}
          style={{ ...fontStyles, color: strokeColor }}
          onSubmit={commitText}
        />
      )}

      {activeTool === 'eraser' && cursorPos && (
        <div
          className="absolute z-[100] rounded-full border border-white bg-white/20 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.2)]"
          style={{
            width: eraserSize,
            height: eraserSize,
            left: cursorPos.x - eraserSize / 2,
            top: cursorPos.y - eraserSize / 2,
          }}
        />
      )}

      {/* Export Tools Overlay */}
      <ExportTools
        stageRef={stageRef}
        lines={lines}
        shapes={shapes}
        textAnnotations={textAnnotations}
        onClear={clearAll}
      />
    </div>
  );
}
