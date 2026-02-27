import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Stage, Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import DOMPurify from 'dompurify';
import { Trash2, Lock, Unlock } from 'lucide-react';
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
  getTransformedBoundingBox,
  getCombinedBoundingBox,
  isPointInBoundingBox,
  BoundingBox,
} from '../../utils/boundingBox';
import ExportTools from '../ExportTools/ExportTools';
import Konva from 'konva';
import { useSync } from '../../services/useSync';
import { StrokeLine } from '../../services/sync.service';

// -- Extracted modules --
import { TextAnnotation, Action } from './types';
import {
  distSq,
  eraseAtPosition,
  removeStrokesAt,
  isPointInShape,
  moveForward,
  moveBackward,
  getFontFamilyWithFallback,
  getBrushProperties,
  getStrokeDashArray,
} from './utils';
import FloatingInput from './components/FloatingInput';
import SelectionOverlay from './components/SelectionOverlay';
import EraserCursor from './components/EraserCursor';
import { GridConfig, DEFAULT_GRID_CONFIG } from '../../types/grid';
import GridRenderer from './GridRenderer';
import MiniMap from './components/MiniMap';
import RecenterButton from './components/RecenterButton';
import { UsernameModal } from './components/UsernameModal';
import PresenceBadge from './components/PresenceBadge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSelectionBounds } from './hooks/useSelectionBounds';

// hardcoded sync endpoint. needs env var override for prod.
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

import { useAuth } from '../../contexts';
import { SessionInfo, toggleSessionLock } from '../../services/session.service';

// magical constants.
const GRID_DOT_COLOR = '#45A29E';
const DEFAULT_STROKE_COLOR = '#66FCF1';

// Monolithic whiteboard component. needs splitting up.
export default function Whiteboard({
  initialLocked = false,
  sessionInfo
}: {
  initialLocked?: boolean;
  sessionInfo?: SessionInfo | null;
}) {
  const { id: boardId } = useParams<{ id: string }>();
  const roomId = boardId || 'default-room';

  const { user } = useAuth();

  // Checking local storage fallback due to missing backend session ownership logic
  const ownedBoards = (() => {
    try { return JSON.parse(localStorage.getItem('novasketch_owned_boards') || '[]'); }
    catch { return []; }
  })();
  const isOwner = (user?.id === sessionInfo?.createdBy) || ownedBoards.includes(roomId);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Task 1.3.1-B: Track username — null means modal is shown
  const [userName, setUserName] = useState<string | null>(
    () => localStorage.getItem('novasketch_userName')
  );

  // Task 1.3.3-A: Assign a persistent unique color to this user/browser instance
  const [userColor] = useState<string>(() => {
    const saved = localStorage.getItem('novasketch_userColor');
    if (saved) return saved;
    // Pick a distinct color from a curated neon palette
    const PALETTE = [
      '#FF3366', '#FF9933', '#FFCC00', '#33FF99',
      '#33CCFF', '#CC33FF', '#FF00CC', '#00FFFF',
    ];
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    localStorage.setItem('novasketch_userColor', color);
    return color;
  });

  // Task 1.3.3-A: Compose the user metadata object (name + color)
  const userMetadata = useMemo(() => ({
    name: userName ?? 'Anonymous',
    color: userColor,
  }), [userName, userColor]);


  // syncing everything with yjs.
  // this hook does all the heavy lifting for real-time collab.
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
    canvasBackgroundColor,
    setCanvasBackgroundColor,
    users,
    updateUserMetadata,
    isLocked,
    setIsLocked,
    setSessionLocked,
  } = useSync({ roomId, wsUrl: WS_URL, initialLocked });

  // Task 1.5 fix: Owner should NEVER be locked. Only guests see the lock.
  const isEffectivelyLocked = isLocked && !isOwner;

  // Task 1.3.3-B: Broadcast our identity to collaborators as soon as we connect
  useEffect(() => {
    if (isConnected && userName) {
      updateUserMetadata(userMetadata);
    }
  }, [isConnected, userName, userMetadata, updateUserMetadata]);

  // local ref to avoid staleness in event handlers.
  // local ref to avoid staleness in event handlers.

  // 🔍 TEMP: Remove after verifying Task 1.3.3-B
  useEffect(() => {
    console.log('[AWARENESS] Connected users in room:', users);
  }, [users]);
  const linesRef = useRef(lines);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  // Utilizing a ref for current stroke data to bypass React's render cycle for performance.
  // This helps maintain 60fps responsiveness during rapid drawing actions.
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

  // yjs handles history internally via UndoManager.
  // keeping this no-op signature to avoid breaking legacy calls scattered in event handlers.
  // TODO: refactor all callsites to use syncService directly and remove this shim.
  const addToHistory = useCallback((_action: Action) => {
    // no-op.
  }, []);

  // -- 2. INTERACTION STATE --
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  // Grid Config (Task 5.5)
  const [gridConfig, setGridConfig] = useState<GridConfig>(DEFAULT_GRID_CONFIG);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [snapPointIndicators, setSnapPointIndicators] = useState<{ x: number; y: number }[]>([]);

  // Initialize tool state
  const [activeTool, setActiveTool] = useState<ActiveTool>('select'); // Default to select

  // Task 1.5.2: If the session locks AND this user is a guest, fall back to Hand tool.
  useEffect(() => {
    if (isEffectivelyLocked) {
      setActiveTool(ToolType.HAND);
    }
  }, [isEffectivelyLocked]);

  const [activeColorMode, setActiveColorMode] = useState<'stroke' | 'fill'>('stroke'); // 'stroke' or 'fill'
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
  // Task 4.3: Store initial positions for group rotation
  const [initialShapePositions, setInitialShapePositions] = useState<Map<string, Position>>(new Map());
  const [initialShapePoints, setInitialShapePoints] = useState<Map<string, Position[]>>(new Map()); // For lines/tris
  const [selectionCenter, setSelectionCenter] = useState<Position | null>(null);
  const [initialSelectionBoundingBox, setInitialSelectionBoundingBox] = useState<BoundingBox | null>(null);
  const [currentGroupRotation, setCurrentGroupRotation] = useState<number>(0);
  const [selectionRotation, setSelectionRotation] = useState<number>(0);

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
  // selectionBoundingBox computed by useSelectionBounds hook
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Reset selection rotation when selection changes
  useEffect(() => {
    setSelectionRotation(0);
  }, [selectedShapeIds, selectedLineIds, selectedTextIds]);

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
  // const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#0B0C10'); // Managed by useSync now

  const [fontStyles, setFontStyles] = useState({
    family: 'Arial', // Default to Arial (system font)
    size: 18, // Default to M preset
    bold: false,
    italic: false,

    underline: false,
    textAlign: 'left' as 'left' | 'center' | 'right'
  });


  const [isStageDragging, setIsStageDragging] = useState(false);

  // Task 5.4.2 + 5.4.3: Animate Viewport Offset back to (0,0) and Zoom to 100%
  const recenterAnimRef = useRef<number | null>(null);

  const handleRecenter = useCallback(() => {
    // Cancel any in-flight recenter animation
    if (recenterAnimRef.current !== null) {
      cancelAnimationFrame(recenterAnimRef.current);
      recenterAnimRef.current = null;
    }

    const DURATION = 400; // ms
    const startX = stagePos.x;
    const startY = stagePos.y;
    const startScale = stageScale;
    const startTime = performance.now();

    // easeOutCubic for a natural deceleration feel
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = ease(progress);

      // Animate pan back to origin
      setStagePos({
        x: startX + (0 - startX) * eased,
        y: startY + (0 - startY) * eased,
      });

      // Task 5.4.3: Animate zoom back to 100%
      setStageScale(startScale + (1 - startScale) * eased);

      if (progress < 1) {
        recenterAnimRef.current = requestAnimationFrame(animate);
      } else {
        recenterAnimRef.current = null;
      }
    };

    recenterAnimRef.current = requestAnimationFrame(animate);
  }, [stagePos, stageScale]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent browser back/forward navigation via two-finger horizontal swipe.
  // Must use native listener with passive:false as React's onWheel can't call preventDefault.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventNavGesture = (e: WheelEvent) => {
      // Block browser zoom (Ctrl+Scroll / pinch) and horizontal swipe navigation
      if (e.ctrlKey || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', preventNavGesture, { passive: false });
    return () => el.removeEventListener('wheel', preventNavGesture);
  }, []);

  // Spacebar Panning Mode Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !activeTextInput) {
        setIsPanning(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsPanning(false);
        setIsStageDragging(false); // Stop dragging if space released
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTextInput]);

  // NOTE: Canvas loading and saving is now handled automatically by the SyncService
  // via Yjs + WebSocket (for MongoDB persistence) and IndexedDB (for offline support)


  // Keyboard shortcuts extracted to hook
  useKeyboardShortcuts({
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
    isLocked: isEffectivelyLocked,
  });

  // Task 5.2: Keyboard Zoom Shortcuts (Ctrl+= / Ctrl+- / Ctrl+0)
  useEffect(() => {
    const handleZoomKeys = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      const MIN_SCALE = 0.1;
      const MAX_SCALE = 5;
      const ZOOM_STEP = 0.1;

      let newScale: number | null = null;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        newScale = Math.min(MAX_SCALE, stageScale + ZOOM_STEP);
      } else if (e.key === '-') {
        e.preventDefault();
        newScale = Math.max(MIN_SCALE, stageScale - ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        newScale = 1;
      }

      if (newScale !== null && newScale !== stageScale) {
        // Zoom toward screen center
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        const worldX = (centerX - stagePos.x) / stageScale;
        const worldY = (centerY - stagePos.y) / stageScale;
        setStagePos({
          x: centerX - worldX * newScale,
          y: centerY - worldY * newScale,
        });
        setStageScale(newScale);
      }
    };

    window.addEventListener('keydown', handleZoomKeys);
    return () => window.removeEventListener('keydown', handleZoomKeys);
  }, [stageScale, stagePos, dimensions]);

  // -- 4a. SNAP HELPERS --
  // Snaps a shape's geometry anchor to the nearest grid point.
  // For rects/triangles: snaps position (top-left).
  // For circles/ellipses: snaps center (position).
  // For lines/arrows: snaps both startPoint and endPoint.
  const snapShapeToGrid = useCallback((shape: Shape): Shape => {
    if (!gridConfig.snapEnabled || gridConfig.snapType === 'none') return shape;
    const size = gridConfig.size;
    const snapType = gridConfig.snapType;
    const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
    const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);
    const snapVal = (v: number) => Math.round(v / size) * size;
    const sx = (v: number) => canSnapX ? snapVal(v) : v;
    const sy = (v: number) => canSnapY ? snapVal(v) : v;

    if (isRectangle(shape)) {
      return { ...shape, position: { x: sx(shape.position.x), y: sy(shape.position.y) } };
    } else if (isCircle(shape)) {
      return { ...shape, position: { x: sx(shape.position.x), y: sy(shape.position.y) } };
    } else if (isEllipse(shape)) {
      return { ...shape, position: { x: sx(shape.position.x), y: sy(shape.position.y) } };
    } else if (isLine(shape)) {
      const ls = shape as LineShape;
      const snappedStart = { x: sx(ls.startPoint.x), y: sy(ls.startPoint.y) };
      const snappedEnd = { x: sx(ls.endPoint.x), y: sy(ls.endPoint.y) };
      return { ...shape, position: snappedStart, startPoint: snappedStart, endPoint: snappedEnd } as LineShape;
    } else if (isArrow(shape)) {
      const as_ = shape as ArrowShape;
      const snappedStart = { x: sx(as_.startPoint.x), y: sy(as_.startPoint.y) };
      const snappedEnd = { x: sx(as_.endPoint.x), y: sy(as_.endPoint.y) };
      return { ...shape, position: snappedStart, startPoint: snappedStart, endPoint: snappedEnd } as ArrowShape;
    } else if (isTriangle(shape)) {
      const ts = shape as TriangleShape;
      const dx = sx(ts.position.x) - ts.position.x;
      const dy = sy(ts.position.y) - ts.position.y;
      return {
        ...shape,
        position: { x: ts.position.x + dx, y: ts.position.y + dy },
        points: ts.points.map(p => ({ x: p.x + dx, y: p.y + dy })) as [Position, Position, Position],
      } as TriangleShape;
    }
    return shape;
  }, [gridConfig.snapEnabled, gridConfig.size, gridConfig.snapType]);

  // -- 4. HELPERS --
  const getPointerPos = (e: any) => {
    // robustly get client coordinates from various event types (React, Konva, Native)
    const nativeEvent = e.nativeEvent || e;
    const clientX = e.clientX ?? nativeEvent.clientX ?? e.evt?.clientX;
    const clientY = e.clientY ?? nativeEvent.clientY ?? e.evt?.clientY;

    if (containerRef.current && typeof clientX === 'number' && typeof clientY === 'number') {
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      // Convert Screen to Virtual: (Screen - Pan) / Scale
      return {
        x: (screenX - stagePos.x) / stageScale,
        y: (screenY - stagePos.y) / stageScale
      };
    }

    // Fallback should rarely handle active interactions
    return { x: 0, y: 0 };
  };

  // isPointInShape is imported from ./utils (eraserUtils)

  // Hit test for selection: find item (text, line, shape) at clicked point
  function findElementAtPoint(x: number, y: number): { id: string; type: 'shape' | 'line' | 'text' } | null {
    // 1. Text (Top Layer)
    for (let i = textAnnotations.length - 1; i >= 0; i--) {
      const t = textAnnotations[i];
      // simplified hit test: approximating width since we don't have canvas context measureText here.
      // 0.6 is a rough average aspect ratio (width/height) for most sans-serif fonts.
      // FIXME: this effectively assumes monospaced behavior, results will be sloppy for 'iiii' vs 'MMMM'.
      const w = t.text.length * (t.fontSize * 0.6);
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

    // 3. Shapes
    // Opting for a bounding box check here as it's significantly more performant (O(1)) 
    // than a precise point-in-polygon algorithm for hit testing.
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (isPointInBoundingBox({ x, y }, getShapeBoundingBox(s), 5)) {
        return { id: s.id, type: 'shape' };
      }
    }
    return null;
  }

  // Selection bounding box computed by hook
  const selectionBoundingBox = useSelectionBounds({
    selectedShapeIds,
    selectedLineIds,
    selectedTextIds,
    shapes,
    lines,
    textAnnotations,
  });

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
  // getBrushProperties and getStrokeDashArray are now imported from ./utils/brushUtils

  const performErase = (x: number, y: number) => {

    // 1. Lines
    // Vector erasure is computationally expensive as it requires splitting paths.
    // We detect intersection points and slice the line segments accordingly.
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
    // manipulating local state arrays.
    // layers are strictly separated by type currently (shapes, lines, texts).
    // TODO: implement unified display list to allow interleaving types (e.g. text behind a line).
    let newShapes = shapes;
    let newLines = lines;
    let newTexts = textAnnotations;

    if (selectedShapeIds.size > 0) newShapes = moveForward(shapes, selectedShapeIds);
    if (selectedLineIds.size > 0) newLines = moveForward(lines, selectedLineIds);
    if (selectedTextIds.size > 0) newTexts = moveForward(textAnnotations, selectedTextIds);

    // only update state if changes occurred to avoid needless re-renders.
    if (newShapes !== shapes) setShapes(newShapes);
    if (newLines !== lines) setLines(newLines);
    if (newTexts !== textAnnotations) setTextAnnotations(newTexts);

    // Task 3: Collaboration Broadcast
    // sending full ID list might be heavy if >1000 items. consider sending only moved indices later.
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
          // updating existing text node. simple map replace.
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
          // fresh text node creation.
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

          // auto-select the new text to allow immediate moving/resizing.
          // unless user locked the tool to 'text' mode for rapid entry.
          if (!isToolLocked) {
            setActiveTool('select');
            setSelectedTextIds(new Set([newTextId]));
          }
        }
      } else if (editingTextId) {
        // user cleared the input (empty string), interpret this as a delete intent.
        const textToDelete = textAnnotations.find(t => t.id === editingTextId);
        if (textToDelete) {
          setTextAnnotations(prev => prev.filter(t => t.id !== editingTextId));
          addToHistory({ type: 'DELETE', objectType: 'text', id: editingTextId, previousState: textToDelete, newState: null, userId: 'local' });
        }
      }
    }
    // cleanup temp state
    setActiveTextInput(null);
    setTextInputValue('');
    setEditingTextId(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Task 1.5.3: Block text editing when locked (guests only)
    if (isEffectivelyLocked) return;

    const { x, y } = getPointerPos(e);
    const clickedItem = findElementAtPoint(x, y);
    if (clickedItem && clickedItem.type === 'text') {
      const text = textAnnotations.find(t => t.id === clickedItem.id);
      if (text) {
        // hydrate the modal state with existing text props so they don't reset to defaults.
        setEditingTextId(text.id);
        setActiveTextInput({ x: text.x, y: text.y });
        setTextInputValue(text.text);

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

  const handleWheel = (e: React.WheelEvent | KonvaEventObject<WheelEvent>) => {
    const evt = (e as any).evt || e;
    evt.preventDefault();

    const dx = evt.deltaX;
    const dy = evt.deltaY;

    if (evt.ctrlKey) {
      // Task 5.2: Zoom toward cursor on Ctrl+Scroll / pinch
      const zoomSensitivity = 0.002;
      const minScale = 0.1;  // 10%
      const maxScale = 5;    // 500%

      // Calculate new scale — scroll up (negative deltaY) zooms in
      const scaleDelta = -dy * zoomSensitivity;
      const newScale = Math.min(maxScale, Math.max(minScale, stageScale + scaleDelta));

      // Get mouse position in screen space relative to container
      const rect = containerRef.current?.getBoundingClientRect();
      const mouseScreenX = (evt.clientX ?? 0) - (rect?.left ?? 0);
      const mouseScreenY = (evt.clientY ?? 0) - (rect?.top ?? 0);

      // Zoom toward cursor: keep the world point under the mouse fixed
      // worldPoint = (screenPoint - stagePos) / oldScale
      // After zoom: screenPoint = worldPoint * newScale + newStagePos
      // So: newStagePos = screenPoint - worldPoint * newScale
      const worldX = (mouseScreenX - stagePos.x) / stageScale;
      const worldY = (mouseScreenY - stagePos.y) / stageScale;
      const newPosX = mouseScreenX - worldX * newScale;
      const newPosY = mouseScreenY - worldY * newScale;

      setStageScale(newScale);
      setStagePos({ x: newPosX, y: newPosY });
      return;
    }

    // Panning
    if (evt.shiftKey && dy !== 0) {
      setStagePos(prev => ({ ...prev, x: prev.x - dy }));
    } else {
      setStagePos(prev => ({ x: prev.x - dx, y: prev.y - dy }));
    }
  };

  // this function handles all the clicking logic.
  // it's getting kinda big, maybe i should split it up later.
  // Core handler for pointer down events. 
  // currently manages multiple interaction modes; candidate for refactoring into smaller handlers.
  const handlePointerDown = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    // Task 1.3.1-B: Block canvas interactions until username is set
    if (!userName) return;

    // Check if clicking on UI (Toolbar)
    if ((e.target as HTMLElement).closest?.('[data-component="toolbar"]')) {
      if (activeTextInput) commitText();
      return;
    }

    // Panning / Hand Tool (Spacebar or explicit tool)
    if (isPanning || activeTool === ToolType.HAND) {
      const nativeEvent = (e as any).nativeEvent || (e as any).evt;
      const clientX = nativeEvent?.clientX ?? (e as any).clientX;
      const clientY = nativeEvent?.clientY ?? (e as any).clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        setIsStageDragging(true);
        setLastPointerPos({ x: clientX, y: clientY });
      }
      return;
    }

    // Task 1.5.3: Block ALL other interactions if locked (guests only)
    if (isEffectivelyLocked) return;

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

      const centerX = selectionBoundingBox.centerX;
      const centerY = selectionBoundingBox.centerY;
      setSelectionCenter({ x: centerX, y: centerY });

      const startAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      setRotationStartAngle(startAngle);

      // Store initial state for all selected items
      const initialRotations = new Map<string, number>();
      const initialPositions = new Map<string, Position>();
      const initialPoints = new Map<string, Position[]>();

      shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
        initialRotations.set(s.id, s.transform.rotation);
        initialPositions.set(s.id, { x: s.position.x, y: s.position.y });

        // Capture points for point-based shapes
        if (isTriangle(s)) {
          initialPoints.set(s.id, (s as TriangleShape).points);
        } else if (isLine(s) || isArrow(s)) {
          // Store start/end as an array of 2 points
          const ls = s as LineShape;
          initialPoints.set(s.id, [ls.startPoint, ls.endPoint]);
        }
      });

      // Lines need special handling for points
      lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
        // Convert flat array to Position[] for easier rotation math
        const pts: Position[] = [];
        for (let i = 0; i < l.points.length; i += 2) {
          pts.push({ x: l.points[i], y: l.points[i + 1] });
        }
        initialPoints.set(l.id, pts);
      });

      textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
        initialRotations.set(t.id, t.rotation || 0);
        initialPositions.set(t.id, { x: t.x, y: t.y });
      });

      setInitialShapeRotations(initialRotations);
      setInitialShapePositions(initialPositions);
      setInitialShapePoints(initialPoints);

      // Store initial bounding box for stable visual rotation
      if (selectionBoundingBox) {
        setInitialSelectionBoundingBox(selectionBoundingBox);
      }
      setCurrentGroupRotation(0);

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
      // If no shape clicked, change canvas background (Synced)
      if (!filled) {
        setCanvasBackgroundColor(fillColor);
        // Hint: addToHistory is handled by SyncService metadata tracking automatically
      }
      return;
    }

    // D. DRAWING/SHAPE TOOLS
    setIsDrawing(true);

    // Snap the starting point to grid for shape creation tools
    let startX = x;
    let startY = y;
    if (gridConfig.snapEnabled && gridConfig.snapType !== 'none' && activeTool !== ToolType.PEN && activeTool !== ToolType.HIGHLIGHTER) {
      const size = gridConfig.size;
      const snapType = gridConfig.snapType;
      const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
      const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);
      if (canSnapX) startX = Math.round(x / size) * size;
      if (canSnapY) startY = Math.round(y / size) * size;
    }
    setDragStart({ x: startX, y: startY });

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
      setPreviewShape(createRectangle(startX, startY, 0, 0, {
        cornerRadius,
        style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: fillColor !== 'transparent', strokeDashArray: dashArr }
      }));
    } else if (activeTool === ToolType.CIRCLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createCircle(startX, startY, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.ELLIPSE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createEllipse(startX, startY, 0, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.LINE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createLine(startX, startY, startX, startY, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: 'none', hasFill: false, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.ARROW) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createArrow(startX, startY, startX, startY, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: 'none', hasFill: false, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.TRIANGLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createTriangle(startX, startY, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    }
  };

  // Calculate Sub-Lines
  // This logic is complex. 'eraseAtPosition' splits lines.
  // Instead of recalculating here, we should rely on the state update inside 'performErase'.
  // But 'performErase' can call 'setLines'.
  // We need to capture the pointer move events.
  // Simpler: Just rely on 'eraseAtPosition' inside 'performErase' to update state, 
  // and PointerUp to diff.
  // Pointer Move Handler.
  // Logic here runs every frame during drag interactions. Optimized to minimize allocation and avoid lag.
  const handlePointerMove = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    // Panning Logic
    if (isStageDragging && lastPointerPos) {
      const nativeEvent = (e as any).nativeEvent || (e as any).evt;
      const clientX = nativeEvent?.clientX ?? (e as any).clientX;
      const clientY = nativeEvent?.clientY ?? (e as any).clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        const dx = clientX - lastPointerPos.x;
        const dy = clientY - lastPointerPos.y;
        setStagePos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastPointerPos({ x: clientX, y: clientY });
      }
      return;
    }

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
    if (isRotating && selectionCenter && initialShapeRotations.size > 0) {
      const { x: centerX, y: centerY } = selectionCenter;

      const currentAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      let deltaAngle = currentAngle - rotationStartAngle;

      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      if (nativeEvent?.shiftKey) {
        deltaAngle = Math.round(deltaAngle / 15) * 15;
      }

      setCurrentGroupRotation(deltaAngle); // Update visual rotation state

      const rad = (deltaAngle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Rotate Point Helper
      const rotatePoint = (px: number, py: number) => ({
        x: centerX + (px - centerX) * cos - (py - centerY) * sin,
        y: centerY + (px - centerX) * sin + (py - centerY) * cos
      });

      // Update all selected shapes
      setShapes(prev => prev.map(s => {
        if (!selectedShapeIds.has(s.id)) return s;

        const initPos = initialShapePositions.get(s.id);
        const initRot = initialShapeRotations.get(s.id) || 0;
        if (!initPos) return s;

        if (isRectangle(s) || isCircle(s) || isEllipse(s)) {
          // Rigid Body Rotation for Centered Shapes (Rect, Circle, Ellipse)

          // Calculate Initial Center/Pivot
          let itemCx = initPos.x;
          let itemCy = initPos.y;

          if (isRectangle(s)) {
            itemCx += (s as RectangleShape).width / 2;
            itemCy += (s as RectangleShape).height / 2;
          }

          // Rotate the pivot point around the selection center
          const newCenter = rotatePoint(itemCx, itemCy);
          const newRot = initRot + deltaAngle;

          // Convert back to Top-Left if necessary
          let newPos = { x: newCenter.x, y: newCenter.y };

          if (isRectangle(s)) {
            newPos.x -= (s as RectangleShape).width / 2;
            newPos.y -= (s as RectangleShape).height / 2;
          }

          return {
            ...s,
            position: newPos,
            transform: { ...s.transform, rotation: newRot }
          };
        } else if (isLine(s) || isArrow(s)) {
          // For Lines/Arrows, we rotate the Start and End points physically.
          // We DO NOT change the transform.rotation, as the geometry rotation covers the "group" rotation.
          // Existing local rotation (initRot) is preserved.

          const points = initialShapePoints.get(s.id);
          if (!points || points.length < 2) return s;

          const p1 = rotatePoint(points[0].x, points[0].y);
          const p2 = rotatePoint(points[1].x, points[1].y);

          return {
            ...s,
            // LineShape properties need casting or explicit update
            ...((isLine(s) ? {
              startPoint: p1,
              endPoint: p2
            } : {
              startPoint: p1,
              endPoint: p2
            }) as any),
            transform: { ...s.transform, rotation: initRot } // Keep initial local rotation! 
          };
        } else if (isTriangle(s)) {
          // For Triangles, rotate all points physically.
          const points = initialShapePoints.get(s.id);
          if (!points) return s;

          const newPoints = points.map(p => rotatePoint(p.x, p.y));

          return {
            ...s,
            points: newPoints,
            transform: { ...s.transform, rotation: initRot } // Keep initial local rotation
          } as TriangleShape;
        }

        // Fallback
        return s;
      }));

      // Update Lines (Freehand)
      if (selectedLineIds.size > 0) {
        setLines(prev => prev.map(l => {
          if (selectedLineIds.has(l.id)) {
            const initPts = initialShapePoints.get(l.id);
            if (!initPts) return l;

            const newPts: number[] = [];
            initPts.forEach(pt => {
              const newPt = rotatePoint(pt.x, pt.y);
              newPts.push(newPt.x, newPt.y);
            });
            return { ...l, points: newPts };
          }
          return l;
        }));
      }

      // Update all selected text
      setTextAnnotations(prev => prev.map(t => {
        if (selectedTextIds.has(t.id)) {
          const initPos = initialShapePositions.get(t.id);
          const initRot = initialShapeRotations.get(t.id) || 0;
          if (!initPos) return t;

          // Text rotates around top-left
          // To rotate group properly, we rotate the top-left anchor?
          // Or center?
          // Text is rendered: transform: rotate(). transform-origin: top left.
          // So we should rotate the Top-Left Postion around Selection, then rotate Text.

          const newPos = rotatePoint(initPos.x, initPos.y);
          return {
            ...t,
            x: newPos.x,
            y: newPos.y,
            rotation: initRot + deltaAngle
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
      // Note: This logic assumes axis-aligned bounding box (AABB).
      // If we support rotated resizing in future, this entire block needs a matrix rewrite.

      let targetX = x;
      let targetY = y;

      // Task 5.5.3: Resize Snapping (Polish)
      if (gridConfig.snapEnabled) {
        const size = gridConfig.size;
        const snapType = gridConfig.snapType || 'all';
        const threshold = 10 / stageScale;

        const snapX = Math.round(targetX / size) * size;
        const snapY = Math.round(targetY / size) * size;

        const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
        const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);

        let glX = null;
        let glY = null;

        if (canSnapX && Math.abs(targetX - snapX) < threshold) {
          targetX = snapX;
          glX = snapX;
        }
        if (canSnapY && Math.abs(targetY - snapY) < threshold) {
          targetY = snapY;
          glY = snapY;
        }

        // Only show guides if we actually snapped
        // But we need to filter based on handle?
        // E.g. pulling 'East' handle should only show Vertical guide (X).
        // Pulling 'South' should show Horizontal (Y).
        // It's fine to show both if we snapped both (corner).

        setSnapGuides({ x: glX, y: glY });
      }

      if (resizeHandle.includes('e')) newWidth = Math.max(10, targetX - box.x);
      if (resizeHandle.includes('w')) {
        const right = box.x + box.width;
        newWidth = Math.max(10, right - targetX);
        newX = right - newWidth;
      }
      if (resizeHandle.includes('s')) newHeight = Math.max(10, targetY - box.y);
      if (resizeHandle.includes('n')) {
        const bottom = box.y + box.height;
        newHeight = Math.max(10, bottom - targetY);
        newY = bottom - newHeight;
      }

      // Aspect Ratio Lock (Shift)
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      if (nativeEvent?.shiftKey && ['nw', 'ne', 'se', 'sw'].includes(resizeHandle)) {
        const ratio = box.width / box.height;

        // constraint solver: force height to obey width ratio.
        // simpler than checking dominant axis delta, covers 90% of use cases.
        if (resizeHandle === 'se' || resizeHandle === 'nw') {
          const projectedHeight = newWidth / ratio;

          // prevent shape from flipping or collapsing if user drags "past" the origin.
          if (newHeight < projectedHeight) {
            newHeight = projectedHeight;
            if (resizeHandle === 'nw') newY = (box.y + box.height) - newHeight;
          } else {
            newWidth = newHeight * ratio;
            if (resizeHandle === 'nw') newX = (box.x + box.width) - newWidth;
          }
        } else {
          // NE / SW handles.
          // math gets weird here because growing width usually means shrinking height visual.
          // stick to width-first constraint for consistency.
          newHeight = newWidth / ratio;

          // Adjust position anchor points.
          if (resizeHandle.includes('n')) {
            newY = (box.y + box.height) - newHeight;
          }
          // specific edge-case: dragging SW needs no X adjustment, but we might need Y.
          // kept logic minimal here to avoid jitter.
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
              return { ...s, position: { x: finalX, y: finalY }, width: (initS as RectangleShape).width * scaleX, height: (initS as RectangleShape).height * scaleY } as Shape;
            } else if (isCircle(initS)) {
              let scale = 1;
              if (['n', 's'].includes(resizeHandle)) scale = scaleY;
              else if (['e', 'w'].includes(resizeHandle)) scale = scaleX;
              else scale = Math.max(scaleX, scaleY);

              return { ...s, position: { x: finalX, y: finalY }, radius: (initS as CircleShape).radius * scale } as Shape;
            } else if (isLine(initS) || isArrow(initS)) {
              const ls = initS as LineShape;
              return {
                ...s,
                position: { x: finalX, y: finalY },
                startPoint: {
                  x: newX + (ls.startPoint.x - box.x) * scaleX,
                  y: newY + (ls.startPoint.y - box.y) * scaleY,
                },
                endPoint: {
                  x: newX + (ls.endPoint.x - box.x) * scaleX,
                  y: newY + (ls.endPoint.y - box.y) * scaleY,
                },
              } as Shape;
            } else if (isEllipse(initS)) {
              const es = initS as EllipseShape;
              // Proper Ellipse Resize
              const scaleX = newWidth / box.width;
              const scaleY = newHeight / box.height;

              return {
                ...s,
                position: { x: finalX, y: finalY },
                radiusX: es.radiusX * scaleX,
                radiusY: es.radiusY * scaleY
              } as Shape;
            } else if (isTriangle(initS)) {
              const ts = initS as TriangleShape;
              return {
                ...s,
                position: { x: finalX, y: finalY },
                points: ts.points.map((p: Position) => ({
                  x: newX + (p.x - box.x) * scaleX,
                  y: newY + (p.y - box.y) * scaleY,
                })),
              } as Shape;
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
      // standard delta calculation. using simple difference since last frame.
      // heavily relying on consistent pointer move event firing.
      // heavily relying on consistent pointer move event firing.
      let dx = x - lastPointerPos.x;
      let dy = y - lastPointerPos.y;

      // Task 5.5.2: Grid Snapping Logic (Magnetic Snapping)
      if (gridConfig.snapEnabled && selectionBoundingBox) {
        const size = gridConfig.size;
        const snapType = gridConfig.snapType || 'all';
        // User requested smoothness ("not smooth") AND alignment ("not in middle").
        // Solution: Magnetic Snap during drag (Smooth), Hard Snap on Release (Alignment).
        const threshold = 10 / stageScale;

        // Task 5.5.2 Refinement: Snap to Geometry Anchor (Center/Path) instead of Bounding Box (Stroke Edge)
        // This ensures the visual line passes THROUGH the grid dots.
        let anchorX = selectionBoundingBox.minX;
        let anchorY = selectionBoundingBox.minY;

        // Attempt to find a concrete geometry anchor from selection
        if (selectedShapeIds.size > 0) {
          const s = shapes.find(s => selectedShapeIds.has(s.id));
          if (s) {
            if (s.type === 'line' || s.type === 'arrow') {
              const ls = s as any; // Cast for access
              anchorX = ls.startPoint.x; anchorY = ls.startPoint.y;
            } else if (s.type === 'triangle') {
              const ts = s as any;
              anchorX = ts.points[0].x; anchorY = ts.points[0].y;
            } else {
              anchorX = s.position.x; anchorY = s.position.y;
            }
          }
        } else if (selectedTextIds.size > 0) {
          const t = textAnnotations.find(t => selectedTextIds.has(t.id));
          if (t) { anchorX = t.x; anchorY = t.y; }
        } else if (selectedLineIds.size > 0) {
          const l = lines.find(l => selectedLineIds.has(l.id));
          if (l && l.points.length >= 2) { anchorX = l.points[0]; anchorY = l.points[1]; }
        }

        const proposedX = anchorX + dx;
        const proposedY = anchorY + dy;

        const snapX = Math.round(proposedX / size) * size;
        const snapY = Math.round(proposedY / size) * size;

        const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
        const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);

        let activeGuideX = null;
        let activeGuideY = null;

        if (snapType === 'points') {
          // Points mode: snap to grid intersections (dots).
          // When EITHER axis is near a grid line, snap BOTH axes to the nearest dot.
          const nearX = Math.abs(proposedX - snapX) < threshold;
          const nearY = Math.abs(proposedY - snapY) < threshold;
          if (nearX || nearY) {
            dx = snapX - anchorX;
            dy = snapY - anchorY;
            activeGuideX = snapX;
            activeGuideY = snapY;
          }

          // Compute nearby grid points for "+" crosshair indicators
          const range = 3; // Show 3x3 grid of indicator points around anchor
          const pts: { x: number; y: number }[] = [];
          const centerGridX = Math.round(proposedX / size);
          const centerGridY = Math.round(proposedY / size);
          for (let gx = centerGridX - range; gx <= centerGridX + range; gx++) {
            for (let gy = centerGridY - range; gy <= centerGridY + range; gy++) {
              pts.push({ x: gx * size, y: gy * size });
            }
          }
          setSnapPointIndicators(pts);
        } else {
          // Lines / Horizontal / Vertical modes: snap each axis independently
          if (canSnapX && Math.abs(proposedX - snapX) < threshold) {
            dx = snapX - anchorX;
            activeGuideX = snapX;
          }
          if (canSnapY && Math.abs(proposedY - snapY) < threshold) {
            dy = snapY - anchorY;
            activeGuideY = snapY;
          }
          setSnapPointIndicators([]);
        }
        setSnapGuides({ x: activeGuideX, y: activeGuideY });
      } else {
        setSnapGuides({ x: null, y: null });
        setSnapPointIndicators([]);
      }

      // Task 4.2.2: Update object coordinates locally in real-time

      // 1. Move Shapes
      if (selectedShapeIds.size > 0) {
        setShapes(prev => prev.map(s => {
          if (selectedShapeIds.has(s.id)) {
            let updated = {
              ...s,
              position: { x: s.position.x + dx, y: s.position.y + dy }
            };
            // Lines and Arrows store geometry in startPoint/endPoint, not position
            // ugly polymorphic check, but better than normalizing the data structure right now.
            if (isLine(s) || isArrow(s)) {
              const ls = s as LineShape;
              updated = {
                ...updated,
                startPoint: { x: ls.startPoint.x + dx, y: ls.startPoint.y + dy },
                endPoint: { x: ls.endPoint.x + dx, y: ls.endPoint.y + dy },
              } as typeof updated;
            }
            // Triangles store geometry in points array
            if (isTriangle(s)) {
              const ts = s as TriangleShape;
              updated = {
                ...updated,
                points: ts.points.map((p: Position) => ({ x: p.x + dx, y: p.y + dy })),
              } as typeof updated;
            }
            return updated as Shape;
          }
          return s;
        }));
      }

      // 2. Move Lines (all points must shift)
      if (selectedLineIds.size > 0) {
        setLines(prev => prev.map(l => {
          if (selectedLineIds.has(l.id)) {
            const newPoints = l.points.map((val, i) => {
              // konva lines are flat arrays [x1, y1, x2, y2...].
              // moving every single point. expensive for complex paths, but necessary.
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
    // Task 5.1: Stop Panning when mouse released
    setIsStageDragging(false);
    if (!isDraggingSelection) {
      setLastPointerPos(null);
    }
    setSnapGuides({ x: null, y: null });
    setSnapPointIndicators([]);


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
        // broadcast final rotation angle only on mouseup.
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
          // prevent history spam if user clicked but didn't drag.
          if (initRotation !== undefined && initRotation !== s.transform.rotation) {
            const prevState = { ...s, transform: { ...s.transform, rotation: initRotation } };
            addToHistory({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prevState, newState: s, userId: 'local' });
          }
        });
      }
      setSelectionRotation(prev => prev + currentGroupRotation);
      setIsRotating(false);
      setRotationStartAngle(0);
      setInitialShapeRotations(new Map());
      setInitialSelectionBoundingBox(null);
      setCurrentGroupRotation(0);
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

        // Task 5.5.3 Optimization: Snap-On-Release (Polished UX)
        // If we ended the drag in a "Dead Zone" (Magnetic), strictly snap to grid now.
        let finalSnapDx = 0;
        let finalSnapDy = 0;

        if (gridConfig.snapEnabled) {
          const size = gridConfig.size;
          const snapType = gridConfig.snapType || 'all';

          // Find Anchor (Same logic as handlePointerMove)
          let anchorX = selectionBoundingBox?.minX || 0;
          let anchorY = selectionBoundingBox?.minY || 0;

          // Attempt to find a concrete geometry anchor from selection
          if (selectedShapeIds.size > 0) {
            const s = shapes.find(s => selectedShapeIds.has(s.id));
            if (s) {
              if (s.type === 'line' || s.type === 'arrow') { const ls = s as any; anchorX = ls.startPoint.x; anchorY = ls.startPoint.y; }
              else if (s.type === 'triangle') { const ts = s as any; anchorX = ts.points[0].x; anchorY = ts.points[0].y; }
              else { anchorX = s.position.x; anchorY = s.position.y; }
            }
          } else if (selectedTextIds.size > 0) {
            const t = textAnnotations.find(t => selectedTextIds.has(t.id));
            if (t) { anchorX = t.x; anchorY = t.y; }
          } else if (selectedLineIds.size > 0) {
            const l = lines.find(l => selectedLineIds.has(l.id));
            if (l && l.points.length >= 2) { anchorX = l.points[0]; anchorY = l.points[1]; }
          }

          const snapX = Math.round(anchorX / size) * size;
          const snapY = Math.round(anchorY / size) * size;

          const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
          const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);

          if (canSnapX) finalSnapDx = snapX - anchorX;
          if (canSnapY) finalSnapDy = snapY - anchorY;
        }

        // Apply Final Snap to State
        if (finalSnapDx !== 0 || finalSnapDy !== 0) {
          // Update Shapes
          if (selectedShapeIds.size > 0) {
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
                const base: any = { ...s, position: { x: s.position.x + finalSnapDx, y: s.position.y + finalSnapDy } };
                if (isLine(s) || isArrow(s)) {
                  const ls = s as LineShape;
                  base.startPoint = { x: ls.startPoint.x + finalSnapDx, y: ls.startPoint.y + finalSnapDy };
                  base.endPoint = { x: ls.endPoint.x + finalSnapDx, y: ls.endPoint.y + finalSnapDy };
                } else if (isTriangle(s)) {
                  const ts = s as TriangleShape;
                  base.points = ts.points.map((p: Position) => ({ x: p.x + finalSnapDx, y: p.y + finalSnapDy }));
                }
                return base as Shape;
              }
              return s;
            }));
          }
          if (selectedLineIds.size > 0) {
            setLines(prev => prev.map(l => {
              if (selectedLineIds.has(l.id)) {
                return { ...l, points: l.points.map((v, i) => v + (i % 2 === 0 ? finalSnapDx : finalSnapDy)) };
              }
              return l;
            }));
          }
          if (selectedTextIds.size > 0) {
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id)) return { ...t, x: t.x + finalSnapDx, y: t.y + finalSnapDy };
              return t;
            }));
          }
        }

        shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
          const prev = initialDragState.shapes.get(s.id);
          const finalS: any = { ...s };
          if (finalSnapDx !== 0 || finalSnapDy !== 0) {
            finalS.position = { x: s.position.x + finalSnapDx, y: s.position.y + finalSnapDy };
            if (isLine(s) || isArrow(s)) {
              const ls = s as LineShape;
              finalS.startPoint = { x: ls.startPoint.x + finalSnapDx, y: ls.startPoint.y + finalSnapDy };
              finalS.endPoint = { x: ls.endPoint.x + finalSnapDx, y: ls.endPoint.y + finalSnapDy };
            } else if (isTriangle(s)) {
              const ts = s as TriangleShape;
              finalS.points = ts.points.map((p: Position) => ({ x: p.x + finalSnapDx, y: p.y + finalSnapDy }));
            }
          }

          if (prev && (prev.position.x !== finalS.position.x || prev.position.y !== finalS.position.y)) {
            addToHistory({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prev, newState: finalS, userId: 'local' });
          }
        });

        lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
          const prev = initialDragState.lines.get(l.id);
          let finalL = { ...l };
          if (finalSnapDx !== 0 || finalSnapDy !== 0) {
            finalL = { ...finalL, points: l.points.map((v, i) => v + (i % 2 === 0 ? finalSnapDx : finalSnapDy)) };
          }
          if (prev) addToHistory({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: prev, newState: finalL, userId: 'local' });
        });

        textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
          const prev = initialDragState.texts.get(t.id);
          let finalT = { ...t };
          if (finalSnapDx !== 0 || finalSnapDy !== 0) {
            finalT = { ...finalT, x: t.x + finalSnapDx, y: t.y + finalSnapDy };
          }
          if (prev && (prev.x !== finalT.x || prev.y !== finalT.y)) {
            addToHistory({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: prev, newState: finalT, userId: 'local' });
          }
        });
      }

      // Logic to prepare data for broadcast
      const affectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
      const affectedLines = lines.filter(l => selectedLineIds.has(l.id));
      const affectedText = textAnnotations.filter(t => selectedTextIds.has(t.id));

      if (affectedShapes.length > 0 || affectedLines.length > 0 || affectedText.length > 0) {
        // deferred broadcast. we don't spam the socket on every mousemove.
        // wait until drag ends, then send final state.
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
        // Task 5.5: Snap shape to grid on creation
        const newShape = snapShapeToGrid(previewShape);
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



  // -- Task 5.1: Culling (Infinite Panning Optimization) --
  // Calculate visible viewport bounds in virtual coordinates
  const visibleBounds = useMemo(() => {
    // Add a buffer margin (e.g., 500px) to prevent pop-in during fast panning
    const buffer = 500;
    return {
      minX: (-stagePos.x - buffer) / stageScale,
      minY: (-stagePos.y - buffer) / stageScale,
      maxX: (dimensions.width - stagePos.x + buffer) / stageScale,
      maxY: (dimensions.height - stagePos.y + buffer) / stageScale,
    };
  }, [stagePos, stageScale, dimensions]);

  // Filter Shapes
  const visibleShapes = useMemo(() => {
    return shapes.filter(s => {
      // Use transformed bounding box to account for rotation
      const bbox = getTransformedBoundingBox(s);
      return !(bbox.maxX < visibleBounds.minX || bbox.minX > visibleBounds.maxX ||
        bbox.maxY < visibleBounds.minY || bbox.minY > visibleBounds.maxY);
    });
  }, [shapes, visibleBounds]);

  // Filter Lines (Performance: Cache bounding boxes if possible, but for now calculate on fly)
  // Optimization: Only cull if line count is high (>100), otherwise overhead of calc might outweigh render cost?
  // For now, consistent culling.
  const visibleLines = useMemo(() => {
    return lines.filter(l => {
      // Quick check: if line has no points, skip
      if (l.points.length < 2) return false;

      // Calculate bbox (simplified: just min/max of points)
      let minX = l.points[0], maxX = l.points[0], minY = l.points[1], maxY = l.points[1];
      for (let i = 2; i < l.points.length; i += 2) {
        const x = l.points[i];
        const y = l.points[i + 1];
        if (x < minX) minX = x; else if (x > maxX) maxX = x;
        if (y < minY) minY = y; else if (y > maxY) maxY = y;
      }

      // Add stroke width buffer
      const buf = (l.strokeWidth || 5) / 2;
      return !(maxX + buf < visibleBounds.minX || minX - buf > visibleBounds.maxX ||
        maxY + buf < visibleBounds.minY || minY - buf > visibleBounds.maxY);
    });
  }, [lines, visibleBounds]);

  // Filter Text
  const visibleTextAnnotations = useMemo(() => {
    return textAnnotations.filter(t => {
      // Approx bbox
      const w = t.text.length * (t.fontSize || 18) * 0.6;
      const h = (t.fontSize || 18) * 1.2;
      return !(t.x + w < visibleBounds.minX || t.x > visibleBounds.maxX ||
        t.y + h < visibleBounds.minY || t.y > visibleBounds.maxY);
    });
  }, [textAnnotations, visibleBounds]);


  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen overflow-hidden select-none ${isDraggingSelection || (activeTool === 'select' && isHoveringSelection) || isStageDragging || isPanning || activeTool === ToolType.HAND
        ? isPanning || isStageDragging || activeTool === ToolType.HAND ? 'cursor-grab active:cursor-grabbing' : 'cursor-move'
        : activeTool === 'select'
          ? 'cursor-default'
          : activeTool === ToolType.FILL_BUCKET
            ? 'cursor-pointer'
            : 'cursor-crosshair'
        }`}
      style={{
        backgroundColor: canvasBackgroundColor,
        touchAction: 'none',
        overscrollBehaviorX: 'none' as any,
      }}
      onMouseMove={handlePointerMove}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => setCursorPos(null)}
      onWheel={handleWheel}
    >
      {/* --- FIXED UI ELEMENTS (Outside Viewport) --- */}

      {/* Loading Overlay */}
      {isLoadingCanvas && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-[#0B0C10] text-[#66FCF1]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#1F2833] border-t-[#66FCF1] rounded-full animate-spin"></div>
            <p className="font-medium animate-pulse">Loading your masterpiece...</p>
          </div>
        </div>
      )}

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

      {/* Task 1.5.2: Read-Only Indicator & Lock Toggle */}
      <div className="fixed top-14 right-4 z-50 pointer-events-auto flex items-center gap-2">
        {isEffectivelyLocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5 backdrop-blur-md">
            <Lock size={12} className="animate-pulse" />
            Read-Only
          </div>
        )}
        {isOwner && (
          <button
            onClick={async () => {
              try {
                const newStatus = await toggleSessionLock(roomId, !isLocked);
                setIsLocked(newStatus);
                // Broadcast lock state change via Yjs for real-time sync to guests
                setSessionLocked(newStatus);
              } catch (e) {
                console.error("Failed to toggle lock", e);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-lg backdrop-blur-md border ${isLocked
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-[#1F2833]/80 text-[#66FCF1] border-[#66FCF1]/30 hover:bg-[#1F2833]'
              }`}
          >
            {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
            {isLocked ? 'Unlock Session' : 'Lock Session'}
          </button>
        )}
      </div>

      <Toolbar
        isSessionLocked={isEffectivelyLocked}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        isToolLocked={isToolLocked}
        onToolLockChange={setIsToolLocked}
        brushSize={brushSize}
        onBrushSizeChange={(s) => {
          setBrushSize(s);
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
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
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
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
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
          setFontStyles(p => ({ ...p, size: s }));
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
        gridConfig={gridConfig}
        onGridConfigChange={setGridConfig}
      />

      {/* --- CANVAS LAYERS --- */}

      {/* LAYER 1: BACKGROUND (Infinite Pan using backgroundPosition) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none select-none"
        style={{
          backgroundColor: canvasBackgroundColor || '#121212',
        }}
      />

      {/* LAYER 1.5: GRID (Separate Stage behind shapes) */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
        >
          <Layer>
            <GridRenderer
              config={gridConfig}
              width={dimensions.width}
              height={dimensions.height}
              stageScale={stageScale}
              stagePos={stagePos}
            />
          </Layer>
        </Stage>
      </div>

      {/* LAYER 2: SVG SHAPES (Fixed Container, Transformed Content) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <SVGShapeRenderer
          shapes={previewShape ? [...visibleShapes, previewShape] : visibleShapes}
          width={dimensions.width}
          height={dimensions.height}
          selectedShapeIds={selectedShapeIds}
          transform={{ x: stagePos.x, y: stagePos.y, scale: stageScale }}
        />
      </div>

      {/* LAYER 2.3: MARQUEE SELECTION RECTANGLE */}
      {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
        <svg
          className="absolute inset-0 z-25 pointer-events-none"
          width={dimensions.width}
          height={dimensions.height}
          style={{ overflow: 'visible' }}
        >
          <g transform={`translate(${stagePos.x}, ${stagePos.y}) scale(${stageScale})`}>
            <defs>
              <pattern id="marquee-pattern" patternUnits="userSpaceOnUse" width="8" height="8">
                <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
              </pattern>
            </defs>
            <rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="#2dd4bf"
              fillOpacity={0.08}
            />
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
          </g>
        </svg>
      )}

      {/* LAYER 2.5: SELECTION BOUNDING BOX */}
      {(selectionBoundingBox || (isRotating && initialSelectionBoundingBox)) && activeTool === 'select' && (
        <SelectionOverlay
          key={[...selectedShapeIds, ...selectedLineIds, ...selectedTextIds].join(',')}
          selectionBoundingBox={isRotating && initialSelectionBoundingBox ? initialSelectionBoundingBox : selectionBoundingBox!}
          dimensions={dimensions}
          rotation={
            isRotating
              ? (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0
                ? (initialShapeRotations.get(Array.from(selectedShapeIds)[0]) || 0) + currentGroupRotation
                : (selectedTextIds.size === 1 && selectedShapeIds.size === 0 && selectedLineIds.size === 0)
                  ? (initialShapeRotations.get(Array.from(selectedTextIds)[0]) || 0) + currentGroupRotation
                  : currentGroupRotation)
              : (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0)
                ? (shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.transform.rotation || 0)
                : (selectedTextIds.size === 1 && selectedShapeIds.size === 0 && selectedLineIds.size === 0)
                  ? (textAnnotations.find(t => t.id === Array.from(selectedTextIds)[0])?.rotation || 0)
                  : selectionRotation
          }
          showRotationHandle={true} // Always allow rotation because we support group rotation now!
          transform={{ x: stagePos.x, y: stagePos.y, scale: stageScale }}
        />
      )}

      {/* LAYER 3: KONVA (Drawings) - Native Konva Transform */}
      {/* LAYER 3: KONVA (Drawings) - Native Konva Transform */}
      <div className="absolute inset-0 z-20">
        <Stage
          ref={stageRef}
          data-testid="main-stage"
          width={dimensions.width}
          height={dimensions.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.evt.preventDefault()} // proper way to disable context menu in Konva
        >
          {/* Grid Layer (Behind everything) */}
          <Layer>
            {/* Render lines first so they are behind shapes if desired, or same layer */}
            {visibleLines.map((line) => (
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

          {/* LAYER 3.5: Alignment Guides (High Z-Index inside Stage) */}
          <Layer>
            {snapGuides.x !== null && (
              <Line
                points={[snapGuides.x, visibleBounds.minY, snapGuides.x, visibleBounds.maxY]}
                stroke="#0099ff"
                strokeWidth={1 / stageScale}
                dash={[4 / stageScale, 2 / stageScale]}
              />
            )}
            {snapGuides.y !== null && (
              <Line
                points={[visibleBounds.minX, snapGuides.y, visibleBounds.maxX, snapGuides.y]}
                stroke="#0099ff"
                strokeWidth={1 / stageScale}
                dash={[4 / stageScale, 2 / stageScale]}
              />
            )}
            {/* Points mode: "+" crosshair indicators at grid intersections */}
            {snapPointIndicators.map((pt, i) => {
              const crossSize = 6 / stageScale;
              return (
                <React.Fragment key={`snap-pt-${i}`}>
                  <Line
                    points={[pt.x - crossSize, pt.y, pt.x + crossSize, pt.y]}
                    stroke="#66FCF1"
                    strokeWidth={1.5 / stageScale}
                    opacity={0.8}
                  />
                  <Line
                    points={[pt.x, pt.y - crossSize, pt.x, pt.y + crossSize]}
                    stroke="#66FCF1"
                    strokeWidth={1.5 / stageScale}
                    opacity={0.8}
                  />
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* LAYER 4, 5: TEXT & HTML OVERLAYS (Transformed Container) */}
      <div
        className="absolute inset-0 z-30 pointer-events-none origin-top-left will-change-transform"
        style={{
          transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale})`,
          width: '100%',
          height: '100%'
        }}
      >
        {/* Texts */}
        {visibleTextAnnotations.map((t) => {
          if (editingTextId === t.id) return null;
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: t.x,
                top: t.y,
                color: t.color,
                fontSize: Math.max(1, t.fontSize || 18),
                fontFamily: getFontFamilyWithFallback(t.fontFamily),
                fontWeight: t.fontWeight,
                fontStyle: t.fontStyle,
                textDecoration: t.textDecoration,
                textAlign: t.textAlign || 'left',
                transform: `rotate(${t.rotation || 0}deg)`,
                transformOrigin: 'top left',
              }}
              className="whitespace-pre p-1 select-none origin-top-left"
            >
              {t.text}
            </div>
          );
        })}

        {/* Input */}
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

        {/* Eraser Cursor */}
        {activeTool === 'eraser' && cursorPos && (
          <EraserCursor cursorPos={cursorPos} eraserSize={eraserSize / stageScale} />
        )}
      </div>

      {/* Export Tools Overlay */}
      <ExportTools
        stageRef={stageRef}
        lines={lines}
        shapes={shapes}
        textAnnotations={textAnnotations}
        onClear={clearAll}
        backgroundColor={canvasBackgroundColor}
      />

      {/* Task 5.4.1: Recenter Button */}
      <RecenterButton onRecenter={handleRecenter} />

      {/* Task 5.3: Mini-Map */}
      <MiniMap
        shapes={shapes}
        lines={lines}
        textAnnotations={textAnnotations}
        stagePos={stagePos}
        stageScale={stageScale}
        dimensions={dimensions}
        onNavigate={(worldX, worldY) => {
          // Center the viewport on the clicked world position
          setStagePos({
            x: -(worldX * stageScale) + dimensions.width / 2,
            y: -(worldY * stageScale) + dimensions.height / 2,
          });
        }}
      />

      {/* Task 5.2.3: Zoom Percentage Indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 shadow-lg">
        <button
          onClick={() => {
            const newScale = Math.max(0.1, stageScale - 0.1);
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const worldX = (centerX - stagePos.x) / stageScale;
            const worldY = (centerY - stagePos.y) / stageScale;
            setStagePos({ x: centerX - worldX * newScale, y: centerY - worldY * newScale });
            setStageScale(newScale);
          }}
          className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-l-lg transition-colors text-sm font-medium"
          title="Zoom Out (Ctrl+-)"
        >
          −
        </button>
        <button
          onClick={() => {
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const worldX = (centerX - stagePos.x) / stageScale;
            const worldY = (centerY - stagePos.y) / stageScale;
            setStagePos({ x: centerX - worldX * 1, y: centerY - worldY * 1 });
            setStageScale(1);
          }}
          className="px-2 py-1.5 text-[#66FCF1] hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold min-w-[52px] text-center tabular-nums"
          title="Reset Zoom (Ctrl+0)"
        >
          {Math.round(stageScale * 100)}%
        </button>
        <button
          onClick={() => {
            const newScale = Math.min(5, stageScale + 0.1);
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const worldX = (centerX - stagePos.x) / stageScale;
            const worldY = (centerY - stagePos.y) / stageScale;
            setStagePos({ x: centerX - worldX * newScale, y: centerY - worldY * newScale });
            setStageScale(newScale);
          }}
          className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-r-lg transition-colors text-sm font-medium"
          title="Zoom In (Ctrl+=)"
        >
          +
        </button>
      </div>

      {/* Standalone Clear Canvas Button */}
      <button
        onClick={() => {
          if (confirm('Are you sure you want to clear the entire canvas? This action can be undone.')) {
            clearAll();
          }
        }}
        className="fixed bottom-4 left-4 bg-transparent border-2 border-red-500/60 text-red-400 p-2.5 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-900/20 hover:text-red-300 transition-all duration-300 z-50 flex items-center gap-2 text-xs font-medium"
        title="Clear Canvas"
      >
        <Trash2 size={16} />
        <span>Clear</span>
      </button>

      {/* Task 1.4.3-B: Presence Badge — top-right corner, shows live collaborators */}
      <PresenceBadge users={users} />

      {/* Task 1.3.1-B: Username Modal — blocks canvas until name is provided */}
      {!userName && (
        <UsernameModal
          onSubmit={(name) => {
            localStorage.setItem('novasketch_userName', name);
            setUserName(name);
          }}
        />
      )}
    </div>
  );
}
