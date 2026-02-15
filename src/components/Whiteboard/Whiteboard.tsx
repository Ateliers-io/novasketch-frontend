import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import DOMPurify from 'dompurify';
import Toolbar, { ActiveTool, EraserMode } from '../Toolbar/Toolbar';
import {
  ToolType,
  BrushType,
  StrokeStyle,
  Shape,
  ShapeType,
  createRectangle,
  createCircle,
  createEllipse,
  createLine,
  createArrow,
  createTriangle,
  isRectangle,
  isCircle,
  isEllipse,
  isLine,
  isArrow,
  isTriangle,
  RectangleShape,
  CircleShape,
  EllipseShape,
  LineShape,
  ArrowShape,
  TriangleShape,
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
import { StrokeLine } from '../../services/sync.service';

// hardcoded sync endpoint. needs env var override for prod.
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const ROOM_ID = 'default-room'; // TODO: derive from route params/auth context

// magical constants.
const GRID_DOT_COLOR = '#45A29E';
const DEFAULT_STROKE_COLOR = '#66FCF1';

// StrokeLine and TextAnnotation are imported from sync.service via useSync

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

  textAlign?: 'left' | 'center' | 'right';
  rotation?: number;
}

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

// collision detection for eraser. expensive but necessary.
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
        // generating unique ID for split segments to avoid react key collisions.
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

// z-index manipulation (bring forward). naive array swap.
function moveForward<T extends { id: string }>(items: T[], selectedIds: Set<string>): T[] {
  const newItems = [...items];
  for (let i = newItems.length - 2; i >= 0; i--) {
    if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i + 1].id)) {
      [newItems[i], newItems[i + 1]] = [newItems[i + 1], newItems[i]];
    }
  }
  return newItems;
}

// z-index manipulation (send backward).
function moveBackward<T extends { id: string }>(items: T[], selectedIds: Set<string>): T[] {
  const newItems = [...items];
  for (let i = 1; i < newItems.length; i++) {
    if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i - 1].id)) {
      [newItems[i], newItems[i - 1]] = [newItems[i - 1], newItems[i]];
    }
  }
  return newItems;
}

// Font family mapping with proper fallbacks (system fonts only)
function getFontFamilyWithFallback(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Arial': 'Arial, sans-serif',
    'Times New Roman': '"Times New Roman", serif',
    'Courier New': '"Courier New", monospace'
  };
  return fontMap[fontFamily] || 'Arial, sans-serif';
}

// --- HELPER COMPONENTS ---
const FloatingInput = ({ x, y, style, value, onChange, onSubmit }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // auto-focus on mount with slight delay to ensure DOM is ready
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
      onChange(''); // clear input
      onSubmit();   // close
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
      <div className="bg-[#1a2026]/95 backdrop-blur-md p-2 rounded-lg shadow-2xl border border-[#2d2d44] ring-1 ring-white/10">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type something..."
          className="block w-full h-full bg-transparent text-white outline-none resize-none overflow-hidden min-w-[200px] min-h-[50px] placeholder:text-gray-500"
          style={{
            fontSize: `${style.size || 18}px`,
            fontFamily: getFontFamilyWithFallback(style.family || 'Arial'),
            fontWeight: style.bold ? 'bold' : 'normal',
            fontStyle: style.italic ? 'italic' : 'normal',
            textDecoration: style.underline ? 'underline' : 'none',
            textAlign: style.textAlign || 'left',
            color: style.color,
          }}
        />
        <div className="text-[10px] text-gray-500 text-right px-1 pt-1 font-mono">Press Enter to save</div>
      </div>
    </div>
  );
};

// Monolithic whiteboard component. needs splitting up.
export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });


  // connecting to the hive mind (yjs + ws + idb).
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

  // local ref to avoid staleness in event handlers.
  // local ref to avoid staleness in event handlers.
  const linesRef = useRef(lines);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  // Current Stroke Ref for efficient drawing updates (bypassing stale state)
  const currentStrokeRef = useRef<{ id: string, points: number[] } | null>(null);

  // Snapshot for Eraser Diffing
  const [initialEraserLines, setInitialEraserLines] = useState<StrokeLine[] | null>(null);

  // legacy adaptors. hijacking state setters to route through yjs sync engine.
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

  // yjs handles history internally, but we keep this signature to avoid breaking old calls.
  const addToHistory = useCallback((_action: Action) => {
    // no-op.
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
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // -- 3. STYLE STATE --
  const [brushSize, setBrushSize] = useState(3);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState('transparent');
  const [cornerRadius, setCornerRadius] = useState(0); // For rounded corners
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [brushType, setBrushType] = useState<BrushType>(BrushType.BRUSH);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#0B0C10');

  const [fontStyles, setFontStyles] = useState({
    family: 'Arial', // Default to Arial (system font)
    size: 18, // Default to M preset
    bold: false,
    italic: false,

    underline: false,
    textAlign: 'left' as 'left' | 'center' | 'right'
  });






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

      // Tool shortcuts (only when not typing)
      if (!activeTextInput && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'g') setActiveTool(ToolType.FILL_BUCKET);
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
    if (isEllipse(shape)) {
      const s = shape as EllipseShape;
      const dx = (x - s.position.x) / (s.radiusX + radius);
      const dy = (y - s.position.y) / (s.radiusY + radius);
      return dx * dx + dy * dy <= 1;
    }
    if (isLine(shape) || isArrow(shape)) {
      const s = shape as LineShape;
      // Point-to-line-segment distance
      const dx = s.endPoint.x - s.startPoint.x;
      const dy = s.endPoint.y - s.startPoint.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.sqrt((s.startPoint.x - x) ** 2 + (s.startPoint.y - y) ** 2) <= radius + 5;
      let t = ((x - s.startPoint.x) * dx + (y - s.startPoint.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const closestX = s.startPoint.x + t * dx;
      const closestY = s.startPoint.y + t * dy;
      const dist = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
      return dist <= radius + s.style.strokeWidth / 2 + 5;
    }
    if (isTriangle(shape)) {
      const s = shape as TriangleShape;
      // Bounding box check
      const xs = s.points.map(p => p.x);
      const ys = s.points.map(p => p.y);
      const minX = Math.min(...xs) - radius;
      const maxX = Math.max(...xs) + radius;
      const minY = Math.min(...ys) - radius;
      const maxY = Math.max(...ys) + radius;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
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

  // Synchronize Toolbar with Text Selection
  useEffect(() => {
    if (selectedTextIds.size === 1) {
      const textId = Array.from(selectedTextIds)[0];
      const text = textAnnotations.find(t => t.id === textId);
      if (text) {
        setFontStyles(prev => ({
          ...prev,
          family: text.fontFamily,
          size: text.fontSize,
          bold: text.fontWeight === 'bold',
          italic: text.fontStyle === 'italic',
          underline: text.textDecoration === 'underline',
          textAlign: text.textAlign || 'left'
        }));
        setStrokeColor(text.color);
      }
    }
  }, [selectedTextIds, textAnnotations]);

  // Synchronize Toolbar with Shape Selection (Property Reflection)
  useEffect(() => {
    if (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0) {
      const shapeId = Array.from(selectedShapeIds)[0];
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        setStrokeColor(shape.style.stroke);
        setFillColor(shape.style.hasFill ? shape.style.fill : '#45A29E');
        setBrushSize(shape.style.strokeWidth);
      }
    }
  }, [selectedShapeIds, shapes, selectedTextIds, selectedLineIds]);

  // Synchronize Toolbar with Line Selection (Property Reflection)
  useEffect(() => {
    if (selectedLineIds.size === 1 && selectedShapeIds.size === 0 && selectedTextIds.size === 0) {
      const lineId = Array.from(selectedLineIds)[0];
      const line = lines.find(l => l.id === lineId);
      if (line) {
        setStrokeColor(line.color);
        setBrushSize(line.strokeWidth);
      }
    }
  }, [selectedLineIds, lines, selectedShapeIds, selectedTextIds]);
  // -- BRUSH PROPERTIES HELPER --
  function getBrushProperties(brush: BrushType, size: number, color: string): Partial<StrokeLine> {
    switch (brush) {
      case BrushType.BRUSH:
        return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 1, strokeWidth: size };
      case BrushType.CALLIGRAPHY:
        return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.5, opacity: 1, strokeWidth: size * 1.5 };
      case BrushType.CALLIGRAPHY_PEN:
        return { lineCap: 'square', lineJoin: 'bevel', tension: 0, opacity: 1, strokeWidth: size, globalCompositeOperation: 'source-over' };
      case BrushType.AIRBRUSH:
        return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.5, strokeWidth: size * 1.5, shadowBlur: 10, shadowColor: color };
      case BrushType.OIL_BRUSH:
        return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.9, strokeWidth: size * 1.2, shadowBlur: 2, shadowColor: color };
      case BrushType.CRAYON:
        return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.1, opacity: 0.8, strokeWidth: size, dash: [1, 2] };
      case BrushType.MARKER:
        return { lineCap: 'square', lineJoin: 'miter', tension: 0.2, opacity: 0.5, strokeWidth: size * 3, globalCompositeOperation: 'multiply' }; // Multiply ensures marker blending
      case BrushType.NATURAL_PENCIL:
        return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.8, strokeWidth: Math.max(1, size * 0.6), dash: [0.5, 0.5] }; // textured look
      case BrushType.WATERCOLOUR:
        return { lineCap: 'round', lineJoin: 'round', tension: 0.6, opacity: 0.3, strokeWidth: size * 2.5, shadowBlur: 5, shadowColor: color };
      default:
        return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 1, strokeWidth: size };
    }
  }

  function getStrokeDashArray(style: StrokeStyle, strokeWidth: number): number[] | undefined {
    switch (style) {
      case 'dashed': return [strokeWidth * 4, strokeWidth * 2];
      case 'dotted': return [strokeWidth, strokeWidth * 2];
      case 'solid': default: return undefined;
    }
  }

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

  // -- Delete Selected Items --
  const handleDeleteSelected = () => {
    const actions: Action[] = [];

    if (selectedShapeIds.size > 0) {
      shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
        actions.push({ type: 'DELETE', objectType: 'shape', id: s.id, previousState: s, newState: null, userId: 'local' });
      });
      setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)));
    }

    if (selectedLineIds.size > 0) {
      lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
        actions.push({ type: 'DELETE', objectType: 'line', id: l.id, previousState: l, newState: null, userId: 'local' });
      });
      setLines(prev => prev.filter(l => !selectedLineIds.has(l.id)));
    }

    if (selectedTextIds.size > 0) {
      textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
        actions.push({ type: 'DELETE', objectType: 'text', id: t.id, previousState: t, newState: null, userId: 'local' });
      });
      setTextAnnotations(prev => prev.filter(t => !selectedTextIds.has(t.id)));
    }

    if (actions.length > 0) {
      addToHistory({ type: 'BATCH', userId: 'local', actions });
    }

    setSelectedShapeIds(new Set());
    setSelectedLineIds(new Set());
    setSelectedTextIds(new Set());
  };

  // -- 5. ACTION HANDLERS --

  const commitText = () => {
    if (activeTextInput) {
      if (textInputValue.trim()) {
        if (editingTextId) {
          // Update existing text
          setTextAnnotations(prev => prev.map(t => {
            if (t.id === editingTextId) {
              const updatedT = {
                ...t,
                text: textInputValue,
                color: strokeColor,
                fontSize: fontStyles.size,
                fontFamily: fontStyles.family,
                fontWeight: fontStyles.bold ? 'bold' : 'normal',
                fontStyle: fontStyles.italic ? 'italic' : 'normal',
                textDecoration: fontStyles.underline ? 'underline' : 'none',
                textAlign: fontStyles.textAlign
              };
              addToHistory({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: updatedT, userId: 'local' });
              return updatedT;
            }
            return t;
          }));
        } else {
          // Create new text
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
            textAlign: fontStyles.textAlign,
            rotation: 0
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
          if (!isToolLocked) {
            setActiveTool('select');
            setSelectedTextIds(new Set([newTextId]));
          }
        }
      } else if (editingTextId) {
        // If empty string and editing, delete the text?
        // For now, let's keep it simple and just do nothing (restore old), unless explicitly deleting.
        // Or if user cleared it, they might want to delete.
        // Let's assume empty = delete for consistency with creation.
        const textToDelete = textAnnotations.find(t => t.id === editingTextId);
        if (textToDelete) {
          setTextAnnotations(prev => prev.filter(t => t.id !== editingTextId));
          addToHistory({ type: 'DELETE', objectType: 'text', id: editingTextId, previousState: textToDelete, newState: null, userId: 'local' });
        }
      }
    }
    setActiveTextInput(null);
    setTextInputValue('');
    setEditingTextId(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getPointerPos(e);
    const clickedItem = findElementAtPoint(x, y);
    if (clickedItem && clickedItem.type === 'text') {
      const text = textAnnotations.find(t => t.id === clickedItem.id);
      if (text) {
        setEditingTextId(text.id);
        setActiveTextInput({ x: text.x, y: text.y });
        setTextInputValue(text.text);
        // Sync styles to toolbar/input
        setFontStyles({
          family: text.fontFamily,
          size: text.fontSize,
          bold: text.fontWeight === 'bold',
          italic: text.fontStyle === 'italic',
          underline: text.textDecoration === 'underline',
          textAlign: text.textAlign || 'left' as 'left' | 'center' | 'right'
        });
        setStrokeColor(text.color);
      }
    }
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

      // Using robust coordinates relative to container
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

    // C. FILL BUCKET TOOL
    if (activeTool === ToolType.FILL_BUCKET) {
      // Check if clicking on a shape — fill it
      let filled = false;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (isPointInShape(shape, x, y, 5)) {
          const prevShape = shape;
          const newShape = { ...shape, style: { ...shape.style, fill: fillColor, hasFill: true } };
          setShapes(prev => prev.map(s => s.id === shape.id ? newShape : s));
          addToHistory({ type: 'UPDATE', objectType: 'shape', id: shape.id, previousState: prevShape, newState: newShape, userId: 'local' });
          filled = true;
          break;
        }
      }
      // If no shape clicked, change canvas background
      if (!filled) {
        setCanvasBackgroundColor(fillColor);
      }
      return;
    }

    // D. DRAWING/SHAPE TOOLS
    setIsDrawing(true);
    setDragStart({ x, y });

    if (activeTool === ToolType.PEN) {
      const brushProps = getBrushProperties(brushType, brushSize, strokeColor);
      const newLineId = `stroke-${Date.now()}`;
      const newPoints = [x, y];

      // Store in ref for immediate access in pointerMove
      currentStrokeRef.current = { id: newLineId, points: newPoints };

      // Use addLine which is more efficient than setLines full rewrite
      addLine({
        id: newLineId,
        points: newPoints,
        color: strokeColor,
        strokeWidth: brushSize,
        brushType: brushType,
        ...brushProps, // Apply all enhanced properties (shadows, opacity, etc.)
      });
    } else if (activeTool === ToolType.HIGHLIGHTER) {
      const highlighterColor = strokeColor + '66';
      const newLineId = `highlight-${Date.now()}`;
      const newPoints = [x, y];

      currentStrokeRef.current = { id: newLineId, points: newPoints };

      addLine({
        id: newLineId,
        points: newPoints,
        color: highlighterColor,
        strokeWidth: brushSize * 3,
        brushType: BrushType.MARKER,
        opacity: 0.5,
        lineCap: 'square',
        lineJoin: 'miter',
        tension: 0.4,
      });
    } else if (activeTool === ToolType.RECTANGLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createRectangle(x, y, 0, 0, {
        cornerRadius,
        style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: fillColor !== 'transparent', strokeDashArray: dashArr }
      }));
    } else if (activeTool === ToolType.CIRCLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createCircle(x, y, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.ELLIPSE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createEllipse(x, y, 0, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.LINE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createLine(x, y, x, y, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: 'none', hasFill: false, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.ARROW) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createArrow(x, y, x, y, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: 'none', hasFill: false, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.TRIANGLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createTriangle(x, y, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
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
              // Scale choice based on handle
              let scale = 1;
              if (['n', 's'].includes(resizeHandle)) scale = scaleY;
              else if (['e', 'w'].includes(resizeHandle)) scale = scaleX;
              else scale = Math.max(scaleX, scaleY);

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

            // Text Scaling:
            // If dragging width-only handles (e/w), use scaleX. 
            // If height-only (n/s) or corner, use scaleY (standard).
            let fontScale = scaleY;
            if (['e', 'w'].includes(resizeHandle)) fontScale = scaleX;

            const nFontSize = initT.fontSize * fontScale;
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

    // B. DRAWING PEN / HIGHLIGHTER
    if (activeTool === ToolType.PEN || activeTool === ToolType.HIGHLIGHTER) {
      if (currentStrokeRef.current) {
        const { id, points } = currentStrokeRef.current;
        // Efficiently append new point
        const newPoints = [...points, x, y];
        currentStrokeRef.current.points = newPoints;

        // Use syncUpdateLine to update only this line, not rewrite the whole array
        syncUpdateLine(id, { points: newPoints });
      }
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
      } else if (activeTool === ToolType.ELLIPSE) {
        const radiusX = Math.abs(width);
        const radiusY = Math.abs(height);
        setPreviewShape({
          ...previewShape,
          position: { x: dragStart.x, y: dragStart.y },
          radiusX,
          radiusY,
        } as EllipseShape);
      } else if (activeTool === ToolType.LINE) {
        setPreviewShape({
          ...previewShape,
          startPoint: { x: dragStart.x, y: dragStart.y },
          endPoint: { x, y },
        } as LineShape);
      } else if (activeTool === ToolType.ARROW) {
        setPreviewShape({
          ...previewShape,
          startPoint: { x: dragStart.x, y: dragStart.y },
          endPoint: { x, y },
        } as ArrowShape);
      } else if (activeTool === ToolType.TRIANGLE) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        const h = (Math.sqrt(3) / 2) * size;
        const baseX = width < 0 ? dragStart.x - size : dragStart.x;
        const baseY = height < 0 ? dragStart.y - h : dragStart.y;
        setPreviewShape({
          ...previewShape,
          position: { x: baseX, y: baseY },
          points: [
            { x: baseX + size / 2, y: baseY },
            { x: baseX + size, y: baseY + h },
            { x: baseX, y: baseY + h },
          ],
        } as TriangleShape);
      }
    }
  };

  const handlePointerUp = () => {
    // Reset drawing ref
    currentStrokeRef.current = null;

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
      let isValidShape = false;

      if (isRectangle(previewShape)) {
        isValidShape = (previewShape as RectangleShape).width > 5 && (previewShape as RectangleShape).height > 5;
      } else if (isCircle(previewShape)) {
        isValidShape = (previewShape as CircleShape).radius > 5;
      } else if (isEllipse(previewShape)) {
        isValidShape = (previewShape as EllipseShape).radiusX > 5 || (previewShape as EllipseShape).radiusY > 5;
      } else if (isLine(previewShape) || isArrow(previewShape)) {
        const s = previewShape as LineShape;
        const dist = Math.sqrt((s.endPoint.x - s.startPoint.x) ** 2 + (s.endPoint.y - s.startPoint.y) ** 2);
        isValidShape = dist > 5;
      } else if (isTriangle(previewShape)) {
        const s = previewShape as TriangleShape;
        const xs = s.points.map(p => p.x);
        const ys = s.points.map(p => p.y);
        isValidShape = (Math.max(...xs) - Math.min(...xs)) > 5 || (Math.max(...ys) - Math.min(...ys)) > 5;
      }

      if (isValidShape) {
        const newShape = previewShape;
        setShapes(prev => [...prev, newShape]);
        addToHistory({ type: 'ADD', objectType: 'shape', id: newShape.id, previousState: null, newState: newShape, userId: 'local' });

        // Auto-switch to selection tool after drawing (unless locked)
        if (!isToolLocked) {
          setActiveTool('select');
          setSelectedShapeIds(new Set([newShape.id]));
        }
      }
      setPreviewShape(null);
    }

    // Handle Pen/Highlighter Stroke
    if ((activeTool === ToolType.PEN || activeTool === ToolType.HIGHLIGHTER) && linesRef.current.length > 0) {
      const lastLine = linesRef.current[linesRef.current.length - 1];
      addToHistory({ type: 'ADD', objectType: 'line', id: lastLine.id, previousState: null, newState: lastLine, userId: 'local' });
    }

    setDragStart(null);
  };



  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen overflow-hidden select-none ${isDraggingSelection || (activeTool === 'select' && isHoveringSelection)
        ? 'cursor-move'
        : activeTool === 'select'
          ? 'cursor-default'
          : activeTool === ToolType.FILL_BUCKET
            ? 'cursor-pointer'
            : 'cursor-crosshair'
        }`}
      style={{ backgroundColor: canvasBackgroundColor }}
      onMouseMove={handlePointerMove}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
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
        onBrushSizeChange={(s) => {
          setBrushSize(s);
          // Live-edit selected shapes strokeWidth
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(sh => {
              if (selectedShapeIds.has(sh.id)) {
                const newS = { ...sh, style: { ...sh.style, strokeWidth: s } };
                updates.push({ type: 'UPDATE', objectType: 'shape', id: sh.id, previousState: sh, newState: newS, userId: 'local' });
                return newS;
              }
              return sh;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
          // Live-edit selected lines strokeWidth
          if (selectedLineIds.size > 0) {
            const updates: Action[] = [];
            setLines(prev => prev.map(l => {
              if (selectedLineIds.has(l.id)) {
                const newL = { ...l, strokeWidth: s };
                updates.push({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: l, newState: newL, userId: 'local' });
                return newL;
              }
              return l;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        strokeColor={strokeColor}
        onColorChange={(c) => {
          setStrokeColor(c);
          // Live-edit selected shapes
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
                const newS = { ...s, style: { ...s.style, stroke: c } };
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
          // Live-edit selected lines
          if (selectedLineIds.size > 0) {
            const updates: Action[] = [];
            setLines(prev => prev.map(l => {
              if (selectedLineIds.has(l.id)) {
                const newL = { ...l, color: c };
                updates.push({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: l, newState: newL, userId: 'local' });
                return newL;
              }
              return l;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
          // Live-edit selected text
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, color: c };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        fillColor={fillColor}
        onFillColorChange={(c) => {
          setFillColor(c);
          // Live-edit selected shapes fill
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
                // Update hasFill based on transparency
                const hasFill = c !== 'transparent';
                const newS = { ...s, style: { ...s.style, fill: c, hasFill } };
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        cornerRadius={cornerRadius}
        onCornerRadiusChange={(r) => {
          setCornerRadius(r);
          // Live-edit selected Rectangles
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              // Check type via type guard logic if strict, but simple check works
              if (selectedShapeIds.has(s.id) && s.type === 'rectangle') {
                const newS = { ...s, cornerRadius: r } as RectangleShape;
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        brushType={brushType}
        onBrushTypeChange={setBrushType}
        strokeStyle={strokeStyle}
        onStrokeStyleChange={setStrokeStyle}
        fontFamily={fontStyles.family}
        onFontFamilyChange={(f) => {
          setFontStyles(p => ({ ...p, family: f }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontFamily: f };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        fontSize={fontStyles.size}
        onFontSizeChange={(s) => {
          // Update font style state
          setFontStyles(p => ({ ...p, size: s }));

          // Update selected text objects (skip actively edited text)
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontSize: s };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isBold={fontStyles.bold}
        onBoldChange={(b) => {
          setFontStyles(p => ({ ...p, bold: b }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontWeight: b ? 'bold' : 'normal' };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isItalic={fontStyles.italic}
        onItalicChange={(i) => {
          setFontStyles(p => ({ ...p, italic: i }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontStyle: i ? 'italic' : 'normal' };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isUnderline={fontStyles.underline}
        onUnderlineChange={(u) => {
          setFontStyles(p => ({ ...p, underline: u }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, textDecoration: u ? 'underline' : 'none' };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        textAlign={fontStyles.textAlign}
        onTextAlignChange={(align) => {
          setFontStyles(p => ({ ...p, textAlign: align }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, textAlign: align };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isTextSelected={selectedTextIds.size > 0}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}

        hasSelection={selectedShapeIds.size > 0 || selectedLineIds.size > 0 || selectedTextIds.size > 0}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onDeleteSelected={handleDeleteSelected}

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
          selectedShapeIds={selectedShapeIds}
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
                tension={line.tension ?? 0.5}
                lineCap={line.lineCap ?? 'round'}
                lineJoin={line.lineJoin ?? 'round'}
                opacity={line.opacity ?? 1}
                dash={line.dash}
                globalCompositeOperation={line.globalCompositeOperation as any}
                shadowBlur={line.shadowBlur}
                shadowColor={line.shadowColor || line.color}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* LAYER 4: TEXT */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {textAnnotations.map((t) => {
          // Hide text being edited so it doesn't duplicate under the input
          if (editingTextId === t.id) return null;
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: t.x,
                top: t.y,
                color: t.color,
                // Ensure font size is never 0 or invalid to prevent disappearing
                fontSize: Math.max(1, t.fontSize || 18),
                fontFamily: getFontFamilyWithFallback(t.fontFamily),
                fontWeight: t.fontWeight,
                fontStyle: t.fontStyle,
                textDecoration: t.textDecoration,
                textAlign: t.textAlign || 'left',
                transform: `rotate(${t.rotation || 0}deg)`,
                transformOrigin: 'top left', // Or handle properly with offset
              }}
              className="whitespace-pre p-1 select-none origin-top-left"
            >
              {t.text}
            </div>
          );
        })}
      </div>



      {/* LAYER 5: UI OVERLAYS */}
      {activeTextInput && (
        <FloatingInput
          x={activeTextInput.x}
          y={activeTextInput.y}
          value={textInputValue}
          onChange={setTextInputValue}
          style={{ ...fontStyles, fontSize: fontStyles.size, color: strokeColor }}
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
    </div >
  );
}
