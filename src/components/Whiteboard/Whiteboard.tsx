import React, { useRef, useState, useEffect } from 'react';
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
        result.push({ ...stroke, id: `${stroke.id}-${segmentCount++}`, points: [...currentLinePoints] });
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
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // -- 1. CANVAS STATE --
  const [lines, setLines] = useState<StrokeLine[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);

  // -- 2. INTERACTION STATE --
  const [activeTool, setActiveTool] = useState<ActiveTool>('select'); // Default to select
  const [isDrawing, setIsDrawing] = useState(false);
  const [isToolLocked, setIsToolLocked] = useState(false); // Lock tool for multiple drawings

  // Shape Creation
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [previewShape, setPreviewShape] = useState<Shape | null>(null);

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
        // Don't delete if user is typing in text input
        if (activeTextInput) return;

        setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)));
        setLines(prev => prev.filter(l => !selectedLineIds.has(l.id)));
        setTextAnnotations(prev => prev.filter(t => !selectedTextIds.has(t.id)));
        setSelectedShapeIds(new Set());
        setSelectedLineIds(new Set());
        setSelectedTextIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shapes, lines, textAnnotations, selectedShapeIds, selectedLineIds, selectedTextIds, activeTextInput]);

  // -- 4. HELPERS --
  const getPointerPos = (e: any) => {
    const stage = e.target?.getStage?.();
    if (stage) {
      return stage.getPointerPosition() || { x: 0, y: 0 };
    }
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

  // Hit test for selection: find shape at clicked point
  function findShapeAtPoint(x: number, y: number): Shape | null {
    // Iterate in reverse (top-most shapes first based on array order)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      const bbox = getShapeBoundingBox(shape);
      if (isPointInBoundingBox({ x, y }, bbox, 5)) { // 5px tolerance
        return shape;
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
      setLines(lines => removeStrokesAt(x, y, lines, eraserSize));
    } else {
      setLines(lines => eraseAtPosition(x, y, lines, eraserSize));
    }

    // 2. Shapes
    setShapes(prev => prev.filter(s => !isPointInShape(s, x, y, eraserSize)));

    // 3. Text
    setTextAnnotations(prev => prev.filter(t => {
      // Approximate text hit (top-left anchor)
      const dx = t.x - x;
      const dy = t.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist > eraserSize + 20; // 20px buffer for text body
    }));
  };

  // -- 5. ACTION HANDLERS --

  const commitText = () => {
    if (activeTextInput && textInputValue.trim()) {
      const newTextId = `text-${Date.now()}`;
      setTextAnnotations(prev => [...prev, {
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
      }]);

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
    // If text input is open, commit it first (unless we are clicking ON the input, which is handled by stopPropagation)
    if (activeTextInput) {
      commitText();
      // Don't return, allow specific tool actions (like starting a new text elsewhere)
    }

    const { x, y } = getPointerPos(e);

    // A. SELECTION TOOL
    if (activeTool === 'select') {
      const clickedShape = findShapeAtPoint(x, y);
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      const isShiftClick = nativeEvent?.shiftKey || false;

      if (clickedShape) {
        if (isShiftClick) {
          // Multi-select: toggle selection
          setSelectedShapeIds(prev => {
            const next = new Set(prev);
            if (next.has(clickedShape.id)) {
              next.delete(clickedShape.id);
            } else {
              next.add(clickedShape.id);
            }
            return next;
          });
        } else {
          // Single select: replace selection (clear others)
          setSelectedShapeIds(new Set([clickedShape.id]));
          setSelectedLineIds(new Set());
          setSelectedTextIds(new Set());
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

    // B. TEXT TOOL
    if (activeTool === 'text') {
      // Start new text input
      setActiveTextInput({ x, y });
      setTextInputValue('');
      return;
    }

    // C. ERASER TOOL
    if (activeTool === 'eraser') {
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

  const handlePointerMove = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    const { x, y } = getPointerPos(e);
    setCursorPos({ x, y });

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
    // Auto-switch to selection after erasing (unless locked)
    if (activeTool === 'eraser' && isDrawing && !isToolLocked) {
      setIsDrawing(false);
      setActiveTool('select');
      return;
    }

    setIsDrawing(false);

    // Handle marquee selection completion
    if (marqueeRect && activeTool === 'select') {
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

      // Check text annotations (approximate bounding box)
      textAnnotations.forEach(text => {
        // Estimate text size (rough approximation)
        const textWidth = text.text.length * (text.fontSize * 0.6);
        const textHeight = text.fontSize * 1.2;
        const textMinX = text.x;
        const textMinY = text.y;
        const textMaxX = text.x + textWidth;
        const textMaxY = text.y + textHeight;

        const intersects = !(
          textMaxX < marqueeBox.minX ||
          textMinX > marqueeBox.maxX ||
          textMaxY < marqueeBox.minY ||
          textMinY > marqueeBox.maxY
        );
        if (intersects) {
          selectedTextIdsNew.add(text.id);
        }
      });

      // Update selections
      const hasSelection = selectedShapeIdsNew.size > 0 || selectedLineIdsNew.size > 0 || selectedTextIdsNew.size > 0;
      if (hasSelection) {
        setSelectedShapeIds(selectedShapeIdsNew);
        setSelectedLineIds(selectedLineIdsNew);
        setSelectedTextIds(selectedTextIdsNew);
      }
      setMarqueeRect(null);
      setDragStart(null);
      return;
    }

    if (previewShape) {
      const isRect = isRectangle(previewShape) && (previewShape as RectangleShape).width > 5;
      const isCirc = isCircle(previewShape) && (previewShape as CircleShape).radius > 5;

      if (isRect || isCirc) {
        const newShape = previewShape;
        setShapes([...shapes, newShape]);

        // Auto-switch to selection tool after drawing (unless locked)
        if (!isToolLocked) {
          setActiveTool('select');
          setSelectedShapeIds(new Set([newShape.id]));
        }
      }
      setPreviewShape(null);
    }

    // Auto-switch after pen stroke (unless locked)
    if (activeTool === ToolType.PEN && lines.length > 0 && !isToolLocked) {
      // Don't auto-switch for pen as it's often used for continuous drawing
      // Only switch if user explicitly wants single-stroke mode
    }

    setDragStart(null);
  };



  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-[#0B0C10] select-none"
      onMouseMove={handlePointerMove}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onMouseLeave={() => setCursorPos(null)}
    >
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
      />

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
            x={selectionBoundingBox.x - 4}
            y={selectionBoundingBox.y - 4}
            width={selectionBoundingBox.width + 8}
            height={selectionBoundingBox.height + 8}
            fill="none"
            stroke="#2dd4bf"
            strokeWidth={1.5}
            strokeDasharray="6,4"
            rx={2}
            filter="url(#selection-glow)"
          />

          {/* Corner handles with shadows and cursor hints */}
          {[
            { x: selectionBoundingBox.minX, y: selectionBoundingBox.minY, cursor: 'nwse-resize' }, // Top-left
            { x: selectionBoundingBox.maxX, y: selectionBoundingBox.minY, cursor: 'nesw-resize' }, // Top-right
            { x: selectionBoundingBox.maxX, y: selectionBoundingBox.maxY, cursor: 'nwse-resize' }, // Bottom-right
            { x: selectionBoundingBox.minX, y: selectionBoundingBox.maxY, cursor: 'nesw-resize' }, // Bottom-left
          ].map((corner, i) => (
            <g key={`corner-${i}`} style={{ pointerEvents: 'auto', cursor: corner.cursor }}>
              <rect
                x={corner.x - 6}
                y={corner.y - 6}
                width={12}
                height={12}
                fill="#0f1419"
                stroke="#2dd4bf"
                strokeWidth={2}
                rx={2}
                filter="url(#handle-shadow)"
              />
              {/* Inner highlight */}
              <rect
                x={corner.x - 3}
                y={corner.y - 3}
                width={6}
                height={6}
                fill="#2dd4bf"
                rx={1}
              />
            </g>
          ))}

          {/* Midpoint handles with shadows */}
          {[
            { x: selectionBoundingBox.centerX, y: selectionBoundingBox.minY, cursor: 'ns-resize' }, // Top-center
            { x: selectionBoundingBox.maxX, y: selectionBoundingBox.centerY, cursor: 'ew-resize' }, // Right-center
            { x: selectionBoundingBox.centerX, y: selectionBoundingBox.maxY, cursor: 'ns-resize' }, // Bottom-center
            { x: selectionBoundingBox.minX, y: selectionBoundingBox.centerY, cursor: 'ew-resize' }, // Left-center
          ].map((mid, i) => (
            <g key={`mid-${i}`} style={{ pointerEvents: 'auto', cursor: mid.cursor }}>
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
              {/* Inner dot */}
              <circle
                cx={mid.x}
                cy={mid.y}
                r={2}
                fill="#2dd4bf"
              />
            </g>
          ))}

          {/* Rotation handle (top-center, above the box) */}
          <g style={{ pointerEvents: 'auto', cursor: 'grab' }}>
            {/* Connection line */}
            <line
              x1={selectionBoundingBox.centerX}
              y1={selectionBoundingBox.minY - 4}
              x2={selectionBoundingBox.centerX}
              y2={selectionBoundingBox.minY - 24}
              stroke="#2dd4bf"
              strokeWidth={1.5}
              strokeDasharray="3,2"
            />
            {/* Rotation circle */}
            <circle
              cx={selectionBoundingBox.centerX}
              cy={selectionBoundingBox.minY - 30}
              r={8}
              fill="#0f1419"
              stroke="#2dd4bf"
              strokeWidth={2}
              filter="url(#handle-shadow)"
            />
            {/* Rotation icon (curved arrow) */}
            <path
              d={`M ${selectionBoundingBox.centerX - 3} ${selectionBoundingBox.minY - 32} 
                  A 4 4 0 1 1 ${selectionBoundingBox.centerX + 3} ${selectionBoundingBox.minY - 28}`}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </g>
        </svg>
      )}

      {/* LAYER 3: KONVA (Drawings) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <Stage
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
            }}
            className="whitespace-pre p-1 select-none"
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
    </div>
  );
}