import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import DOMPurify from 'dompurify';
import { Trash2 } from 'lucide-react';
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSelectionBounds } from './hooks/useSelectionBounds';

// hardcoded sync endpoint. needs env var override for prod.
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
// Hardcoded room ID for local development. 
// TODO: Replace with dynamic routing parameter once the backend auth integration is finalized.
const ROOM_ID = 'default-room';

// magical constants.
const GRID_DOT_COLOR = '#45A29E';
const DEFAULT_STROKE_COLOR = '#66FCF1';

// Monolithic whiteboard component. needs splitting up.
export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });


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
  } = useSync({ roomId: ROOM_ID, wsUrl: WS_URL });

  // local ref to avoid staleness in event handlers.
  // local ref to avoid staleness in event handlers.
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
  // selectionBoundingBox computed by useSelectionBounds hook
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
  });

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

  // this function handles all the clicking logic.
  // it's getting kinda big, maybe i should split it up later.
  // Core handler for pointer down events. 
  // currently manages multiple interaction modes; candidate for refactoring into smaller handlers.
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
  // Pointer Move Handler.
  // Logic here runs every frame during drag interactions. Optimized to minimize allocation and avoid lag.
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
      // Note: This logic assumes axis-aligned bounding box (AABB).
      // If we support rotated resizing in future, this entire block needs a matrix rewrite.

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
      const dx = x - lastPointerPos.x;
      const dy = y - lastPointerPos.y;

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
          // live-edit selected items immediately.
          // iterating separately for shapes vs lines vs text to keep types safe.
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
            // batching history to avoid flooding the undo stack with one entry per shape.
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
          // text color update logic. simple prop swap.
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
          // only shapes support fill currently.
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
                // explicit hasFill flag needed for SVGs where fill="none" != fill="transparent".
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
        <SelectionOverlay
          selectionBoundingBox={selectionBoundingBox}
          dimensions={dimensions}
          rotation={
            (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0)
              ? (shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.transform.rotation || 0)
              : (selectedTextIds.size === 1 && selectedShapeIds.size === 0 && selectedLineIds.size === 0)
                ? (textAnnotations.find(t => t.id === Array.from(selectedTextIds)[0])?.rotation || 0)
                : undefined
          }
          showRotationHandle={selectedTextIds.size === 0 && selectedLineIds.size === 0}
        />
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
          // hide the text being edited to avoid the "ghosting" effect (duplicate text underneath the input).
          if (editingTextId === t.id) return null;
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: t.x,
                top: t.y,
                color: t.color,
                // safety check: 0px font makes element disappear and unselectable.
                fontSize: Math.max(1, t.fontSize || 18),
                fontFamily: getFontFamilyWithFallback(t.fontFamily),
                fontWeight: t.fontWeight,
                fontStyle: t.fontStyle,
                textDecoration: t.textDecoration,
                textAlign: t.textAlign || 'left',
                transform: `rotate(${t.rotation || 0}deg)`,
                transformOrigin: 'top left',
              }}
              // using HTML overlay instead of Konva Text for crisper rendering and better accessibility.
              // also simplifies the "contentEditable" illusion.
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
        <EraserCursor cursorPos={cursorPos} eraserSize={eraserSize} />
      )}

      {/* Export Tools Overlay */}
      <ExportTools
        stageRef={stageRef}
        lines={lines}
        shapes={shapes}
        textAnnotations={textAnnotations}
        onClear={clearAll}
        backgroundColor={canvasBackgroundColor}
      />

      {/* Standalone Clear Canvas Button */}
      <button
        onClick={() => {
          if (confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
            clearAll();
          }
        }}
        className="fixed bottom-4 left-4 bg-transparent border-2 border-red-500/60 text-red-400 p-2.5 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-900/20 hover:text-red-300 transition-all duration-300 z-50 flex items-center gap-2 text-xs font-medium"
        title="Clear Canvas"
      >
        <Trash2 size={16} />
        <span>Clear</span>
      </button>
    </div >
  );
}
